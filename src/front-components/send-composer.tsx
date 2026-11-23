import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import { TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Phase 0 placeholder: proves the command opens with the selection. The composer
// (channel, template, consent preview, single vs bulk) lands in Phase 2.
const SendComposer = () => {
  const theme = useTheme();
  const selected = useSelectedRecordIds();
  return (
    <div
      data-testid="truebeep-send-composer"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2], padding: theme.spacing[4] }}
    >
      <Text weight="semibold">Send via TrueBeep</Text>
      <Text color="secondary" data-testid="truebeep-send-composer-count">
        {selected.length === 1 ? '1 person selected' : `${selected.length} people selected`}
      </Text>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TRUEBEEP_SEND_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'TrueBeep send composer',
  description: 'Compose an SMS, email or WhatsApp message to the selected people',
  component: SendComposer,
});
