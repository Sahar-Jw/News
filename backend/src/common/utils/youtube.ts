const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts the 11-character video id from any common YouTube link
 * (watch?v=, youtu.be/, /embed/, /shorts/, /live/, m. / music. / nocookie hosts). Returns null when it is not a YouTube video.
 */
export function parseYoutubeId(input?: string | null): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = u.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else id = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** The one canonical form that is stored in the database. */
export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
