import { defineCommandMenuItem, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  TRUEBEEP_START_WORKFLOW_COMMAND_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_START_WORKFLOW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: TRUEBEEP_START_WORKFLOW_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'Start TrueBeep workflow',
  shortLabel: 'TrueBeep workflow',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier: TRUEBEEP_START_WORKFLOW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
