import { randomBytes } from 'node:crypto';
import { defineLogicFunction } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import {
  TRUEBEEP_EVENTS_SETUP_ROUTE_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { EVENTS_SECRET_KEY, TIMELINE_TYPE_ID_KEY } from 'src/lib/events';
import { bodyOf, route } from 'src/lib/route';
import { getTrueBeep } from 'src/lib/truebeep-client';

type Status = { registered: boolean; eventsUrl?: string; lastDeliveredAt?: string | null; lastError?: string | null };

// Twenty sets TWENTY_FUNCTIONS_URL to '' when the app has no custom domain;
// routes are then served from the server URL under /s.
const functionsBaseUrl = () =>
  (process.env.TWENTY_FUNCTIONS_URL || `${(process.env.TWENTY_API_URL || '').replace(/\/+$/, '')}/s`).replace(/\/+$/, '');

// {action:'status'} reads the feed; 'enable' turns it on (new secret, registered
// with TrueBeep); 'disable' turns it off (unregistered, secret dropped).
const handler = route('truebeep-events-setup', async (event) => {
  const trueBeep = await getTrueBeep();
  const { action } = bodyOf<{ action: 'status' | 'enable' | 'disable' }>(event);
  if (action === 'enable') {
    // Resolved here, in a signed-in request: the metadata lookup fails in the
    // public events route, which has no user. The events route reads it from kv.
    const { timelineActivityTypes } = await new MetadataApiClient().query({
      timelineActivityTypes: { id: true, universalIdentifier: true },
    });
    const type = timelineActivityTypes.find((t) => t.universalIdentifier === TRUEBEEP_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER);
    if (!type) return { status: 'error' as const, message: 'The TrueBeep timeline type is not installed. Reinstall the app.' };
    await kv.set(TIMELINE_TYPE_ID_KEY, type.id);

    const secret = randomBytes(32).toString('hex');
    await kv.set(EVENTS_SECRET_KEY, secret);
    const eventsUrl = `${functionsBaseUrl()}/truebeep/events`;
    await trueBeep.request('PUT', '/v1/integrations/twenty-app', { eventsUrl, secret });
  } else if (action === 'disable') {
    await trueBeep.request('DELETE', '/v1/integrations/twenty-app');
    await kv.delete(EVENTS_SECRET_KEY);
  }
  const res = await trueBeep.request<{ data: Status }>('GET', '/v1/integrations/twenty-app');
  return { status: 'ok' as const, feed: res.data };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_EVENTS_SETUP_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-events-setup',
  description: 'Turn the TrueBeep activity feed on the timeline on or off',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: { path: '/truebeep/events-setup', httpMethod: 'POST', isAuthRequired: true },
  handler,
});
