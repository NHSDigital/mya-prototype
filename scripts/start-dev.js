const { spawn } = require('node:child_process');
const net = require('node:net');

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

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let index = 0; index < maxAttempts; index += 1) {
    const candidate = startPort + index;
    // Pick the first free port near the default to keep URLs predictable.
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  return startPort;
}

async function main() {
  if (!process.env.PORT) {
    const defaultPort = 2000;
    const selectedPort = await findAvailablePort(defaultPort);

    if (selectedPort !== defaultPort) {
      console.log(`Port ${defaultPort} is in use. Starting on ${selectedPort}.`);
    }

    process.env.PORT = String(selectedPort);
  }

  spawnNodeProcess(['app.js']);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
