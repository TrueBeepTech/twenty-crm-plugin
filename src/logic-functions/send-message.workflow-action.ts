import { defineLogicFunction } from 'twenty-sdk/define';

import { TRUEBEEP_SEND_MESSAGE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getTrueBeep } from 'src/lib/truebeep-client';

type SendMessageInput = {
  personEmail?: string;
  personPhone?: string;
  channel: 'sms' | 'email' | 'whatsapp';
  message: string;
  subject?: string;
};

// Phase 0: proves the step appears in Twenty Workflows and reaches TrueBeep with the
// workspace's key. The real send goes through POST /v1/messages (plan T1), which
// enforces opt-in on TrueBeep's side; until it exists this step fails clearly.
const handler = async (input: SendMessageInput) => {
  if (!input.personEmail && !input.personPhone) {
    throw new Error('Give the person email or phone.');
  }
  if (!input.message?.trim()) {
    throw new Error('Message is empty.');
  }
  const trueBeep = await getTrueBeep();
  const result = await trueBeep.request<{ data: { id: string; status: string } }>('POST', '/v1/messages', {
    to: { email: input.personEmail, phone: input.personPhone },
    channel: input.channel,
    body: input.message,
    subject: input.subject,
    source: { app: 'twenty', via: 'workflow' },
  });
  return { messageId: result.data.id, status: result.data.status };
};

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_SEND_MESSAGE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-send-message',
  description: 'Send an SMS, email or WhatsApp message through TrueBeep',
  timeoutSeconds: 20,
  workflowActionTriggerSettings: {
    label: 'TrueBeep: Send message',
    icon: 'IconMessage',
    inputSchema: [
      {
        type: 'object',
        properties: {
          personEmail: { type: 'string', label: 'Person email' },
          personPhone: { type: 'string', label: 'Person phone (with country code)' },
          channel: { type: 'string', enum: ['sms', 'email', 'whatsapp'], label: 'Channel' },
          subject: { type: 'string', label: 'Subject (email only)' },
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
        },
      },
    ],
  },
  handler,
});
