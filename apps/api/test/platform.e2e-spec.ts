import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { Public } from '../src/auth/session.decorators.js';
import type {
  ErrorBodyDto,
  ErrorResponseDto,
} from '../src/platform/errors/error-response.dto.js';

function errorOf(response: request.Response): ErrorBodyDto {
  return (response.body as ErrorResponseDto).error;
}

class ProbeBody {
  @IsString()
  @MaxLength(5)
  name: string;
}

/** Test-only endpoints that exercise the shared HTTP behavior before feature endpoints exist. */
@Public()
@Controller('probe')
class ProbeController {
  @Post('echo')
  echo(@Body() body: ProbeBody): ProbeBody {
    return body;
  }

  @Get('ping')
  ping(): { ok: true } {
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('internal detail that must not leak');
  }

  @Get('limited')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  limited(): { ok: true } {
    return { ok: true };
  }
}

// Requires a reachable PostgreSQL database via DATABASE_URL (see docs/deployment/local-development.md).
describe('API foundations (e2e)', () => {
  let app: INestApplication<App>;
  let webOrigin: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    webOrigin = new URL(app.get(ConfigService).getOrThrow<string>('WEB_ORIGIN'))
      .origin;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('paths', () => {
    it('serves LanguZe endpoints under /v1', () => {
      return request(app.getHttpServer())
        .get('/v1/probe/ping')
        .expect(200, { ok: true });
    });

    it('keeps the health check at the root', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/v1/health').expect(404);
    });
  });

  describe('error format', () => {
    it('answers unknown routes with NOT_FOUND', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/no-such-thing')
        .expect(404);

      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: expect.any(String) as string },
      });
    });

    it('never echoes the query string, which can hold personal data', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/no-such-thing?email=nok@example.com')
        .expect(404);

      expect(errorOf(response).message).not.toContain('nok@example.com');
    });

    it('lists the fields that failed validation', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/probe/echo')
        .set('Origin', webOrigin)
        .send({ name: 'far too long', extra: 1 })
        .expect(400);

      expect(errorOf(response).code).toBe('VALIDATION_FAILED');
      expect((errorOf(response).details as { fields: unknown }).fields).toEqual(
        expect.arrayContaining([
          { field: 'name', rules: ['maxLength'] },
          { field: 'extra', rules: ['whitelistValidation'] },
        ]),
      );
    });

    it('answers a body that is not JSON with BAD_REQUEST', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/probe/echo')
        .set('Origin', webOrigin)
        .set('Content-Type', 'application/json')
        .send('{"name": ')
        .expect(400);

      expect(errorOf(response).code).toBe('BAD_REQUEST');
    });

    it('hides unexpected errors and returns the request ID instead', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/probe/boom')
        .expect(500);

      expect(errorOf(response)).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        details: { requestId: response.headers['x-request-id'] },
      });
      expect(JSON.stringify(response.body)).not.toContain('internal detail');
    });
  });

  describe('request IDs', () => {
    it('gives every response an X-Request-Id', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reuses a well-formed incoming request ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'proxy-1234abcd')
        .expect(200);
      expect(response.headers['x-request-id']).toBe('proxy-1234abcd');
    });
  });

  describe('cross-site protection', () => {
    it('refuses a request that changes data without an Origin header', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/probe/echo')
        .send({ name: 'ok' })
        .expect(403);

      expect(errorOf(response).code).toBe('ORIGIN_NOT_ALLOWED');
    });

    it('refuses a request that changes data from another site', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/probe/echo')
        .set('Origin', 'https://evil.example')
        .send({ name: 'ok' })
        .expect(403);

      expect(errorOf(response).code).toBe('ORIGIN_NOT_ALLOWED');
    });

    it('accepts a request that changes data from the web app', () => {
      return request(app.getHttpServer())
        .post('/v1/probe/echo')
        .set('Origin', webOrigin)
        .send({ name: 'ok' })
        .expect(201, { name: 'ok' });
    });

    it('allows the web app to send cookies through CORS', async () => {
      const response = await request(app.getHttpServer())
        .options('/v1/probe/echo')
        .set('Origin', webOrigin)
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe(webOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('rate limits', () => {
    it('answers RATE_LIMITED with Retry-After once the limit is used up', async () => {
      await request(app.getHttpServer()).get('/v1/probe/limited').expect(200);
      await request(app.getHttpServer()).get('/v1/probe/limited').expect(200);

      const response = await request(app.getHttpServer())
        .get('/v1/probe/limited')
        .expect(429);

      expect(errorOf(response).code).toBe('RATE_LIMITED');
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('never rate-limits the health check', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/health').expect(200);
      }
    });
  });
});
