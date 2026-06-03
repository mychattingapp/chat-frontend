import type { Chat, ChatMessage, MessageCursor } from '../types';
import { useCallback, useRef, useState } from "react";
import { getChatMessages, getChats, openDirectChat, sendChatMessage } from "../api/chatsApi";

type MessageCacheEntry = {
    messages: ChatMessage[];
    nextCursor: MessageCursor | null;
    hasMoreMessages: boolean;
};

export function useChats() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [nextCursor, setNextCursor] = useState<MessageCursor | null>(null);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [hasLoadedChats, setHasLoadedChats] = useState(false);
    const [messageCacheByChatId, setMessageCacheByChatId] = useState<Record<string, MessageCacheEntry>>({});
    const [error, setError] = useState<string | null>(null);
    const activeMessageRequestChatIdRef = useRef<string | null>(null);

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

            setMessages(messagePage.messages);
            setNextCursor(messagePage.nextCursor);
            setHasMoreMessages(messagePage.hasMore);
            setMessageCacheByChatId((currentCache) => ({
                ...currentCache,
                [chatId]: {
                    messages: messagePage.messages,
                    nextCursor: messagePage.nextCursor,
                    hasMoreMessages: messagePage.hasMore,
                },
            }));
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
                const withoutOpenedChat = currentChats.filter((currentChat) => currentChat.id !== chat.id);
                return [chat, ...withoutOpenedChat];
            });
            setHasLoadedChats(true);

            if (!cachedMessages) {
                const messagePage = await getChatMessages(chat.id);

                if (activeMessageRequestChatIdRef.current !== chat.id) {
                    return false;
                }

                setMessages(messagePage.messages);
                setNextCursor(messagePage.nextCursor);
                setHasMoreMessages(messagePage.hasMore);
                setMessageCacheByChatId((currentCache) => ({
                    ...currentCache,
                    [chat.id]: {
                        messages: messagePage.messages,
                        nextCursor: messagePage.nextCursor,
                        hasMoreMessages: messagePage.hasMore,
                    },
                }));
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
        if (!selectedChat) return false;

        const trimmedText = text.trim();
        if (!trimmedText) return false;

        setError(null);

        try {
            const sentMessage = await sendChatMessage(selectedChat.id, trimmedText);
            setMessages((currentMessages) => {
                const updatedMessages = [...currentMessages, sentMessage];

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

    }, [hasMoreMessages, nextCursor, selectedChat]);

    return {
        chats,
        selectedChat,
        messages,
        nextCursor,
        hasMoreMessages,
        isLoadingChats,
        isLoadingMessages,
        loadError: error,
        loadChats,
        selectChat,
        startDirectChat,
        loadMoreMessages,
        sendMessage,
    };
}
