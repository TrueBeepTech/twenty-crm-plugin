import { describe, expect, it } from 'vitest';

import { campaignName, prepareCampaign, soonIso } from 'src/lib/bulk';
import type { TwentyPerson } from 'src/lib/people';
import type { TrueBeepClient } from 'src/lib/truebeep-client';

const fake = (audience: { tagId: string | null; matched: number; unmatched: string[] }) => {
  const calls: Array<{ method: string; path: string; body: any }> = [];
  const client: TrueBeepClient = {
    connectionId: 'c',
    request: async <T>(method: string, path: string, body?: unknown): Promise<T> => {
      calls.push({ method, path, body });
      if (path === '/v1/audiences') return { data: audience } as T;
      if (path === '/v1/campaigns') return { data: { id: 'camp-1' } } as T;
      if (path.endsWith('/schedule')) {
        return { data: { preview: { campaignId: 'camp-1', name: 'n', audienceSize: audience.matched, sendAt: 'x', estimatedCost: 1.2, ready: true, missing: [] } } } as T;
      }
      throw new Error(`unexpected ${path}`);
    },
  };
  return { client, calls };
};

const person = (id: string, email: string): TwentyPerson => ({ id, emails: { primaryEmail: email }, phones: null, truebeepSubscriberId: null });

describe('prepareCampaign', () => {
  it('tags the people, creates an SMS draft for that tag and asks only for a preview', async () => {
    const { client, calls } = fake({ tagId: 'tag-1', matched: 2, unmatched: ['p3'] });
    const res = await prepareCampaign(client, [person('p1', 'a@x.io'), person('p2', 'b@x.io'), person('p3', 'c@x.io')], {
      channel: 'sms',
      templateId: 'tpl-1',
      name: 'Q4',
    });
    expect(calls.map((c) => c.path)).toEqual(['/v1/audiences', '/v1/campaigns', '/v1/campaigns/camp-1/schedule']);
    expect(calls[0].body.people[0]).toMatchObject({ ref: 'p1', email: 'a@x.io' });
    expect(calls[1].body).toMatchObject({ type: 'messaging', contentId: 'tpl-1', channels: ['sms'], tags: ['tag-1'] });
    expect(calls[2].body.confirm).toBeUndefined();
    expect(res).toMatchObject({ campaignId: 'camp-1', matched: 2, notInTrueBeep: 1 });
  });

  it('an email campaign uses the email template field', async () => {
    const { client, calls } = fake({ tagId: 'tag-1', matched: 1, unmatched: [] });
    await prepareCampaign(client, [person('p1', 'a@x.io')], { channel: 'email', templateId: 'tpl-e' });
    expect(calls[1].body).toMatchObject({ type: 'email', emailContentId: 'tpl-e' });
    expect(calls[1].body.channels).toBeUndefined();
  });

  it('creates no campaign when nobody is in TrueBeep', async () => {
    const { client, calls } = fake({ tagId: null, matched: 0, unmatched: ['p1'] });
    const res = await prepareCampaign(client, [person('p1', 'a@x.io')], { channel: 'sms', templateId: 't' });
    expect(res.campaignId).toBeNull();
    expect(calls.map((c) => c.path)).toEqual(['/v1/audiences']);
  });
});

describe('campaign helpers', () => {
  it('names stay within TrueBeep’s 3–40 characters', () => {
    expect(campaignName('x'.repeat(60))).toHaveLength(40);
    expect(campaignName('ab').length).toBeGreaterThanOrEqual(3);
    expect(campaignName('', new Date('2026-11-24T10:05:00Z'))).toBe('Twenty send 2026-11-24 10:05');
  });
  it('the send time is in the future', () => {
    expect(new Date(soonIso(1_000)).getTime()).toBeGreaterThan(1_000);
  });
});
