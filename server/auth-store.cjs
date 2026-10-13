'use strict';

const { openDatabase } = require('./database.cjs');
const { randomBytes, createHash, createCipheriv, createDecipheriv } = require('node:crypto');
const fs = require('node:fs');

class AuthStore {
    constructor(db, key) {
        this.db = db;
        this.key = key;
    }

    static async open(config, rootDir) {
        const engine = config.dbs?.engine ?? 'sqlite';
        let secret = config.totp?.secret || '';
        if (engine === 'postgres' && !secret) {
            throw new Error('Configure a persistent totp.secret when using PostgreSQL');
        }
        const db = openDatabase(config, rootDir);
        try {
            if (!secret) {
                const keyFile = `${db.filename}.key`;
                try {
                    fs.writeFileSync(keyFile, randomBytes(32).toString('hex'), {
                        flag: 'wx',
                        mode: 0o600
                    });
                } catch (err) {
                    if (err.code !== 'EEXIST') {
                        throw err;
                    }
                }
                secret = fs.readFileSync(keyFile, 'utf8').trim();
                if (!secret) {
                    throw new Error('The local 2FA encryption key is empty');
                }
            }
            const store = new AuthStore(db, createHash('sha256').update(secret).digest());
            await store.initialize();
            return store;
        } catch (err) {
            await db.close();
            throw err;
        }
    }

    async initialize() {
        if (this.db.engine === 'sqlite') {
            await this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
        }
        await this.db.transaction(async db => {
            if (db.engine === 'postgres') {
                await db.query('SELECT pg_advisory_xact_lock(1464090945)');
            }
            const binary = db.engine === 'postgres' ? 'BYTEA' : 'BLOB';
            const integer = db.engine === 'postgres' ? 'BIGINT' : 'INTEGER';
            await db.exec(`
                CREATE TABLE IF NOT EXISTS admins (
                    username TEXT PRIMARY KEY,
                    user_id ${binary} NOT NULL,
                    totp_secret TEXT,
                    totp_step ${integer} NOT NULL DEFAULT -1,
                    version ${integer} NOT NULL DEFAULT 0,
                    policy TEXT
                );
                CREATE TABLE IF NOT EXISTS credentials (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL REFERENCES admins(username),
                    name TEXT NOT NULL,
                    public_key ${binary} NOT NULL,
                    counter ${integer} NOT NULL,
                    transports TEXT NOT NULL,
                    device_type TEXT NOT NULL,
                    backed_up ${integer} NOT NULL,
                    created ${integer} NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL REFERENCES admins(username),
                    version ${integer} NOT NULL,
                    verified ${integer} NOT NULL,
                    expires ${integer} NOT NULL,
                    challenge_kind TEXT,
                    challenge_data TEXT,
                    challenge_expires ${integer}
                );
                CREATE TABLE IF NOT EXISTS auth_attempts (
                    scope TEXT PRIMARY KEY,
                    attempts ${integer} NOT NULL,
                    expires ${integer} NOT NULL
                );
            `);
            if (db.engine === 'postgres') {
                await db.exec('ALTER TABLE admins ADD COLUMN IF NOT EXISTS policy TEXT');
            } else if (
                !(await db.query('PRAGMA table_info(admins)')).rows.some(
                    column => column.name === 'policy'
                )
            ) {
                await db.exec('ALTER TABLE admins ADD COLUMN policy TEXT');
            }
            await db.query('DELETE FROM sessions WHERE expires <= $1', [Date.now()]);
            await db.query('DELETE FROM auth_attempts WHERE expires <= $1', [Date.now()]);
        });
    }

    async transaction(username, operation) {
        return this.db.transaction(async db => {
            const store = new AuthStore(db, this.key);
            if (db.engine === 'postgres') {
                await db.query('SELECT username FROM admins WHERE username = $1 FOR UPDATE', [
                    username
                ]);
            }
            return operation(store);
        });
    }

    async get(sql, ...params) {
        return (await this.db.query(sql, params)).rows[0];
    }
    async all(sql, ...params) {
        return (await this.db.query(sql, params)).rows;
    }
    async run(sql, ...params) {
        return this.db.query(sql, params);
    }
    async close() {
        await this.db.close();
    }

    async admin(username) {
        await this.run(
            'INSERT INTO admins (username, user_id) VALUES ($1, $2) ON CONFLICT(username) DO NOTHING',
            username,
            randomBytes(32)
        );
        return this.get('SELECT * FROM admins WHERE username = $1', username);
    }

    async credentials(username) {
        return this.all('SELECT * FROM credentials WHERE username = $1 ORDER BY created', username);
    }

    async session(id, username) {
        return this.get(
            `SELECT sessions.* FROM sessions JOIN admins USING (username)
            WHERE sessions.id = $1 AND sessions.username = $2 AND sessions.expires > $3 AND sessions.version = admins.version`,
            id,
            username,
            Date.now()
        );
    }

    async createSession(username, verified, maxAge) {
        const admin = await this.admin(username);
        const session = {
            id: randomBytes(24).toString('base64url'),
            username,
            version: admin.version,
            verified: verified ? 1 : 0,
            expires: Date.now() + maxAge * 1000
        };
        await this.run('DELETE FROM sessions WHERE expires <= $1', Date.now());
        await this.run(
            'INSERT INTO sessions (id, username, version, verified, expires) VALUES ($1, $2, $3, $4, $5)',
            session.id,
            username,
            session.version,
            session.verified,
            session.expires
        );
        return session;
    }

    async revokeSession(id) {
        await this.run('DELETE FROM sessions WHERE id = $1', id);
    }

    // Invalidate older sessions after a method changes; keep only the verified caller.
    async methodsChanged(session, maxAge) {
        await this.run(
            'UPDATE admins SET version = version + 1 WHERE username = $1',
            session.username
        );
        const version = (await this.admin(session.username)).version;
        await this.run(
            'DELETE FROM sessions WHERE username = $1 AND id != $2',
            session.username,
            session.id
        );
        const newId = randomBytes(24).toString('base64url');
        await this.run(
            `UPDATE sessions SET id = $1, version = $2, verified = 1, expires = $3, challenge_kind = NULL,
            challenge_data = NULL, challenge_expires = NULL WHERE id = $4`,
            newId,
            version,
            Date.now() + maxAge * 1000,
            session.id
        );
        session.id = newId;
        session.version = version;
    }

    async promote(session, maxAge) {
        const newId = randomBytes(24).toString('base64url');
        const result = await this.run(
            `UPDATE sessions SET id = $1, verified = 1, expires = $2, challenge_kind = NULL, challenge_data = NULL,
            challenge_expires = NULL WHERE id = $3 AND version = $4 AND expires > $5`,
            newId,
            Date.now() + maxAge * 1000,
            session.id,
            session.version,
            Date.now()
        );
        if (!result.changes) {
            throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
        }
        return this.session(newId, session.username);
    }

    async setChallenge(session, kind, data, lifetime = 300) {
        await this.run(
            'UPDATE sessions SET challenge_kind = $1, challenge_data = $2, challenge_expires = $3 WHERE id = $4',
            kind,
            JSON.stringify(data),
            Date.now() + lifetime * 1000,
            session.id
        );
    }

    async challenge(session, kind, consume = false) {
        const read = async store => {
            const lock = consume && store.db.engine === 'postgres' ? ' FOR UPDATE' : '';
            const row = await store.get(
                `SELECT challenge_data FROM sessions
                WHERE id = $1 AND challenge_kind = $2 AND challenge_expires > $3${lock}`,
                session.id,
                kind,
                Date.now()
            );
            if (!row) {
                throw Object.assign(new Error('Setup or challenge expired. Please start again.'), {
                    statusCode: 400
                });
            }
            if (consume) {
                await store.clearChallenge(session);
            }
            return JSON.parse(row.challenge_data);
        };
        return consume && !this.db.bound ? this.transaction(session.username, read) : read(this);
    }

    async clearChallenge(session) {
        await this.run(
            'UPDATE sessions SET challenge_kind = NULL, challenge_data = NULL, challenge_expires = NULL WHERE id = $1',
            session.id
        );
    }

    // Charge every attempt before asynchronous verification, so parallel requests cannot bypass the limit.
    async attempt(username, scope, limit = 6, window = 180) {
        const key = `${username}:${scope}`;
        const now = Date.now();
        const row = await this.get(
            `INSERT INTO auth_attempts (scope, attempts, expires) VALUES ($1, 1, $2)
            ON CONFLICT(scope) DO UPDATE SET
                attempts = CASE WHEN auth_attempts.expires <= $3 THEN 1 ELSE auth_attempts.attempts + 1 END,
                expires = CASE WHEN auth_attempts.expires <= $4 THEN $5 ELSE auth_attempts.expires END
            WHERE auth_attempts.expires <= $6 OR auth_attempts.attempts < $7 RETURNING attempts`,
            key,
            now + window * 1000,
            now,
            now,
            now + window * 1000,
            now,
            limit
        );
        if (!row) {
            throw Object.assign(new Error('Too many attempts. Please wait and try again.'), {
                statusCode: 429
            });
        }
    }

    async clearAttempts(username, scope) {
        await this.run('DELETE FROM auth_attempts WHERE scope = $1', `${username}:${scope}`);
    }

    async setPolicy(username, policy) {
        await this.run(
            'UPDATE admins SET policy = $1, version = version + 1 WHERE username = $2',
            policy,
            username
        );
        await this.run('DELETE FROM sessions WHERE username = $1', username);
    }

    async setTotp(username, secret, step) {
        await this.run(
            'UPDATE admins SET totp_secret = $1, totp_step = $2 WHERE username = $3',
            secret,
            step,
            username
        );
    }

    async useTotp(username, step) {
        return this.run(
            'UPDATE admins SET totp_step = $1 WHERE username = $2 AND totp_step < $3',
            step,
            username,
            step
        );
    }

    async addCredential(username, name, credential, deviceType, backedUp) {
        await this.run(
            `INSERT INTO credentials (id, username, name, public_key, counter, transports, device_type, backed_up, created)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            credential.id,
            username,
            name,
            Buffer.from(credential.publicKey),
            credential.counter,
            JSON.stringify(credential.transports || []),
            deviceType,
            backedUp ? 1 : 0,
            Date.now()
        );
    }

    async updateCounter(username, id, previous, next) {
        return this.run(
            'UPDATE credentials SET counter = $1 WHERE id = $2 AND username = $3 AND counter = $4',
            next,
            id,
            username,
            previous
        );
    }

    async deleteCredential(username, id) {
        await this.run('DELETE FROM credentials WHERE id = $1 AND username = $2', id, username);
    }

    async reset(username) {
        await this.transaction(username, async store => {
            if (!(await store.get('SELECT username FROM admins WHERE username = $1', username))) {
                throw new Error('Administrator not found in the database');
            }
            await store.run('DELETE FROM credentials WHERE username = $1', username);
            await store.run(
                'UPDATE admins SET totp_secret = NULL, totp_step = -1, version = version + 1 WHERE username = $1',
                username
            );
            await store.run('DELETE FROM sessions WHERE username = $1', username);
            await store.run(
                'DELETE FROM auth_attempts WHERE scope IN ($1, $2)',
                `${username}:password`,
                `${username}:2fa`
            );
        });
    }

    encrypt(secret) {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
        return [iv, cipher.getAuthTag(), ciphertext]
            .map(part => part.toString('base64url'))
            .join('.');
    }

    decrypt(encrypted) {
        const [iv, tag, data] = encrypted.split('.').map(part => Buffer.from(part, 'base64url'));
        const cipher = createDecipheriv('aes-256-gcm', this.key, iv);
        cipher.setAuthTag(tag);
        return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
    }
}

module.exports = { AuthStore };
