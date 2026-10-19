/** Static export: the whole site is plain files, ideal for cPanel shared hosting.
 *  All data is fetched in the browser from the NestJS API (NEXT_PUBLIC_API_URL). */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
  // Several root layouts ((root) and [lang]) and none in app/: unknown URLs (e.g. /ar/l/) are rendered by
  // src/app/global-not-found.tsx, which provides its own <html>/<body>.
  experimental: { globalNotFound: true },
};
export default nextConfig;
