import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { localizeAny } from '../i18n/messages';
import { requestLang } from '../i18n/request-lang';

/** Unified error body; never leaks internals or filesystem paths (SRS 21). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'حدث خطأ غير متوقع';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'string') message = r;
      else {
        message = (r as any).message ?? exception.message;
        error = (r as any).error ?? error;
      }
    } else if (exception?.name === 'MulterError') {
      const tooBig = exception.code === 'LIMIT_FILE_SIZE';
      status = tooBig ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST;
      message = tooBig ? 'حجم الملف يتجاوز الحد المسموح' : 'ملف مرفوع غير صالح أو عدد الملفات يتجاوز الحد';
      error = tooBig ? 'Payload Too Large' : 'Bad Request';
    } else if (exception instanceof QueryFailedError && (exception as any).code === '23505') {
      status = HttpStatus.CONFLICT;
      message = 'القيمة موجودة مسبقاً';
      error = 'Conflict';
    } else if (exception?.type === 'entity.too.large') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'حجم الطلب كبير جداً';
      error = 'Payload Too Large';
    } else {
      this.logger.error(`${req.method} ${req.originalUrl}`, exception?.stack ?? String(exception));
    }

    if (status === 429) message = 'تم تجاوز عدد المحاولات المسموح، حاول لاحقاً';

    // every message above is written in Arabic; English clients (X-Lang: en) get the English text
    message = localizeAny(message, requestLang(req));

    res.status(status).json({ statusCode: status, error, message, timestamp: new Date().toISOString() });
  }
}
