import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

if (!process.env.TEST_DATABASE_URL)
  throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL server.');
const image = process.argv[2] ?? 'template-ci';
const name = `template-smoke-${randomUUID()}`;
const directory = mkdtempSync(join(tmpdir(), 'template-smoke-'));
const database = new URL(process.env.TEST_DATABASE_URL);
if (['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
  database.hostname = 'host.docker.internal';
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let started = false;
try {
  const envFile = join(directory, '.env');
  writeFileSync(
    envFile,
    [
      'NODE_ENV=production',
      'APP_PORT=43127',
      'SWAGGER_ENABLED=false',
      `DATABASE_URL=${database}`,
      'BETTER_AUTH_URL=http://localhost:43127',
      'BETTER_AUTH_SECRET=container-fixture-secret-at-least-32-characters',
    ].join('\n'),
    { mode: 0o600 },
  );
  docker(
    'run',
    '--detach',
    '--name',
    name,
    '--add-host',
    'host.docker.internal:host-gateway',
    '--publish',
    '127.0.0.1::43127',
    '--env-file',
    envFile,
    image,
  );
  started = true;
  const mapping = docker('port', name, '43127/tcp');
  const port = mapping.split(':').at(-1);
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(500) });
      if (response.ok && (await response.text()) === 'Hello World!') {
        ready = true;
        break;
      }
    } catch {
      /* Wait for application initialization. */
    }
    if (docker('inspect', '--format', '{{.State.Running}}', name) !== 'true')
      throw new Error('Container exited during startup');
    await setTimeout(100);
  }
  assert.ok(ready, 'Container must serve the public greeting');
  assert.equal((await fetch(`${origin}/me`)).status, 401);
  assert.equal((await fetch(`${origin}/docs-json`)).status, 404);
  assert.equal(docker('exec', name, 'id', '-u'), '1000', 'Production must run as node');
  docker(
    'exec',
    name,
    'node',
    '-e',
    "const fs=require('node:fs'); for(const p of ['.env','node_modules/vite-plus','/usr/local/bin/bun']) if(fs.existsSync(p)) process.exit(1)",
  );
  docker('stop', '--time', '15', name);
  assert.ok(
    ['0', '143'].includes(docker('inspect', '--format', '{{.State.ExitCode}}', name)),
    'SIGTERM must shut down before Docker kills the process',
  );
  console.log(
    'Production container passed: greeting, auth guard, Swagger off, non-root user, runtime-only image, graceful SIGTERM.',
  );
} catch {
  console.error(
    'Production container smoke test failed. Inspect the test image and its runtime configuration.',
  );
  process.exitCode = 1;
} finally {
  if (started) docker('rm', '--force', name);
  rmSync(directory, { recursive: true, force: true });
}
