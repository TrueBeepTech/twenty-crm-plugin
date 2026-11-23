import { personEmail, personPhone, type TwentyPerson } from 'src/lib/people';
import type { TrueBeepClient } from 'src/lib/truebeep-client';
import type { TrueBeepChannel } from 'src/lib/truebeep-types';

// More than 25 people go out as a TrueBeep campaign, so TrueBeep's throttling,
// quiet hours, consent and campaign billing apply. Two steps: prepare (tag the
// matched customers, create a draft, get TrueBeep's preview) and confirm.

export type CampaignPreview = {
  campaignId: string;
  name: string;
  audienceSize: number;
  sendAt: string;
  estimatedCost: number | null;
  ready: boolean;
  missing: string[];
};

export type PreparedCampaign = {
  campaignId: string | null;
  matched: number;
  notInTrueBeep: number;
  preview: CampaignPreview | null;
};

/** Send time a couple of minutes out: TrueBeep refuses a send time in the past. */
export const soonIso = (now = Date.now()) => new Date(now + 2 * 60_000).toISOString();

export const campaignName = (name: string | undefined, now = new Date()) => {
  const fallback = `Twenty send ${now.toISOString().slice(0, 16).replace('T', ' ')}`;
  const n = (name ?? '').trim() || fallback;
  return (n.length < 3 ? `${n}   `.slice(0, 3) : n).slice(0, 40);
};

export const prepareCampaign = async (
  trueBeep: TrueBeepClient,
  people: TwentyPerson[],
  input: { channel: TrueBeepChannel; templateId: string; name?: string },
): Promise<PreparedCampaign> => {
  const name = campaignName(input.name);
  const audience = await trueBeep.request<{ data: { tagId: string | null; matched: number; unmatched: string[] } }>(
    'POST',
    '/v1/audiences',
    {
      name,
      people: people.map((p) => ({
        ref: p.id,
        customerId: p.truebeepSubscriberId ?? undefined,
        email: personEmail(p),
        phone: personPhone(p),
      })),
    },
  );
  const { tagId, matched, unmatched } = audience.data;
  if (!tagId) return { campaignId: null, matched: 0, notInTrueBeep: unmatched.length, preview: null };

  const isEmail = input.channel === 'email';
  const created = await trueBeep.request<{ data: { id: string } }>('POST', '/v1/campaigns', {
    name,
    type: isEmail ? 'email' : 'messaging',
    ...(isEmail ? { emailContentId: input.templateId } : { contentId: input.templateId, channels: [input.channel] }),
    tags: [tagId],
    sendAt: soonIso(),
  });
  const campaignId = created.data.id;
  const preview = await trueBeep.request<{ data: { preview: CampaignPreview } }>('POST', `/v1/campaigns/${campaignId}/schedule`, {
    sendAt: soonIso(),
  });
  return { campaignId, matched, notInTrueBeep: unmatched.length, preview: preview.data.preview };
};

export const confirmCampaign = async (trueBeep: TrueBeepClient, campaignId: string) => {
  const res = await trueBeep.request<{ data: { scheduled: boolean; campaign?: { sendAt?: string; audience?: { total?: number } } } }>(
    'POST',
    `/v1/campaigns/${encodeURIComponent(campaignId)}/schedule`,
    { confirm: true, sendAt: soonIso() },
  );
  return { sendAt: res.data.campaign?.sendAt ?? null, audience: res.data.campaign?.audience?.total ?? null };
};
