import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createPublicCache } from './common/middleware/public-cache';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });

  // behind cPanel / Passenger / a reverse proxy the real client IP comes from X-Forwarded-For
  app.set('trust proxy', process.env.TRUST_PROXY === 'false' ? false : 1);
  app.disable('x-powered-by');

  // files are loaded by the frontend from another origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // gzip for JSON and text (images/PDF are already compressed and skipped by the default filter)
  app.use(compression({ threshold: 1024 }));
  app.use(cookieParser());
  // private data must never be stored by a proxy or CDN; routes that want caching (files, share page) set their own header
  app.use((req: any, res: any, next: any) => {
    if (req.headers.authorization || req.cookies?.access_token) res.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  app.use(createPublicCache());
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: false });

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false, // SRS 21: CORS limited to the frontend origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Lang'],
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
  // longer than the load balancer's idle timeout (usually 60 s), otherwise it reuses a socket Node just closed -> random 502s
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 120_000;
  new Logger('Bootstrap').log(`API listening on :${port} (prefix /api)`);
}
bootstrap();
