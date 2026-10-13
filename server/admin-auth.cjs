'use strict';

const { isIP } = require('node:net');
const { createHash } = require('node:crypto');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const { verifyPassword } = require('./password.cjs');
const { AuthStore } = require('./auth-store.cjs');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

class AdminAuth {
    constructor(config, adminConfig) {
        this.username = adminConfig.auth.username;
        this.passwordHash = adminConfig.auth.passwordHash;
        this.maxAge = adminConfig.sessionMaxAge;
        this.strict = Boolean(config.admin?.auth?.strict2fa);
        this.totpEnabled = config.totp?.enabled !== false;
        this.webauthnEnabled = config.webauthn?.enabled !== false;
        this.issuer = String(config.totp?.issuer || config.name || 'WildDuck Admin UI');
        this.rpName = String(config.webauthn?.rpName || config.name || 'WildDuck Admin UI');
        this.attachment = config.webauthn?.authenticatorAttachment || undefined;
        this.userVerification = config.webauthn?.userVerification || 'preferred';
        if (this.strict && !this.totpEnabled && !this.webauthnEnabled) {
            throw new Error('Strict 2FA requires at least one enabled method');
        }
        if (this.attachment && !['platform', 'cross-platform'].includes(this.attachment)) {
            throw new Error('Invalid webauthn.authenticatorAttachment');
        }
        if (!['required', 'preferred', 'discouraged'].includes(this.userVerification)) {
            throw new Error('Invalid webauthn.userVerification');
        }
        const configuredOrigin = config.webauthn?.origin || [
            'http://localhost:3100',
            'http://localhost:5173'
        ];
        this.origins = [].concat(configuredOrigin).map(value => {
            const url = new URL(String(value));
            if (
                isIP(url.hostname.replace(/^\[|\]$/g, '')) ||
                url.origin !== value ||
                (url.protocol !== 'https:' &&
                    !(url.protocol === 'http:' && url.hostname === 'localhost'))
            ) {
                throw new Error(
                    'webauthn.origin must use an HTTPS domain name (or HTTP localhost), without an IP address, path, or trailing slash'
                );
            }
            return url.origin;
        });
        this.rpId = String(config.webauthn?.rpId || new URL(this.origins[0]).hostname);
        if (
            !this.rpId ||
            isIP(this.rpId.replace(/^\[|\]$/g, '')) ||
            this.origins.some(origin => {
                const hostname = new URL(origin).hostname;
                return hostname !== this.rpId && !hostname.endsWith(`.${this.rpId}`);
            })
        ) {
            throw new Error(
                'webauthn.rpId must match the configured origin hostname or its parent domain'
            );
        }
    }

    async initialize(config, rootDir) {
        this.store = await AuthStore.open(config, rootDir);
        try {
            await this.store.admin(this.username);
            const policy = createHash('sha256')
                .update(
                    JSON.stringify({
                        passwordHash: this.passwordHash,
                        strict: this.strict,
                        totpEnabled: this.totpEnabled,
                        webauthnEnabled: this.webauthnEnabled,
                        origins: this.origins,
                        rpId: this.rpId,
                        userVerification: this.userVerification
                    })
                )
                .digest('hex');
            await this.store.transaction(this.username, async store => {
                const account = await store.admin(this.username);
                if (account.policy !== policy) {
                    await store.setPolicy(this.username, policy);
                }
                // Detect a changed/missing encryption key before accepting requests.
                if (account.totp_secret) {
                    store.decrypt(account.totp_secret);
                }
            });
        } catch (err) {
            await this.store.close();
            throw err;
        }
    }

    async methods(store = this.store) {
        const admin = await store.admin(this.username);
        const methods = [];
        if (this.totpEnabled && admin.totp_secret) {
            methods.push('totp');
        }
        if (this.webauthnEnabled && (await store.credentials(this.username)).length) {
            methods.push('webauthn');
        }
        return methods;
    }

    async canAccess(session, store = this.store) {
        if (!session) {
            return false;
        }
        const methods = await this.methods(store);
        const current = await store.session(session.id, this.username);
        return Boolean(current && (methods.length ? current.verified : !this.strict));
    }

    async status(session, store = this.store) {
        const methods = session ? await this.methods(store) : [];
        const admin = session ? await store.admin(this.username) : null;
        return {
            strict: this.strict,
            totpAllowed: this.totpEnabled,
            webauthnAllowed: this.webauthnEnabled,
            methods,
            totpEnrolled: Boolean(admin?.totp_secret),
            credentials: session
                ? (await store.credentials(this.username)).map(row => ({
                      id: row.id,
                      name: row.name,
                      created: new Date(row.created).toISOString()
                  }))
                : [],
            setupRequired: Boolean(session && this.strict && !methods.length),
            verificationRequired: Boolean(session && methods.length && !session.verified)
        };
    }

    async createSession(store = this.store) {
        return store.transaction(this.username, async transaction => {
            const full = !this.strict && !(await this.methods(transaction)).length;
            // Password-only sessions are never marked 2FA-verified.
            return transaction.createSession(this.username, false, full ? this.maxAge : 600);
        });
    }

    async current(session, store = this.store) {
        const current = await store.session(session.id, this.username);
        if (!current || current.version !== session.version) {
            throw fail('Authentication required', 401);
        }
        return current;
    }

    async requireManage(session, store = this.store) {
        await this.current(session, store);
        if (
            !(await this.canAccess(session, store)) &&
            !(this.strict && !(await this.methods(store)).length)
        ) {
            throw fail('Complete two-factor authentication first', 403);
        }
    }

    async confirmPassword(session, body, store = this.store) {
        // Mandatory first enrollment already follows a password login with a ten-minute lifetime.
        if (!(await this.canAccess(session, store))) {
            return;
        }
        await store.attempt(this.username, 'password', 8, 60);
        if (!(await verifyPassword(body.password, this.passwordHash))) {
            throw fail('Enter your current administrator password', 401);
        }
        await store.clearAttempts(this.username, 'password');
        await this.current(session, store);
    }

    totp(secret) {
        return new OTPAuth.TOTP({
            issuer: this.issuer,
            label: this.username,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret)
        });
    }

    tokenStep(secret, token) {
        if (typeof token !== 'string' || !/^\d{6}$/.test(token)) {
            throw fail('Enter a valid six-digit authenticator code');
        }
        const timestamp = Date.now();
        const delta = this.totp(secret).validate({ token, window: 1, timestamp });
        if (delta === null) {
            throw fail('Invalid authenticator code');
        }
        return Math.floor(timestamp / 30000) + delta;
    }

    async requireRemaining(excluding, store = this.store) {
        if (
            this.strict &&
            !(await this.methods(store)).filter(method => method !== excluding).length
        ) {
            throw fail(
                'Strict 2FA requires at least one method. Add another method before removing this one.',
                409
            );
        }
    }

    async handle(req, res, url, session, { readJson, sendJson, sendSession }) {
        if (!url.pathname.startsWith('/api/admin/2fa')) {
            return false;
        }
        const route = url.pathname.slice('/api/admin/2fa'.length);
        res.setHeader('Cache-Control', 'no-store');
        try {
            if (!session) {
                throw fail('Authentication required', 401);
            }
            if (route === '/status' && req.method === 'GET') {
                sendJson(res, 200, { success: true, ...(await this.status(session)) });
                return true;
            }
            if (!['POST', 'DELETE'].includes(req.method)) {
                throw fail('Method not allowed', 405);
            }
            if (req.headers['x-admin-request'] !== '1') {
                throw fail('Invalid admin request', 403);
            }
            const body = await readJson(req);
            if (!body || typeof body !== 'object' || Array.isArray(body)) {
                throw fail('Expected a JSON object');
            }
            if (route === '/totp/setup' && req.method === 'POST') {
                await this.requireManage(session);
                if (!this.totpEnabled) {
                    throw fail('TOTP is disabled', 403);
                }
                if ((await this.store.admin(this.username)).totp_secret) {
                    throw fail(
                        'TOTP is already enrolled. Remove it before setting up another authenticator.',
                        409
                    );
                }
                await this.confirmPassword(session, body);
                const secret = new OTPAuth.Secret({ size: 20 }).base32;
                const uri = this.totp(secret).toString();
                const qrCode = await QRCode.toDataURL(uri, { margin: 2, width: 240 });
                await this.current(session);
                await this.store.setChallenge(session, 'totp-enrollment', {
                    secret: this.store.encrypt(secret)
                });
                sendJson(res, 200, { success: true, secret, uri, qrCode });
                return true;
            }
            if (route === '/totp/enable' && req.method === 'POST') {
                await this.requireManage(session);
                if (!this.totpEnabled) {
                    throw fail('TOTP is disabled', 403);
                }
                await this.store.attempt(this.username, '2fa');
                const setup = await this.store.challenge(session, 'totp-enrollment');
                const step = this.tokenStep(this.store.decrypt(setup.secret), body.token);
                await this.store.transaction(this.username, async store => {
                    await this.current(session, store);
                    if ((await store.admin(this.username)).totp_secret) {
                        throw fail('TOTP is already enrolled', 409);
                    }
                    const currentSetup = await store.challenge(session, 'totp-enrollment', true);
                    if (currentSetup.secret !== setup.secret) {
                        throw fail('Setup changed. Please start again.');
                    }
                    await store.setTotp(this.username, setup.secret, step);
                    await store.methodsChanged(session, this.maxAge);
                });
                await this.store.clearAttempts(this.username, '2fa');
                await sendSession(res, await this.store.session(session.id, this.username));
                return true;
            }
            if (route === '/totp/verify' && req.method === 'POST') {
                if (!(await this.methods()).includes('totp')) {
                    throw fail('No active authenticator app is enrolled', 403);
                }
                await this.store.attempt(this.username, '2fa');
                const admin = await this.store.admin(this.username);
                const step = this.tokenStep(this.store.decrypt(admin.totp_secret), body.token);
                let promoted;
                await this.store.transaction(this.username, async store => {
                    await this.current(session, store);
                    if ((await store.admin(this.username)).totp_secret !== admin.totp_secret) {
                        throw fail('Authenticator changed. Please sign in again.', 401);
                    }
                    const used = await store.useTotp(this.username, step);
                    if (!used.changes) {
                        throw fail('This code has already been used. Wait for the next code.');
                    }
                    promoted = await store.promote(session, this.maxAge);
                });
                await this.store.clearAttempts(this.username, '2fa');
                await sendSession(res, promoted);
                return true;
            }
            if (route === '/totp' && req.method === 'DELETE') {
                await this.requireManage(session);
                if (!(await this.canAccess(session))) {
                    throw fail('Complete two-factor authentication first', 403);
                }
                if ((await this.methods()).includes('totp')) {
                    await this.requireRemaining('totp');
                }
                await this.confirmPassword(session, body);
                await this.store.transaction(this.username, async store => {
                    await this.current(session, store);
                    if ((await this.methods(store)).includes('totp')) {
                        await this.requireRemaining('totp', store);
                    }
                    await store.setTotp(this.username, null, -1);
                    await store.methodsChanged(session, this.maxAge);
                });
                await sendSession(res, await this.store.session(session.id, this.username));
                return true;
            }
            if (route.startsWith('/webauthn') && !this.webauthnEnabled) {
                throw fail('WebAuthn is disabled', 403);
            }
            if (route === '/webauthn/register/options' && req.method === 'POST') {
                await this.requireManage(session);
                if ((await this.store.credentials(this.username)).length >= 10) {
                    throw fail('At most ten passkeys may be enrolled');
                }
                await this.confirmPassword(session, body);
                const name = typeof body.name === 'string' ? body.name.trim().slice(0, 128) : '';
                if (!name) {
                    throw fail('Enter a name for this passkey');
                }
                const options = await generateRegistrationOptions({
                    rpName: this.rpName,
                    rpID: this.rpId,
                    userName: this.username,
                    userID: new Uint8Array((await this.store.admin(this.username)).user_id),
                    attestationType: 'none',
                    excludeCredentials: (await this.store.credentials(this.username)).map(row => ({
                        id: row.id,
                        transports: JSON.parse(row.transports)
                    })),
                    authenticatorSelection: {
                        residentKey: 'preferred',
                        userVerification: this.userVerification,
                        ...(this.attachment ? { authenticatorAttachment: this.attachment } : {})
                    }
                });
                await this.current(session);
                await this.store.setChallenge(session, 'webauthn-registration', {
                    challenge: options.challenge,
                    name
                });
                sendJson(res, 200, options);
                return true;
            }
            if (route === '/webauthn/register/verify' && req.method === 'POST') {
                await this.requireManage(session);
                await this.store.attempt(this.username, '2fa');
                const challenge = await this.store.challenge(
                    session,
                    'webauthn-registration',
                    true
                );
                const result = await verifyRegistrationResponse({
                    response: body.response,
                    expectedChallenge: challenge.challenge,
                    expectedOrigin: this.origins,
                    expectedRPID: this.rpId,
                    requireUserVerification: this.userVerification === 'required'
                }).catch(() => {
                    throw fail('Passkey registration could not be verified. Please try again.');
                });
                if (!result.verified || !result.registrationInfo) {
                    throw fail('Passkey registration failed');
                }
                const { credential, credentialDeviceType, credentialBackedUp } =
                    result.registrationInfo;
                await this.store.transaction(this.username, async store => {
                    await this.current(session, store);
                    if ((await store.credentials(this.username)).length >= 10) {
                        throw fail('At most ten passkeys may be enrolled');
                    }
                    await store.addCredential(
                        this.username,
                        challenge.name,
                        credential,
                        credentialDeviceType,
                        credentialBackedUp
                    );
                    await store.methodsChanged(session, this.maxAge);
                });
                await this.store.clearAttempts(this.username, '2fa');
                await sendSession(res, await this.store.session(session.id, this.username));
                return true;
            }
            if (route === '/webauthn/authenticate/options' && req.method === 'POST') {
                if (!(await this.methods()).includes('webauthn')) {
                    throw fail('No passkey is enrolled', 403);
                }
                const options = await generateAuthenticationOptions({
                    rpID: this.rpId,
                    userVerification: this.userVerification,
                    allowCredentials: (await this.store.credentials(this.username)).map(row => ({
                        id: row.id,
                        transports: JSON.parse(row.transports)
                    }))
                });
                await this.current(session);
                await this.store.setChallenge(session, 'webauthn-authentication', {
                    challenge: options.challenge
                });
                sendJson(res, 200, options);
                return true;
            }
            if (route === '/webauthn/authenticate/verify' && req.method === 'POST') {
                await this.store.attempt(this.username, '2fa');
                const challenge = await this.store.challenge(
                    session,
                    'webauthn-authentication',
                    true
                );
                const credential = (await this.store.credentials(this.username)).find(
                    row => row.id === body.response?.id
                );
                if (!credential) {
                    throw fail('Unknown passkey');
                }
                if (
                    body.response.response?.userHandle &&
                    body.response.response.userHandle !==
                        Buffer.from((await this.store.admin(this.username)).user_id).toString(
                            'base64url'
                        )
                ) {
                    throw fail('Passkey belongs to another account');
                }
                const result = await verifyAuthenticationResponse({
                    response: body.response,
                    expectedChallenge: challenge.challenge,
                    expectedOrigin: this.origins,
                    expectedRPID: this.rpId,
                    requireUserVerification: this.userVerification === 'required',
                    credential: {
                        id: credential.id,
                        publicKey: new Uint8Array(credential.public_key),
                        counter: credential.counter,
                        transports: JSON.parse(credential.transports)
                    }
                }).catch(() => {
                    throw fail('Passkey authentication could not be verified. Please try again.');
                });
                if (!result.verified) {
                    throw fail('Passkey authentication failed');
                }
                let promoted;
                await this.store.transaction(this.username, async store => {
                    await this.current(session, store);
                    const updated = await store.updateCounter(
                        this.username,
                        credential.id,
                        credential.counter,
                        result.authenticationInfo.newCounter
                    );
                    if (!updated.changes) {
                        throw fail('Passkey was used by another request. Please try again.');
                    }
                    promoted = await store.promote(session, this.maxAge);
                });
                await this.store.clearAttempts(this.username, '2fa');
                await sendSession(res, promoted);
                return true;
            }
            const credentialMatch = route.match(/^\/webauthn\/([^/]+)$/);
            if (credentialMatch && req.method === 'DELETE') {
                await this.requireManage(session);
                if (!(await this.canAccess(session))) {
                    throw fail('Complete two-factor authentication first', 403);
                }
                const credentials = await this.store.credentials(this.username);
                const id = decodeURIComponent(credentialMatch[1]);
                if (!credentials.some(row => row.id === id)) {
                    throw fail('Passkey not found', 404);
                }
                if (credentials.length === 1) {
                    await this.requireRemaining('webauthn');
                }
                await this.confirmPassword(session, body);
                await this.store.transaction(this.username, async store => {
                    await this.current(session, store);
                    const currentCredentials = await store.credentials(this.username);
                    if (!currentCredentials.some(row => row.id === id)) {
                        throw fail('Passkey not found', 404);
                    }
                    if (currentCredentials.length === 1) {
                        await this.requireRemaining('webauthn', store);
                    }
                    await store.deleteCredential(this.username, id);
                    await store.methodsChanged(session, this.maxAge);
                });
                await sendSession(res, await this.store.session(session.id, this.username));
                return true;
            }
            throw fail('Not found', 404);
        } catch (err) {
            sendJson(res, err.statusCode || 500, {
                success: false,
                error: err.statusCode
                    ? err.message
                    : 'Could not update administrator authentication'
            });
        }
        return true;
    }
}

module.exports = { AdminAuth };
