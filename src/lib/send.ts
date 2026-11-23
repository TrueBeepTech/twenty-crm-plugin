import { findCustomer, personEmail, personName, personPhone, type TwentyPerson } from 'src/lib/people';
import { TrueBeepApiError, type TrueBeepClient } from 'src/lib/truebeep-client';
import { CHANNEL_LABELS, type CustomerSummary, type RecipientPreview, type SendOutcome, type SentMessage, type TrueBeepChannel } from 'src/lib/truebeep-types';

export type MessageDraft = {
  channel: TrueBeepChannel;
  templateId?: string;
  body?: string;
  subject?: string;
};

export type SendSource = { via: 'record' | 'bulk' | 'workflow'; workspaceId?: string; recordId?: string; userName?: string };

/**
 * Sends one message to one Twenty person through TrueBeep. Consent is decided
 * by TrueBeep (POST /v1/messages); a person TrueBeep doesn't know is created
 * there for email only.
 */
export const sendToPerson = async (
  trueBeep: TrueBeepClient,
  person: TwentyPerson,
  draft: MessageDraft,
  source: SendSource,
  idempotencyKey?: string,
): Promise<SentMessage> => {
  const match = await findCustomer(trueBeep, person);
  const recipient = match
    ? { customerId: match.customerId }
    : {
        email: personEmail(person),
        phone: personPhone(person),
        createIfMissing: true,
        firstName: person.name?.firstName ?? undefined,
        lastName: person.name?.lastName ?? undefined,
      };
  const res = await trueBeep.request<{ data: SentMessage }>('POST', '/v1/messages', {
    ...recipient,
    channel: draft.channel,
    templateId: draft.templateId || undefined,
    body: draft.body?.trim() || undefined,
    subject: draft.subject?.trim() || undefined,
    idempotencyKey,
    source: { app: 'twenty', ...source, recordId: source.recordId ?? person.id },
  });
  return res.data;
};

export const sendToPeople = async (
  trueBeep: TrueBeepClient,
  people: TwentyPerson[],
  draft: MessageDraft,
  source: Omit<SendSource, 'recordId'>,
  requestId: string,
): Promise<SendOutcome[]> => {
  const outcomes: SendOutcome[] = [];
  for (const person of people) {
    const name = personName(person);
    try {
      const sent = await sendToPerson(trueBeep, person, draft, source, `twenty-${requestId}-${person.id}`);
      outcomes.push({
        personId: person.id,
        name,
        ok: true,
        message: `${CHANNEL_LABELS[draft.channel]} ${sent.status === 'sent' ? 'sent' : 'on its way'} to ${sent.to}${sent.createdCustomer ? ' (added to TrueBeep)' : ''}`,
      });
    } catch (error) {
      outcomes.push({
        personId: person.id,
        name,
        ok: false,
        message: error instanceof Error ? error.message : 'Not sent',
      });
      // A dead key fails every person the same way; stop instead of repeating it.
      if (error instanceof TrueBeepApiError && error.status === 401) break;
    }
  }
  return outcomes;
};

/** What will happen for each selected person, before anything is sent. */
export const previewRecipients = async (
  trueBeep: TrueBeepClient,
  people: TwentyPerson[],
  channel: TrueBeepChannel,
): Promise<RecipientPreview[]> => {
  const rows: RecipientPreview[] = [];
  for (const person of people) {
    const name = personName(person);
    const match = await findCustomer(trueBeep, person);
    if (!match) {
      const canCreate = channel === 'email' && !!personEmail(person);
      rows.push({
        personId: person.id,
        name,
        canSend: canCreate,
        note: canCreate
          ? 'Not in TrueBeep yet: will be added (email only)'
          : channel === 'email'
            ? 'No email address in Twenty'
            : `Not in TrueBeep yet. New customers get email only until they opt in to ${CHANNEL_LABELS[channel]}.`,
      });
      continue;
    }
    const summary = await trueBeep.request<{ data: CustomerSummary }>('GET', `/v1/customer/${encodeURIComponent(match.customerId)}/summary`);
    const ch = summary.data.channels.find((c) => c.channel === channel);
    rows.push({ personId: person.id, name, canSend: !!ch?.canSend, note: ch?.canSend ? ch.value : (ch?.reason ?? 'Not available') });
  }
  return rows;
};
