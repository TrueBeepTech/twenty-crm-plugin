import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_FIND_CUSTOMER_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findCustomer, getPeople } from 'src/lib/people';
import { getTrueBeep } from 'src/lib/truebeep-client';
import type { CustomerSummary } from 'src/lib/truebeep-types';

// A Twenty workflow step that looks up the person in TrueBeep, so later steps
// can branch on consent (e.g. "if canSms then send SMS else send email").
const handler = async (input: { personId: string }) => {
  if (!input.personId) throw new Error('Give the person (record id).');
  const [person] = await getPeople([input.personId]);
  if (!person) throw new Error('Person not found.');
  const trueBeep = await getTrueBeep();
  const match = await findCustomer(trueBeep, person);
  if (!match) return { found: false, truebeepCustomerId: '', canEmail: false, canSms: false, canWhatsapp: false, loyaltyPoints: 0 };
  const { data } = await trueBeep.request<{ data: CustomerSummary }>('GET', `/v1/customer/${encodeURIComponent(match.customerId)}/summary`);
  const can = (c: string) => data.channels.some((x) => x.channel === c && x.canSend);
  return {
    found: true,
    truebeepCustomerId: data.id,
    canEmail: can('email'),
    canSms: can('sms'),
    canWhatsapp: can('whatsapp'),
    loyaltyPoints: data.loyaltyPoints,
  };
};

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_FIND_CUSTOMER_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-find-customer',
  description: 'Find a person in TrueBeep and what they can be sent',
  timeoutSeconds: 20,
  workflowActionTriggerSettings: {
    label: 'TrueBeep: Find customer',
    icon: 'IconUserSearch',
    inputSchema: [{ type: 'object', properties: { personId: { type: 'string', label: 'Person (record id)' } } }],
    outputSchema: [
      {
        type: 'object',
        properties: {
          found: { type: 'boolean' },
          truebeepCustomerId: { type: 'string' },
          canEmail: { type: 'boolean' },
          canSms: { type: 'boolean' },
          canWhatsapp: { type: 'boolean' },
          loyaltyPoints: { type: 'number' },
        },
      },
    ],
  },
  handler,
});
