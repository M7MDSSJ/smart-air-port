import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ErrorResponseDto } from 'src/modules/users/dto/error-response.dto';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'An error occurred';
    let error = 'Internal Server Error';
    let validationErrors: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, any>;

        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          validationErrors = this.transformValidationErrors(res.message);
        } else {
          message = res.message || message;
        }

        error = res.error || error;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[status] || error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    const errorResponse: ErrorResponseDto = {
      success: false,
      message,
      error,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      errors: validationErrors,
    };

    response.status(status).send(errorResponse);
  }

  private transformValidationErrors(messages: any[]): Record<string, string> {
    return messages.reduce((acc, error) => {
      if (error.property && error.constraints) {
        acc[error.property] = Object.values(error.constraints).join(', ');
      }
      return acc;
    }, {});
  }
}
