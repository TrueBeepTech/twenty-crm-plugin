import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_RUN_WORKFLOW_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getPeople, getPointsOfContact } from 'src/lib/people';
import { bodyOf, route } from 'src/lib/route';
import { runWorkflowForPeople } from 'src/lib/run-workflow';
import { getTrueBeep } from 'src/lib/truebeep-client';

type Body = { workflowId: string; personIds: string[]; opportunityIds: string[] };

const handler = route('truebeep-run-workflow', async (event) => {
  const body = bodyOf<Body>(event);
  if (!body.workflowId) return { status: 'error' as const, message: 'Pick a workflow.' };
  const trueBeep = await getTrueBeep();
  const fromDeals = body.opportunityIds?.length ? await getPointsOfContact(body.opportunityIds) : { personIds: [], skipped: 0 };
  const people = await getPeople([...(body.personIds ?? []), ...fromDeals.personIds]);
  if (people.length === 0) return { status: 'error' as const, message: 'Nobody selected.' };
  const outcomes = await runWorkflowForPeople(trueBeep, body.workflowId, people);
  return { status: 'ok' as const, outcomes };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_RUN_WORKFLOW_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-run-workflow',
  description: 'Start a TrueBeep workflow for selected people',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: { path: '/truebeep/run-workflow', httpMethod: 'POST', isAuthRequired: true },
  handler,
});
