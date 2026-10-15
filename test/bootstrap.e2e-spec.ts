import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vite-plus/test';

const children = new Set<ChildProcess>();
const fixture = {
  NODE_ENV: 'production',
  SWAGGER_ENABLED: 'false',
  BETTER_AUTH_URL: 'http://localhost:43127',
  BETTER_AUTH_SECRET: 'integration-secret-at-least-thirty-two-characters',
  BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:43127',
};

async function reservePort(): Promise<{ server: Server; port: number }> {
  const server = createServer();
  server.listen(0, '0.0.0.0');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP port allocated');
  return { server, port: address.port };
}

function launch(overrides: Record<string, string>) {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error('Set TEST_DATABASE_URL before running integration tests.');
  const child = spawn(process.execPath, ['--enable-source-maps', 'dist/main.js'], {
    env: { ...process.env, ...fixture, DATABASE_URL: process.env.TEST_DATABASE_URL, ...overrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  const exited = once(child, 'exit');
  return { child, exited, output: () => output };
}

async function waitForServer(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Application exited before listening');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(300),
      });
      if (response.status === 200 && (await response.text()) === 'Hello World!') return;
    } catch {
      /* Startup is still in progress. */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Application did not listen within 12 seconds');
}

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
  }
  children.clear();
});

describe('compiled application startup', () => {
  it('fails invalid configuration without leaking its values', async () => {
    const process = launch({ APP_PORT: 'invalid', BETTER_AUTH_SECRET: 'do-not-log-this-secret' });
    const [code] = await process.exited;
    expect(code).toBe(1);
    expect(process.output()).toContain('Application startup failed');
    expect(process.output()).not.toContain('do-not-log-this-secret');
  });

  it('fails unavailable database connections without leaking the URL', async () => {
    const process = launch({
      DATABASE_URL: 'postgresql://postgres:do-not-log-this-password@127.0.0.1:1/core_test',
    });
    const [code] = await process.exited;
    expect(code).toBe(1);
    expect(process.output()).toContain('Application startup failed');
    expect(process.output()).not.toContain('do-not-log-this-password');
  });

  it('cleans up and exits unsuccessfully when the port is occupied', async () => {
    const { server, port } = await reservePort();
    try {
      const process = launch({ APP_PORT: String(port) });
      const [code] = await process.exited;
      expect(code).toBe(1);
      expect(process.output()).toContain('Application startup failed');
    } finally {
      server.close();
    }
  });

  it.each(['false', 'true'])(
    'honors production Swagger opt-in %s and exits on SIGTERM',
    async (SWAGGER_ENABLED) => {
      const { server, port } = await reservePort();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      const process = launch({ APP_PORT: String(port), SWAGGER_ENABLED });
      await waitForServer(port, process.child);
      const docs = await fetch(`http://127.0.0.1:${port}/docs-json`);
      expect(docs.status).toBe(SWAGGER_ENABLED === 'true' ? 200 : 404);
      process.child.kill('SIGTERM');
      const [code, signal] = await process.exited;
      expect(code === 0 || signal === 'SIGTERM').toBe(true);
    },
  );
});
