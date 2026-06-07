import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import useAuth from "../../auth/hooks/useAuth";
import type { Chat, ChatMessage } from "../types";
import type { ClientToServerEvents, NewSocketMessageEvent, SendSocketMessagePayload, ServerToClientEvents } from "../socket/chatSocketTypes";

const BASE_URL = import.meta.env.VITE_BASE_SERVER_URL;

type UseChatSocketOptions = {
    onNewMessage: (event: NewSocketMessageEvent) => void;
    onJoinedChat: (chat: Chat) => void;
    onError: (message: string) => void;
};

export function useChatSocket({ onNewMessage, onJoinedChat, onError }: UseChatSocketOptions) {
    const { user } = useAuth();
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const joinSocketChat = useCallback(async (chatId: string): Promise<Chat> => {
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

        return response.data.chat;
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
        socket.on("chat:new", ({ chatId }) => {
            void joinSocketChat(chatId)
                .then(onJoinedChat)
                .catch(() => undefined);
        });

        return () => {
            socketRef.current?.off("message:new", onNewMessage);
            socketRef.current?.off("chat:new");
            socketRef.current?.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        };
    }, [joinSocketChat, onError, onJoinedChat, onNewMessage, user]);

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

    return {
        isConnected,
        joinSocketChat,
        sendSocketMessage,
    };
}
