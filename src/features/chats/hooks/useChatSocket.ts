import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import useAuth from "../../auth/hooks/useAuth";
import type { Chat, ChatMessage } from "../types";
import type { ClientToServerEvents, MarkSocketChatReadPayload, NewSocketMessageEvent, PresenceSocketSnapshotEvent, PresenceSocketUpdateEvent, SendSocketMessagePayload, ServerToClientEvents, TypingSocketUpdateEvent } from "../socket/chatSocketTypes";

const BASE_URL = import.meta.env.VITE_BASE_SERVER_URL;

type UseChatSocketOptions = {
    onNewMessage: (event: NewSocketMessageEvent) => void;
    onJoinedChat: (chat: Chat, onlineUserIds: string[]) => void;
    onTypingUpdate: (event: TypingSocketUpdateEvent) => void;
    onPresenceSnapshot: (event: PresenceSocketSnapshotEvent) => void;
    onPresenceUpdate: (event: PresenceSocketUpdateEvent) => void;
    onError: (message: string) => void;
};

export function useChatSocket({ onNewMessage, onJoinedChat, onTypingUpdate, onPresenceSnapshot, onPresenceUpdate, onError }: UseChatSocketOptions) {
    const { user } = useAuth();
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const joinSocketChat = useCallback(async (chatId: string): Promise<{ chat: Chat; onlineUserIds: string[] }> => {
        const socket = socketRef.current;

        if (!socket || !socket.connected) {
            onError("Chat socket is not connected.");
            return Promise.reject(new Error("Chat socket is not connected."));
        }

        const response = await socket.emitWithAck("chat:join", { chatId });

        if (!response.success || !response.data?.chat) {
            const message = response.error?.message ?? "Failed to join chat.";
            onError(message);
            throw new Error(message);
        }

        return {
            chat: response.data.chat,
            onlineUserIds: response.data.onlineUserIds ?? [],
        };
    }, [onError]);

    useEffect(() => {
        if (!user) {
            return;
        }

        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(BASE_URL, {
            withCredentials: true,
        });

        socketRef.current = socket;
        socket.on("connect", () => setIsConnected(true));
        socket.on("disconnect", () => setIsConnected(false));
        socket.on("connect_error", () => onError("Could not connect to chat server."));
        socket.on("message:new", onNewMessage);
        socket.on("typing:update", onTypingUpdate);
        socket.on("presence:snapshot", onPresenceSnapshot);
        socket.on("presence:update", onPresenceUpdate);
        socket.on("chat:new", ({ chatId }) => {
            void joinSocketChat(chatId)
                .then(({ chat, onlineUserIds }) => onJoinedChat(chat, onlineUserIds))
                .catch(() => undefined);
        });

        return () => {
            socketRef.current?.off("message:new", onNewMessage);
            socketRef.current?.off("typing:update", onTypingUpdate);
            socketRef.current?.off("presence:snapshot", onPresenceSnapshot);
            socketRef.current?.off("presence:update", onPresenceUpdate);
            socketRef.current?.off("chat:new");
            socketRef.current?.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        };
    }, [joinSocketChat, onError, onJoinedChat, onNewMessage, onPresenceSnapshot, onPresenceUpdate, onTypingUpdate, user]);

    const sendSocketMessage = useCallback(async (payload: SendSocketMessagePayload): Promise<ChatMessage> => {
        const socket = socketRef.current;

        if (!socket || !socket.connected) {
            onError("Chat socket is not connected.");
            return Promise.reject(new Error("Chat socket is not connected."));
        }

        const response = await socket.emitWithAck("message:send", payload);

        if (!response.success || !response.data?.message) {
            const message = response.error?.message ?? "Failed to send message.";
            onError(message);
            throw new Error(message);
        }

        return response.data.message;
    }, [onError]);

    const markSocketChatRead = useCallback(async (payload: MarkSocketChatReadPayload): Promise<boolean> => {
        const socket = socketRef.current;

        if (!socket || !socket.connected) {
            return false;
        }

        const response = await socket.emitWithAck("chat:read", payload);

        if (!response.success) {
            const message = response.error?.message ?? "Failed to mark chat as read.";
            onError(message);
            return false;
        }

        return true;
    }, [onError]);

    const startTyping = useCallback((chatId: string) => {
        const socket = socketRef.current;

        if (!socket || !socket.connected) {
            return;
        }

        socket.emit("typing:start", { chatId });
    }, []);

    const stopTyping = useCallback((chatId: string) => {
        const socket = socketRef.current;

        if (!socket || !socket.connected) {
            return;
        }

        socket.emit("typing:stop", { chatId });
    }, []);

    return {
        isConnected,
        joinSocketChat,
        sendSocketMessage,
        markSocketChatRead,
        startTyping,
        stopTyping,
    };
}
