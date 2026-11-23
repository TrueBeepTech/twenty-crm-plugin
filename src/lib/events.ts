import { createHmac, timingSafeEqual } from 'node:crypto';

// Shape of TrueBeep's interaction events (processor services/app-api/app-events.service.ts).
export type TrueBeepInteractionEvent = {
  id: string;
  type: 'interaction.created';
  occurredAt: string;
  interaction: { channel: string; type: string; direction: string; summary: string | null; preview?: string | null };
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    twentyPersonId: string | null;
  };
};

export const EVENTS_SECRET_KEY = 'truebeep-events-secret';
export const TIMELINE_TYPE_ID_KEY = 'truebeep-timeline-type-id';
export const MAX_EVENT_AGE_SECONDS = 300;

/**
 * Verifies `X-TrueBeep-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 * Rejects a missing/odd header, a timestamp older than 5 minutes, and a wrong MAC.
 */
export const verifySignature = (
  secret: string,
  header: string | undefined,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean => {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(nowSeconds - t) > MAX_EVENT_AGE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parts.v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};

const CHANNEL: Record<string, string> = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', twenty: 'Twenty' };

/** A one-line title for the Twenty timeline. */
export const timelineTitle = (event: TrueBeepInteractionEvent): string => {
  if (event.interaction.summary) return event.interaction.summary;
  const channel = CHANNEL[event.interaction.channel] ?? event.interaction.channel;
  const what = event.interaction.direction === 'inbound' ? `${channel} reply` : `${channel} ${event.interaction.type}`;
  return event.interaction.preview ? `${what}: "${event.interaction.preview}"` : what;
};
