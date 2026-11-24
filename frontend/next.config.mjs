/** Server mode (standalone): Next.js runs as a Node server inside the container.
 *  The backend URL is NOT baked in at build time: it is read from the API_URL environment variable when the
 *  container starts and handed to the browser through /runtime-config.js (see src/app/runtime-config.js/route.ts). */
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false, // do not announce the framework
  devIndicators: false,
  // Several root layouts ((root) and [lang]) and none in app/: unknown URLs (e.g. /ar/l/) are rendered by
  // src/app/global-not-found.tsx, which provides its own <html>/<body>.
  experimental: { globalNotFound: true },
  // Detail pages have clean addresses (/news/123/, /pages/about/); there are no /view pages any more: the old /news/view/?id=123 addresses are redirected by src/middleware.ts.
};

// Browser hardening headers for every page. (A full script CSP is not set here: it would have to list every inline script and external host.)
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // the site cannot be framed by another site (clickjacking)
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=15552000' }, // browsers ignore it over plain http
];
nextConfig.headers = async () => [{ source: '/:path*', headers: securityHeaders }];

export default nextConfig;
