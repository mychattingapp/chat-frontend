import type { Chat, ChatMessage, MessageCursor } from '../types';
import { useCallback, useRef, useState } from "react";
import { getChatMessages, getChats, openDirectChat, sendChatMessage } from "../api/chatsApi";
import { useChatSocket } from './useChatSocket';
import type { NewSocketMessageEvent, SendSocketMessagePayload } from '../socket/chatSocketTypes';

type MessageCacheEntry = {
    messages: ChatMessage[];
    nextCursor: MessageCursor | null;
    hasMoreMessages: boolean;
};

const appendMessageIfMissing = (
    currentMessages: ChatMessage[],
    message: ChatMessage
) => {
    if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
        return currentMessages;
    }

    return [...currentMessages, message];
};

const mergeMessagesById = (messages: ChatMessage[]) =>
    [...new Map(messages.map((message) => [message.id, message])).values()].sort((a, b) => {
        const timeDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return timeDifference || a.id.localeCompare(b.id);
    });

const upsertChatToTop = (currentChats: Chat[], chat: Chat) => [
    chat,
    ...currentChats.filter((currentChat) => currentChat.id !== chat.id),
];

export function useChats() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [nextCursor, setNextCursor] = useState<MessageCursor | null>(null);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [hasLoadedChats, setHasLoadedChats] = useState(false);
    const [messageCacheByChatId, setMessageCacheByChatId] = useState<Record<string, MessageCacheEntry>>({});
    const [error, setError] = useState<string | null>(null);
    const activeMessageRequestChatIdRef = useRef<string | null>(null);
    const isSendingMessageRef = useRef(false);

    const handleNewSocketMessage = useCallback((event: NewSocketMessageEvent) => {
        const { chatId, message } = event;

        setMessages((currentMessages) => {
            if (activeMessageRequestChatIdRef.current !== chatId) {
                return currentMessages;
            }

            return appendMessageIfMissing(currentMessages, message);
        });

        setMessageCacheByChatId((currentCache) => {
            const currentChatCache = currentCache[chatId];

            if (!currentChatCache) {
                return currentCache;
            }

            return {
                ...currentCache,
                [chatId]: {
                    ...currentChatCache,
                    messages: appendMessageIfMissing(currentChatCache.messages, message),
                },
            };
        });

        setChats((currentChats) => {
            const chat = currentChats.find((currentChat) => currentChat.id === chatId);

            if (!chat) {
                return currentChats;
            }

            return [
                {
                    ...chat,
                    lastMessage: message,
                    updatedAt: message.createdAt,
                },
                ...currentChats.filter((currentChat) => currentChat.id !== chatId)
            ];
        });
    }, []);

    const handleSocketError = useCallback((message: string) => {
        setError(message);
    }, []);

    const handleJoinedSocketChat = useCallback((chat: Chat) => {
        setChats((currentChats) => upsertChatToTop(currentChats, chat));
    }, []);

    const { isConnected, joinSocketChat, sendSocketMessage } = useChatSocket({
        onJoinedChat: handleJoinedSocketChat,
        onNewMessage: handleNewSocketMessage,
        onError: handleSocketError
    });

    const loadChats = useCallback(async (force = false) => {
        if (!force && hasLoadedChats) {
            return;
        }

        setIsLoadingChats(true);
        setError(null);

        try {
            const loadedChats = await getChats("DIRECT");
            setChats(loadedChats);
            setHasLoadedChats(true);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load chats.");
        }
        finally {
            setIsLoadingChats(false);
        }
    }, [hasLoadedChats]);

    const selectChat = useCallback(async (chatId: string) => {
        if (selectedChat?.id === chatId) {
            return;
        }

        setError(null);

        try {
            const chat = chats.find((currentChat) => currentChat.id === chatId) ?? null;
            setSelectedChat(chat);
            activeMessageRequestChatIdRef.current = chatId;

            const cachedMessages = messageCacheByChatId[chatId];

            if (cachedMessages) {
                setMessages(cachedMessages.messages);
                setNextCursor(cachedMessages.nextCursor);
                setHasMoreMessages(cachedMessages.hasMoreMessages);
                return;
            }

            setIsLoadingMessages(true);
            setMessages([]);
            setNextCursor(null);
            setHasMoreMessages(false);

            const messagePage = await getChatMessages(chatId);

            if (activeMessageRequestChatIdRef.current !== chatId) {
                return;
            }

            setMessages((currentMessages) => {
                const mergedMessages = mergeMessagesById([...messagePage.messages, ...currentMessages]);

                setMessageCacheByChatId((currentCache) => ({
                    ...currentCache,
                    [chatId]: {
                        messages: mergedMessages,
                        nextCursor: messagePage.nextCursor,
                        hasMoreMessages: messagePage.hasMore,
                    },
                }));

                return mergedMessages;
            });
            setNextCursor(messagePage.nextCursor);
            setHasMoreMessages(messagePage.hasMore);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load messages.");
        }
        finally {
            setIsLoadingMessages(false);
        }
    }, [chats, messageCacheByChatId, selectedChat?.id]);

    const startDirectChat = useCallback(async (friendId: string) => {
        setIsLoadingChats(true);
        setIsLoadingMessages(true);
        setError(null);

        try {
            const chat = await openDirectChat(friendId);
            setSelectedChat(chat);
            activeMessageRequestChatIdRef.current = chat.id;
            const cachedMessages = messageCacheByChatId[chat.id];

            if (cachedMessages) {
                setMessages(cachedMessages.messages);
                setNextCursor(cachedMessages.nextCursor);
                setHasMoreMessages(cachedMessages.hasMoreMessages);
            }
            else {
                setMessages([]);
                setNextCursor(null);
                setHasMoreMessages(false);
            }
            setChats((currentChats) => {
                if (currentChats.some((currentChat) => currentChat.id === chat.id)) {
                    return currentChats.map((currentChat) =>
                        currentChat.id === chat.id ? chat : currentChat
                    );
                }

                return [chat, ...currentChats];
            });
            setHasLoadedChats(true);

            if (!cachedMessages) {
                const messagePage = await getChatMessages(chat.id);

                if (activeMessageRequestChatIdRef.current !== chat.id) {
                    return false;
                }

                setMessages((currentMessages) => {
                    const mergedMessages = mergeMessagesById([...messagePage.messages, ...currentMessages]);

                    setMessageCacheByChatId((currentCache) => ({
                        ...currentCache,
                        [chat.id]: {
                            messages: mergedMessages,
                            nextCursor: messagePage.nextCursor,
                            hasMoreMessages: messagePage.hasMore,
                        },
                    }));

                    return mergedMessages;
                });
                setNextCursor(messagePage.nextCursor);
                setHasMoreMessages(messagePage.hasMore);
            }
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to open chat.");
            return false;
        }
        finally {
            setIsLoadingChats(false);
            setIsLoadingMessages(false);
        }
    }, [messageCacheByChatId]);

    const loadMoreMessages = useCallback(async () => {
        if (!selectedChat || !nextCursor) return false;

        setIsLoadingMessages(true);
        setError(null);

        try {
            const chatId = selectedChat.id;
            const messagePage = await getChatMessages(selectedChat.id, nextCursor);

            if (activeMessageRequestChatIdRef.current !== chatId) {
                return false;
            }

            setMessages((currentMessages) => {
                const updatedMessages = [...messagePage.messages, ...currentMessages];

                setMessageCacheByChatId((currentCache) => ({
                    ...currentCache,
                    [chatId]: {
                        messages: updatedMessages,
                        nextCursor: messagePage.nextCursor,
                        hasMoreMessages: messagePage.hasMore,
                    },
                }));

                return updatedMessages;
            });
            setNextCursor(messagePage.nextCursor);
            setHasMoreMessages(messagePage.hasMore);
            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load more messages.");
            return false;
        }
        finally {
            setIsLoadingMessages(false);
        }

    }, [selectedChat, nextCursor]);

    const sendMessage = useCallback(async (text: string) => {
        if (!selectedChat || isSendingMessageRef.current) return false;

        const trimmedText = text.trim();
        if (!trimmedText) return false;

        isSendingMessageRef.current = true;
        setIsSendingMessage(true);
        setError(null);

        try {
            const payload: SendSocketMessagePayload = {
                chatId: selectedChat.id,
                text: trimmedText
            };

            const sentMessage = isConnected
                ? await sendSocketMessage(payload)
                : await sendChatMessage(selectedChat.id, trimmedText);
            setMessages((currentMessages) => {
                const updatedMessages = appendMessageIfMissing(currentMessages, sentMessage);

                setMessageCacheByChatId((currentCache) => ({
                    ...currentCache,
                    [selectedChat.id]: {
                        messages: updatedMessages,
                        nextCursor,
                        hasMoreMessages,
                    },
                }));

                return updatedMessages;
            });

            setChats((currentChats) => {
                const updatedChat = currentChats.find((chat) => chat.id === selectedChat.id);
                if (!updatedChat) return currentChats;

                return [
                    {
                        ...updatedChat,
                        lastMessage: sentMessage,
                        updatedAt: sentMessage.createdAt,
                    },
                    ...currentChats.filter((chat) => chat.id !== selectedChat.id)
                ]
            });

            return true;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send message.");
            return false;
        }
        finally {
            isSendingMessageRef.current = false;
            setIsSendingMessage(false);
        }

    }, [hasMoreMessages, isConnected, nextCursor, selectedChat, sendSocketMessage]);

    return {
        chats,
        selectedChat,
        messages,
        nextCursor,
        hasMoreMessages,
        isLoadingChats,
        isLoadingMessages,
        isSendingMessage,
        isChatSocketConnected: isConnected,
        joinSocketChat,
        loadError: error,
        loadChats,
        selectChat,
        startDirectChat,
        loadMoreMessages,
        sendMessage,
    };
}
