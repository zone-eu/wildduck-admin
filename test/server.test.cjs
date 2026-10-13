'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { hashPassword } = require('../server/password.cjs');

async function startAdminServer(configFile) {
    const child = spawn(process.execPath, ['server/index.cjs'], {
        env: { ...process.env, NODE_CONFIG_PATH: configFile },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let stderr = '';
    const url = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`Server startup timed out: ${stderr}`));
        }, 10000);
        child.stderr.on('data', chunk => {
            stderr += chunk;
        });
        child.stdout.on('data', chunk => {
            output += chunk;
            const match = output.match(/listening on (http:\/\/[^\s]+)/);
            if (match) {
                clearTimeout(timer);
                resolve(match[1]);
            }
        });
        child.once('error', err => {
            clearTimeout(timer);
            reject(err);
        });
        child.once('exit', code => {
            clearTimeout(timer);
            reject(new Error(`Server exited ${code}: ${stderr}`));
        });
    });
    return { child, url };
}

test('hashed admin login, sessions, and mail-rule proxy contracts', { timeout: 20000 }, async t => {
    // Record upstream requests to verify what the authenticated proxy forwards.
    const calls = [];
    const upstream = http.createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) {
            body += chunk;
        }
        calls.push({
            path: req.url,
            method: req.method,
            token: req.headers['x-access-token'],
            body: body ? JSON.parse(body) : undefined
        });
        res.writeHead(req.url.endsWith('/missing') ? 404 : 200, {
            'Content-Type': 'application/json'
        });
        res.end(
            JSON.stringify(
                req.url.endsWith('/missing')
                    ? { success: false, error: 'Unknown filter' }
                    : { success: true, results: [], status: false }
            )
        );
    });
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    t.after(
        () =>
            new Promise(resolve => {
                upstream.closeAllConnections();
                upstream.close(resolve);
            })
    );
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wildduck-admin-test-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const configFile = path.join(dir, 'config.json');
    await fs.writeFile(
        configFile,
        JSON.stringify({
            admin: {
                host: '127.0.0.1',
                port: 0,
                sessionSecret: 'test-session-secret',
                auth: { username: 'operator', passwordHash: await hashPassword('correct password') }
            },
            api: {
                url: `http://127.0.0.1:${upstream.address().port}`,
                accessToken: 'test-upstream-token'
            }
        })
    );
    const { child, url } = await startAdminServer(configFile);
    t.after(async () => {
        if (child.exitCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
    });
    const request = (route, method = 'GET', body, cookie) =>
        fetch(url + route, {
            method,
            headers: {
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(cookie ? { Cookie: cookie } : {})
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });
    // Protected routes and invalid credentials must reject unauthenticated requests.
    assert.equal((await request('/api/users/user/filters')).status, 401);
    for (const body of [
        { username: 'operator', password: 'wrong' },
        { username: 'admin', password: 'correct password' },
        { username: 'operator', password: {} },
        null
    ]) {
        assert.equal((await request('/api/login', 'POST', body)).status, 401);
    }
    // A valid login creates a protected cookie without exposing the password hash.
    const login = await request('/api/login', 'POST', {
        username: 'operator',
        password: 'correct password'
    });
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly/);
    assert.match(cookieHeader, /SameSite=Lax/);
    const cookie = cookieHeader.split(';')[0];
    const session = await (await request('/api/session', 'GET', undefined, cookie)).json();
    assert.equal(session.authenticated, true);
    assert.equal(session.user, 'operator');
    assert.equal(JSON.stringify(session).includes('passwordHash'), false);
    const invalidCookie = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
    assert.equal(
        (await request('/api/users/user/filters', 'GET', undefined, invalidCookie)).status,
        401
    );

    // The proxy forwards allowed fields and supplies its own upstream API token.
    const reply = {
        status: false,
        name: '',
        subject: '',
        text: '',
        html: '',
        start: false,
        end: false,
        accessToken: 'injected'
    };
    assert.equal((await request('/api/users/user/autoreply', 'PUT', reply, cookie)).status, 200);
    assert.deepEqual(calls.at(-1), {
        path: '/users/user/autoreply',
        method: 'PUT',
        token: 'test-upstream-token',
        body: { status: false, name: '', subject: '', text: '', html: '', start: false, end: false }
    });
    const rule = {
        name: 'Sort mail',
        disabled: false,
        query: { from: '', subject: 'invoice' },
        action: { spam: null, seen: false, targets: [] },
        unexpected: 'ignored'
    };
    assert.equal((await request('/api/users/user/filters', 'POST', rule, cookie)).status, 200);
    assert.deepEqual(calls.at(-1).body, {
        name: rule.name,
        disabled: false,
        query: rule.query,
        action: rule.action
    });
    assert.equal(
        (await request('/api/users/user/filters/filter', 'PUT', rule, cookie)).status,
        200
    );
    assert.equal(calls.at(-1).path, '/users/user/filters/filter');
    assert.equal(
        (await request('/api/users/user/filters/filter', 'DELETE', undefined, cookie)).status,
        200
    );
    assert.equal(calls.at(-1).method, 'DELETE');
    // Invalid routes, methods, and bodies retain their expected HTTP responses.
    assert.equal(
        (await request('/api/users/user/filters', 'DELETE', undefined, cookie)).status,
        405
    );
    assert.equal(
        (await request('/api/users/user/autoreply/item', 'GET', undefined, cookie)).status,
        404
    );
    assert.equal((await request('/api/users/user/filters', 'POST', null, cookie)).status, 400);
    assert.equal(
        (await request('/api/users/user/filters/missing', 'GET', undefined, cookie)).status,
        404
    );
    assert.equal(
        (await request('/api/users/user/autoreply', 'GET', undefined, cookie)).status,
        200
    );
    // Logout clears the browser's session cookie.
    const logout = await request('/api/logout', 'POST', undefined, cookie);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('server refuses plaintext-only configuration', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wildduck-admin-invalid-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const configFile = path.join(dir, 'config.json');
    await fs.writeFile(
        configFile,
        JSON.stringify({ admin: { auth: { password: 'old-password', passwordHash: '' } } })
    );
    const result = spawnSync(process.execPath, ['server/index.cjs'], {
        env: { ...process.env, NODE_CONFIG_PATH: configFile },
        encoding: 'utf8',
        timeout: 5000
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Configure admin.auth.passwordHash/);
    assert.equal(result.stderr.includes('old-password'), false);
});
