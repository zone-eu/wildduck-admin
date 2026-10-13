import { spawn } from 'node:child_process';

const processes = [];
const isWindows = process.platform === 'win32';

function start(name, command, args, env = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', chunk => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', chunk => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', code => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopAll();
    process.exit(code ?? 0);
  });

  processes.push(child);
}

function stopAll() {
  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

let shuttingDown = false;

process.on('SIGINT', () => {
  shuttingDown = true;
  stopAll();
  process.exit(130);
});

process.on('SIGTERM', () => {
  shuttingDown = true;
  stopAll();
  process.exit(143);
});

start('server', process.execPath, ['server/index.cjs'], { NODE_ENV: 'development' });
start('vite', isWindows ? 'npm.cmd' : 'npm', ['exec', 'vite', '--', '--host', '127.0.0.1']);
