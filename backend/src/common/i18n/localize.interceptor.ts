import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { localize } from './messages';
import { requestLang } from './request-lang';

/** Success bodies such as `{ message: 'تم تسجيل الخروج' }` are translated for English clients, like the error bodies are. */
@Injectable()
export class LocalizeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const lang = requestLang(ctx.switchToHttp().getRequest());
    if (lang !== 'en') return next.handle();
    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === 'object' && !Array.isArray(body) && Object.getPrototypeOf(body) === Object.prototype && typeof body.message === 'string') {
          return { ...body, message: localize(body.message, lang) };
        }
        return body;
      }),
    );
  }
}
