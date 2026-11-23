import { useEffect, useState } from 'react';
import { closeSidePanel, enqueueSnackbar } from 'twenty-sdk/front-component';
import { LightButton, MainButton, SegmentedControl } from 'twenty-ui/components/input';
import { Banner, Loader } from 'twenty-ui/primitives/feedback';
import { Input } from 'twenty-ui/primitives/input';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import { getRoute, isFailure, postRoute } from 'src/front-components/shared/call-route';
import type { PreparedCampaign } from 'src/lib/bulk';
import { CHANNEL_LABELS, type TrueBeepChannel, type TrueBeepTemplate } from 'src/lib/truebeep-types';

export const MAX_CAMPAIGN_SELECTION = 1000;

type Prepared = PreparedCampaign & { selected: number; dealsWithoutContact: number };

/**
 * More than 25 selected: send as a TrueBeep campaign. Campaigns send a
 * template, and TrueBeep applies consent, quiet hours, throttling and billing.
 * Prepare first (tag + draft + TrueBeep's preview with cost), then confirm.
 */
export const CampaignComposerView = ({
  ids,
  filter,
  isDeal,
  totalSelected,
}: {
  ids: string[];
  filter?: unknown;
  isDeal: boolean;
  /** null when the whole list is selected (Twenty gives a filter, not a count). */
  totalSelected: number | null;
}) => {
  const theme = useTheme();
  const [channel, setChannel] = useState<TrueBeepChannel>('email');
  const [templates, setTemplates] = useState<TrueBeepTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduled, setScheduled] = useState<{ sendAt: string | null; audience: number | null } | null>(null);

  useEffect(() => {
    setTemplates(null);
    setTemplateId(null);
    setPrepared(null);
    void (async () => {
      const res = await getRoute<{ status: 'ok'; templates: TrueBeepTemplate[] }>('templates', { channel });
      if (isFailure(res)) setProblem(res.message);
      else setTemplates(res.templates);
    })();
  }, [channel]);

  const target = filter
    ? { filter, object: isDeal ? 'opportunity' : 'person' }
    : isDeal
      ? { opportunityIds: ids, personIds: [] }
      : { personIds: ids, opportunityIds: [] };

  const prepare = async () => {
    setBusy(true);
    setProblem(null);
    const res = await postRoute<{ status: 'ok' } & Prepared>('bulk', { action: 'prepare', ...target, channel, templateId, name: name || undefined });
    setBusy(false);
    if (isFailure(res)) return setProblem(res.message);
    setPrepared(res);
  };

  const confirm = async () => {
    if (!prepared?.campaignId) return;
    setBusy(true);
    const res = await postRoute<{ status: 'ok'; sendAt: string | null; audience: number | null }>('bulk', {
      action: 'confirm',
      campaignId: prepared.campaignId,
    });
    setBusy(false);
    if (isFailure(res)) return setProblem(res.message);
    setScheduled({ sendAt: res.sendAt, audience: res.audience });
    await enqueueSnackbar({ message: 'Campaign scheduled in TrueBeep', variant: 'success' });
  };

  const column = { display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[3], padding: theme.spacing[4] };
  const label = (text: string) => (
    <Text size="sm" color="tertiary" weight="medium">
      {text}
    </Text>
  );

  if (scheduled && prepared?.preview) {
    return (
      <div style={column} data-testid="truebeep-campaign-scheduled">
        <Text weight="semibold">Campaign scheduled</Text>
        <Text size="sm" color="secondary">
          “{prepared.preview.name}” goes to {scheduled.audience ?? prepared.preview.audienceSize} people
          {scheduled.sendAt ? ` at ${new Date(scheduled.sendAt).toLocaleTimeString()}` : ' in a couple of minutes'}. Follow it, or cancel
          it, in TrueBeep → Campaigns.
        </Text>
        <LightButton onClick={() => void closeSidePanel()} data-testid="truebeep-campaign-close">
          Close
        </LightButton>
      </div>
    );
  }

  return (
    <div style={column} data-testid="truebeep-campaign-composer">
      <Text weight="semibold">Send as a TrueBeep campaign</Text>
      <Text size="sm" color="secondary">
        {totalSelected === null ? `All ${isDeal ? 'deals' : 'people'} in this view (up to ${MAX_CAMPAIGN_SELECTION})` : `${totalSelected} selected`}. Large sends go out as a campaign, so TrueBeep’s consent, quiet hours and sending limits apply.
      </Text>
      {totalSelected !== null && totalSelected > MAX_CAMPAIGN_SELECTION && (
        <Banner status="warning" variant="soft">
          Up to {MAX_CAMPAIGN_SELECTION} are used. For bigger audiences, build a segment in TrueBeep.
        </Banner>
      )}
      {problem && (
        <Banner status="error" variant="soft">
          {problem}
        </Banner>
      )}

      {!prepared && (
        <>
          <SegmentedControl
            aria-label="Channel"
            fullWidth
            value={channel}
            onValueChange={(v) => setChannel(v as TrueBeepChannel)}
            options={(['email', 'sms', 'whatsapp'] as const).map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
            data-testid="truebeep-campaign-channel"
          />
          {label('Template')}
          {templates === null ? (
            <Loader />
          ) : templates.length === 0 ? (
            <Text size="sm" color="tertiary">
              No {CHANNEL_LABELS[channel]} templates in TrueBeep. Create one in TrueBeep first: campaigns send a template.
            </Text>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[1] }}>
              {templates.map((t) => (
                <LightButton
                  key={t.id}
                  variant={templateId === t.id ? 'soft' : 'ghost'}
                  aria-pressed={templateId === t.id}
                  onClick={() => setTemplateId(t.id)}
                  title={t.preview}
                  data-testid={`truebeep-campaign-template-${t.id}`}
                >
                  {t.name}
                </LightButton>
              ))}
            </div>
          )}
          {label('Campaign name')}
          <Input value={name} onValueChange={(v) => setName(String(v))} placeholder="Twenty send (optional)" data-testid="truebeep-campaign-name" />
          <MainButton onClick={() => void prepare()} disabled={!templateId || busy} loading={busy} data-testid="truebeep-campaign-prepare">
            Check audience and cost
          </MainButton>
        </>
      )}

      {prepared && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }} data-testid="truebeep-campaign-preview">
          {prepared.campaignId === null ? (
            <Banner status="warning" variant="soft">
              None of the {prepared.selected} people are TrueBeep customers yet, so there is nobody to send to.
            </Banner>
          ) : (
            <>
              <Text size="sm">
                {prepared.preview?.audienceSize ?? prepared.matched} will receive it
                {prepared.notInTrueBeep > 0 ? ` · ${prepared.notInTrueBeep} not in TrueBeep (left out)` : ''}
                {prepared.dealsWithoutContact > 0 ? ` · ${prepared.dealsWithoutContact} deals without a contact` : ''}
              </Text>
              {prepared.preview?.estimatedCost != null && (
                <Text size="sm" color="secondary">
                  Estimated cost: {prepared.preview.estimatedCost.toFixed(2)} (charged to your TrueBeep plan)
                </Text>
              )}
              {(prepared.preview?.missing ?? []).map((m) => (
                <Text key={m} size="sm" color="tertiary">
                  – {m}
                </Text>
              ))}
              <MainButton
                onClick={() => void confirm()}
                disabled={busy || !prepared.preview?.ready}
                loading={busy}
                data-testid="truebeep-campaign-confirm"
              >
                Send campaign
              </MainButton>
            </>
          )}
          <LightButton onClick={() => setPrepared(null)} disabled={busy} data-testid="truebeep-campaign-back">
            Back
          </LightButton>
        </div>
      )}
    </div>
  );
};
