'use strict';

const fs = require('node:fs');
const path = require('node:path');

const numericColumns = new Set([
    'totp_step',
    'version',
    'counter',
    'created',
    'expires',
    'challenge_expires',
    'attempts',
    'verified',
    'backed_up'
]);

function normalize(row) {
    for (const [key, value] of Object.entries(row)) {
        if (numericColumns.has(key) && value !== null) {
            row[key] = Number(value);
            if (!Number.isSafeInteger(row[key])) {
                throw new Error(`Invalid database integer: ${key}`);
            }
        }
    }
    return row;
}

class Database {
    constructor(engine, connection, bound = false) {
        this.engine = engine;
        this.connection = connection;
        this.bound = bound;
        this.tail = Promise.resolve();
    }

    // Every SQLite operation waits for the preceding transaction to finish.
    exclusive(operation) {
        const result = this.tail.then(operation);
        this.tail = result.catch(() => {});
        return result;
    }

    async query(sql, params = []) {
        if (this.engine === 'postgres') {
            const result = await this.connection.query(sql, params);
            return { rows: result.rows.map(normalize), changes: result.rowCount };
        }
        const operation = () => {
            // Only application-owned SQL uses these positional placeholders.
            const statement = this.connection.prepare(sql.replace(/\$\d+/g, '?'));
            if (/^\s*(SELECT|PRAGMA)\b|\bRETURNING\b/i.test(sql)) {
                const rows = statement.all(...params).map(normalize);
                return { rows, changes: rows.length };
            }
            return { rows: [], changes: Number(statement.run(...params).changes) };
        };
        return this.bound ? operation() : this.exclusive(operation);
    }

    async exec(sql) {
        if (this.engine === 'postgres') {
            return this.connection.query(sql);
        }
        const operation = () => this.connection.exec(sql);
        return this.bound ? operation() : this.exclusive(operation);
    }

    async transaction(operation) {
        if (this.bound) {
            throw new Error('Nested database transactions are not supported');
        }
        const run = async () => {
            const client =
                this.engine === 'postgres' ? await this.connection.connect() : this.connection;
            const db = new Database(this.engine, client, true);
            try {
                await db.exec(this.engine === 'postgres' ? 'BEGIN' : 'BEGIN IMMEDIATE');
                try {
                    const result = await operation(db);
                    await db.exec('COMMIT');
                    return result;
                } catch (err) {
                    await db.exec('ROLLBACK').catch(() => {});
                    throw err;
                }
            } finally {
                if (this.engine === 'postgres') {
                    client.release();
                }
            }
        };
        return this.engine === 'sqlite' ? this.exclusive(run) : run();
    }

    async close() {
        if (this.engine === 'postgres') {
            await this.connection.end();
        } else {
            await this.exclusive(() => this.connection.close());
        }
    }
}

function openDatabase(config, rootDir, { existing = false } = {}) {
    const engine = config.dbs?.engine ?? 'sqlite';
    if (!['sqlite', 'postgres'].includes(engine)) {
        throw new Error('dbs.engine must be sqlite or postgres');
    }
    if (engine === 'postgres') {
        const connectionString = config.dbs?.postgres;
        if (
            typeof connectionString !== 'string' ||
            !/^postgres(?:ql)?:\/\//.test(connectionString)
        ) {
            throw new Error('Configure dbs.postgres with a PostgreSQL connection URL');
        }
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
        pool.on('error', () => console.error('An idle PostgreSQL connection failed'));
        return new Database(engine, pool);
    }
    const filename = path.resolve(rootDir, config.dbs?.sqlite || 'data/admin.sqlite');
    if (existing && !fs.existsSync(filename)) {
        throw new Error('Administrator database does not exist');
    }
    if (!existing) {
        fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    }
    const { DatabaseSync } = require('node:sqlite');
    const db = new Database(engine, new DatabaseSync(filename));
    db.filename = filename;
    fs.chmodSync(filename, 0o600);
    db.connection.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    return db;
}

module.exports = { openDatabase };
