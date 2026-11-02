import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/chats/hooks/useChatSocket.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('useChatSocket.ts', source, ts.ScriptTarget.Latest, true);
const hook = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'useChatSocket')!;
const { outputText } = ts.transpileModule(hook.getText(file).replace('export ', ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
});

test('explicit reconnect permits refresh again after a transient failure and restores live events', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const effects: (() => (() => void))[] = [];
    let connections = 0;
    let refreshes = 0;
    let received = 0;
    let ready = 0;
    const noop = () => undefined;
    const socket = {
        connected: false,
        on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
        connect: () => { connections += 1; },
        disconnect: noop,
        removeAllListeners: () => handlers.clear(),
    };
    const useChatSocket = runInNewContext(`${outputText}\nuseChatSocket;`, {
        BASE_URL: 'http://test', io: () => socket,
        useRef: (current: unknown) => ({ current }),
        useState: () => [false, noop],
        useCallback: (callback: unknown) => callback,
        useEffect: (effect: () => (() => void)) => effects.push(effect),
        useAuth: () => ({ user: { id: 'user' }, clearSession: () => assert.fail('must retain session') }),
        refreshToken: async () => { if (++refreshes === 1) throw new Error('temporary network failure'); },
        isApiError: () => false,
        document: { visibilityState: 'visible', addEventListener: noop, removeEventListener: noop },
        window: { addEventListener: noop, removeEventListener: noop },
    });
    const result = useChatSocket({
        onReady: () => { ready += 1; }, onDisconnected: noop,
        onNewMessage: () => { received += 1; }, onJoinedChat: noop,
        onTypingUpdate: noop, onPresenceSnapshot: noop, onPresenceUpdate: noop, onError: noop,
    });
    const cleanup = effects[0]();
    const rejection = { data: { code: 'AUTH_REQUIRED' } };
    await handlers.get('connect_error')!(rejection);
    assert.equal(refreshes, 1);
    assert.equal(connections, 0);
    result.reconnect();
    assert.equal(connections, 1);
    await handlers.get('connect_error')!(rejection);
    assert.equal(refreshes, 2);
    assert.equal(connections, 2);
    socket.connected = true;
    handlers.get('connect')!();
    handlers.get('session:ready')!();
    handlers.get('message:new')!({ message: { id: 'new' } });
    assert.equal(ready, 1);
    assert.equal(received, 1);
    result.reconnect();
    assert.equal(connections, 2);
    cleanup();
    result.reconnect();
    assert.equal(connections, 2);
});
