import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            messageFormat: '{msg} - {req.method} {req.url} {res.statusCode}',
            customColors: 'err:red,info:blue,warn:yellow,debug:green',
          },
        },
        serializers: {
          req: (req: FastifyRequest) => ({
            method: req.method,
            url: req.url,
            ip: req.ip,
            headers: req.headers,
          }),
          res: (res: { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  );

  // ===== ENHANCEMENTS =====
  // 1. Request-Response Timing
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (req, res, done) => {
      req.startTime = Date.now();
      done();
    });

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onResponse', (req, res, done) => {
      const responseTime = Date.now() - (req.startTime ?? Date.now());
      req.log.info(
        {
          responseTime: `${responseTime}ms`,
          status: res.statusCode,
        },
        'Request Completed',
      );
      done();
    });

  // 2. Error Formatting
  app
    .getHttpAdapter()
    .getInstance()
    .setErrorHandler((error, req, res) => {
      req.log.error(
        {
          err: error,
          stack: error.stack,
          body: req.body,
          params: req.params,
        },
        `Error: ${error.message}`,
      );
      res.send(error);
    });

  // 3. Startup Banner
  const fastify = app.getHttpAdapter().getInstance();

  // 4. Version Logging
  fastify.addHook('onListen', () => {
    fastify.log.info(`Version ${process.env.npm_package_version || '0.0.1'}`);
    fastify.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // 5. Graceful Shutdown
  process.on('SIGINT', () => {
    fastify.log.info(' Shutting down gracefully...');
    app
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        fastify.log.error('Error during shutdown', err);
        process.exit(1);
      });
  });

  // Existing Config
  await app.register(import('@fastify/cors'), { origin: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  fastify.log.info(` Server ready on ${await app.getUrl()}`);
}

void bootstrap();
