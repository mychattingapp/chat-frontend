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

export const sendChatMessage = async (chatId: string, text: string) => {
    const response = await apiRequest<SendMessageResponse>(`api/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
    });

    return response.data.message;
};
