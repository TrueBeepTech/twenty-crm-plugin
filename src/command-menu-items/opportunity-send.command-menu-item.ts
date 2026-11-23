import { defineCommandMenuItem, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  TRUEBEEP_OPPORTUNITY_SEND_COMMAND_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// "Send via TrueBeep" on deals: messages each deal's point of contact.
export default defineCommandMenuItem({
  universalIdentifier: TRUEBEEP_OPPORTUNITY_SEND_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'Send via TrueBeep to point of contact',
  shortLabel: 'Send',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  frontComponentUniversalIdentifier: TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
