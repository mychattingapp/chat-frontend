import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Supply Vite's build-time setting without starting a browser or a server.
const source = (await readFile(new URL('../src/lib/apiClient.ts', import.meta.url), 'utf8'))
    .replace('import.meta.env.VITE_BASE_SERVER_URL', '"https://chat.test"');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { apiRequest, refreshToken } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('HTTP requests and socket refresh share the same in-flight refresh', async () => {
    const originalFetch = globalThis.fetch;
    let finishRefresh!: (response: Response) => void;
    let startedRefresh!: () => void;
    const started = new Promise<void>(resolve => { startedRefresh = resolve; });
    let refreshCalls = 0;
    let requestCalls = 0;
    globalThis.fetch = async (url) => {
        if (String(url).endsWith('/api/auth/refresh')) {
            refreshCalls += 1;
            startedRefresh();
            return new Promise<Response>(resolve => { finishRefresh = resolve; });
        }
        requestCalls += 1;
        return Response.json(requestCalls === 1 ? { message: 'expired' } : { success: true }, { status: requestCalls === 1 ? 401 : 200 });
    };
    try {
        const request = apiRequest('api/chats');
        await started;
        const socketRefresh = refreshToken();
        finishRefresh(Response.json({ success: true }));
        await Promise.all([request, socketRefresh]);
        assert.equal(refreshCalls, 1);
        assert.equal(requestCalls, 2);
    }
    finally { globalThis.fetch = originalFetch; }
});

test('refresh preserves server errors and permits a later retry', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ message: 'unavailable' }, { status: 503 });
    try {
        await assert.rejects(refreshToken(), { status: 503 });
        globalThis.fetch = async () => Response.json({ success: true });
        await refreshToken();
    }
    finally { globalThis.fetch = originalFetch; }
});

test('rejected refresh retains its authentication status', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ message: 'expired' }, { status: 401 });
    try {
        await assert.rejects(apiRequest('api/chats'), { status: 401, message: 'Session expired. Please log in again.' });
    }
    finally { globalThis.fetch = originalFetch; }
});
