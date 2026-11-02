import type { ChatMessage, ChatMessagesPage, MessageCursor } from '../types';

export const mergeMessagesById = (messages: ChatMessage[]) =>
    [...new Map(messages.map((message) => [message.id, message])).values()].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));

// Walk back to the pre-disconnection boundary, not the newest live message.
export async function recoverMessages(
    fetchPage: (cursor?: MessageCursor | null) => Promise<ChatMessagesPage>,
    boundaryId: string | undefined,
    isCurrent: () => boolean,
) {
    const messages: ChatMessage[] = [];
    let page: ChatMessagesPage;
    let cursor: MessageCursor | null = null;
    do {
        page = await fetchPage(cursor);
        if (!isCurrent()) return null;
        messages.push(...page.messages);
        if (!boundaryId || page.messages.some(message => message.id === boundaryId)) break;
        cursor = page.nextCursor;
    } while (page.hasMore && cursor);

    return { ...page, messages: mergeMessagesById(messages) };
}
