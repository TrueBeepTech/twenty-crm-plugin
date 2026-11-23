import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { closeSidePanel, enqueueSnackbar, useSelectedObjectMetadata, useSelectedRecordIds, useSelectedRecordsFilter } from 'twenty-sdk/front-component';
import { LightButton, MainButton, SegmentedControl } from 'twenty-ui/components/input';
import { Banner, Loader } from 'twenty-ui/primitives/feedback';
import { Input, Textarea } from 'twenty-ui/primitives/input';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import { TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getRoute, isFailure, newRequestId, postRoute } from 'src/front-components/shared/call-route';
import { CampaignComposerView, MAX_CAMPAIGN_SELECTION } from 'src/front-components/shared/campaign-composer-view';
import {
  CHANNEL_LABELS,
  type RecipientPreview,
  type SendOutcome,
  type TrueBeepChannel,
  type TrueBeepTemplate,
} from 'src/lib/truebeep-types';

const MAX = 25;
const SMS_SEGMENT = 160;

const SendComposer = () => {
  const theme = useTheme();
  const selectedIds = useSelectedRecordIds();
  // "Select all" in a list gives a filter instead of ids.
  const selectAllFilter = useSelectedRecordsFilter();
  const objectName = useSelectedObjectMetadata()?.nameSingular;
  const isDeal = objectName === 'opportunity';
  const ids = useMemo(() => selectedIds.slice(0, MAX), [selectedIds]);
  const tooMany = selectedIds.length > MAX;
  const target = useMemo(() => (isDeal ? { opportunityIds: ids, personIds: [] } : { personIds: ids, opportunityIds: [] }), [ids, isDeal]);

  const [channel, setChannel] = useState<TrueBeepChannel>('email');
  const [templates, setTemplates] = useState<TrueBeepTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<RecipientPreview[] | null>(null);
  const [dealsWithoutContact, setDealsWithoutContact] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<SendOutcome[] | null>(null);
  const [requestId] = useState(newRequestId);

  const loadForChannel = useCallback(async () => {
    setTemplates(null);
    setRecipients(null);
    setTemplateId(null);
    setProblem(null);
    const [tpl, preview] = await Promise.all([
      getRoute<{ status: 'ok'; templates: TrueBeepTemplate[] }>('templates', { channel }),
      postRoute<{ status: 'ok'; recipients: RecipientPreview[]; dealsWithoutContact: number }>('preview', { ...target, channel }),
    ]);
    if (isFailure(tpl)) setProblem(tpl.message);
    else setTemplates(tpl.templates);
    if (isFailure(preview)) setProblem(preview.message);
    else {
      setRecipients(preview.recipients);
      setDealsWithoutContact(preview.dealsWithoutContact);
    }
  }, [channel, target]);

  useEffect(() => {
    if (ids.length > 0 && !tooMany) void loadForChannel();
  }, [loadForChannel, ids.length, tooMany]);

  const sendable = recipients?.filter((r) => r.canSend).length ?? 0;
  const hasMessage = !!templateId || body.trim().length > 0;
  const needsSubject = channel === 'email' && !templateId && !subject.trim();
  const canSend = !sending && !outcomes && sendable > 0 && hasMessage && !needsSubject;

  const send = async () => {
    setSending(true);
    const result = await postRoute<{ status: 'ok'; outcomes: SendOutcome[] }>('send', {
      ...target,
      personIds: isDeal ? [] : recipients?.filter((r) => r.canSend).map((r) => r.personId) ?? [],
      channel,
      templateId: templateId ?? undefined,
      subject: subject || undefined,
      body: body || undefined,
      requestId,
    });
    setSending(false);
    if (isFailure(result)) {
      setProblem(result.message);
      return;
    }
    setOutcomes(result.outcomes);
    const ok = result.outcomes.filter((o) => o.ok).length;
    await enqueueSnackbar({
      message: ok === result.outcomes.length ? `Sent to ${ok} ${ok === 1 ? 'person' : 'people'}` : `Sent to ${ok} of ${result.outcomes.length}`,
      variant: ok === result.outcomes.length ? 'success' : 'warning',
    });
  };

  const column = { display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[3], padding: theme.spacing[4] };
  const label = (text: string) => (
    <Text size="sm" color="tertiary" weight="medium">
      {text}
    </Text>
  );

  if (ids.length === 0 && selectAllFilter) {
    return <CampaignComposerView ids={[]} filter={selectAllFilter} isDeal={isDeal} totalSelected={null} />;
  }
  if (ids.length === 0) {
    return (
      <div style={column} data-testid="truebeep-send-composer">
        <Text color="secondary">Select people first.</Text>
      </div>
    );
  }
  if (tooMany) {
    return (
      <CampaignComposerView
        ids={selectedIds.slice(0, MAX_CAMPAIGN_SELECTION)}
        isDeal={isDeal}
        totalSelected={selectedIds.length}
      />
    );
  }

  if (outcomes) {
    return (
      <div style={column} data-testid="truebeep-send-composer">
        <Text weight="semibold">Sent via TrueBeep</Text>
        {outcomes.map((o) => (
          <div key={o.personId} data-testid={`truebeep-send-outcome-${o.ok ? 'ok' : 'failed'}`}>
            <Text size="sm" weight="medium">
              {o.ok ? '✓' : '✕'} {o.name}
            </Text>
            <Text size="sm" color="tertiary">
              {o.message}
            </Text>
          </div>
        ))}
        <LightButton onClick={() => void closeSidePanel()} data-testid="truebeep-send-close">
          Close
        </LightButton>
      </div>
    );
  }

  return (
    <div style={column} data-testid="truebeep-send-composer">
      <Text weight="semibold">Send via TrueBeep</Text>
      {problem && (
        <Banner status="error" variant="soft">
          {problem}
        </Banner>
      )}

      <SegmentedControl
        aria-label="Channel"
        fullWidth
        value={channel}
        onValueChange={(value) => setChannel(value as TrueBeepChannel)}
        options={(['email', 'sms', 'whatsapp'] as const).map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
        data-testid="truebeep-send-channel"
      />

      {label('To')}
      {recipients === null ? (
        <Loader />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }} data-testid="truebeep-send-recipients">
          {recipients.map((r) => (
            <div key={r.personId} style={{ opacity: r.canSend ? 1 : 0.6 }}>
              <Text size="sm" weight="medium">
                {r.canSend ? '✓' : '–'} {r.name}
              </Text>
              {r.note && (
                <Text size="sm" color="tertiary">
                  {r.note}
                </Text>
              )}
            </div>
          ))}
          {dealsWithoutContact > 0 && (
            <Text size="sm" color="tertiary">
              {dealsWithoutContact} deal(s) have no point of contact and are skipped.
            </Text>
          )}
        </div>
      )}

      {label('Template')}
      {templates === null ? (
        <Loader />
      ) : templates.length === 0 ? (
        <Text size="sm" color="tertiary">
          No {CHANNEL_LABELS[channel]} templates in TrueBeep. Write a message below.
        </Text>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[1] }} data-testid="truebeep-send-templates">
          <LightButton variant={templateId === null ? 'soft' : 'ghost'} aria-pressed={templateId === null} onClick={() => setTemplateId(null)} data-testid="truebeep-send-template-none">
            Write my own
          </LightButton>
          {templates.map((t) => (
            <LightButton
              key={t.id}
              variant={templateId === t.id ? 'soft' : 'ghost'} aria-pressed={templateId === t.id}
              onClick={() => setTemplateId(t.id)}
              title={t.preview}
              data-testid={`truebeep-send-template-${t.id}`}
            >
              {t.name}
            </LightButton>
          ))}
        </div>
      )}

      {!templateId && (
        <>
          {channel === 'email' && (
            <>
              {label('Subject')}
              <Input value={subject} onValueChange={(v) => setSubject(String(v))} placeholder="Subject" data-testid="truebeep-send-subject" />
            </>
          )}
          {label('Message')}
          <Textarea
            value={body}
            onValueChange={(v) => setBody(v)}
            autoResize
            maxRows={12}
            rows={5}
            placeholder={channel === 'email' ? 'Write your email' : 'Write your message'}
            data-testid="truebeep-send-body"
          />
          {channel === 'sms' && body.length > 0 && (
            <Text size="sm" color="tertiary">
              {body.length} characters · {Math.ceil(body.length / SMS_SEGMENT)} SMS
            </Text>
          )}
          {channel === 'whatsapp' && (
            <Text size="sm" color="tertiary">
              WhatsApp free text only arrives if the person messaged you in the last 24 hours. Use a template otherwise.
            </Text>
          )}
        </>
      )}

      <MainButton onClick={() => void send()} disabled={!canSend} loading={sending} data-testid="truebeep-send-submit">
        {sendable > 0 ? `Send to ${sendable} ${sendable === 1 ? 'person' : 'people'}` : 'Nobody can receive this'}
      </MainButton>
      <Text size="sm" color="tertiary">
        Charged to your TrueBeep plan like campaign messages.
      </Text>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'TrueBeep send composer',
  description: 'Compose an SMS, email or WhatsApp message to the selected people or deals',
  component: SendComposer,
});
