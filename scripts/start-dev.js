const { spawn } = require('node:child_process');

const childProcesses = [];
let shuttingDown = false;

function spawnNodeProcess(args) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: process.env
  });

  childProcesses.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopAllChildren(child);

    if (typeof code === 'number') {
      process.exit(code);
      return;
    }

    process.exit(signal ? 1 : 0);
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(error);
    stopAllChildren(child);
    process.exit(1);
  });
}

function stopAllChildren(excludeChild) {
  for (const child of childProcesses) {
    if (child === excludeChild || child.killed) {
      continue;
    }

    child.kill('SIGTERM');
  }
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopAllChildren();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

spawnNodeProcess(['app.js']);
