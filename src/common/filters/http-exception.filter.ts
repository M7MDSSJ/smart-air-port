import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception.getResponse();

    let message = 'An error occurred';
    let errorType = exception.name;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      message =
        'message' in exceptionResponse &&
        typeof exceptionResponse.message === 'string'
          ? exceptionResponse.message
          : message;

      errorType =
        'error' in exceptionResponse &&
        typeof exceptionResponse.error === 'string'
          ? exceptionResponse.error
          : errorType;
    }

    response.status(status).send({
      success: false,
      message,
      error: errorType,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
