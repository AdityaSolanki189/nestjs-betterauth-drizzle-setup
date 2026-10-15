import { Controller, Get, INestApplication, Logger, UnauthorizedException } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { SafeExceptionFilter } from './safe-exception.filter.js';

@Controller()
class FailingController {
  @Get('unexpected')
  unexpected() {
    throw new Error('database-password-must-not-leak');
  }

  @Get('unauthorized')
  unauthorized() {
    throw new UnauthorizedException('Sign in required');
  }
}

describe('safe HTTP errors', () => {
  let app: INestApplication;
  const logged: unknown[][] = [];

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
    const module = await Test.createTestingModule({
      controllers: [FailingController],
      providers: [{ provide: APP_FILTER, useClass: SafeExceptionFilter }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  it('sanitizes unexpected errors in HTTP responses and logs', async () => {
    const response = await request(app.getHttpServer()).get('/unexpected').expect(500);
    expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(JSON.stringify(logged)).not.toContain('database-password-must-not-leak');
  });

  it('preserves expected HTTP exception responses', async () => {
    const response = await request(app.getHttpServer()).get('/unauthorized').expect(401);
    expect(response.body).toMatchObject({ statusCode: 401, message: 'Sign in required' });
  });
});
