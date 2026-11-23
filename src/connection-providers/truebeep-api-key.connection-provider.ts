import { defineConnectionProvider } from 'twenty-sdk/define';

import {
  TRUEBEEP_API_KEY_CONNECTION_NAME,
  TRUEBEEP_API_KEY_CONNECTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// One TrueBeep team per Twenty workspace. The API key is created in TrueBeep under
// Settings → API keys; TrueBeep derives the team from it, so the app never sends a team id.
export default defineConnectionProvider({
  universalIdentifier: TRUEBEEP_API_KEY_CONNECTION_UNIVERSAL_IDENTIFIER,
  name: TRUEBEEP_API_KEY_CONNECTION_NAME,
  displayName: 'TrueBeep (API key)',
  logo: 'logo.svg',
  scope: 'WORKSPACE',
  type: 'api-key',
});
