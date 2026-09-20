import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { API_PREFIX } from './app.setup.js';

/**
 * Writes the OpenAPI document to `openapi.json`, which the web app turns into
 * TypeScript types (API design, E4). It builds the application without listening
 * and without touching the database, so it runs anywhere, including CI.
 */
const OUTPUT = 'openapi.json';

// Placeholders only: the application is never started, so nothing connects anywhere.
process.env.DATABASE_URL ??=
  'postgresql://placeholder:placeholder@localhost:5432/placeholder';
process.env.AUTH_SECRET ??= 'placeholder-placeholder-placeholder';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  await app.init();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('LanguZe API')
      .setDescription('Endpoints used by the LanguZe web app.')
      .setVersion('0.0.1')
      .build(),
  );

  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`Wrote ${OUTPUT}`);
}

await generate();
