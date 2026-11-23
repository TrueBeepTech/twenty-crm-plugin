import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_SEND_MESSAGE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getPeople, type TwentyPerson } from 'src/lib/people';
import { sendToPerson } from 'src/lib/send';
import { getTrueBeep } from 'src/lib/truebeep-client';
import type { TrueBeepChannel } from 'src/lib/truebeep-types';

type Input = {
  personId?: string;
  personEmail?: string;
  personPhone?: string;
  channel: TrueBeepChannel;
  templateId?: string;
  subject?: string;
  message?: string;
};

// A Twenty workflow step. Consent is enforced by TrueBeep: an opted-out or
// not-opted-in person makes the step fail with TrueBeep's reason, so the run
// history shows why nothing was sent.
const handler = async (input: Input, context: { workflowRunId?: string } & Record<string, unknown>) => {
  if (!['email', 'sms', 'whatsapp'].includes(input.channel)) throw new Error('Channel must be email, sms or whatsapp.');
  if (!input.templateId && !input.message?.trim()) throw new Error('Give a message or a TrueBeep template id.');

  let person: TwentyPerson | undefined;
  if (input.personId) [person] = await getPeople([input.personId]);
  if (!person) {
    if (!input.personEmail && !input.personPhone) throw new Error('Give the person (record id), or an email or phone.');
    person = {
      id: input.personId ?? 'workflow',
      emails: { primaryEmail: input.personEmail ?? null },
      phones: { primaryPhoneNumber: input.personPhone ?? null, primaryPhoneCallingCode: null },
    };
  }

  const trueBeep = await getTrueBeep();
  const sent = await sendToPerson(
    trueBeep,
    person,
    { channel: input.channel, templateId: input.templateId, subject: input.subject, body: input.message },
    { via: 'workflow' },
    typeof context?.workflowRunId === 'string' ? `twenty-wf-${context.workflowRunId}-${person.id}` : undefined,
  );
  return { messageId: sent.id, status: sent.status, to: sent.to, truebeepCustomerId: sent.customerId, addedToTrueBeep: sent.createdCustomer };
};

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_SEND_MESSAGE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-send-message',
  description: 'Send an SMS, email or WhatsApp message through TrueBeep',
  timeoutSeconds: 30,
  workflowActionTriggerSettings: {
    label: 'TrueBeep: Send message',
    icon: 'IconMessage',
    inputSchema: [
      {
        type: 'object',
        properties: {
          personId: { type: 'string', label: 'Person (record id)' },
          personEmail: { type: 'string', label: 'Or: email' },
          personPhone: { type: 'string', label: 'Or: phone with country code' },
          channel: { type: 'string', enum: ['email', 'sms', 'whatsapp'], label: 'Channel' },
          templateId: { type: 'string', label: 'TrueBeep template id (optional)' },
          subject: { type: 'string', label: 'Subject (email without a template)' },
          message: { type: 'string', label: 'Message', multiline: true },
        },
      },
    ],
    outputSchema: [
      {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
          status: { type: 'string' },
          to: { type: 'string' },
          truebeepCustomerId: { type: 'string' },
          addedToTrueBeep: { type: 'boolean' },
        },
      },
    ],
  },
  handler,
});
