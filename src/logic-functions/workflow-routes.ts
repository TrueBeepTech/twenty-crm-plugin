import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_WORKFLOWS_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { route } from 'src/lib/route';
import { getTrueBeep } from 'src/lib/truebeep-client';

export type StartableWorkflow = { id: string; name: string };

const handler = route('truebeep-workflows', async () => {
  const trueBeep = await getTrueBeep();
  const res = await trueBeep.request<{ data: StartableWorkflow[] }>('GET', '/v1/workflows-startable');
  return { status: 'ok' as const, workflows: res.data };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_WORKFLOWS_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-workflows',
  description: 'TrueBeep workflows that can be started from Twenty',
  timeoutSeconds: 15,
  httpRouteTriggerSettings: { path: '/truebeep/workflows', httpMethod: 'GET', isAuthRequired: true },
  handler,
});
