import { useCallback, useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';
import { Banner, Loader } from 'twenty-ui/primitives/feedback';
import { Tag } from 'twenty-ui/primitives/data-display';
import { Text } from 'twenty-ui/primitives/typography';
import { LightButton } from 'twenty-ui/components/input';
import { useTheme } from 'twenty-ui/theme';

import { TRUEBEEP_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type { PersonSummaryResponse } from 'src/logic-functions/person-summary';

const CHANNEL_LABELS: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };

const TrueBeepPanel = () => {
  const theme = useTheme();
  const personId = useRecordId();
  const [summary, setSummary] = useState<PersonSummaryResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!personId) return;
    setSummary(null);
    setFailed(null);
    try {
      const result = await new RestApiClient().get<PersonSummaryResponse>('/s/truebeep/person-summary', {
        query: { personId },
      });
      setSummary(result);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'Could not reach TrueBeep.');
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const column = { display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[2], padding: theme.spacing[3] };

  if (failed) {
    return (
      <div style={column} data-testid="truebeep-panel-error">
        <Banner status="error" variant="soft">{failed}</Banner>
        <LightButton onClick={() => void load()} data-testid="truebeep-panel-retry">
          Try again
        </LightButton>
      </div>
    );
  }

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
            No TrueBeep customer matches {summary.lookedUp.email ?? summary.lookedUp.phone}.
          </Text>
        </div>
      );
    case 'found': {
      const { customer } = summary;
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unnamed customer';
      return (
        <div style={column} data-testid="truebeep-panel-found">
          <Text weight="semibold">{name}</Text>
          <Text color="tertiary" size="sm">
            Matched by {summary.matchedBy}
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[1] }}>
            {(customer.channels ?? []).map((channel) => (
              <Tag key={`${channel.type}:${channel.value}`} color={channel.isVerified ? 'green' : 'gray'}>
                {CHANNEL_LABELS[channel.type] ?? channel.type}: {channel.value}
              </Tag>
            ))}
          </div>
        </div>
      );
    }
  }
};

export default defineFrontComponent({
  universalIdentifier: TRUEBEEP_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'TrueBeep panel',
  description: 'TrueBeep customer, channels and consent for this person',
  component: TrueBeepPanel,
});
