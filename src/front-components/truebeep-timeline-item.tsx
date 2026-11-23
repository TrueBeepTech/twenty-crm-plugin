import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useTimelineActivityId } from 'twenty-sdk/front-component';
import { Tag } from 'twenty-ui/primitives/data-display';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import { TRUEBEEP_TIMELINE_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type Properties = { title?: string; channel?: string; direction?: string };

const CHANNEL: Record<string, string> = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', twenty: 'Twenty' };

// How one TrueBeep activity reads on a person's timeline: the channel, in/out,
// and TrueBeep's one-line summary (e.g. "SMS sent from Twenty: …").
const TrueBeepTimelineItem = () => {
  const theme = useTheme();
  const id = useTimelineActivityId();
  const [props, setProps] = useState<Properties | null>(null);

  useEffect(() => {
    if (!id) return;
    void new RestApiClient()
      .get<{ data: { timelineActivity: { properties: Properties | null } } }>(`/rest/timelineActivities/${id}`)
      .then((res) => setProps(res.data.timelineActivity.properties ?? {}))
      .catch(() => setProps({}));
  }, [id]);

  if (!props) return null;
  const channel = props.channel ? (CHANNEL[props.channel] ?? props.channel) : null;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], flexWrap: 'wrap', minWidth: 0 }}
      data-testid="truebeep-timeline-item"
    >
      {channel && (
        <Tag color={props.direction === 'inbound' ? 'blue' : 'gray'}>
          {channel} {props.direction === 'inbound' ? '←' : '→'}
        </Tag>
      )}
      <Text size="sm" truncate>
        {props.title ?? 'TrueBeep activity'}
      </Text>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TRUEBEEP_TIMELINE_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'TrueBeep timeline item',
  description: 'One TrueBeep activity on a person timeline',
  component: TrueBeepTimelineItem,
});
