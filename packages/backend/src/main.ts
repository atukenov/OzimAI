import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
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
