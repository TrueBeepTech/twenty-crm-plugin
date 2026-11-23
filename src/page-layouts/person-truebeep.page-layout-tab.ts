import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  TRUEBEEP_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_PERSON_TAB_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_PERSON_TAB_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayoutTab({
  universalIdentifier: TRUEBEEP_PERSON_TAB_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier: STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.personRecordPage.universalIdentifier,
  title: 'TrueBeep',
  icon: 'IconMessage',
  position: 50,
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: TRUEBEEP_PERSON_TAB_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'TrueBeep',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: TRUEBEEP_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
