import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Environment } from './config/env.js';

export function configureApplication(app: INestApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  app.enableShutdownHooks();
  if (
    config.get('NODE_ENV', { infer: true }) !== 'production' ||
    config.get('SWAGGER_ENABLED', { infer: true })
  ) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Core API')
        .setDescription('NestJS API with Better Auth and Drizzle')
        .setVersion('1.0')
        .addServer(config.get('BETTER_AUTH_URL', { infer: true }))
        .addCookieAuth('better-auth.session_token')
        .addTag('app')
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'Core API Docs',
      swaggerOptions: { persistAuthorization: true },
    });
  }
}

export async function createApplication(): Promise<INestApplication> {
  // Import within the startup boundary so invalid configuration is caught by main.
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create(AppModule, { bodyParser: false, abortOnError: false });
  try {
    configureApplication(app);
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}

export async function bootstrap(): Promise<INestApplication> {
  let app: INestApplication | undefined;
  try {
    app = await createApplication();
    const config = app.get<ConfigService<Environment, true>>(ConfigService);
    await app.listen(config.get('APP_PORT', { infer: true }), '0.0.0.0');
    return app;
  } catch (error) {
    await app?.close();
    throw error;
  }
}
