import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_BULK_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { confirmCampaign, prepareCampaign } from 'src/lib/bulk';
import { getPeopleBulk, getPeopleByFilter, getPointsOfContactBulk, getPointsOfContactByFilter } from 'src/lib/people';
import { bodyOf, route } from 'src/lib/route';
import { getTrueBeep } from 'src/lib/truebeep-client';
import type { TrueBeepChannel } from 'src/lib/truebeep-types';

type Body = {
  action: 'prepare' | 'confirm';
  personIds?: string[];
  opportunityIds?: string[];
  channel?: TrueBeepChannel;
  templateId?: string;
  name?: string;
  campaignId?: string;
  filter?: Record<string, unknown>;
  object?: 'person' | 'opportunity';
};

// Bulk send (more than 25 people) as a TrueBeep campaign: 'prepare' returns
// TrueBeep's preview (audience, cost, anything missing); 'confirm' schedules it.
const handler = route('truebeep-bulk', async (event) => {
  const body = bodyOf<Body>(event);
  const trueBeep = await getTrueBeep();

  if (body.action === 'confirm') {
    if (!body.campaignId) return { status: 'error' as const, message: 'campaignId is required' };
    const confirmed = await confirmCampaign(trueBeep, body.campaignId);
    return { status: 'ok' as const, scheduled: true, ...confirmed };
  }

  if (!body.channel || !body.templateId) {
    return { status: 'error' as const, message: 'Pick a channel and a TrueBeep template: campaigns send a template.' };
  }
  // "Select all" in a list gives a record filter instead of ids.
  let people;
  let fromDeals = { personIds: [] as string[], skipped: 0 };
  if (body.filter && body.object === 'opportunity') {
    fromDeals = await getPointsOfContactByFilter(body.filter);
    people = await getPeopleBulk(fromDeals.personIds);
  } else if (body.filter) {
    people = await getPeopleByFilter(body.filter);
  } else {
    fromDeals = body.opportunityIds?.length ? await getPointsOfContactBulk(body.opportunityIds) : fromDeals;
    people = await getPeopleBulk([...(body.personIds ?? []), ...fromDeals.personIds]);
  }
  if (people.length === 0) return { status: 'error' as const, message: 'Nobody to send to.' };
  const prepared = await prepareCampaign(trueBeep, people, { channel: body.channel, templateId: body.templateId, name: body.name });
  return { status: 'ok' as const, ...prepared, selected: people.length, dealsWithoutContact: fromDeals.skipped };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_BULK_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-bulk',
  description: 'Send to many people as a TrueBeep campaign',
  timeoutSeconds: 120,
  httpRouteTriggerSettings: { path: '/truebeep/bulk', httpMethod: 'POST', isAuthRequired: true },
  handler,
});
