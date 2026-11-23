import { defineCommandMenuItem, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  TRUEBEEP_SEND_COMMAND_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: TRUEBEEP_SEND_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'Send via TrueBeep',
  shortLabel: 'Send',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier: TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
