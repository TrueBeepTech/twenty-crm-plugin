import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import {
  TRUEBEEP_EVENTS_ROUTE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { EVENTS_SECRET_KEY, TIMELINE_TYPE_ID_KEY, timelineTitle, type TrueBeepInteractionEvent, verifySignature } from 'src/lib/events';

const reply = (status: number, body: unknown) => ({ __twentyHttpResponse: true as const, status, body });

type PersonRow = { id: string };

/** The Twenty person for a TrueBeep customer: the connector's link, then email, then phone. */
const findPerson = async (customer: TrueBeepInteractionEvent['customer']): Promise<string | null> => {
  const twenty = new RestApiClient();
  if (customer.twentyPersonId) {
    try {
      const { data } = await twenty.get<{ data: { person: PersonRow | null } }>(`/rest/people/${encodeURIComponent(customer.twentyPersonId)}`);
      if (data?.person?.id) return data.person.id;
    } catch {
      // deleted in Twenty: fall back to email/phone
    }
  }
  const search = async (filter: string) => {
    const { data } = await twenty.get<{ data: { people: PersonRow[] } }>('/rest/people', { query: { filter, limit: 2 } });
    return data?.people ?? [];
  };
  if (customer.email) {
    const people = await search(`emails.primaryEmail[eq]:"${customer.email.replace(/"/g, '')}"`);
    if (people.length === 1) return people[0].id;
  }
  const digits = customer.phone?.replace(/\D/g, '') ?? '';
  if (digits.length >= 7) {
    // Twenty keeps the calling code apart; match on the last 9 digits.
    const people = await search(`phones.primaryPhoneNumber[like]:"%${digits.slice(-9)}"`);
    if (people.length === 1) return people[0].id;
  }
  return null;
};

// Public route TrueBeep posts to; trusted only through the HMAC signature made
// with the secret this workspace generated when the feed was turned on.
const handler = async (event: RoutePayload) => {
  const secret = await kv.get<string>(EVENTS_SECRET_KEY);
  if (!secret) return reply(404, { message: 'TrueBeep activity feed is off in this workspace' });

  const raw = event.rawBody ?? (event.body ? JSON.stringify(event.body) : '');
  const signature = event.headers['x-truebeep-signature'] ?? event.headers['X-TrueBeep-Signature'];
  if (!verifySignature(secret, signature, raw)) return reply(401, { message: 'Bad signature' });

  let payload: TrueBeepInteractionEvent;
  try {
    payload = JSON.parse(raw) as TrueBeepInteractionEvent;
  } catch {
    return reply(400, { message: 'Invalid JSON' });
  }
  if (payload.type !== 'interaction.created' || !payload.id) return reply(202, { ignored: true });

  let step = 'dedupe';
  try {
  const seenKey = `evt:${payload.id}`;
  if (await kv.get(seenKey)) return reply(200, { duplicate: true });

  step = 'find person';
  const personId = await findPerson(payload.customer);
  if (!personId) return reply(202, { ignored: 'no matching person' });

  step = 'create timeline activity';
  // Posted directly: the SDK's createTimelineActivity resolves the type through
  // a metadata query that fails without a user. The id is stored on enable.
  const timelineActivityTypeId = await kv.get<string>(TIMELINE_TYPE_ID_KEY);
  if (!timelineActivityTypeId) return reply(409, { message: 'Turn the activity feed off and on again in TrueBeep settings.' });
  await new RestApiClient().post('/rest/timelineActivities', {
    timelineActivityTypeId,
    targetPersonId: personId,
    happensAt: payload.occurredAt,
    properties: {
      title: timelineTitle(payload),
      channel: payload.interaction.channel,
      direction: payload.interaction.direction,
      kind: payload.interaction.type,
      truebeepInteractionId: payload.id,
      truebeepCustomerId: payload.customer.id,
    },
  });
  await kv.set(seenKey, true);
  return reply(200, { ok: true, personId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`truebeep-events failed at ${step}`, message);
    // 500 so TrueBeep retries and shows the step in the feed's last error.
    return reply(500, { message: `Failed at ${step}: ${message.slice(0, 300)}` });
  }
};

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_EVENTS_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-events',
  description: 'Receives signed TrueBeep activity and puts it on the person timeline',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: {
    path: '/truebeep/events',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['x-truebeep-signature', 'x-truebeep-event'],
  },
  handler,
});
