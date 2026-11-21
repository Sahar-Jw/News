import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { localizeAny } from '../i18n/messages';
import { requestLang } from '../i18n/request-lang';

const DB_DOWN_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', 'EPIPE', '57P01', '57P02', '57P03', '53300', '08000', '08001', '08003', '08004', '08006']);
const DB_DOWN_TEXT = /not yet accepting connections|database system is (starting up|shutting down|in recovery)|connection terminated|terminating connection|connection refused|timeout exceeded when trying to connect|server closed the connection|too many clients/i;

/** the database cannot be reached (down, restarting, in crash recovery, out of connections): a temporary 503, not a bug of the API */
export function isDatabaseDown(e: any): boolean {
  if (!e) return false;
  const list = [e, e.driverError, ...(Array.isArray(e.errors) ? e.errors : [])];
  return list.some((x) => x && (DB_DOWN_CODES.has(String(x.code)) || DB_DOWN_TEXT.test(String(x.message ?? ''))));
}

/** Unified error body; never leaks internals or filesystem paths (SRS 21). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');
  // while the database is down every request fails the same way: one short line every 30 s says so, instead of a stack trace per request
  private dbDownSince = 0;
  private dbDownCount = 0;

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
    } else if (isDatabaseDown(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'الخدمة غير متاحة مؤقتاً (تعذّر الاتصال بقاعدة البيانات). يرجى المحاولة بعد قليل.';
      error = 'Service Unavailable';
      res.setHeader('Retry-After', '15');
      this.dbDownCount++;
      if (Date.now() - this.dbDownSince > 30_000) {
        this.logger.warn(`Database unreachable (${exception?.code ?? exception?.errors?.[0]?.code ?? 'connection error'}: ${String(exception?.message ?? '').slice(0, 120)}) - answering 503; ${this.dbDownCount} request(s) refused so far`);
        this.dbDownSince = Date.now();
        this.dbDownCount = 0;
      }
    } else {
      this.logger.error(`${req.method} ${req.originalUrl}`, exception?.stack ?? String(exception));
    }

    if (status === 429) message = 'تم تجاوز عدد المحاولات المسموح، حاول لاحقاً';

    // every message above is written in Arabic; English clients (X-Lang: en) get the English text
    message = localizeAny(message, requestLang(req));

    res.status(status).json({ statusCode: status, error, message, timestamp: new Date().toISOString() });
  }
}
