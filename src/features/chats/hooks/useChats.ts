import type { Chat, ChatMessage, MessageCursor } from '../types';
import { useCallback, useEffect, useRef, useState } from "react";
import { getChatMessages, getChats, getMessageImageUploadUrl, openDirectChat, sendChatMessage } from "../api/chatsApi";
import { useChatSocket } from './useChatSocket';
import type { NewSocketMessageEvent, PresenceSocketSnapshotEvent, PresenceSocketUpdateEvent, SendSocketMessagePayload, TypingSocketUpdateEvent } from '../socket/chatSocketTypes';
import useAuth from '../../auth/hooks/useAuth';
import { playMessageNotificationSound } from '../utils/notificationSound';
import { uploadToSignedUrl } from '../../../shared/utils/uploadToSignedUrl';

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

const getUnreadDividerMessageId = (chat: Chat, messages: ChatMessage[], currentUserId?: string) => {
    if (chat.unreadCount <= 0 || messages.length === 0 || !currentUserId) {
        return null;
    }

    const isUnreadCandidate = (message: ChatMessage) => message.senderId !== currentUserId;

    if (chat.lastReadMessageId) {
        const lastReadMessageIndex = messages.findIndex((message) => message.id === chat.lastReadMessageId);

        if (lastReadMessageIndex >= 0) {
            return messages.slice(lastReadMessageIndex + 1).find(isUnreadCandidate)?.id ?? null;
        }
    }

    let unreadMessagesSeen = 0;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];

        if (!message || !isUnreadCandidate(message)) {
            continue;
        }

        unreadMessagesSeen += 1;

        if (unreadMessagesSeen === chat.unreadCount) {
            return message.id;
        }
    }

    return null;
};

const getTypingKey = (chatId: string, userId: string) => `${chatId}:${userId}`;

export function useChats(isChatViewActive: boolean) {
    const { user } = useAuth();
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
    const [newMessagesDividerMessageId, setNewMessagesDividerMessageId] = useState<string | null>(null);
    const [typingUserIdsByChatId, setTypingUserIdsByChatId] = useState<Record<string, string[]>>({});
    const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const activeMessageRequestChatIdRef = useRef<string | null>(null);
    const selectedChatIdRef = useRef<string | null>(null);
    const isChatViewActiveRef = useRef(isChatViewActive);
    const messagesRef = useRef<ChatMessage[]>([]);
    const isSendingMessageRef = useRef(false);
    const markSocketChatReadRef = useRef<((payload: { chatId: string; lastReadMessageId: string }) => Promise<boolean>) | null>(null);
    const pendingReadRef = useRef<{ chatId: string; lastReadMessageId: string } | null>(null);
    const isFlushingPendingReadRef = useRef(false);
    const readDebounceTimeoutRef = useRef<number | null>(null);
    const dividerTimeoutRef = useRef<number | null>(null);
    const typingTimeoutsRef = useRef<Record<string, number>>({});
    const hiddenUnreadDividerByChatIdRef = useRef<Record<string, string>>({});

    const removeTypingUser = useCallback((chatId: string, typingUserId: string) => {
        const typingKey = getTypingKey(chatId, typingUserId);

        if (typingTimeoutsRef.current[typingKey] !== undefined) {
            window.clearTimeout(typingTimeoutsRef.current[typingKey]);
            delete typingTimeoutsRef.current[typingKey];
        }

        setTypingUserIdsByChatId((currentTypingUserIdsByChatId) => {
            const currentTypingUserIds = currentTypingUserIdsByChatId[chatId];

            if (!currentTypingUserIds?.includes(typingUserId)) {
                return currentTypingUserIdsByChatId;
            }

            const nextTypingUserIds = currentTypingUserIds.filter((currentUserId) => currentUserId !== typingUserId);

            if (nextTypingUserIds.length === 0) {
                const remainingTypingUserIdsByChatId = { ...currentTypingUserIdsByChatId };
                delete remainingTypingUserIdsByChatId[chatId];
                return remainingTypingUserIdsByChatId;
            }

            return {
                ...currentTypingUserIdsByChatId,
                [chatId]: nextTypingUserIds,
            };
        });
    }, []);

    const clearReadDebounceTimeout = useCallback(() => {
        if (readDebounceTimeoutRef.current !== null) {
            window.clearTimeout(readDebounceTimeoutRef.current);
            readDebounceTimeoutRef.current = null;
        }
    }, []);

    const flushPendingRead = useCallback(() => {
        const pendingRead = pendingReadRef.current;
        const markSocketChatRead = markSocketChatReadRef.current;

        clearReadDebounceTimeout();

        if (!pendingRead || !markSocketChatRead || isFlushingPendingReadRef.current) {
            return;
        }

        isFlushingPendingReadRef.current = true;

        void markSocketChatRead(pendingRead).then((didMarkRead) => {
            const currentPendingRead = pendingReadRef.current;

            if (!currentPendingRead) {
                return;
            }

            const isSamePendingRead =
                currentPendingRead.chatId === pendingRead.chatId &&
                currentPendingRead.lastReadMessageId === pendingRead.lastReadMessageId;

            if (didMarkRead && isSamePendingRead) {
                pendingReadRef.current = null;
                return;
            }
        }).finally(() => {
            const currentPendingRead = pendingReadRef.current;
            const hasNewerPendingRead = !!currentPendingRead && (
                currentPendingRead.chatId !== pendingRead.chatId ||
                currentPendingRead.lastReadMessageId !== pendingRead.lastReadMessageId
            );

            isFlushingPendingReadRef.current = false;

            if (hasNewerPendingRead) {
                window.setTimeout(() => {
                    flushPendingRead();
                }, 0);
            }
        });
    }, [clearReadDebounceTimeout]);

    const scheduleMarkChatRead = useCallback((chatId: string, lastReadMessageId: string) => {
        pendingReadRef.current = { chatId, lastReadMessageId };
        clearReadDebounceTimeout();
        readDebounceTimeoutRef.current = window.setTimeout(() => {
            flushPendingRead();
        }, 350);
    }, [clearReadDebounceTimeout, flushPendingRead]);

    const clearChatUnread = useCallback((chatId: string, lastReadMessageId?: string | null) => {
        setChats((currentChats) => currentChats.map((chat) =>
            chat.id === chatId
                ? {
                    ...chat,
                    unreadCount: 0,
                    lastReadMessageId: lastReadMessageId ?? chat.lastReadMessageId,
                }
                : chat
        ));

        setSelectedChat((currentChat) =>
            currentChat?.id === chatId
                ? {
                    ...currentChat,
                    unreadCount: 0,
                    lastReadMessageId: lastReadMessageId ?? currentChat.lastReadMessageId,
                }
                : currentChat
        );
    }, []);

    const showNewMessagesDivider = useCallback((dividerMessageId: string | null) => {
        setNewMessagesDividerMessageId(dividerMessageId);

        if (dividerTimeoutRef.current !== null) {
            window.clearTimeout(dividerTimeoutRef.current);
            dividerTimeoutRef.current = null;
        }

        if (dividerMessageId) {
            dividerTimeoutRef.current = window.setTimeout(() => {
                setNewMessagesDividerMessageId(null);
                dividerTimeoutRef.current = null;
            }, 4000);
        }
    }, []);

    const showUnreadDivider = useCallback((chat: Chat, loadedMessages: ChatMessage[]) => {
        showNewMessagesDivider(getUnreadDividerMessageId(chat, loadedMessages, user?.id));
    }, [showNewMessagesDivider, user?.id]);

    const handleNewSocketMessage = useCallback((event: NewSocketMessageEvent) => {
        const { chatId, message } = event;
        const isOwnMessage = message.senderId === user?.id;
        const isSelectedChat = selectedChatIdRef.current === chatId;
        const isViewingSelectedChat = isSelectedChat && isChatViewActiveRef.current;
        const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const shouldMarkRead = !isOwnMessage && isViewingSelectedChat && !isTabHidden;
        const shouldShowHiddenDividerOnReturn = !isOwnMessage && isViewingSelectedChat && isTabHidden;

        if (!isOwnMessage && (isTabHidden || !isViewingSelectedChat)) {
            playMessageNotificationSound();
        }

        if (shouldShowHiddenDividerOnReturn && !hiddenUnreadDividerByChatIdRef.current[chatId]) {
            hiddenUnreadDividerByChatIdRef.current[chatId] = message.id;
        }

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
            const shouldIncrementUnread = !isOwnMessage && (!isViewingSelectedChat || isTabHidden);

            if (!chat) {
                return currentChats;
            }

            return [
                {
                    ...chat,
                    lastMessage: message,
                    updatedAt: message.createdAt,
                    unreadCount: shouldIncrementUnread ? chat.unreadCount + 1 : 0,
                    lastReadMessageId: shouldMarkRead ? message.id : chat.lastReadMessageId,
                },
                ...currentChats.filter((currentChat) => currentChat.id !== chatId)
            ];
        });

        if (shouldMarkRead) {
            clearChatUnread(chatId, message.id);
            scheduleMarkChatRead(chatId, message.id);
        }
    }, [clearChatUnread, scheduleMarkChatRead, user?.id]);

    const handleSocketError = useCallback((message: string) => {
        setError(message);
    }, []);

    const mergeOnlineUserIds = useCallback((nextOnlineUserIds: string[]) => {
        const filteredOnlineUserIds = nextOnlineUserIds.filter((onlineUserId) => onlineUserId !== user?.id);

        if (filteredOnlineUserIds.length === 0) {
            return;
        }

        setOnlineUserIds((currentOnlineUserIds) => [
            ...new Set([...currentOnlineUserIds, ...filteredOnlineUserIds]),
        ]);
    }, [user?.id]);

    const handleJoinedSocketChat = useCallback((chat: Chat, joinedOnlineUserIds: string[]) => {
        setChats((currentChats) => upsertChatToTop(currentChats, chat));
        mergeOnlineUserIds(joinedOnlineUserIds);
    }, [mergeOnlineUserIds]);

    const handleTypingUpdate = useCallback((event: TypingSocketUpdateEvent) => {
        if (event.userId === user?.id) {
            return;
        }

        if (!event.isTyping) {
            removeTypingUser(event.chatId, event.userId);
            return;
        }

        const typingKey = getTypingKey(event.chatId, event.userId);

        if (typingTimeoutsRef.current[typingKey] !== undefined) {
            window.clearTimeout(typingTimeoutsRef.current[typingKey]);
        }

        typingTimeoutsRef.current[typingKey] = window.setTimeout(() => {
            removeTypingUser(event.chatId, event.userId);
        }, 3000);

        setTypingUserIdsByChatId((currentTypingUserIdsByChatId) => {
            const currentTypingUserIds = currentTypingUserIdsByChatId[event.chatId] ?? [];

            if (currentTypingUserIds.includes(event.userId)) {
                return currentTypingUserIdsByChatId;
            }

            return {
                ...currentTypingUserIdsByChatId,
                [event.chatId]: [...currentTypingUserIds, event.userId],
            };
        });
    }, [removeTypingUser, user?.id]);

    const handlePresenceSnapshot = useCallback((event: PresenceSocketSnapshotEvent) => {
        setOnlineUserIds(event.onlineUserIds.filter((onlineUserId) => onlineUserId !== user?.id));
    }, [user?.id]);

    const handlePresenceUpdate = useCallback((event: PresenceSocketUpdateEvent) => {
        if (event.userId === user?.id) {
            return;
        }

        setOnlineUserIds((currentOnlineUserIds) => {
            if (event.isOnline) {
                return currentOnlineUserIds.includes(event.userId)
                    ? currentOnlineUserIds
                    : [...currentOnlineUserIds, event.userId];
            }

            return currentOnlineUserIds.filter((onlineUserId) => onlineUserId !== event.userId);
        });
    }, [user?.id]);

    const { isConnected, joinSocketChat, sendSocketMessage, markSocketChatRead, startTyping, stopTyping } = useChatSocket({
        onJoinedChat: handleJoinedSocketChat,
        onNewMessage: handleNewSocketMessage,
        onTypingUpdate: handleTypingUpdate,
        onPresenceSnapshot: handlePresenceSnapshot,
        onPresenceUpdate: handlePresenceUpdate,
        onError: handleSocketError
    });
    const selectedChatId = selectedChat?.id ?? null;

    useEffect(() => {
        selectedChatIdRef.current = selectedChatId;

        if (!selectedChatId) {
            activeMessageRequestChatIdRef.current = null;
        }
    }, [selectedChatId]);

    useEffect(() => {
        isChatViewActiveRef.current = isChatViewActive;
    }, [isChatViewActive]);

    useEffect(() => {
        if (!isChatViewActive || document.visibilityState !== 'visible') {
            return;
        }

        const chatId = selectedChatIdRef.current;
        const latestMessageId = messages[messages.length - 1]?.id;

        if (!chatId || !latestMessageId) {
            return;
        }

        const currentChat = chats.find((chat) => chat.id === chatId);

        if (!currentChat || currentChat.unreadCount <= 0) {
            return;
        }

        showUnreadDivider(currentChat, messages);
        clearChatUnread(chatId, latestMessageId);
        scheduleMarkChatRead(chatId, latestMessageId);
    }, [chats, clearChatUnread, isChatViewActive, messages, scheduleMarkChatRead, showUnreadDivider]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        markSocketChatReadRef.current = markSocketChatRead;
    }, [markSocketChatRead]);

    useEffect(() => {
        if (isConnected) {
            flushPendingRead();
        }
    }, [flushPendingRead, isConnected]);

    useEffect(() => () => {
        flushPendingRead();

        if (dividerTimeoutRef.current !== null) {
            window.clearTimeout(dividerTimeoutRef.current);
            dividerTimeoutRef.current = null;
        }

        Object.values(typingTimeoutsRef.current).forEach((typingTimeoutId) => {
            window.clearTimeout(typingTimeoutId);
        });
        typingTimeoutsRef.current = {};
    }, [flushPendingRead]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            const chatId = selectedChatIdRef.current;
            const latestMessageId = messages[messages.length - 1]?.id;

            if (!chatId || !latestMessageId || !isChatViewActiveRef.current) {
                return;
            }

            const hiddenDividerMessageId = hiddenUnreadDividerByChatIdRef.current[chatId] ?? null;
            delete hiddenUnreadDividerByChatIdRef.current[chatId];
            showNewMessagesDivider(hiddenDividerMessageId);
            clearChatUnread(chatId, latestMessageId);
            scheduleMarkChatRead(chatId, latestMessageId);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [clearChatUnread, messages, scheduleMarkChatRead, showNewMessagesDivider]);

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

            const selectedChatId = selectedChatIdRef.current;
            const refreshedSelectedChat = selectedChatId
                ? loadedChats.find((chat) => chat.id === selectedChatId)
                : null;

            if (refreshedSelectedChat) {
                setSelectedChat((currentChat) =>
                    currentChat?.id === refreshedSelectedChat.id
                        ? {
                            ...refreshedSelectedChat,
                            unreadCount: currentChat.unreadCount,
                            lastReadMessageId: currentChat.lastReadMessageId,
                        }
                        : currentChat
                );

                const latestKnownMessageId = messagesRef.current[messagesRef.current.length - 1]?.id;
                const refreshedLastMessageId = refreshedSelectedChat.lastMessage?.id;

                if (refreshedLastMessageId && refreshedLastMessageId !== latestKnownMessageId) {
                    const messagePage = await getChatMessages(refreshedSelectedChat.id);

                    if (selectedChatIdRef.current !== refreshedSelectedChat.id) {
                        return;
                    }

                    const mergedMessages = mergeMessagesById([...messagePage.messages, ...messagesRef.current]);
                    setMessages(mergedMessages);
                    messagesRef.current = mergedMessages;
                    setNextCursor(messagePage.nextCursor);
                    setHasMoreMessages(messagePage.hasMore);
                    setMessageCacheByChatId((currentCache) => ({
                        ...currentCache,
                        [refreshedSelectedChat.id]: {
                            messages: mergedMessages,
                            nextCursor: messagePage.nextCursor,
                            hasMoreMessages: messagePage.hasMore,
                        },
                    }));

                    showUnreadDivider(refreshedSelectedChat, mergedMessages);

                    const latestMessageId = mergedMessages[mergedMessages.length - 1]?.id;

                    if (latestMessageId && document.visibilityState === 'visible' && isChatViewActiveRef.current) {
                        clearChatUnread(refreshedSelectedChat.id, latestMessageId);
                        scheduleMarkChatRead(refreshedSelectedChat.id, latestMessageId);
                    }
                }
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load chats.");
        }
        finally {
            setIsLoadingChats(false);
        }
    }, [clearChatUnread, hasLoadedChats, scheduleMarkChatRead, showUnreadDivider]);

    const selectChat = useCallback(async (chatId: string) => {
        if (selectedChat?.id === chatId) {
            return;
        }

        setError(null);
        flushPendingRead();

        try {
            const chat = chats.find((currentChat) => currentChat.id === chatId) ?? null;
            setSelectedChat(chat ? { ...chat, unreadCount: 0 } : null);
            activeMessageRequestChatIdRef.current = chatId;
            selectedChatIdRef.current = chatId;
            clearChatUnread(chatId);

            const cachedMessages = messageCacheByChatId[chatId];

            if (cachedMessages) {
                setMessages(cachedMessages.messages);
                setNextCursor(cachedMessages.nextCursor);
                setHasMoreMessages(cachedMessages.hasMoreMessages);
                if (chat) {
                    showUnreadDivider(chat, cachedMessages.messages);
                }
                const latestMessageId = cachedMessages.messages[cachedMessages.messages.length - 1]?.id;
                if (latestMessageId) {
                    clearChatUnread(chatId, latestMessageId);
                    scheduleMarkChatRead(chatId, latestMessageId);
                }
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

                if (chat) {
                    showUnreadDivider(chat, mergedMessages);
                }
                const latestMessageId = mergedMessages[mergedMessages.length - 1]?.id;
                if (latestMessageId) {
                    clearChatUnread(chatId, latestMessageId);
                    scheduleMarkChatRead(chatId, latestMessageId);
                }

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
    }, [chats, clearChatUnread, flushPendingRead, messageCacheByChatId, scheduleMarkChatRead, selectedChat?.id, showUnreadDivider]);

    const startDirectChat = useCallback(async (friendId: string) => {
        setIsLoadingChats(true);
        setIsLoadingMessages(true);
        setError(null);
        flushPendingRead();

        try {
            const chat = await openDirectChat(friendId);
            setSelectedChat({ ...chat, unreadCount: 0 });
            activeMessageRequestChatIdRef.current = chat.id;
            selectedChatIdRef.current = chat.id;
            clearChatUnread(chat.id);
            setChats((currentChats) => {
                const readChat = { ...chat, unreadCount: 0 };

                if (currentChats.some((currentChat) => currentChat.id === chat.id)) {
                    return currentChats.map((currentChat) =>
                        currentChat.id === chat.id ? readChat : currentChat
                    );
                }

                return [readChat, ...currentChats];
            });
            const cachedMessages = messageCacheByChatId[chat.id];

            if (cachedMessages) {
                setMessages(cachedMessages.messages);
                setNextCursor(cachedMessages.nextCursor);
                setHasMoreMessages(cachedMessages.hasMoreMessages);
                showUnreadDivider(chat, cachedMessages.messages);
                const latestMessageId = cachedMessages.messages[cachedMessages.messages.length - 1]?.id;
                if (latestMessageId) {
                    clearChatUnread(chat.id, latestMessageId);
                    scheduleMarkChatRead(chat.id, latestMessageId);
                }
            }
            else {
                setMessages([]);
                setNextCursor(null);
                setHasMoreMessages(false);
            }
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

                    showUnreadDivider(chat, mergedMessages);
                    const latestMessageId = mergedMessages[mergedMessages.length - 1]?.id;
                    if (latestMessageId) {
                        clearChatUnread(chat.id, latestMessageId);
                        scheduleMarkChatRead(chat.id, latestMessageId);
                    }

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
    }, [clearChatUnread, flushPendingRead, messageCacheByChatId, scheduleMarkChatRead, showUnreadDivider]);

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

    const sendMessagePayload = useCallback(async (payload: { text?: string; imageKey?: string }) => {
        if (!selectedChat || isSendingMessageRef.current) return false;

        const trimmedText = payload.text?.trim();
        const imageKey = payload.imageKey?.trim();
        if (!trimmedText && !imageKey) return false;

        isSendingMessageRef.current = true;
        setIsSendingMessage(true);
        setError(null);

        try {
            const socketPayload: SendSocketMessagePayload = {
                chatId: selectedChat.id,
                ...(trimmedText && { text: trimmedText }),
                ...(imageKey && { imageKey })
            };

            const sentMessage = isConnected
                ? await sendSocketMessage(socketPayload)
                : await sendChatMessage(selectedChat.id, {
                    ...(trimmedText && { text: trimmedText }),
                    ...(imageKey && { imageKey })
                });
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
                        unreadCount: 0,
                        lastReadMessageId: sentMessage.id,
                    },
                    ...currentChats.filter((chat) => chat.id !== selectedChat.id)
                ]
            });

            clearChatUnread(selectedChat.id, sentMessage.id);
            scheduleMarkChatRead(selectedChat.id, sentMessage.id);

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

    }, [clearChatUnread, hasMoreMessages, isConnected, nextCursor, scheduleMarkChatRead, selectedChat, sendSocketMessage]);

    const sendMessage = useCallback(async (text: string) => {
        return sendMessagePayload({ text });
    }, [sendMessagePayload]);

    const sendImageMessage = useCallback(async (file: File, caption: string) => {
        if (!selectedChat || isSendingMessageRef.current) return false;

        setError(null);

        try {
            const { uploadUrl, contentType, key } = await getMessageImageUploadUrl(file);
            await uploadToSignedUrl(uploadUrl, file, contentType);
            return await sendMessagePayload({
                text: caption,
                imageKey: key,
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send image.");
            return false;
        }
    }, [selectedChat, sendMessagePayload]);

    return {
        chats,
        selectedChat,
        messages,
        nextCursor,
        hasMoreMessages,
        isLoadingChats,
        isLoadingMessages,
        isSendingMessage,
        newMessagesDividerMessageId,
        typingUserIds: selectedChat ? typingUserIdsByChatId[selectedChat.id] ?? [] : [],
        onlineUserIds,
        isChatSocketConnected: isConnected,
        joinSocketChat,
        startTyping,
        stopTyping,
        loadError: error,
        loadChats,
        selectChat,
        startDirectChat,
        loadMoreMessages,
        sendMessage,
        sendImageMessage,
    };
}
