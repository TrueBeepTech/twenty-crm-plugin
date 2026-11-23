import { describe, expect, it } from 'vitest';

import type { TwentyPerson } from 'src/lib/people';
import { previewRecipients, sendToPeople } from 'src/lib/send';
import { TrueBeepApiError, type TrueBeepClient } from 'src/lib/truebeep-client';

// A fake TrueBeep: customers known by email, a summary per customer, and a
// record of every POST /v1/messages body.
const fakeTrueBeep = (opts: { known?: Record<string, string>; failWith?: TrueBeepApiError } = {}) => {
  const posts: Array<Record<string, unknown>> = [];
  const client: TrueBeepClient = {
    connectionId: 'conn',
    request: async <T>(method: string, path: string, body?: unknown): Promise<T> => {
      const email = decodeURIComponent(path.split('/v1/customer/email/')[1] ?? '');
      if (method === 'GET' && email) {
        const id = opts.known?.[email];
        if (!id) throw new TrueBeepApiError(404, 'HTTP_404', 'Customer not found');
        return { data: { id } } as T;
      }
      if (method === 'GET' && path.endsWith('/summary')) {
        return {
          data: {
            channels: [
              { channel: 'email', value: 'ada@x.io', canSend: true, reason: null },
              { channel: 'sms', value: '1555', canSend: false, reason: "This customer hasn't opted in to SMS." },
            ],
          },
        } as T;
      }
      if (method === 'POST' && path === '/v1/messages') {
        if (opts.failWith) throw opts.failWith;
        posts.push(body as Record<string, unknown>);
        return { data: { id: 'm1', status: 'sent', channel: 'email', customerId: 'c1', createdCustomer: !('customerId' in (body as object)), to: 'x' } } as T;
      }
      throw new TrueBeepApiError(404, 'HTTP_404', `unexpected ${method} ${path}`);
    },
  };
  return { client, posts };
};

const person = (id: string, email?: string): TwentyPerson => ({
  id,
  name: { firstName: id, lastName: null },
  emails: { primaryEmail: email ?? null },
  phones: { primaryPhoneNumber: null, primaryPhoneCallingCode: null },
});

describe('previewRecipients', () => {
  it('uses TrueBeep’s consent for known customers', async () => {
    const { client } = fakeTrueBeep({ known: { 'ada@x.io': 'c1' } });
    const [sms] = await previewRecipients(client, [person('ada', 'ada@x.io')], 'sms');
    expect(sms.canSend).toBe(false);
    expect(sms.note).toMatch(/opted in to SMS/);
  });

  it('an unknown person can get email (added to TrueBeep) but not SMS', async () => {
    const { client } = fakeTrueBeep();
    const [email] = await previewRecipients(client, [person('bo', 'bo@x.io')], 'email');
    const [sms] = await previewRecipients(client, [person('bo', 'bo@x.io')], 'sms');
    expect(email).toMatchObject({ canSend: true, note: expect.stringMatching(/will be added/) });
    expect(sms.canSend).toBe(false);
  });
});

describe('sendToPeople', () => {
  it('sends known people by customerId and unknown ones by email with createIfMissing', async () => {
    const { client, posts } = fakeTrueBeep({ known: { 'ada@x.io': 'c1' } });
    const outcomes = await sendToPeople(
      client,
      [person('ada', 'ada@x.io'), person('bo', 'bo@x.io')],
      { channel: 'email', subject: 'Hi', body: 'Hello' },
      { via: 'bulk' },
      'req12345',
    );
    expect(outcomes.every((o) => o.ok)).toBe(true);
    expect(posts[0]).toMatchObject({ customerId: 'c1', channel: 'email', idempotencyKey: 'twenty-req12345-ada' });
    expect(posts[0]).not.toHaveProperty('createIfMissing');
    expect(posts[1]).toMatchObject({ email: 'bo@x.io', createIfMissing: true, idempotencyKey: 'twenty-req12345-bo' });
    expect(posts[1].source).toMatchObject({ app: 'twenty', via: 'bulk', recordId: 'bo' });
  });

  it('a TrueBeep refusal is reported per person, not thrown', async () => {
    const { client } = fakeTrueBeep({ known: { 'ada@x.io': 'c1' }, failWith: new TrueBeepApiError(409, 'CONSENT_REQUIRED', 'Not opted in') });
    const outcomes = await sendToPeople(client, [person('ada', 'ada@x.io')], { channel: 'sms', body: 'x' }, { via: 'record' }, 'req12345');
    expect(outcomes).toEqual([{ personId: 'ada', name: 'ada', ok: false, message: 'Not opted in' }]);
  });

  it('stops after a rejected key instead of repeating the failure for everyone', async () => {
    const { client } = fakeTrueBeep({ known: { 'a@x.io': 'c1', 'b@x.io': 'c2' }, failWith: new TrueBeepApiError(401, 'TRUEBEEP_AUTH_FAILED', 'Reconnect') });
    const outcomes = await sendToPeople(client, [person('a', 'a@x.io'), person('b', 'b@x.io')], { channel: 'email', body: 'x', subject: 's' }, { via: 'bulk' }, 'req12345');
    expect(outcomes).toHaveLength(1);
  });
});
