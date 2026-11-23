import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';
import { LightButton } from 'twenty-ui/components/input';
import { Tag } from 'twenty-ui/primitives/data-display';
import { Banner, Loader } from 'twenty-ui/primitives/feedback';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import { TRUEBEEP_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getRoute } from 'src/front-components/shared/call-route';
import type { PersonSummaryResponse } from 'src/logic-functions/person-summary';
import { CHANNEL_LABELS } from 'src/lib/truebeep-types';

const when = (iso: string) => {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString();
};

const TrueBeepPanel = () => {
  const theme = useTheme();
  const personId = useRecordId();
  const [summary, setSummary] = useState<PersonSummaryResponse | null>(null);

  const load = useCallback(async () => {
    if (!personId) return;
    setSummary(null);
    setSummary(await getRoute<PersonSummaryResponse>('person-summary', { personId }));
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const column = { display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[3], padding: theme.spacing[3] };
  const section = (title: string) => (
    <Text size="sm" color="tertiary" weight="medium">
      {title}
    </Text>
  );

  if (!summary) {
    return (
      <div style={column} data-testid="truebeep-panel-loading">
        <Loader />
      </div>
    );
  }

  switch (summary.status) {
    case 'not_connected':
    case 'error':
      return (
        <div style={column} data-testid={`truebeep-panel-${summary.status}`}>
          <Banner status={summary.status === 'error' ? 'error' : 'warning'} variant="soft">
            {summary.message}
          </Banner>
          <LightButton onClick={() => void load()} data-testid="truebeep-panel-retry">
            Try again
          </LightButton>
        </div>
      );
    case 'no_contact':
      return (
        <div style={column} data-testid="truebeep-panel-no-contact">
          <Text color="secondary">{summary.message}</Text>
        </div>
      );
    case 'not_found':
      return (
        <div style={column} data-testid="truebeep-panel-not-found">
          <Text weight="medium">Not in TrueBeep yet</Text>
          <Text color="secondary" size="sm">
            No TrueBeep customer matches {summary.lookedUp.email ?? summary.lookedUp.phone}. Sending an email from
            “Send via TrueBeep” adds them; SMS and WhatsApp need them to opt in through TrueBeep.
          </Text>
        </div>
      );
    case 'found': {
      const { customer } = summary;
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unnamed customer';
      return (
        <div style={column} data-testid="truebeep-panel-found">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing[2] }}>
            <Text weight="semibold">{name}</Text>
            <Text size="sm" color="secondary" data-testid="truebeep-panel-points">
              {customer.loyaltyPoints} points
            </Text>
          </div>

          {section('Channels')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
            {customer.channels.map((c) => (
              <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                <Tag color={c.canSend ? 'green' : 'gray'} data-testid={`truebeep-panel-channel-${c.channel}`}>
                  {CHANNEL_LABELS[c.channel]}
                </Tag>
                <Text size="sm" color={c.canSend ? 'secondary' : 'tertiary'}>
                  {c.canSend ? c.value : c.reason}
                </Text>
              </div>
            ))}
          </div>

          {section('Recent activity')}
          {customer.recentInteractions.length === 0 ? (
            <Text size="sm" color="tertiary">
              Nothing yet.
            </Text>
          ) : (
            customer.recentInteractions.map((i) => (
              <div key={i.id}>
                <Text size="sm">{i.summary ?? `${i.direction} ${i.type} (${i.channel})`}</Text>
                <Text size="sm" color="tertiary">
                  {when(i.createdAt)}
                </Text>
              </div>
            ))
          )}

          {customer.recentCampaigns.length > 0 && (
            <>
              {section('Campaigns')}
              {customer.recentCampaigns.map((c) => (
                <div key={`${c.campaignId}:${c.channel}`}>
                  <Text size="sm">{c.name}</Text>
                  <Text size="sm" color="tertiary">
                    {c.channel} · {c.status ?? 'sent'} · {when(c.sentAt)}
                  </Text>
                </div>
              ))}
            </>
          )}
          <LightButton onClick={() => void load()} data-testid="truebeep-panel-refresh">
            Refresh
          </LightButton>
        </div>
      );
    }
  }
};

export default defineFrontComponent({
  universalIdentifier: TRUEBEEP_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'TrueBeep panel',
  description: 'TrueBeep channels, consent, points and activity for this person',
  component: TrueBeepPanel,
});
