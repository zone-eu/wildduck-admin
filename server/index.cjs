'use strict';

const crypto = require('node:crypto');
const { handleWorkflowRoutes } = require('./workflow-routes.cjs');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const { parsePasswordHash, verifyPassword } = require('./password.cjs');
const { AdminAuth } = require('./admin-auth.cjs');

const config = require('./config.cjs');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const cookieName = 'wd_admin_session';
const jsonLimit = 1024 * 1024;
let activeLogins = 0;

const adminConfig = {
    host: config.admin?.host || '127.0.0.1',
    port: Number(config.admin?.port ?? process.env.PORT ?? 3100),
    sessionSecret: String(config.admin?.sessionSecret || crypto.randomBytes(32).toString('hex')),
    sessionMaxAge: Number(config.admin?.sessionMaxAge || 8 * 60 * 60),
    secureCookies: Boolean(config.admin?.secureCookies),
    auth: {
        username: String(config.admin?.auth?.username || 'admin'),
        passwordHash: String(config.admin?.auth?.passwordHash || '')
    }
};

parsePasswordHash(adminConfig.auth.passwordHash);
const adminAuth = new AdminAuth(config, adminConfig);

const wildduckApi = {
    url: String(config.api?.url || 'http://127.0.0.1:8080').replace(/\/+$/, ''),
    accessToken: String(config.api?.accessToken || ''),
    exportAccessToken: String(config.api?.exportAccessToken || '')
};

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp'
};

function hash(value) {
    return crypto.createHash('sha256').update(String(value)).digest();
}

function safeEqual(a, b) {
    return crypto.timingSafeEqual(hash(a), hash(b));
}

function sign(value) {
    return crypto.createHmac('sha256', adminConfig.sessionSecret).update(value).digest('base64url');
}

function sessionToken(session) {
    const payload = Buffer.from(
        JSON.stringify({
            sub: session.username,
            exp: Math.ceil(session.expires / 1000),
            nonce: session.id
        })
    ).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

async function sendSession(res, session) {
    sendJson(res, 200, await sessionPayload(session), {
        'Set-Cookie': sessionCookie(
            sessionToken(session),
            Math.max(0, Math.ceil((session.expires - Date.now()) / 1000))
        )
    });
}

async function readSession(req) {
    const raw = readCookie(req, cookieName);
    if (!raw) {
        return false;
    }

    const [payload, signature, extra] = raw.split('.');
    if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) {
        return false;
    }

    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
            return false;
        }
        if (data.sub !== adminConfig.auth.username) {
            return false;
        }
        if (typeof data.nonce !== 'string') {
            return false;
        }
        return (await adminAuth.store.session(data.nonce, adminConfig.auth.username)) || false;
    } catch (err) {
        return false;
    }
}

function readCookie(req, name) {
    const header = req.headers.cookie || '';
    for (const part of header.split(';')) {
        const [key, ...valueParts] = part.trim().split('=');
        if (key === name) {
            try {
                return decodeURIComponent(valueParts.join('='));
            } catch (err) {
                return '';
            }
        }
    }
    return '';
}

function sessionCookie(value, maxAge) {
    const parts = [
        `${cookieName}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAge}`
    ];

    if (adminConfig.secureCookies) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

function sendJson(res, statusCode, body, headers) {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
    });
    res.end(payload);
}

async function sessionPayload(session) {
    return {
        success: true,
        authenticated: await adminAuth.canAccess(session),
        passwordAuthenticated: Boolean(session),
        twoFactor: await adminAuth.status(session),
        user: session ? adminConfig.auth.username : null,
        service: {
            name: config.name || 'WildDuck Admin UI'
        },
        api: {
            url: wildduckApi.url,
            tokenConfigured: Boolean(wildduckApi.accessToken),
            exportTokenConfigured: Boolean(wildduckApi.exportAccessToken)
        }
    };
}

function methodNotAllowed(res) {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
}

function notFound(res) {
    sendJson(res, 404, { success: false, error: 'Not found' });
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];

        req.on('data', chunk => {
            size += chunk.length;
            if (size > jsonLimit) {
                reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            if (!chunks.length) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch (err) {
                reject(Object.assign(new Error('Invalid JSON request body'), { statusCode: 400 }));
            }
        });

        req.on('error', reject);
    });
}

function appendQuery(pathname, sourceParams, allowed) {
    const params = new URLSearchParams();
    for (const key of allowed) {
        const value = sourceParams.get(key);
        if (value) {
            params.set(key, value);
        }
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
}

function pick(input, keys, keepEmpty = false) {
    const output = {};
    for (const key of keys) {
        if (
            Object.prototype.hasOwnProperty.call(input, key) &&
            (keepEmpty || input[key] !== '') &&
            input[key] !== undefined
        ) {
            output[key] = input[key];
        }
    }
    return output;
}

async function wildduckRequest(apiPath, options = {}) {
    const headers = {
        Accept: 'application/json',
        ...(options.headers || {})
    };

    if (wildduckApi.accessToken) {
        headers['X-Access-Token'] = wildduckApi.accessToken;
    }

    const init = {
        method: options.method || 'GET',
        headers
    };

    if (options.body) {
        init.body = JSON.stringify(options.body);
        init.headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${wildduckApi.url}${apiPath}`, init);
    } catch (err) {
        return {
            statusCode: 502,
            body: {
                success: false,
                error: 'WildDuck API is not reachable',
                detail: 'Could not complete the request'
            }
        };
    }

    const text = await response.text();
    let body;
    try {
        body = text ? JSON.parse(text) : {};
    } catch (err) {
        body = {
            success: response.ok,
            error: response.ok ? undefined : text || response.statusText,
            raw: text
        };
    }

    return {
        statusCode: response.status,
        body
    };
}

async function forward(res, apiPath, options) {
    const result = await wildduckRequest(apiPath, options);
    sendJson(res, result.statusCode, result.body);
}

async function handleApi(req, res, url) {
    if (url.pathname === '/api/session') {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }

        const session = await readSession(req);
        sendJson(res, 200, await sessionPayload(session));
        return;
    }

    if (url.pathname === '/api/login') {
        if (req.method !== 'POST') {
            methodNotAllowed(res);
            return;
        }

        let body;
        try {
            body = await readJson(req);
        } catch (err) {
            sendJson(res, err.statusCode || 400, { success: false, error: err.message });
            return;
        }

        if (activeLogins >= 4) {
            sendJson(
                res,
                429,
                { success: false, error: 'Too many login attempts. Try again shortly.' },
                { 'Retry-After': '1' }
            );
            return;
        }
        try {
            await adminAuth.store.attempt(adminConfig.auth.username, 'password', 8, 60);
        } catch (err) {
            sendJson(res, err.statusCode || 503, {
                success: false,
                error: err.statusCode ? err.message : 'Administrator database unavailable'
            });
            return;
        }
        if (activeLogins >= 4) {
            sendJson(
                res,
                429,
                { success: false, error: 'Too many login attempts. Try again shortly.' },
                { 'Retry-After': '1' }
            );
            return;
        }
        let passwordValid;
        activeLogins++;
        try {
            passwordValid = await verifyPassword(body?.password, adminConfig.auth.passwordHash);
        } finally {
            activeLogins--;
        }
        const valid =
            typeof body?.username === 'string' &&
            safeEqual(body.username, adminConfig.auth.username) &&
            passwordValid;

        if (!valid) {
            sendJson(res, 401, { success: false, error: 'Invalid username or password' });
            return;
        }

        await adminAuth.store.clearAttempts(adminConfig.auth.username, 'password');
        const previous = await readSession(req);
        if (previous) {
            await adminAuth.store.revokeSession(previous.id);
        }
        await sendSession(res, await adminAuth.createSession());
        return;
    }

    if (url.pathname === '/api/logout') {
        if (req.method !== 'POST') {
            methodNotAllowed(res);
            return;
        }

        const session = await readSession(req);
        if (session) {
            await adminAuth.store.revokeSession(session.id);
        }
        sendJson(
            res,
            200,
            { success: true },
            {
                'Set-Cookie': sessionCookie('', 0)
            }
        );
        return;
    }

    const session = await readSession(req);
    if (await adminAuth.handle(req, res, url, session, { readJson, sendJson, sendSession })) {
        return;
    }
    if (!session) {
        sendJson(res, 401, { success: false, error: 'Authentication required' });
        return;
    }

    if (!(await adminAuth.canAccess(session))) {
        sendJson(res, 403, {
            success: false,
            code: 'AdminTwoFactorRequired',
            error: 'Two-factor authentication required'
        });
        return;
    }

    if (
        await handleWorkflowRoutes(req, res, url, {
            readJson,
            sendJson,
            forward,
            api: wildduckApi,
            exportAccessToken: wildduckApi.exportAccessToken
        })
    )
        return;

    if (url.pathname === '/api/health') {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }
        await forward(res, '/health');
        return;
    }

    if (url.pathname === '/api/users') {
        if (req.method === 'GET') {
            await forward(
                res,
                appendQuery('/users', url.searchParams, ['query', 'limit', 'next', 'previous'])
            );
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, [
                'username',
                'password',
                'address',
                'name',
                'quota',
                'tags',
                'requirePasswordChange'
            ]);
            await forward(res, '/users', { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const mailRuleMatch = url.pathname.match(
        /^\/api\/users\/([^/]+)\/(autoreply|filters)(?:\/([^/]+))?$/
    );
    if (mailRuleMatch) {
        const user = encodeURIComponent(decodeURIComponent(mailRuleMatch[1]));
        const resource = mailRuleMatch[2];
        const item = mailRuleMatch[3];
        if (resource === 'autoreply' && item) {
            notFound(res);
            return;
        }
        const allowed =
            resource === 'autoreply'
                ? ['GET', 'PUT', 'DELETE']
                : item
                  ? ['GET', 'PUT', 'DELETE']
                  : ['GET', 'POST'];
        if (!allowed.includes(req.method)) {
            methodNotAllowed(res);
            return;
        }
        const apiPath = `/users/${user}/${resource}${item ? `/${encodeURIComponent(decodeURIComponent(item))}` : ''}`;
        let payload;
        if (req.method === 'PUT' || req.method === 'POST') {
            try {
                const input = await readJson(req);
                if (!input || typeof input !== 'object' || Array.isArray(input)) {
                    throw new Error('Expected a JSON object');
                }
                // Keep empty strings here: WildDuck uses them to clear saved values.
                const keys =
                    resource === 'autoreply'
                        ? ['status', 'name', 'subject', 'text', 'html', 'start', 'end']
                        : ['name', 'query', 'action', 'disabled'];
                payload = Object.fromEntries(
                    keys.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]])
                );
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }
        }
        await forward(res, apiPath, { method: req.method, body: payload });
        return;
    }

    const userAddressMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/addresses$/);
    if (userAddressMatch) {
        const user = encodeURIComponent(userAddressMatch[1]);
        if (req.method === 'GET') {
            await forward(res, `/users/${user}/addresses`);
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['address', 'name', 'main', 'allowWildcard', 'tags']);
            await forward(res, `/users/${user}/addresses`, { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const userAddressItemMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/addresses\/([^/]+)$/);
    if (userAddressItemMatch) {
        const user = encodeURIComponent(decodeURIComponent(userAddressItemMatch[1]));
        const address = encodeURIComponent(decodeURIComponent(userAddressItemMatch[2]));

        if (req.method === 'PUT') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['name', 'address', 'main', 'tags']);
            await forward(res, `/users/${user}/addresses/${address}`, {
                method: 'PUT',
                body: payload
            });
            return;
        }

        if (req.method === 'DELETE') {
            await forward(res, `/users/${user}/addresses/${address}`, { method: 'DELETE' });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const userMailboxesMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/mailboxes$/);
    if (userMailboxesMatch) {
        const user = encodeURIComponent(decodeURIComponent(userMailboxesMatch[1]));

        if (req.method === 'GET') {
            await forward(
                res,
                appendQuery(`/users/${user}/mailboxes`, url.searchParams, [
                    'specialUse',
                    'showHidden',
                    'counters',
                    'sizes'
                ])
            );
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['path', 'hidden', 'retention', 'encryptMessages']);
            await forward(res, `/users/${user}/mailboxes`, { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const userMailboxMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/mailboxes\/([^/]+)$/);
    if (userMailboxMatch) {
        const user = encodeURIComponent(decodeURIComponent(userMailboxMatch[1]));
        const mailbox = encodeURIComponent(decodeURIComponent(userMailboxMatch[2]));

        if (req.method === 'GET') {
            await forward(res, `/users/${user}/mailboxes/${mailbox}`);
            return;
        }

        if (req.method === 'PUT') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, [
                'path',
                'retention',
                'subscribed',
                'encryptMessages',
                'hidden'
            ]);
            await forward(res, `/users/${user}/mailboxes/${mailbox}`, {
                method: 'PUT',
                body: payload
            });
            return;
        }

        if (req.method === 'DELETE') {
            await forward(res, `/users/${user}/mailboxes/${mailbox}`, { method: 'DELETE' });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const userAuthLogMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/authlog$/);
    if (userAuthLogMatch) {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }

        const user = encodeURIComponent(decodeURIComponent(userAuthLogMatch[1]));
        await forward(
            res,
            appendQuery(`/users/${user}/authlog`, url.searchParams, [
                'action',
                'filterip',
                'limit',
                'next',
                'previous'
            ])
        );
        return;
    }

    const userStorageMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/storage$/);
    if (userStorageMatch) {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }

        const user = encodeURIComponent(decodeURIComponent(userStorageMatch[1]));
        await forward(
            res,
            appendQuery(`/users/${user}/storage`, url.searchParams, [
                'query',
                'limit',
                'next',
                'previous'
            ])
        );
        return;
    }

    const userStorageFileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/storage\/([^/]+)$/);
    if (userStorageFileMatch) {
        if (req.method !== 'DELETE') {
            methodNotAllowed(res);
            return;
        }

        const user = encodeURIComponent(decodeURIComponent(userStorageFileMatch[1]));
        const file = encodeURIComponent(decodeURIComponent(userStorageFileMatch[2]));
        await forward(res, `/users/${user}/storage/${file}`, { method: 'DELETE' });
        return;
    }

    const userActionMatch = url.pathname.match(
        /^\/api\/users\/([^/]+)\/(logout|password\/reset|quota\/reset)$/
    );
    if (userActionMatch) {
        const user = encodeURIComponent(decodeURIComponent(userActionMatch[1]));
        const action = userActionMatch[2];

        if (action === 'logout' && req.method === 'PUT') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['reason']);
            await forward(res, `/users/${user}/logout`, { method: 'PUT', body: payload });
            return;
        }

        if ((action === 'password/reset' || action === 'quota/reset') && req.method === 'POST') {
            await forward(res, `/users/${user}/${action}`, { method: 'POST' });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch) {
        const user = encodeURIComponent(decodeURIComponent(userMatch[1]));

        if (req.method === 'GET') {
            await forward(res, `/users/${user}`);
            return;
        }

        if (req.method === 'PUT') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
                sendJson(res, 400, { success: false, error: 'Expected a JSON object' });
                return;
            }
            if (
                body.metaData !== undefined &&
                (!body.metaData ||
                    typeof body.metaData !== 'object' ||
                    Array.isArray(body.metaData))
            ) {
                sendJson(res, 400, {
                    success: false,
                    error: 'Custom metadata must be a JSON object'
                });
                return;
            }
            const payload = pick(
                body,
                [
                    'name',
                    'quota',
                    'disabledScopes',
                    'targets',
                    'encryptMessages',
                    'encryptForwarded',
                    'pubKey',
                    'smimeCerts',
                    'smimeCipher',
                    'smimeKeyTransport',
                    'recipients',
                    'forwards',
                    'tags',
                    'disabled',
                    'suspended',
                    'require2faEnabled',
                    'disable2fa',
                    'spamLevel',
                    'metaData'
                ],
                true
            );
            await forward(res, `/users/${user}`, { method: 'PUT', body: payload });
            return;
        }

        if (req.method === 'DELETE') {
            await forward(res, appendQuery(`/users/${user}`, url.searchParams, ['deleteAfter']), {
                method: 'DELETE'
            });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    if (url.pathname === '/api/settings') {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }

        await forward(res, appendQuery('/settings', url.searchParams, ['filter']));
        return;
    }

    if (url.pathname === '/api/dkim') {
        if (req.method === 'GET') {
            await forward(
                res,
                appendQuery('/dkim', url.searchParams, ['query', 'limit', 'next', 'previous'])
            );
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['domain', 'selector', 'description', 'privateKey']);
            await forward(res, '/dkim', { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const dkimResolveMatch = url.pathname.match(/^\/api\/dkim\/resolve\/([^/]+)$/);
    if (dkimResolveMatch) {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }

        await forward(
            res,
            `/dkim/resolve/${encodeURIComponent(decodeURIComponent(dkimResolveMatch[1]))}`
        );
        return;
    }

    const dkimMatch = url.pathname.match(/^\/api\/dkim\/([^/]+)$/);
    if (dkimMatch) {
        const dkim = encodeURIComponent(decodeURIComponent(dkimMatch[1]));

        if (req.method === 'GET') {
            await forward(res, `/dkim/${dkim}`);
            return;
        }

        if (req.method === 'DELETE') {
            await forward(res, `/dkim/${dkim}`, { method: 'DELETE' });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const domainAccessListMatch = url.pathname.match(
        /^\/api\/domainaccess\/([^/]+)\/(allow|block)$/
    );
    if (domainAccessListMatch) {
        const tag = encodeURIComponent(decodeURIComponent(domainAccessListMatch[1]));
        const action = domainAccessListMatch[2];

        if (req.method === 'GET') {
            await forward(res, `/domainaccess/${tag}/${action}`);
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['domain']);
            await forward(res, `/domainaccess/${tag}/${action}`, { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const domainAccessMatch = url.pathname.match(/^\/api\/domainaccess\/([^/]+)$/);
    if (domainAccessMatch) {
        if (req.method !== 'DELETE') {
            methodNotAllowed(res);
            return;
        }

        const domain = encodeURIComponent(decodeURIComponent(domainAccessMatch[1]));
        await forward(res, `/domainaccess/${domain}`, { method: 'DELETE' });
        return;
    }

    if (url.pathname === '/api/domainaliases') {
        if (req.method === 'GET') {
            await forward(
                res,
                appendQuery('/domainaliases', url.searchParams, [
                    'query',
                    'limit',
                    'next',
                    'previous'
                ])
            );
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['alias', 'domain']);
            await forward(res, '/domainaliases', { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const domainAliasResolveMatch = url.pathname.match(/^\/api\/domainaliases\/resolve\/([^/]+)$/);
    if (domainAliasResolveMatch) {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }

        await forward(
            res,
            `/domainaliases/resolve/${encodeURIComponent(decodeURIComponent(domainAliasResolveMatch[1]))}`
        );
        return;
    }

    const domainAliasMatch = url.pathname.match(/^\/api\/domainaliases\/([^/]+)$/);
    if (domainAliasMatch) {
        const alias = encodeURIComponent(decodeURIComponent(domainAliasMatch[1]));

        if (req.method === 'GET') {
            await forward(res, `/domainaliases/${alias}`);
            return;
        }

        if (req.method === 'DELETE') {
            await forward(res, `/domainaliases/${alias}`, { method: 'DELETE' });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    if (url.pathname === '/api/certs') {
        if (req.method === 'GET') {
            await forward(
                res,
                appendQuery('/certs', url.searchParams, [
                    'query',
                    'altNames',
                    'limit',
                    'next',
                    'previous'
                ])
            );
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, [
                'servername',
                'privateKey',
                'cert',
                'ca',
                'description',
                'acme'
            ]);
            await forward(res, '/certs', { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const certResolveMatch = url.pathname.match(/^\/api\/certs\/resolve\/([^/]+)$/);
    if (certResolveMatch) {
        if (req.method !== 'GET') {
            methodNotAllowed(res);
            return;
        }

        await forward(
            res,
            `/certs/resolve/${encodeURIComponent(decodeURIComponent(certResolveMatch[1]))}`
        );
        return;
    }

    const certMatch = url.pathname.match(/^\/api\/certs\/([^/]+)$/);
    if (certMatch) {
        const cert = encodeURIComponent(decodeURIComponent(certMatch[1]));

        if (req.method === 'GET') {
            await forward(res, `/certs/${cert}`);
            return;
        }

        if (req.method === 'DELETE') {
            await forward(res, `/certs/${cert}`, { method: 'DELETE' });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    if (url.pathname === '/api/webhooks') {
        if (req.method === 'GET') {
            await forward(
                res,
                appendQuery('/webhooks', url.searchParams, [
                    'type',
                    'user',
                    'limit',
                    'next',
                    'previous'
                ])
            );
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            const payload = pick(body, ['type', 'user', 'url']);
            await forward(res, '/webhooks', { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    const webhookMatch = url.pathname.match(/^\/api\/webhooks\/([^/]+)$/);
    if (webhookMatch) {
        if (req.method !== 'DELETE') {
            methodNotAllowed(res);
            return;
        }

        const webhook = encodeURIComponent(decodeURIComponent(webhookMatch[1]));
        await forward(res, `/webhooks/${webhook}`, { method: 'DELETE' });
        return;
    }

    const settingMatch = url.pathname.match(/^\/api\/settings\/([^/]+)$/);
    if (settingMatch) {
        const key = encodeURIComponent(decodeURIComponent(settingMatch[1]));

        if (req.method === 'GET') {
            await forward(res, `/settings/${key}`);
            return;
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = await readJson(req);
            } catch (err) {
                sendJson(res, err.statusCode || 400, { success: false, error: err.message });
                return;
            }

            if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
                sendJson(res, 400, { success: false, error: 'Missing setting value' });
                return;
            }

            const payload = { value: body.value };
            await forward(res, `/settings/${key}`, { method: 'POST', body: payload });
            return;
        }

        methodNotAllowed(res);
        return;
    }

    notFound(res);
}

function serveStatic(req, res, url) {
    if (!['GET', 'HEAD'].includes(req.method || '')) {
        methodNotAllowed(res);
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch (err) {
        res.writeHead(400);
        res.end('Bad request');
        return;
    }

    let filePath = path.join(distDir, pathname);
    if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Build output not found. Run npm run build first.');
        return;
    }

    const ext = path.extname(filePath);
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Length': stat.size
    });

    if (req.method === 'HEAD') {
        res.end();
        return;
    }

    fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api/')) {
        handleApi(req, res, url).catch(err => {
            sendJson(res, 500, {
                success: false,
                error: 'Internal server error',
                detail: 'Could not complete the request'
            });
        });
        return;
    }

    serveStatic(req, res, url);
});

async function start() {
    await adminAuth.initialize(config, rootDir);
    server.once('error', async () => {
        await adminAuth.store.close();
        console.error('Could not start the administrator HTTP server');
        process.exitCode = 1;
    });
    server.listen(adminConfig.port, adminConfig.host, () => {
        console.log(
            `WildDuck Admin UI server listening on http://${adminConfig.host}:${server.address().port}`
        );
        console.log(`WildDuck API target: ${wildduckApi.url}`);
    });
    let stopping = false;
    const stop = () => {
        if (stopping) {
            return;
        }
        stopping = true;
        const deadline = setTimeout(() => process.exit(1), 10000);
        deadline.unref();
        server.close(async () => {
            try {
                await adminAuth.store.close();
            } catch {
                process.exitCode = 1;
            }
            clearTimeout(deadline);
        });
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
}

start().catch(() => {
    console.error(
        'Could not initialize administrator authentication. Check database configuration, connectivity, and encryption secret.'
    );
    process.exitCode = 1;
});
