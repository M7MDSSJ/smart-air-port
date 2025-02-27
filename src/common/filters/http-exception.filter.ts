// src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { FastifyRequest } from 'fastify'; // Adjust if using Express
import { ErrorResponseDto } from 'src/modules/users/dto/error-response.dto';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    const errorResponse: ErrorResponseDto = {
      success: false,
      message: exception.message || 'An error occurred',
      error: exception.name || 'Internal Server Error',
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url, // Dynamically sets the path to the request URL
      errors: exception instanceof HttpException && exception.getResponse()['errors']
        ? exception.getResponse()['errors']
        : undefined,
    };

    response.status(status).send(errorResponse);
  }
}