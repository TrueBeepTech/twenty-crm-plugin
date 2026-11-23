import { defineTimelineActivityType } from 'twenty-sdk/define';

import {
  TRUEBEEP_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_TIMELINE_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// One entry per TrueBeep customer interaction (message sent, reply, opt-out,
// purchase…), created by the events route on the matching person's timeline.
export default defineTimelineActivityType({
  universalIdentifier: TRUEBEEP_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  name: 'truebeepActivity',
  label: 'TrueBeep',
  icon: 'IconMessage',
  frontComponentUniversalIdentifier: TRUEBEEP_TIMELINE_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
