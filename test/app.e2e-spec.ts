import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { configureApplication } from '../src/bootstrap.js';
import { DatabaseService } from '../src/drizzle/drizzle.module.js';

const email = 'ada@example.com';
const password = 'integration-password-123';

describe('application authentication (PostgreSQL)', () => {
  let app: INestApplication;
  let admin: postgres.Sql;
  let database: postgres.Sql;
  let databaseService: DatabaseService;
  const databaseName = `test_${randomUUID().replaceAll('-', '')}`;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL test database.');
    admin = postgres(process.env.TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.pathname = databaseName;
    database = postgres(url.toString(), { max: 1, onnotice: () => {} });
    const baseline = mkdtempSync(join(tmpdir(), 'template-baseline-'));
    try {
      mkdirSync(join(baseline, 'meta'));
      const journal = JSON.parse(
        readFileSync('./src/database/migrations/meta/_journal.json', 'utf8'),
      ) as { entries: { idx: number }[] };
      writeFileSync(
        join(baseline, 'meta/_journal.json'),
        JSON.stringify({ ...journal, entries: journal.entries.filter((entry) => entry.idx === 0) }),
      );
      copyFileSync(
        './src/database/migrations/0000_charming_spitfire.sql',
        join(baseline, '0000_charming_spitfire.sql'),
      );
      await migrate(drizzle(database), { migrationsFolder: baseline });
      await database`insert into "user" (id, name, email, updated_at) values ('legacy-user', 'Existing user', 'legacy@example.com', now())`;
    } finally {
      rmSync(baseline, { recursive: true, force: true });
    }
    await migrate(drizzle(database), {
      migrationsFolder: './src/database/migrations',
    });
    // Applying an existing history again must not recreate tables or lose data.
    await migrate(drizzle(database), {
      migrationsFolder: './src/database/migrations',
    });
    for (const [key, value] of Object.entries({
      NODE_ENV: 'test',
      DATABASE_URL: url.toString(),
      APP_PORT: '43127',
      BETTER_AUTH_URL: 'http://localhost:43127',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-fixture',
      BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:43127',
    }))
      vi.stubEnv(key, value);
    const { AppModule } = await import('../src/app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApplication(app);
    await app.init();
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await database?.end({ timeout: 5 });
      if (admin) {
        await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
        await admin.end({ timeout: 5 });
      }
      vi.unstubAllEnvs();
    }
  });

  it('preserves existing user data when upgrading the original migration', async () => {
    const users = await database`select name, email from \"user\" where id = 'legacy-user'`;
    expect(users[0]).toMatchObject({ name: 'Existing user', email: 'legacy@example.com' });
  });

  it('serves the public greeting with real constructor injection', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('rejects missing and malformed sessions on /me', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
    await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', 'better-auth.session_token=invalid')
      .expect(401);
  });

  it('signs up, signs in, reads the session and signs out', async () => {
    const agent = request.agent(app.getHttpServer());
    agent.set('Origin', 'http://localhost:43127');
    await agent.post('/api/auth/sign-up/email').send({ name: 'Ada', email, password }).expect(200);
    await agent.get('/me').expect(200).expect('Hello Ada');
    const session = await agent.get('/api/auth/get-session').expect(200);
    expect(session.body.user).toMatchObject({ name: 'Ada', email });
    await agent.post('/api/auth/sign-out').send({}).expect(200);
    await agent.get('/me').expect(401);
    await agent.post('/api/auth/sign-in/email').send({ email, password }).expect(200);
    await agent.get('/me').expect(200).expect('Hello Ada');
    await agent.post('/api/auth/sign-out').send({}).expect(200);
  });

  it('rejects invalid credentials without exposing internal errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    expect(JSON.stringify(response.body)).not.toContain('postgresql:');
  });

  it('rejects untrusted signup origins', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'https://untrusted.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Sec-Fetch-Mode', 'cors')
      .send({ name: 'Eve', email: 'eve@example.com', password })
      .expect(403);
  });

  it('exposes Swagger in development/test', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(response.body.paths).toHaveProperty('/me');
  });

  it('closes the application database pool', async () => {
    await app.close();
    await expect(databaseService.client`select 1`).rejects.toMatchObject({
      code: 'CONNECTION_ENDED',
    });
  });
});
