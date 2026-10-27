export type ApiLang = 'ar' | 'en';

/**
 * Language the client wants the API messages in.
 * The frontend sends `X-Lang: ar|en` with every request; `Accept-Language` and `?lang=` are accepted as fallbacks.
 * Arabic stays the default (it is the language the messages are written in).
 */
export function requestLang(req: { headers?: Record<string, any>; query?: Record<string, any> } | undefined): ApiLang {
  const raw = String(req?.headers?.['x-lang'] ?? req?.query?.lang ?? req?.headers?.['accept-language'] ?? '').trim().toLowerCase();
  return raw.startsWith('en') ? 'en' : 'ar';
}
