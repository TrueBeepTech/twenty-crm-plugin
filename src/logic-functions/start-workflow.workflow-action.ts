import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_RUN_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getPeople } from 'src/lib/people';
import { runWorkflowForPeople } from 'src/lib/run-workflow';
import { getTrueBeep } from 'src/lib/truebeep-client';

type Input = { personId: string; workflowId: string; data?: string };

// A Twenty workflow step that starts a TrueBeep workflow (trigger "Started from
// the API or Twenty") for one person, e.g. on "deal moved to Proposal".
const handler = async (input: Input) => {
  if (!input.personId) throw new Error('Give the person (record id).');
  if (!input.workflowId) throw new Error('Give the TrueBeep workflow id.');
  let data: Record<string, unknown> = {};
  if (input.data?.trim()) {
    try {
      data = JSON.parse(input.data) as Record<string, unknown>;
    } catch {
      throw new Error('"Values" must be JSON, e.g. {"dealName": "Acme"}.');
    }
  }
  const people = await getPeople([input.personId]);
  if (people.length === 0) throw new Error('Person not found.');
  const [outcome] = await runWorkflowForPeople(await getTrueBeep(), input.workflowId, people, data);
  if (!outcome.ok) throw new Error(outcome.message);
  return { result: outcome.message };
};

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_RUN_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-start-workflow',
  description: 'Start a TrueBeep workflow for a person',
  timeoutSeconds: 30,
  workflowActionTriggerSettings: {
    label: 'TrueBeep: Start workflow',
    icon: 'IconPlayerPlay',
    inputSchema: [
      {
        type: 'object',
        properties: {
          personId: { type: 'string', label: 'Person (record id)' },
          workflowId: { type: 'string', label: 'TrueBeep workflow id' },
          data: { type: 'string', label: 'Values for the workflow (JSON, optional)', multiline: true },
        },
      },
    ],
    outputSchema: [{ type: 'object', properties: { result: { type: 'string' } } }],
  },
  handler,
});
