import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configureApp } from './app.setup.js';
import { AppModule } from './app.module.js';
import { NodeEnv, type EnvironmentVariables } from './config/env.validation.js';
import { AppLogger } from './platform/logging/app-logger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // JSON lines in production for log collection; readable output while developing.
    logger: new AppLogger({
      json: process.env.NODE_ENV === NodeEnv.Production,
    }),
  });
  configureApp(app);

  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  if (config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('LanguZe API').setVersion('0.0.1').build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`LanguZe API listening on port ${port}`, 'Bootstrap');
}
await bootstrap();
