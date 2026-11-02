import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { mergeMessagesById, recoverMessages } from '../src/features/chats/utils/recoverMessages.ts';

// Run the actual recovery callbacks with controlled I/O, without a browser or
// a new React test dependency. Exercise the production merge and retry logic.
const source = await readFile(new URL('../src/features/chats/hooks/useChats.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('useChats.ts', source, ts.ScriptTarget.Latest, true);
const names = ['upsertChatToTop', 'mergeRecoveredChats', 'appendMessageIfMissing', 'handleNewSocketMessage', 'handleJoinedSocketChat', 'synchronize', 'clearRecoveryRetry', 'requireRecovery', 'handleSocketDisconnected', 'handleSocketReady', 'loadMoreMessages', 'loadChats'];
const declarations: string[] = [];
function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text) && node.initializer) {
        const initializer = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
        declarations.push(`const ${node.name.text} = ${initializer.getText(file)};`);
    }
    ts.forEachChild(node, visit);
}
visit(file);
assert.equal(declarations.length, names.length);
const { outputText } = ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } });

for (const joinDuringRecovery of [true, false]) {
    test(joinDuringRecovery ? 'a chat joined while history loads survives the stale snapshot' : 'an unchanged chat list accepts the recovered snapshot', async () => {
        type ChatStub = { id: string; title: string };
        let chats: ChatStub[] = [{ id: 'existing', title: 'old' }];
        const snapshot = [{ id: 'existing', title: 'refreshed' }];
        let finishMessages!: () => void;
        let messagesRequested!: () => void;
        const started = new Promise<void>(resolve => { messagesRequested = resolve; });
        const pending = new Promise<void>(resolve => { finishMessages = resolve; });
        let retries = 0;
        const noop = () => undefined;
        const context: Record<string, unknown> = {
            user: { id: 'me' },
            recoveryChatUpdatesRef: { current: new Set() },
            recoveryLiveMessagesRef: { current: [] },
            selectedChatIdRef: { current: 'existing' },
            cacheRef: { current: {} },
            historyProgressRef: { current: null },
            recoveryBoundaryRef: { current: null },
            recoveryRetryTimeoutRef: { current: null },
            recoveryRetryCountRef: { current: 0 },
            mountedRef: { current: true },
            messagesRef: { current: [] },
            hiddenUnreadDividerByChatIdRef: { current: {} },
            synchronizeRef: { current: () => { retries += 1; } },
            getChats: async () => snapshot,
            getChatMessages: async () => {
                messagesRequested();
                await pending;
                return { messages: [], hasMore: false, nextCursor: null };
            },
            setChats: (update: ChatStub[] | ((current: ChatStub[]) => ChatStub[])) => {
                chats = typeof update === 'function' ? update(chats) : update;
            },
            setError: (error: unknown) => assert.equal(error, null),
            mergeMessagesById, recoverMessages,
        };
        for (const name of ['recoveryRunningRef', 'recoveryQueuedRef', 'recoveryNeededRef']) context[name] = { current: false };
        for (const name of ['recoveryGenerationRef', 'recoveryRevisionRef']) context[name] = { current: 0 };
        for (const name of ['requireRecovery', 'setMessageCacheByChatId', 'setHasLoadedChats', 'setMessages', 'setNextCursor', 'setHasMoreMessages', 'setSelectedChat', 'showUnreadDivider', 'flushPendingRead', 'mergeOnlineUserIds']) context[name] = noop;
        const callbacks = runInNewContext(`${outputText}\n({ synchronize, handleJoinedSocketChat });`, context);
        const recovery = callbacks.synchronize();
        await started;
        if (joinDuringRecovery) callbacks.handleJoinedSocketChat({ id: 'new', title: 'new conversation' }, []);
        finishMessages();
        await recovery;

        if (joinDuringRecovery) {
            assert.equal(chats.some(chat => chat.id === 'new'), true);
            assert.equal(chats.length, 2);
            assert.equal(chats.find(chat => chat.id === 'existing')?.title, 'refreshed');
            assert.equal(retries, 0);
        } else {
            assert.equal(chats[0].title, 'refreshed');
            assert.equal(retries, 0);
        }
    });
}

function retryHarness(failure: 'chats' | 'messages' = 'messages') {
    const timers = new Map<number, { callback: () => void; delay: number }>();
    let timerId = 0;
    let failing = true;
    let attempts = 0;
    let reads = 0;
    let error: unknown;
    const message = { id: 'boundary', createdAt: '2026-01-01T00:00:00Z' };
    const context = {
        user: { id: 'me' },
        recoveryChatUpdatesRef: { current: new Set() },
        recoveryLiveMessagesRef: { current: [] },
        recoveryRetryTimeoutRef: { current: null },
        recoveryRetryCountRef: { current: 0 },
        socketReadyRef: { current: true },
        recoveryRunningRef: { current: false },
        recoveryQueuedRef: { current: false },
        recoveryNeededRef: { current: true },
        recoveryGenerationRef: { current: 0 },
        recoveryRevisionRef: { current: 0 },
        selectedChatIdRef: { current: 'chat' },
        recoveryBoundaryRef: { current: null as unknown },
        mountedRef: { current: true },
        messagesRef: { current: [message] },
        cacheRef: { current: {} },
        historyProgressRef: { current: null },
        hiddenUnreadDividerByChatIdRef: { current: {} },
        isChatViewActiveRef: { current: true },
        synchronizeRef: { current: (() => Promise.resolve()) as (isRetry?: boolean) => Promise<void> },
        window: {
            setTimeout: (callback: () => void, delay: number) => {
                timers.set(++timerId, { callback, delay });
                return timerId;
            },
            clearTimeout: (id: number) => timers.delete(id),
        },
        document: { visibilityState: 'visible' },
        getChats: async () => {
            attempts += 1;
            if (failing && failure === 'chats') throw new Error('temporary');
            return [];
        },
        getChatMessages: async () => {
            if (failing) throw new Error('temporary');
            return { messages: [message], nextCursor: null, hasMore: false };
        },
        setError: (value: unknown) => { error = value; },
        scheduleMarkChatRead: () => {
            assert.equal(context.recoveryNeededRef.current, false);
            reads += 1;
        },
        mergeMessagesById, recoverMessages,
    };
    const noop = () => undefined;
    const callbacks = runInNewContext(`${outputText}\n({ synchronize, handleSocketDisconnected, handleSocketReady, clearRecoveryRetry });`, {
        ...context,
        setChats: noop, setMessageCacheByChatId: noop, setHasLoadedChats: noop,
        setMessages: noop, setNextCursor: noop, setHasMoreMessages: noop,
        setSelectedChat: noop, clearChatUnread: noop, flushPendingRead: noop,
    });
    context.synchronizeRef.current = callbacks.synchronize;
    return {
        context, callbacks, timers,
        recover: () => { failing = false; },
        attempts: () => attempts, reads: () => reads, error: () => error,
        tick: async (delay: number) => {
            assert.equal(timers.size, 1);
            const [id, timer] = [...timers][0];
            assert.equal(timer.delay, delay);
            timers.delete(id);
            timer.callback();
            // Drain the asynchronous HTTP recovery and its finally block.
            await new Promise(resolve => setImmediate(resolve));
        },
    };
}

for (const initiallyEmpty of [true, false]) {
    test(`live traffic merges a snapshot without another request (${initiallyEmpty ? 'initial load' : 'reconnect'})`, async () => {
        const h = retryHarness();
        const message = (id: number) => ({ id: String(id), senderId: 'friend', createdAt: new Date(id * 1000).toISOString() });
        const chat = (id: string, latest: number, title = id) => ({
            id, title, updatedAt: message(latest).createdAt, lastMessage: message(latest), unreadCount: 1,
        });
        let chats = initiallyEmpty ? [] : [chat('busy', 1), chat('quiet', 1, 'stale')];
        let finish!: () => void;
        const pending = new Promise<void>(resolve => { finish = resolve; });
        let requests = 0;
        let queued = 0;
        const noop = () => undefined;
        const context = {
            ...h.context,
            selectedChatIdRef: { current: null },
            activeMessageRequestChatIdRef: { current: null },
            synchronizeRef: { current: () => { queued += 1; } },
            getChats: async () => {
                requests += 1;
                await pending;
                // Includes message 2 already; it must not be counted twice.
                return [chat('busy', 2), chat('quiet', 2, 'fresh')];
            },
            setChats: (update: (current: typeof chats) => typeof chats) => { chats = update(chats); },
            setMessages: noop, setMessageCacheByChatId: noop, setHasLoadedChats: noop,
            playMessageNotificationSound: noop, flushPendingRead: noop,
            setError: (error: unknown) => assert.equal(error, null),
        };
        const callbacks = runInNewContext(`${outputText}\n({ synchronize, handleNewSocketMessage });`, context);
        const recovery = callbacks.synchronize();
        for (let id = 2; id <= 20; id += 1) callbacks.handleNewSocketMessage({ chatId: 'busy', message: message(id) });
        finish();
        await recovery;
        assert.equal(requests, 1);
        assert.equal(queued, 0);
        assert.equal(h.context.recoveryNeededRef.current, false);
        assert.equal(chats.length, 2);
        assert.equal(chats[0].id, 'busy');
        assert.equal(chats[0].lastMessage.id, '20');
        assert.equal(chats[0].unreadCount, 19);
        assert.equal(chats.find(item => item.id === 'quiet')?.title, 'fresh');
    });
}

test('live messages increment the recovered unread count instead of replacing it', () => {
    const chat = {
        id: 'busy', title: 'busy', updatedAt: '2026-01-01T00:00:10Z',
        lastMessage: { id: '10', senderId: 'friend', createdAt: '2026-01-01T00:00:10Z' },
        unreadCount: 10,
    };
    const merged = runInNewContext(`${outputText}\nmergeRecoveredChats;`, {}) (
        [chat], [], new Set(['busy']),
        [{ chatId: 'busy', message: { id: '11', senderId: 'friend', createdAt: '2026-01-01T00:00:11Z' } }],
        'me',
    );
    assert.equal(merged[0].unreadCount, 11);
    assert.equal(merged[0].lastMessage.id, '11');
});

for (const failure of ['chats', 'messages'] as const) {
    test(`a failed ${failure} request retries with the original boundary and resumes read receipts`, async () => {
        const h = retryHarness(failure);
        await h.callbacks.synchronize();
        const boundary = h.context.recoveryBoundaryRef.current;
        h.context.messagesRef.current.push({ id: 'live', createdAt: '2026-01-02T00:00:00Z' });
        assert.equal(h.context.recoveryNeededRef.current, true);
        assert.equal(h.reads(), 0);
        await h.tick(1000);
        assert.equal(h.context.recoveryBoundaryRef.current, boundary);
        h.recover();
        await h.tick(2000);
        assert.equal(h.context.recoveryNeededRef.current, false);
        assert.equal(h.context.recoveryBoundaryRef.current, null);
        assert.equal(h.reads(), 1);
        assert.equal(h.error(), null);
        assert.equal(h.timers.size, 0);
    });
}

test('retries stop after three failures and manual retry starts a fresh budget', async () => {
    const h = retryHarness();
    await h.callbacks.synchronize();
    for (const delay of [1000, 2000, 4000]) await h.tick(delay);
    assert.equal(h.attempts(), 4);
    assert.equal(h.timers.size, 0);
    assert.equal(h.context.recoveryNeededRef.current, true);
    assert.match(String(h.error()), /retry/i);
    await h.callbacks.synchronize();
    await h.tick(1000);
    assert.equal(h.attempts(), 6);
});

test('history completed during recovery keeps its cursor even before the cache effect runs', async () => {
    const h = retryHarness();
    const message = (id: string) => ({ id, createdAt: `2026-01-0${id}T00:00:00Z` });
    let messages = [message('3')];
    let cursor: unknown = 'page-1';
    let hasMore = true;
    let finish!: () => void;
    let started!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const requested = new Promise<void>(resolve => { started = resolve; });
    const context = {
        ...h.context,
        selectedChat: { id: 'chat' },
        activeMessageRequestChatIdRef: { current: 'chat' },
        nextCursor: 'page-1',
        messagesRef: { current: messages },
        cacheRef: { current: { chat: { messages, nextCursor: 'page-1', hasMoreMessages: true } } },
        getChats: async () => [],
        getChatMessages: async (_chatId: string, requestedCursor?: string) => {
            if (!requestedCursor) {
                started();
                await pending;
                return { messages: [message('3'), message('4')], nextCursor: 'page-1', hasMore: true };
            }
            return { messages: [message('1'), message('2'), message('3')], nextCursor: null, hasMore: false };
        },
        setMessages: (update: (value: typeof messages) => typeof messages) => { messages = update(messages); },
        setNextCursor: (value: unknown) => { cursor = value; },
        setHasMoreMessages: (value: boolean) => { hasMore = value; },
        // Deliberately leave cacheRef stale, as with a pending React effect.
        setMessageCacheByChatId: () => undefined,
        setError: (error: unknown) => assert.equal(error, null),
        setChats: () => undefined, setHasLoadedChats: () => undefined,
        setIsLoadingMessages: () => undefined, clearChatUnread: () => undefined,
    };
    const callbacks = runInNewContext(`${outputText}\n({ synchronize, loadMoreMessages });`, context);
    const recovery = callbacks.synchronize();
    await requested;
    await callbacks.loadMoreMessages();
    finish();
    await recovery;
    assert.equal(cursor, null);
    assert.equal(hasMore, false);
    assert.deepEqual(Array.from(messages, item => item.id), ['1', '2', '3', '4']);
});

test('explicit Retry reconnects even when chats have already loaded', async () => {
    const h = retryHarness();
    h.recover();
    let reconnects = 0;
    const callbacks = runInNewContext(`${outputText}\n({ loadChats });`, {
        ...h.context,
        hasLoadedChats: true,
        reconnect: () => { reconnects += 1; },
        setIsLoadingChats: () => undefined,
        setChats: () => undefined, setMessageCacheByChatId: () => undefined,
        setHasLoadedChats: () => undefined, setMessages: () => undefined,
        setNextCursor: () => undefined, setHasMoreMessages: () => undefined,
        clearChatUnread: () => undefined,
    });
    await callbacks.loadChats(true);
    assert.equal(reconnects, 1);
    assert.equal(h.attempts(), 1);
});

test('disconnect cancels retry and reconnect restarts recovery', async () => {
    const h = retryHarness();
    await h.callbacks.synchronize();
    h.callbacks.handleSocketDisconnected();
    assert.equal(h.timers.size, 0);
    h.recover();
    h.callbacks.handleSocketReady();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.context.recoveryNeededRef.current, false);
});

test('a retry cannot run after disposal', async () => {
    const h = retryHarness();
    await h.callbacks.synchronize();
    const callback = [...h.timers.values()][0].callback;
    h.context.mountedRef.current = false;
    h.callbacks.clearRecoveryRetry();
    callback();
    assert.equal(h.attempts(), 1);
    assert.equal(h.timers.size, 0);
});
