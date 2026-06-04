export type ChatType = 'DIRECT' | 'GROUP';

export type ChatParticipant = {
    id: string;
    username: string;
    email: string;
};

export type Chat = {
    id: string;
    chatType: ChatType;
    title: string;
    name: string | null;
    participants: ChatParticipant[];
    createdAt: string;
    updatedAt: string;
    lastMessage: ChatMessage | null;
};

export type ChatMessage = {
    id: string;
    senderId: string;
    text: string;
    createdAt: string;
};

export type MessageCursor = {
    cursorId: string;
    cursorCreatedAt: string;
};

export type ChatMessagesPage = {
    messages: ChatMessage[];
    nextCursor: MessageCursor | null;
    hasMore: boolean;
};
