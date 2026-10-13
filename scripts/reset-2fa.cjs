'use strict';

const path = require('node:path');
const { openDatabase } = require('../server/database.cjs');
const { AuthStore } = require('../server/auth-store.cjs');
const config = require('../server/config.cjs');
const username = String(config.admin?.auth?.username || 'admin');

async function reset() {
    if (!process.argv.includes(`--confirm=${username}`)) {
        console.error(
            `To reset administrator 2FA for ${username}, stop the admin server and run npm run 2fa:reset -- --confirm=${username}`
        );
        process.exitCode = 1;
        return;
    }
    const db = openDatabase(config, path.resolve(__dirname, '..'), { existing: true });
    try {
        // Recovery neither initializes a schema nor requires the encryption key.
        await new AuthStore(db).reset(username);
        console.log(
            `Administrator 2FA reset for ${username}. All admin sessions were revoked. Strict mode will require enrollment at the next sign-in.`
        );
    } finally {
        await db.close();
    }
}

reset().catch(() => {
    console.error(
        'Could not reset administrator 2FA. Check database configuration, connectivity, and that the administrator exists.'
    );
    process.exitCode = 1;
});
