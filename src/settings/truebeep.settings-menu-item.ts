import { defineSettingsMenuItem } from 'twenty-sdk/define';

import {
  TRUEBEEP_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineSettingsMenuItem({
  universalIdentifier: TRUEBEEP_SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier: TRUEBEEP_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  title: 'TrueBeep',
  icon: 'IconMessage',
  scope: 'WORKSPACE',
  slug: 'truebeep',
});
