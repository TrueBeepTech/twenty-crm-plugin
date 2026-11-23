import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { timelineTitle, type TrueBeepInteractionEvent, verifySignature } from 'src/lib/events';

const sign = (secret: string, t: number, body: string) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

describe('verifySignature', () => {
  const body = '{"id":"int-1"}';
  const now = 1_800_000_000;

  it('accepts TrueBeep’s signature', () => {
    expect(verifySignature('s3cret', sign('s3cret', now, body), body, now)).toBe(true);
  });
  it('rejects another secret', () => {
    expect(verifySignature('s3cret', sign('other', now, body), body, now)).toBe(false);
  });
  it('rejects a changed body', () => {
    expect(verifySignature('s3cret', sign('s3cret', now, body), '{"id":"int-2"}', now)).toBe(false);
  });
  it('rejects a replay older than 5 minutes', () => {
    expect(verifySignature('s3cret', sign('s3cret', now - 301, body), body, now)).toBe(false);
  });
  it('rejects a missing or malformed header', () => {
    expect(verifySignature('s3cret', undefined, body, now)).toBe(false);
    expect(verifySignature('s3cret', 'v1=abc', body, now)).toBe(false);
  });
});

describe('timelineTitle', () => {
  const base: TrueBeepInteractionEvent = {
    id: 'i',
    type: 'interaction.created',
    occurredAt: '2026-11-23T10:00:00Z',
    interaction: { channel: 'sms', type: 'message', direction: 'inbound', summary: null },
    customer: { id: 'c', firstName: null, lastName: null, email: null, phone: null, twentyPersonId: null },
  };
  it('uses TrueBeep’s summary when there is one', () => {
    expect(timelineTitle({ ...base, interaction: { ...base.interaction, summary: 'Replied: yes' } })).toBe('Replied: yes');
  });
  it('falls back to channel and direction', () => {
    expect(timelineTitle(base)).toBe('SMS reply');
  });
  it('quotes the message text when TrueBeep sends a preview', () => {
    expect(timelineTitle({ ...base, interaction: { ...base.interaction, preview: 'Can we move it to 4pm?' } })).toBe(
      'SMS reply: "Can we move it to 4pm?"',
    );
  });
});
