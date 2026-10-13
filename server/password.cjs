'use strict';

const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
const options = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// Fixed work factors keep config mistakes from causing excessive CPU/memory use.
function parsePasswordHash(value) {
    if (
        typeof value !== 'string' ||
        !/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value)
    ) {
        throw new Error(
            'Configure admin.auth.passwordHash with a hash from npm run password:hash. Plaintext passwords are no longer supported.'
        );
    }
    const parts = value.split('$');
    return { salt: Buffer.from(parts[4], 'hex'), key: Buffer.from(parts[5], 'hex') };
}

async function hashPassword(password) {
    if (typeof password !== 'string' || !password.length || Buffer.byteLength(password) > 4096) {
        throw new Error('Password must contain between 1 and 4096 UTF-8 bytes');
    }
    const salt = randomBytes(16);
    const key = await derive(password, salt, 64, options);
    return `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
    if (typeof password !== 'string' || !password.length || Buffer.byteLength(password) > 4096) {
        return false;
    }
    const { salt, key } = parsePasswordHash(stored);
    const candidate = await derive(password, salt, key.length, options);
    return timingSafeEqual(candidate, key);
}

module.exports = { hashPassword, parsePasswordHash, verifyPassword };
