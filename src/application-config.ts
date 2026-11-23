import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  TRUEBEEP_API_BASE_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    // Where the TrueBeep public API (the processor's /v1) lives. Overridden per workspace
    // for local development, e.g. http://host.docker.internal:7001
    TRUEBEEP_API_BASE: {
      universalIdentifier: TRUEBEEP_API_BASE_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'TrueBeep API URL',
      description: 'Base URL of the TrueBeep API. Leave as is unless TrueBeep support asks you to change it.',
      value: 'https://api.truebeep.com',
      isRequired: true,
      scope: 'WORKSPACE',
    },
  },
});
