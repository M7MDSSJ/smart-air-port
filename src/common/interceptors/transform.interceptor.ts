import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map,switchMap } from 'rxjs/operators';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly i18n: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const language = request.query.language || 'en';

    return next.handle().pipe(
      switchMap(async data => {
        if (data && data.message) {
          const total = data.data?.pagination?.total || 0;
          const paginatedTotal = data.data?.paginatedFlights?.length || data.data?.flights?.length || 0;
          data.message = await this.i18n.t('response.foundFlights', {
            lang: language,
            args: { paginatedTotal, total },
            defaultValue: `Found ${paginatedTotal} available flight offers (out of ${total} total)`,
          });
        }
        return {
          success: true,
          ...data,
        };
      }),
    );
  }
}