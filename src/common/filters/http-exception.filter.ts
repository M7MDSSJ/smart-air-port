import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ErrorResponseDto } from 'src/modules/users/dto/error-response.dto';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : {};
    console.log('Exception:', exception);
    const message = typeof exceptionResponse === 'string' ? exceptionResponse : exceptionResponse['message'] || exception.message || 'An error occurred';
    const errors = typeof exceptionResponse === 'object' ? exceptionResponse['errors'] : undefined;

    const errorResponse: ErrorResponseDto = {
      success: false,
      message,
      error: exception.name || 'Internal Server Error',
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      errors,
    };

    response.status(status).send(errorResponse);
  }
}