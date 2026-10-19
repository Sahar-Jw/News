/** Static export: the whole site is plain files, ideal for cPanel shared hosting.
 *  All data is fetched in the browser from the NestJS API (NEXT_PUBLIC_API_URL). */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
};
export default nextConfig;
