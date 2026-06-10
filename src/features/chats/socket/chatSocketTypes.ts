import type { Chat, ChatMessage } from "../types";

export type SendSocketMessagePayload = {
    chatId: string;
    text: string;
};

export type NewSocketMessageEvent = {
    chatId: string;
    message: ChatMessage;
};

export type NewSocketChatEvent = {
    chatId: string;
};

export type JoinSocketChatPayload = {
    chatId: string;
};

export type MarkSocketChatReadPayload = {
    chatId: string;
    lastReadMessageId: string;
};

export type SendSocketMessageAck = {
    success: boolean;
    data?: {
        message: ChatMessage;
    };
    error?: {
        code: string;
        message: string;
    };
};

export type JoinSocketChatAck = {
    success: boolean;
    data?: {
        chat: Chat;
    };
    error?: {
        code: string;
        message: string;
    };
};

export type MarkSocketChatReadAck = {
    success: boolean;
    error?: {
        code: string;
        message: string;
    };
};

export type ServerToClientEvents = {
    "message:new": (event: NewSocketMessageEvent) => void;
    "chat:new": (event: NewSocketChatEvent) => void;
};

export type ClientToServerEvents = {
    "message:send": (
        payload: SendSocketMessagePayload,
        ack: (response: SendSocketMessageAck) => void
    ) => void;
    "chat:join": (
        payload: JoinSocketChatPayload,
        ack: (response: JoinSocketChatAck) => void
    ) => void;
    "chat:read": (
        payload: MarkSocketChatReadPayload,
        ack: (response: MarkSocketChatReadAck) => void
    ) => void;
};
