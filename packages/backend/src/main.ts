import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false, rawBody: true });
  // Railway (and most PaaS) terminate TLS at a proxy: trust its X-Forwarded-For
  // so per-IP rate limits on the public web chat see the real visitor IP.
  // TRUST_PROXY = number of proxy hops in front of the app (Railway = 1; set
  // 2 only if traffic is also proxied through e.g. Vercel rewrites).
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.setGlobalPrefix('api', { exclude: ['webhooks/whatsapp', 'health'] });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`OzimAI backend listening on :${port}`);
}

bootstrap();
