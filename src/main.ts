import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app/app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ErrorResponseDto } from '../src/modules/users/dto/error-response.dto'; // Add this import
import * as fs from 'fs';

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
          req: (req) => ({
            method: req.method,
            url: req.url,
            ip: req.ip,
            headers: req.headers,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  );

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

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorResponseDto],
  });

  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));
  SwaggerModule.setup('docs', app, document);

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

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  app.getHttpAdapter().getInstance().log.info(`Server ready on ${await app.getUrl()}`);
}

void bootstrap();