// Served at /runtime-config.js. Evaluated on every request, so it always reflects the container's CURRENT environment.
export const dynamic = 'force-dynamic';

export function GET() {
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const body = `window.__ENV=${JSON.stringify({ API_URL: apiUrl }).replace(/</g, '\\u003c')};`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
