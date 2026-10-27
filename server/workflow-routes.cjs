'use strict';
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

// Explicit routes only. Session authentication and administrator 2FA checks run before this handler.
const routes = [
    [/^\/api\/addresses$/, ['GET'], ['query', 'forward', 'limit', 'next', 'previous']],
    [/^\/api\/addresses\/resolve\/[^/]+$/, ['GET'], ['allowWildcard']],
    [/^\/api\/addresses\/renameDomain$/, ['PUT'], [], ['oldDomain', 'newDomain']],
    [
        /^\/api\/addresses\/forwarded$/,
        ['POST'],
        [],
        ['address', 'name', 'targets', 'forwards', 'allowWildcard', 'autoreply', 'tags', 'metaData']
    ],
    [
        /^\/api\/addresses\/forwarded\/[^/]+$/,
        ['GET', 'PUT', 'DELETE'],
        [],
        [
            'address',
            'name',
            'targets',
            'forwards',
            'forwardedDisabled',
            'autoreply',
            'tags',
            'metaData'
        ]
    ],
    [/^\/api\/users\/[^/]+\/addressregister$/, ['GET'], ['query', 'limit']],
    [/^\/api\/users\/[^/]+\/addressregister\/[^/]+$/, ['PUT'], [], ['name', 'disabled']],
    [/^\/api\/users\/[^/]+\/restore$/, ['GET', 'POST'], [], []],
    [/^\/api\/quota\/reset$/, ['POST'], [], []]
];

async function handleWorkflowRoutes(
    req,
    res,
    url,
    { readJson, sendJson, forward, api, exportAccessToken }
) {
    if (url.pathname === '/api/data/export' || url.pathname === '/api/data/import') {
        if (req.method !== 'POST') {
            sendJson(res, 405, { success: false, error: 'Method not allowed' });
            return true;
        }
        if (!exportAccessToken) {
            sendJson(res, 503, {
                success: false,
                code: 'ExportTokenNotConfigured',
                error: 'Import and export are unavailable until api.exportAccessToken is configured'
            });
            return true;
        }
        const controller = new AbortController();
        const abort = () => controller.abort();
        req.once('aborted', abort);
        res.once('close', abort);
        try {
            const exporting = url.pathname.endsWith('/export');
            let body = req;
            if (exporting) {
                const input = await readJson(req);
                if (!input || typeof input !== 'object' || Array.isArray(input))
                    throw new Error('Expected a JSON object');
                body = JSON.stringify(
                    Object.fromEntries(
                        ['users', 'tags']
                            .filter(key => Object.hasOwn(input, key))
                            .map(key => [key, input[key]])
                    )
                );
            }
            const upstream = await fetch(`${api.url}${url.pathname.slice(4)}`, {
                method: 'POST',
                headers: {
                    'X-Access-Token': exportAccessToken,
                    'Content-Type': exporting ? 'application/json' : 'application/octet-stream',
                    Accept: exporting ? 'application/octet-stream' : 'application/json'
                },
                body,
                ...(!exporting ? { duplex: 'half' } : {}),
                signal: controller.signal
            });
            res.writeHead(upstream.status, {
                'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
                ...(exporting && upstream.ok
                    ? { 'Content-Disposition': 'attachment; filename="wildduck-export.dump"' }
                    : {}),
                'Cache-Control': 'no-store'
            });
            if (upstream.body) await pipeline(Readable.fromWeb(upstream.body), res);
            else res.end();
        } catch (err) {
            if (!res.headersSent && !res.destroyed)
                sendJson(
                    res,
                    err.statusCode || (err.message === 'Expected a JSON object' ? 400 : 502),
                    { success: false, error: err.message }
                );
            else if (!res.destroyed) res.destroy();
        } finally {
            req.off('aborted', abort);
            res.off('close', abort);
        }
        return true;
    }
    const route = routes.find(([pattern]) => pattern.test(url.pathname));
    if (!route) return false;
    const [, methods, queryKeys, bodyKeys] = route;
    if (!methods.includes(req.method)) {
        sendJson(res, 405, { success: false, error: 'Method not allowed' });
        return true;
    }
    let body;
    if (['PUT', 'POST'].includes(req.method)) {
        try {
            const input = await readJson(req);
            if (!input || typeof input !== 'object' || Array.isArray(input))
                throw new Error('Expected a JSON object');
            // Empty keys and arrays are meaningful native removal operations.
            body = Object.fromEntries(
                bodyKeys.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]])
            );
        } catch (err) {
            sendJson(res, err.statusCode || 400, { success: false, error: err.message });
            return true;
        }
    }
    const query = new URLSearchParams();
    for (const key of queryKeys)
        if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
    await forward(res, url.pathname.slice(4) + (query.size ? `?${query}` : ''), {
        method: req.method,
        body
    });
    return true;
}
module.exports = { handleWorkflowRoutes };
