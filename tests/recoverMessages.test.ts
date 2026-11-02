import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeMessagesById, recoverMessages } from '../src/features/chats/utils/recoverMessages.ts';
import type { ChatMessage, MessageCursor } from '../src/features/chats/types.ts';

const message = (id: number): ChatMessage => ({
    id: String(id), senderId: 'friend', text: String(id), hasImage: false,
    imageContentType: null, createdAt: new Date(id * 1000).toISOString(),
});

test('recovers a gap longer than one page through the original boundary', async () => {
    const history = Array.from({ length: 95 }, (_, index) => message(index + 1));
    let calls = 0;
    const result = await recoverMessages(async (cursor?: MessageCursor | null) => {
        calls += 1;
        const end = cursor ? history.findIndex(item => item.id === cursor.cursorId) : history.length;
        const start = Math.max(0, end - 30);
        const messages = history.slice(start, end);
        return {
            messages, hasMore: start > 0,
            nextCursor: start > 0 ? { cursorId: messages[0].id, cursorCreatedAt: messages[0].createdAt } : null,
        };
    }, '10', () => true);
    assert.equal(calls, 3);
    const merged = mergeMessagesById([...history.slice(0, 10), ...result!.messages, message(95), message(96)]);
    assert.deepEqual(merged.map(item => item.id), Array.from({ length: 96 }, (_, index) => String(index + 1)));
});

test('a stale session or selected conversation discards recovery', async () => {
    const result = await recoverMessages(async () => ({ messages: [message(2)], hasMore: false, nextCursor: null }), '1', () => false);
    assert.equal(result, null);
});

test('an uncached conversation only needs its latest page', async () => {
    let calls = 0;
    const result = await recoverMessages(async () => {
        calls += 1;
        return { messages: [message(2)], hasMore: true, nextCursor: { cursorId: '2', cursorCreatedAt: message(2).createdAt } };
    }, undefined, () => true);
    assert.equal(calls, 1);
    assert.equal(result?.hasMore, true);
});

test('a missing boundary stops at the end of history', async () => {
    const result = await recoverMessages(async () => ({ messages: [message(2)], hasMore: false, nextCursor: null }), 'deleted', () => true);
    assert.deepEqual(result?.messages, [message(2)]);
});

test('request failures remain retryable instead of returning incomplete history', async () => {
    await assert.rejects(recoverMessages(async () => { throw new Error('offline'); }, '1', () => true), /offline/);
});
