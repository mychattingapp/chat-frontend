import type { Chat, ChatMessage, MessageCursor } from '../types';
import { useCallback, useEffect, useRef, useState } from "react";
import { getChatMessages, getChats, getMessageImageUploadUrl, openDirectChat, sendChatMessage } from "../api/chatsApi";
import { useChatSocket } from './useChatSocket';
import type { NewSocketMessageEvent, PresenceSocketSnapshotEvent, PresenceSocketUpdateEvent, SendSocketMessagePayload, TypingSocketUpdateEvent } from '../socket/chatSocketTypes';
import useAuth from '../../auth/hooks/useAuth';
import { playMessageNotificationSound } from '../utils/notificationSound';
import { uploadToSignedUrl } from '../../../shared/utils/uploadToSignedUrl';
import { mergeMessagesById, recoverMessages } from '../utils/recoverMessages';

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

const upsertChatToTop = (currentChats: Chat[], chat: Chat) => [
    chat,
    ...currentChats.filter((currentChat) => currentChat.id !== chat.id),
];

const mergeRecoveredChats = (
    snapshot: Chat[], currentChats: Chat[], updatedChatIds: Set<string>,
    liveMessages: NewSocketMessageEvent[], currentUserId?: string,
) => {
    const merged = new Map(snapshot.map(chat => [chat.id, chat]));
    // Keep a locally joined chat if the list request has not observed it yet.
    for (const chat of currentChats) {
        if (updatedChatIds.has(chat.id) && !merged.has(chat.id)) merged.set(chat.id, chat);
    }
    // During initial loading there may be no local chat to update. Apply only
    // messages newer than the snapshot's last message to avoid counting twice.
    for (const { chatId, message } of liveMessages) {
        const chat = merged.get(chatId);
        if (!chat) continue;
        const lastMessage = chat.lastMessage;
        if (lastMessage && (lastMessage.id === message.id ||
            new Date(lastMessage.createdAt).getTime() > new Date(message.createdAt).getTime() ||
            (lastMessage.createdAt === message.createdAt && lastMessage.id.localeCompare(message.id) >= 0))) continue;
        merged.set(chatId, {
            ...chat, lastMessage: message, updatedAt: message.createdAt,
            unreadCount: chat.unreadCount + (message.senderId !== currentUserId ? 1 : 0),
        });
    }
    return [...merged.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

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
    const recoveryNeededRef = useRef(true);
    const recoveryBoundaryRef = useRef<{ chatId: string; messageId?: string } | null>(null);
    const synchronizeRef = useRef<(isRetry?: boolean) => void>(() => undefined);
    const recoveryRetryTimeoutRef = useRef<number | null>(null);
    const recoveryRetryCountRef = useRef(0);
    const socketReadyRef = useRef(false);
    const recoveryRunningRef = useRef(false);
    const recoveryQueuedRef = useRef(false);
    const recoveryGenerationRef = useRef(0);
    const recoveryRevisionRef = useRef(0);
    const mountedRef = useRef(false);
    const recoveryChatUpdatesRef = useRef(new Set<string>());
    const recoveryLiveMessagesRef = useRef<NewSocketMessageEvent[]>([]);
    const cacheRef = useRef(messageCacheByChatId);
    const historyProgressRef = useRef<{ chatId: string; nextCursor: MessageCursor | null; hasMoreMessages: boolean } | null>(null);
    useEffect(() => { cacheRef.current = messageCacheByChatId; }, [messageCacheByChatId]);

    const requireRecovery = useCallback(() => {
        recoveryRevisionRef.current += 1;
        recoveryNeededRef.current = true;
        if (!recoveryBoundaryRef.current && selectedChatIdRef.current) {
            recoveryBoundaryRef.current = {
                chatId: selectedChatIdRef.current,
                messageId: messagesRef.current.at(-1)?.id,
            };
        }
    }, []);
    const clearRecoveryRetry = useCallback(() => {
        if (recoveryRetryTimeoutRef.current !== null) {
            window.clearTimeout(recoveryRetryTimeoutRef.current);
            recoveryRetryTimeoutRef.current = null;
        }
    }, []);
    const handleSocketDisconnected = useCallback(() => {
        socketReadyRef.current = false;
        clearRecoveryRetry();
        requireRecovery();
    }, [clearRecoveryRetry, requireRecovery]);
    const handleSocketReady = useCallback(() => {
        socketReadyRef.current = true;
        synchronizeRef.current();
    }, []);

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

        if (!pendingRead || !markSocketChatRead || isFlushingPendingReadRef.current || recoveryNeededRef.current) {
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
        if (recoveryRunningRef.current) {
            recoveryChatUpdatesRef.current.add(chatId);
            recoveryLiveMessagesRef.current.push(event);
        }
        const isOwnMessage = message.senderId === user?.id;
        const isSelectedChat = selectedChatIdRef.current === chatId;
        const isViewingSelectedChat = isSelectedChat && isChatViewActiveRef.current;
        const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const shouldMarkRead = !isOwnMessage && isViewingSelectedChat && !isTabHidden && !recoveryNeededRef.current;
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
            const shouldIncrementUnread = !isOwnMessage && (!isViewingSelectedChat || isTabHidden || recoveryNeededRef.current);

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
        if (recoveryRunningRef.current) recoveryChatUpdatesRef.current.add(chat.id);
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

    const { isConnected, reconnect, joinSocketChat, sendSocketMessage, markSocketChatRead, startTyping, stopTyping } = useChatSocket({
        onReady: handleSocketReady,
        onDisconnected: handleSocketDisconnected,
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
        if (!isChatViewActive || document.visibilityState !== 'visible' || recoveryNeededRef.current) {
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
                requireRecovery();
                return;
            }

            synchronizeRef.current();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [requireRecovery]);

    const synchronize = useCallback(async (isRetry = false) => {
        clearRecoveryRetry();
        if (!isRetry) recoveryRetryCountRef.current = 0;
        if (recoveryRunningRef.current) {
            recoveryQueuedRef.current = true;
            return;
        }
        requireRecovery();
        recoveryRunningRef.current = true;
        const generation = recoveryGenerationRef.current;
        const revision = recoveryRevisionRef.current;
        const chatId = selectedChatIdRef.current;
        recoveryChatUpdatesRef.current = new Set();
        recoveryLiveMessagesRef.current = [];
        const cached = chatId ? cacheRef.current[chatId] : undefined;
        const historyProgress = historyProgressRef.current;
        const boundary = recoveryBoundaryRef.current?.chatId === chatId
            ? recoveryBoundaryRef.current.messageId
            : cached?.messages.at(-1)?.id;
        const isCurrent = () => generation === recoveryGenerationRef.current && selectedChatIdRef.current === chatId;
        // Other conversations must fetch fresh history when opened again.
        setMessageCacheByChatId(current => chatId && current[chatId] ? { [chatId]: current[chatId] } : {});
        try {
            const loadedChats = await getChats("DIRECT");
            if (!isCurrent()) return;
            const page = chatId ? await recoverMessages(
                cursor => getChatMessages(chatId, cursor), boundary, isCurrent,
            ) : null;
            if (!isCurrent()) return;

            const updatedChatIds = new Set(recoveryChatUpdatesRef.current);
            const liveMessages = [...recoveryLiveMessagesRef.current];
            setChats(current => mergeRecoveredChats(loadedChats, current, updatedChatIds, liveMessages, user?.id));
            setHasLoadedChats(true);
            setError(null);
            recoveryRetryCountRef.current = 0;
            const interrupted = revision !== recoveryRevisionRef.current;
            recoveryNeededRef.current = interrupted;
            if (interrupted) recoveryQueuedRef.current = true;
            else recoveryBoundaryRef.current = null;
            if (chatId && page) {
                const merged = mergeMessagesById([...page.messages, ...messagesRef.current]);
                // History can finish before React commits its cache update.
                const latestCache = historyProgressRef.current !== historyProgress && historyProgressRef.current?.chatId === chatId
                    ? historyProgressRef.current
                    : cacheRef.current[chatId];
                const pagination = latestCache && boundary && page.messages.some(message => message.id === boundary)
                    ? { nextCursor: latestCache.nextCursor, hasMoreMessages: latestCache.hasMoreMessages }
                    : { nextCursor: page.nextCursor, hasMoreMessages: page.hasMore };
                messagesRef.current = merged;
                setMessages(current => mergeMessagesById([...merged, ...current]));
                setNextCursor(pagination.nextCursor);
                setHasMoreMessages(pagination.hasMoreMessages);
                setMessageCacheByChatId(current => ({
                    ...current,
                    [chatId]: { ...pagination, messages: mergeMessagesById([...merged, ...(current[chatId]?.messages ?? [])]) },
                }));
                const chat = loadedChats.find(item => item.id === chatId);
                if (chat) {
                    setSelectedChat(current => current?.id === chatId ? chat : current);
                    showUnreadDivider(chat, merged);
                }
                const hiddenDivider = hiddenUnreadDividerByChatIdRef.current[chatId];
                if (hiddenDivider && document.visibilityState === 'visible') {
                    if (!chat?.unreadCount) showNewMessagesDivider(hiddenDivider);
                    delete hiddenUnreadDividerByChatIdRef.current[chatId];
                }
                const latestMessageId = merged.at(-1)?.id;
                if (!interrupted && latestMessageId && document.visibilityState === 'visible' && isChatViewActiveRef.current) {
                    clearChatUnread(chatId, latestMessageId);
                    scheduleMarkChatRead(chatId, latestMessageId);
                }
            }
            if (!chatId) flushPendingRead();
        }
        catch {
            if (isCurrent() && mountedRef.current) {
                setError("Couldn't sync messages. Please retry.");
                if (socketReadyRef.current && !recoveryQueuedRef.current && recoveryRetryCountRef.current < 3) {
                    const delay = 1000 * 2 ** recoveryRetryCountRef.current;
                    recoveryRetryCountRef.current += 1;
                    recoveryRetryTimeoutRef.current = window.setTimeout(() => {
                        recoveryRetryTimeoutRef.current = null;
                        if (mountedRef.current && socketReadyRef.current) synchronizeRef.current(true);
                    }, delay);
                }
            }
        }
        finally {
            recoveryRunningRef.current = false;
            if (mountedRef.current && (recoveryQueuedRef.current || !isCurrent())) {
                recoveryQueuedRef.current = false;
                synchronizeRef.current();
            }
        }
    }, [clearChatUnread, clearRecoveryRetry, flushPendingRead, requireRecovery, scheduleMarkChatRead, showNewMessagesDivider, showUnreadDivider, user?.id]);

    useEffect(() => {
        synchronizeRef.current = (isRetry) => { void synchronize(isRetry); };
    }, [synchronize]);

    useEffect(() => {
        mountedRef.current = true;
        const handleOnline = () => synchronizeRef.current();
        window.addEventListener('online', handleOnline);
        return () => {
            mountedRef.current = false;
            clearRecoveryRetry();
            recoveryGenerationRef.current += 1;
            window.removeEventListener('online', handleOnline);
        };
    }, [clearRecoveryRetry, user?.id]);

    const loadChats = useCallback(async (force = false) => {
        if (force) reconnect();
        if (!force && hasLoadedChats) {
            return;
        }

        setIsLoadingChats(true);
        setError(null);

        try {
            await synchronize();
        }
        finally {
            setIsLoadingChats(false);
        }
    }, [hasLoadedChats, reconnect, synchronize]);

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

            historyProgressRef.current = { chatId, nextCursor: messagePage.nextCursor, hasMoreMessages: messagePage.hasMore };
            setMessages((currentMessages) => {
                const updatedMessages = mergeMessagesById([...messagePage.messages, ...currentMessages]);

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
