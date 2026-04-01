import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const port = Number(process.env.APP_PORT ?? 3000);
  const enableSwagger =
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Core API')
      .setDescription('NestJS API with Better Auth and Drizzle')
      .setVersion('1.0')
      .addServer(`http://localhost:${port}`, 'Local')
      .addCookieAuth('better-auth.session_token')
      .addTag('app')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'Core API Docs',
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(port);
}
void bootstrap();
