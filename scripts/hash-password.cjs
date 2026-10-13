'use strict';

const { hashPassword } = require('../server/password.cjs');

async function readPassword() {
    if (!process.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks)
            .toString('utf8')
            .replace(/\r?\n$/, '');
    }
    process.stderr.write('Admin password (input hidden): ');
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    return new Promise((resolve, reject) => {
        let password = '';
        const finish = () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            process.stderr.write('\n');
        };
        function onData(chunk) {
            for (const char of chunk) {
                if (char === '\u0003') {
                    finish();
                    reject(new Error('Cancelled'));
                    return;
                }
                if (char === '\r' || char === '\n') {
                    finish();
                    resolve(password);
                    return;
                }
                if (char === '\u007f' || char === '\b') {
                    password = Array.from(password).slice(0, -1).join('');
                } else if (char >= ' ') {
                    password += char;
                }
            }
        }
        process.stdin.on('data', onData);
    });
}

readPassword()
    .then(hashPassword)
    .then(value => process.stdout.write(`${value}\n`))
    .catch(err => {
        process.stderr.write(`${err.message}\n`);
        process.exitCode = 1;
    });
