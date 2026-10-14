import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/** SRS 13.4: ignore repeat opens from the same visitor within 30 minutes (in-memory, per instance). */
@Injectable()
export class ViewCounterService {
  private readonly seen = new Map<string, number>();
  private readonly WINDOW_MS = 30 * 60 * 1000;

  shouldCount(newsId: number, ip: string, userAgent: string): boolean {
    const now = Date.now();
    if (this.seen.size > 50_000) {
      for (const [k, t] of this.seen) if (now - t > this.WINDOW_MS) this.seen.delete(k);
      if (this.seen.size > 50_000) this.seen.clear();
    }
    const key = createHash('sha1').update(`${newsId}|${ip}|${userAgent ?? ''}`).digest('hex');
    const last = this.seen.get(key);
    if (last && now - last < this.WINDOW_MS) return false;
    this.seen.set(key, now);
    return true;
  }
}
