import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseService, DrizzleModule } from './drizzle/drizzle.module.js';
import { createAuth } from './lib/auth.js';
import { Environment, validateEnvironment } from './config/env.js';
import { SafeExceptionFilter } from './common/safe-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    DrizzleModule,
    AuthModule.forRootAsync({
      imports: [DrizzleModule],
      inject: [ConfigService, DatabaseService],
      useFactory: (config: ConfigService<Environment, true>, database: DatabaseService) => ({
        auth: createAuth(
          {
            NODE_ENV: config.get('NODE_ENV', { infer: true }),
            APP_PORT: config.get('APP_PORT', { infer: true }),
            DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
            BETTER_AUTH_SECRET: config.get('BETTER_AUTH_SECRET', { infer: true }),
            BETTER_AUTH_URL: config.get('BETTER_AUTH_URL', { infer: true }),
            BETTER_AUTH_TRUSTED_ORIGINS: config.get('BETTER_AUTH_TRUSTED_ORIGINS', { infer: true }),
            SWAGGER_ENABLED: config.get('SWAGGER_ENABLED', { infer: true }),
          },
          database.db,
        ),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: SafeExceptionFilter }],
})
export class AppModule {}
