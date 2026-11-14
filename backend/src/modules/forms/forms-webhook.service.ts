import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { AuditService } from '../audit/audit.service';
import { FormDefinition } from './forms.entity';

/** private / loopback / link-local / metadata ranges: a webhook can never be pointed at the server's own network (SSRF) */
function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:') ;
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/**
 * Outgoing link to the chamber's own systems: every event is POSTed as JSON to each enabled https endpoint of the form,
 * signed with HMAC-SHA256 in X-Signature (secret = the endpoint's secret). Fire-and-forget: a slow or broken endpoint never delays or fails the applicant's request.
 * Personal data is NOT sent: only ids, the reference, the status and the (non-sensitive) answers; sensitive answers and files stay here.
 */
@Injectable()
export class FormsWebhookService {
  private readonly logger = new Logger(FormsWebhookService.name);
  constructor(private readonly audit: AuditService) {}

  dispatch(form: FormDefinition, event: 'submitted' | 'status_changed', payload: Record<string, any>) {
    for (const hook of form.integrations ?? []) {
      if (!hook.enabled || !hook.events.includes(event)) continue;
      void this.send(form, hook, event, payload);
    }
  }

  private async send(form: FormDefinition, hook: FormDefinition['integrations'][number], event: string, payload: Record<string, any>) {
    let status = 'failed';
    try {
      const u = new URL(hook.url);
      if (u.protocol !== 'https:') throw new Error('not https');
      const ips = isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname, { all: true });
      if (!ips.length || ips.some((x) => isPrivateIp(x.address))) throw new Error('address not allowed');
      const body = JSON.stringify({ event, form: { id: form.id, slug: form.slug }, sentAt: new Date().toISOString(), data: payload });
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'chamber-forms/1' };
      if (hook.secret) headers['X-Signature'] = 'sha256=' + createHmac('sha256', hook.secret).update(body).digest('hex');
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      try {
        const res = await fetch(hook.url, { method: 'POST', headers, body, signal: ctl.signal, redirect: 'manual' });
        status = res.ok ? 'ok' : `http_${res.status}`;
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      status = `error: ${(e as Error).message}`.slice(0, 120);
      this.logger.warn(`Webhook "${hook.name}" of form ${form.slug} failed: ${status}`);
    }
    await this.audit.log({ category: 'forms', action: 'webhook', description: `ربط ${hook.name}: ${event} (${status})`, entityType: 'form_definitions', entityId: form.id, details: { event, status } });
  }
}
