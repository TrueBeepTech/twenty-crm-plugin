import { findCustomer, personName, type TwentyPerson } from 'src/lib/people';
import type { TrueBeepClient } from 'src/lib/truebeep-client';
import type { SendOutcome } from 'src/lib/truebeep-types';

/** Starts a TrueBeep workflow (trigger "Started from the API or Twenty") for each person. */
export const runWorkflowForPeople = async (
  trueBeep: TrueBeepClient,
  workflowId: string,
  people: TwentyPerson[],
  data: Record<string, unknown> = {},
): Promise<SendOutcome[]> => {
  const outcomes: SendOutcome[] = [];
  for (const person of people) {
    const name = personName(person);
    try {
      const match = await findCustomer(trueBeep, person);
      if (!match) {
        outcomes.push({ personId: person.id, name, ok: false, message: 'Not in TrueBeep yet' });
        continue;
      }
      const res = await trueBeep.request<{ data: { status: 'started' | 'already_running' } }>(
        'POST',
        `/v1/workflows/${encodeURIComponent(workflowId)}/run`,
        { customerId: match.customerId, data, source: { app: 'twenty', recordId: person.id } },
      );
      outcomes.push({
        personId: person.id,
        name,
        ok: true,
        message: res.data.status === 'started' ? 'Workflow started' : 'Already running for this person',
      });
    } catch (error) {
      outcomes.push({ personId: person.id, name, ok: false, message: error instanceof Error ? error.message : 'Not started' });
    }
  }
  return outcomes;
};
