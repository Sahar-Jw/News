import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });

  // behind cPanel / Passenger / a reverse proxy the real client IP comes from X-Forwarded-For
  app.set('trust proxy', process.env.TRUST_PROXY === 'false' ? false : 1);
  app.disable('x-powered-by');

  // files are loaded by the frontend from another origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '2mb' });

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false, // SRS 21: CORS limited to the frontend origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // unknown fields are stripped (e.g. a client-sent "roleId" on /profile is ignored)
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API listening on :${port} (prefix /api)`);
}
bootstrap();
