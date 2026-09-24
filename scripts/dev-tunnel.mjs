/**
 * Starts the Cloudflare tunnel and both applications together (`pnpm dev:tunnel`).
 *
 * Testing on a real domain needs three processes: the tunnel, the API and the web
 * app. pnpm cannot start a root script and a workspace script in parallel — its
 * `--parallel` applies the pattern to workspace projects, so the tunnel would be
 * skipped — and a shell one-liner would only work on one operating system. Node
 * spawns both, forwards their output, and stops the other when one exits, so
 * Ctrl-C leaves nothing behind.
 *
 * The `.env` files still have to be in tunnel mode; see local development docs.
 */
import { spawn } from 'node:child_process';

const commands = [
  {
    name: 'tunnel',
    command: 'cloudflared',
    args: ['tunnel', 'run', 'languze-dev'],
  },
  { name: 'apps', command: 'pnpm', args: ['dev'] },
];

// `shell: true` because both are scripts rather than executables on Windows.
// Away from Windows each child leads its own process group, so the whole group can
// be signalled at once; on Windows that job belongs to `taskkill /t` below.
const onWindows = process.platform === 'win32';
const children = commands.map(({ command, args }) =>
  spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    detached: !onWindows,
  }),
);

/**
 * Stops a child and everything it started. Killing the child alone is not enough:
 * `pnpm dev` is a launcher, and its own children — the API and the web server —
 * would keep the ports and go on running unattended.
 */
function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (onWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // Already gone, which is the state this was aiming for.
  }
}

let stopping = false;
const stopAll = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) stop(child);
};

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

children.forEach((child, index) => {
  child.on('error', (error) => {
    console.error(
      `\nCould not start ${commands[index].command}: ${error.message}`,
    );
    if (commands[index].name === 'tunnel') {
      console.error(
        'Install cloudflared and make sure it is on PATH, or run `pnpm dev` without the tunnel.',
      );
    }
    stopAll();
    process.exitCode = 1;
  });

  child.on('exit', (code) => {
    // One of the three going down leaves a half-working setup, so both stop.
    stopAll();
    if (!process.exitCode) process.exitCode = code ?? 0;
  });
});
