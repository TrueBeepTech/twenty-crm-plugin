import { defineConnectionProvider } from 'twenty-sdk/define';

import {
  TRUEBEEP_OAUTH_CONNECTION_NAME,
  TRUEBEEP_OAUTH_CONNECTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// "Connect TrueBeep": sign in to TrueBeep, pick the team and approve the
// scopes. Twenty discovers TrueBeep's OAuth server from the resource
// (RFC 9728), registers itself (RFC 7591), and refreshes the token.
// The resource is fixed at build time; staging/local builds set
// TRUEBEEP_OAUTH_RESOURCE_URL before `twenty app apply`.
export default defineConnectionProvider({
  universalIdentifier: TRUEBEEP_OAUTH_CONNECTION_UNIVERSAL_IDENTIFIER,
  name: TRUEBEEP_OAUTH_CONNECTION_NAME,
  displayName: 'TrueBeep',
  logo: 'logo.svg',
  scope: 'WORKSPACE',
  type: 'oauth-discovery',
  oauthDiscovery: {
    resourceUrl: process.env.TRUEBEEP_OAUTH_RESOURCE_URL || 'https://api.truebeep.com/mcp',
  },
});
