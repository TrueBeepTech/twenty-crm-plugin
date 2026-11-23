import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { MainButton, LightButton } from 'twenty-ui/components/input';
import { Banner, Loader } from 'twenty-ui/primitives/feedback';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import { TRUEBEEP_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { isFailure, postRoute } from 'src/front-components/shared/call-route';

type Feed = { registered: boolean; eventsUrl?: string; lastDeliveredAt?: string | null; lastError?: string | null };

const TrueBeepSettings = () => {
  const theme = useTheme();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (action: 'status' | 'enable' | 'disable') => {
    setBusy(true);
    const res = await postRoute<{ status: 'ok'; feed: Feed }>('events-setup', { action });
    setBusy(false);
    if (isFailure(res)) {
      setProblem(res.message);
      return;
    }
    setProblem(null);
    setFeed(res.feed);
    if (action !== 'status') {
      await enqueueSnackbar({ message: action === 'enable' ? 'TrueBeep activity feed on' : 'TrueBeep activity feed off', variant: 'success' });
    }
  }, []);

  useEffect(() => {
    void call('status');
  }, [call]);

  const column = { display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[3], padding: theme.spacing[4], maxWidth: 640 };

  return (
    <div style={column} data-testid="truebeep-settings">
      <Text weight="semibold">TrueBeep</Text>
      <Text color="secondary" size="sm">
        Connect TrueBeep with an API key under Settings → Applications → TrueBeep. Then turn on the activity feed to see
        messages, replies and other TrueBeep activity on each person’s timeline.
      </Text>
      {problem && (
        <Banner status={/not connected/i.test(problem) ? 'warning' : 'error'} variant="soft">
          {problem}
        </Banner>
      )}
      {feed === null && !problem ? (
        <Loader />
      ) : feed ? (
        <>
          <Text weight="medium" data-testid="truebeep-settings-feed-state">
            Activity feed: {feed.registered ? 'on' : 'off'}
          </Text>
          {feed.registered && (
            <Text size="sm" color="tertiary">
              {feed.lastError
                ? `Last delivery failed: ${feed.lastError}`
                : feed.lastDeliveredAt
                  ? `Last activity received ${new Date(feed.lastDeliveredAt).toLocaleString()}`
                  : 'Waiting for the first activity.'}
            </Text>
          )}
          {feed.registered ? (
            <LightButton onClick={() => void call('disable')} disabled={busy} data-testid="truebeep-settings-feed-off">
              Turn off
            </LightButton>
          ) : (
            <MainButton onClick={() => void call('enable')} loading={busy} data-testid="truebeep-settings-feed-on">
              Show TrueBeep activity on timelines
            </MainButton>
          )}
        </>
      ) : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TRUEBEEP_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'TrueBeep settings',
  description: 'TrueBeep connection and activity feed settings',
  component: TrueBeepSettings,
});
