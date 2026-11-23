import { listConnections, reportConnectionAuthFailure } from 'twenty-sdk/logic-function';

import { TRUEBEEP_API_KEY_CONNECTION_NAME, TRUEBEEP_OAUTH_CONNECTION_NAME } from 'src/constants/universal-identifiers';

// Server-side only (logic functions). Front components call the app's /s/* routes instead,
// so the TrueBeep credential never reaches the browser.

export class TrueBeepNotConnectedError extends Error {
  readonly code = 'TRUEBEEP_NOT_CONNECTED';
  constructor() {
    super('TrueBeep is not connected. Connect it under Settings → Apps → TrueBeep (sign in with TrueBeep, or add an API key).');
  }
}

export class TrueBeepApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type TrueBeepClient = {
  connectionId: string;
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>;
};

const getApiBase = () => (process.env.TRUEBEEP_API_BASE ?? 'https://api.truebeep.com').replace(/\/+$/, '');

/** Picks the OAuth connection ("Connect TrueBeep") when there is a healthy one, else the API key. */
const pickConnection = async () => {
  const [oauth, apiKey] = await Promise.all([
    listConnections({ providerName: TRUEBEEP_OAUTH_CONNECTION_NAME, scope: 'WORKSPACE' }),
    listConnections({ providerName: TRUEBEEP_API_KEY_CONNECTION_NAME, scope: 'WORKSPACE' }),
  ]);
  const healthy = (list: typeof oauth) => list.find((c) => !c.authFailedAt && c.accessToken);
  return healthy(oauth) ?? healthy(apiKey) ?? oauth[0] ?? apiKey[0];
};

export const getTrueBeep = async (): Promise<TrueBeepClient> => {
  const connection = await pickConnection();
  if (!connection?.accessToken) {
    throw new TrueBeepNotConnectedError();
  }

  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${getApiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
        'X-TrueBeep-Source': 'twenty-app',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 401) {
      const what = connection.providerType === 'api-key' ? 'the API key' : 'the sign-in';
      await reportConnectionAuthFailure({ connectionId: connection.id, reason: `TrueBeep rejected ${what}` });
      throw new TrueBeepApiError(401, 'TRUEBEEP_AUTH_FAILED', `TrueBeep rejected ${what}. Reconnect TrueBeep.`);
    }

    const text = await response.text();
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!response.ok) {
      const code = typeof json.code === 'string' ? json.code : `HTTP_${response.status}`;
      const message = typeof json.message === 'string' ? json.message : `TrueBeep returned ${response.status}`;
      throw new TrueBeepApiError(response.status, code, message);
    }
    return json as T;
  };

  return { connectionId: connection.id, request };
};
