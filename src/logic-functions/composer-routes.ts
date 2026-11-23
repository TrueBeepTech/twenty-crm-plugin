import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_TEMPLATES_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { route } from 'src/lib/route';
import { getTrueBeep } from 'src/lib/truebeep-client';
import type { TrueBeepChannel, TrueBeepTemplate } from 'src/lib/truebeep-types';

const CHANNELS: TrueBeepChannel[] = ['email', 'sms', 'whatsapp'];

const handler = route('truebeep-templates', async (event) => {
  const channel = event.queryStringParameters.channel as TrueBeepChannel;
  if (!CHANNELS.includes(channel)) return { status: 'error' as const, message: 'channel must be email, sms or whatsapp' };
  const trueBeep = await getTrueBeep();
  const res = await trueBeep.request<{ data: TrueBeepTemplate[] }>('GET', `/v1/templates?channel=${channel}`);
  return { status: 'ok' as const, templates: res.data };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_TEMPLATES_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-templates',
  description: 'TrueBeep message templates for a channel',
  timeoutSeconds: 15,
  httpRouteTriggerSettings: { path: '/truebeep/templates', httpMethod: 'GET', isAuthRequired: true },
  handler,
});
