/** Server mode (standalone): Next.js runs as a Node server inside the container.
 *  The backend URL is NOT baked in at build time: it is read from the API_URL environment variable when the
 *  container starts and handed to the browser through /runtime-config.js (see src/app/runtime-config.js/route.ts). */
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
  // Several root layouts ((root) and [lang]) and none in app/: unknown URLs (e.g. /ar/l/) are rendered by
  // src/app/global-not-found.tsx, which provides its own <html>/<body>.
  experimental: { globalNotFound: true },
};
export default nextConfig;
