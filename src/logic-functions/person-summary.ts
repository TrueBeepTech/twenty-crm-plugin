import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_CONNECTION_STATUS_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findCustomer, getPeople, personEmail, personPhone } from 'src/lib/people';
import { route } from 'src/lib/route';
import { getTrueBeep } from 'src/lib/truebeep-client';
import type { CustomerSummary } from 'src/lib/truebeep-types';

export type PersonSummaryResponse =
  | { status: 'not_connected' | 'error'; message: string; code?: string }
  | { status: 'no_contact'; message: string }
  | { status: 'not_found'; lookedUp: { email?: string; phone?: string } }
  | { status: 'found'; matchedBy: 'link' | 'email' | 'phone'; customer: CustomerSummary };

// The person is read server side by id, so the panel can only ask about records
// the user can open in this workspace; it never sends an email or phone.
const handler = route('truebeep-person-summary', async (event): Promise<PersonSummaryResponse> => {
  const personId = event.queryStringParameters.personId;
  if (!personId) return { status: 'error', message: 'personId is required' };

  const trueBeep = await getTrueBeep();
  const [person] = await getPeople([personId]);
  if (!person) return { status: 'error', message: 'Person not found' };

  const email = personEmail(person);
  const phone = personPhone(person);
  if (!email && !phone && !person.truebeepSubscriberId) {
    return { status: 'no_contact', message: 'This person has no email or phone in Twenty.' };
  }

  const match = await findCustomer(trueBeep, person);
  if (!match) return { status: 'not_found', lookedUp: { email, phone } };

  const res = await trueBeep.request<{ data: CustomerSummary }>(
    'GET',
    `/v1/customer/${encodeURIComponent(match.customerId)}/summary`,
  );
  return { status: 'found', matchedBy: match.matchedBy, customer: res.data };
});

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_CONNECTION_STATUS_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-person-summary',
  description: 'TrueBeep customer summary for a Twenty person',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: { path: '/truebeep/person-summary', httpMethod: 'GET', isAuthRequired: true },
  handler,
});
