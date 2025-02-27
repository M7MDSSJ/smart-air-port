import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app/app.module';
import { ValidationPipe,BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';


import * as fs from 'fs'; // Import file system module
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

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Smart Airport API')
    .setDescription('API documentation for the Smart Airport application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Write the Swagger spec to a JSON file
  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));

  // Serve Swagger UI at '/docs'
  SwaggerModule.setup('docs', app, document);

  registerInstrumentations({
    instrumentations: [new FastifyInstrumentation({})],
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  // Request-Response Timing
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (req, res, done) => {
      req.startTime = Date.now();
      done();
    });

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const errorResponse: Record<string, string> = {};
      errors.forEach((error) => {
        const constraints = error.constraints || {};
        errorResponse[error.property] = Object.values(constraints).join(', ');
      });
      return new BadRequestException({ errors: errorResponse });
    },
  }),
);
    
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
    app.useGlobalFilters(new HttpExceptionFilter());
  // Error Formatting
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

  // Version Logging and Startup Banner
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onListen', () => {
    fastify.log.info(`Version ${process.env.npm_package_version || '0.0.1'}`);
    fastify.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful Shutdown
  process.on('SIGINT', () => {
    fastify.log.info('Shutting down gracefully...');
    app
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        fastify.log.error('Error during shutdown', err);
        process.exit(1);
      });
  });

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
  });

  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url === '/users/login') {
      routeOptions.config = {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      };
    }
  });

  await app.register(import('@fastify/cors'), { origin: true });
  

  const port = process.env.PORT || 3000;
  await app.listen(port);
  fastify.log.info(`Server ready on ${await app.getUrl()}`);
}

void bootstrap();
