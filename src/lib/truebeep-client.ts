import { listConnections, reportConnectionAuthFailure } from 'twenty-sdk/logic-function';

import { TRUEBEEP_API_KEY_CONNECTION_NAME } from 'src/constants/universal-identifiers';

// Server-side only (logic functions). Front components call the app's /s/* routes instead,
// so the TrueBeep credential never reaches the browser.

export class TrueBeepNotConnectedError extends Error {
  readonly code = 'TRUEBEEP_NOT_CONNECTED';
  constructor() {
    super('TrueBeep is not connected. Add a TrueBeep API key under Settings → Applications → TrueBeep.');
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

export const getTrueBeep = async (): Promise<TrueBeepClient> => {
  const connections = await listConnections({ providerName: TRUEBEEP_API_KEY_CONNECTION_NAME, scope: 'WORKSPACE' });
  const connection = connections.find((c) => !c.authFailedAt) ?? connections[0];
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
      await reportConnectionAuthFailure({ connectionId: connection.id, reason: 'TrueBeep rejected the API key' });
      throw new TrueBeepApiError(401, 'TRUEBEEP_AUTH_FAILED', 'TrueBeep rejected the API key. Reconnect TrueBeep.');
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
