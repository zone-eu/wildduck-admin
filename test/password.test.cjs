'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { hashPassword, parsePasswordHash, verifyPassword } = require('../server/password.cjs');

test('password hashes have random salts and verify exact Unicode passwords', async () => {
    const password = 'a long pässword 🦆 with spaces ';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    assert.notEqual(first, second);
    assert.equal(await verifyPassword(password, first), true);
    assert.equal(await verifyPassword(password.trim(), first), false);
    assert.equal(await verifyPassword('incorrect', first), false);
    assert.equal(await verifyPassword('', first), false);
    assert.equal(await verifyPassword({ password }, first), false);
    assert.equal(await verifyPassword('x'.repeat(4097), first), false);
});

test('rejects plaintext, missing, corrupted, and excessive-work hashes', async () => {
    for (const value of [
        '',
        undefined,
        'admin',
        'sha256$abcdef',
        'scrypt$1048576$8$1$' + 'a'.repeat(32) + '$' + 'b'.repeat(128)
    ]) {
        assert.throws(() => parsePasswordHash(value), /passwordHash/);
    }
    await assert.rejects(hashPassword(''), /between 1 and 4096/);
    await assert.rejects(hashPassword('x'.repeat(4097)), /between 1 and 4096/);
});

test('hash CLI reads stdin, preserves spaces, and emits only a usable hash', async () => {
    const result = spawnSync(process.execPath, ['scripts/hash-password.cjs'], {
        input: ' cli password \n',
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(await verifyPassword(' cli password ', result.stdout.trim()), true);
    const empty = spawnSync(process.execPath, ['scripts/hash-password.cjs'], {
        input: '\n',
        encoding: 'utf8'
    });
    assert.equal(empty.status, 1);
});
