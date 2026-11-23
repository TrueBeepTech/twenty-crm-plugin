import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_PREVIEW_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getPeople, getPointsOfContact } from 'src/lib/people';
import { bodyOf, route } from 'src/lib/route';
import { previewRecipients } from 'src/lib/send';
import { getTrueBeep } from 'src/lib/truebeep-client';
import type { TrueBeepChannel } from 'src/lib/truebeep-types';

type Body = { personIds: string[]; opportunityIds: string[]; channel: TrueBeepChannel };

const handler = route('truebeep-preview-recipients', async (event) => {
  const body = bodyOf<Body>(event);
  const channel = body.channel ?? 'email';
  const trueBeep = await getTrueBeep();
  const fromDeals = body.opportunityIds?.length ? await getPointsOfContact(body.opportunityIds) : { personIds: [], skipped: 0 };
  const people = await getPeople([...(body.personIds ?? []), ...fromDeals.personIds]);
  const recipients = await previewRecipients(trueBeep, people, channel);
  return { status: 'ok' as const, recipients, dealsWithoutContact: fromDeals.skipped };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_PREVIEW_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-preview-recipients',
  description: 'Who among the selected people can get a TrueBeep message on a channel',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: { path: '/truebeep/preview', httpMethod: 'POST', isAuthRequired: true },
  handler,
});
