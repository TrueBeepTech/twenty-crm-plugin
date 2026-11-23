import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_SEND_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getPeople, getPointsOfContact } from 'src/lib/people';
import { bodyOf, route } from 'src/lib/route';
import { type MessageDraft, sendToPeople } from 'src/lib/send';
import { getTrueBeep } from 'src/lib/truebeep-client';

type Body = MessageDraft & { personIds: string[]; opportunityIds: string[]; requestId: string };

const handler = route('truebeep-send', async (event) => {
  const body = bodyOf<Body>(event);
  if (!body.channel) return { status: 'error' as const, message: 'Pick a channel.' };
  if (!body.templateId && !body.body?.trim()) return { status: 'error' as const, message: 'Write a message or pick a template.' };
  if (!body.requestId || body.requestId.length < 8) return { status: 'error' as const, message: 'requestId is required' };

  const trueBeep = await getTrueBeep();
  const fromDeals = body.opportunityIds?.length ? await getPointsOfContact(body.opportunityIds) : { personIds: [], skipped: 0 };
  const people = await getPeople([...(body.personIds ?? []), ...fromDeals.personIds]);
  if (people.length === 0) return { status: 'error' as const, message: 'Nobody to send to.' };

  const outcomes = await sendToPeople(
    trueBeep,
    people,
    { channel: body.channel, templateId: body.templateId, body: body.body, subject: body.subject },
    { via: people.length > 1 ? 'bulk' : 'record', workspaceId: undefined },
    body.requestId,
  );
  return { status: 'ok' as const, outcomes };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_SEND_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-send',
  description: 'Send a TrueBeep message to selected people',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: { path: '/truebeep/send', httpMethod: 'POST', isAuthRequired: true },
  handler,
});
