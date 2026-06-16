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

export type TypingSocketPayload = {
    chatId: string;
};

export type TypingSocketUpdateEvent = {
    chatId: string;
    userId: string;
    isTyping: boolean;
};

export type PresenceSocketSnapshotEvent = {
    onlineUserIds: string[];
};

export type PresenceSocketUpdateEvent = {
    userId: string;
    isOnline: boolean;
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
        onlineUserIds?: string[];
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
    "typing:update": (event: TypingSocketUpdateEvent) => void;
    "presence:snapshot": (event: PresenceSocketSnapshotEvent) => void;
    "presence:update": (event: PresenceSocketUpdateEvent) => void;
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
    "typing:start": (payload: TypingSocketPayload) => void;
    "typing:stop": (payload: TypingSocketPayload) => void;
};
