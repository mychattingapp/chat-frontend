import { apiRequest } from "../../../lib/apiClient";
import type { Chat, ChatMessagesPage, ChatType, MessageCursor } from "../types";

type OpenDirectChatResponse = {
    success: boolean;
    data: {
        chat: Chat;
    };
};

type GetChatsResponse = {
    success: boolean;
    data: {
        chats: Chat[];
    };
};

type GetChatResponse = {
    success: boolean;
    data: {
        chat: Chat;
    };
};

type GetChatMessagesResponse = {
    success: boolean;
    data: ChatMessagesPage;
};

type SendMessageResponse = {
    success: boolean;
    data: {
        message: ChatMessagesPage["messages"][number];
    };
};

type MessageUploadUrlResponse = {
    success: boolean;
    data: {
        uploadUrl: string;
        contentType: "image/png" | "image/jpeg";
        key: string;
    };
};

type MessageImageUrlResponse = {
    success: boolean;
    data: {
        imageUrl: string;
    };
};

export type SendChatMessagePayload = {
    text?: string;
    imageKey?: string;
};

export const openDirectChat = async (friendId: string) => {
    const response = await apiRequest<OpenDirectChatResponse>("api/chats", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendId }),
    });

    return response.data.chat;
};

export const getChats = async (chatType: ChatType = "DIRECT") => {
    const response = await apiRequest<GetChatsResponse>(`api/chats?chatType=${chatType}`, {
        method: "GET",
    });

    return response.data.chats;
};

export const getChat = async (chatId: string) => {
    const response = await apiRequest<GetChatResponse>(`api/chats/${chatId}`, {
        method: "GET",
    });

    return response.data.chat;
};

export const getChatMessages = async (chatId: string, cursor?: MessageCursor | null) => {
    const params = new URLSearchParams();

    if (cursor) {
        params.set("cursorId", cursor.cursorId);
        params.set("cursorCreatedAt", cursor.cursorCreatedAt);
    }

    const query = params.toString();
    const endpoint = query
        ? `api/chats/${chatId}/messages?${query}`
        : `api/chats/${chatId}/messages`;

    const response = await apiRequest<GetChatMessagesResponse>(endpoint, {
        method: "GET",
    });

    return response.data;
};

export const sendChatMessage = async (chatId: string, payload: SendChatMessagePayload) => {
    const response = await apiRequest<SendMessageResponse>(`api/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return response.data.message;
};

export const getMessageImageUploadUrl = async (file: File) => {
    const response = await apiRequest<MessageUploadUrlResponse>("api/images/upload-url", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            purpose: "message",
            fileType: file.type,
            fileSize: file.size,
        }),
    });

    return response.data;
};

export const getMessageImageUrl = async (chatId: string, messageId: string) => {
    const response = await apiRequest<MessageImageUrlResponse>(`api/chats/${chatId}/messages/${messageId}/image-url`, {
        method: "GET",
    });

    return response.data.imageUrl;
};
