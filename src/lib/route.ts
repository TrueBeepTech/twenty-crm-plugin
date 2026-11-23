import type { RoutePayload } from 'twenty-sdk/define';

import { TrueBeepApiError, TrueBeepNotConnectedError } from 'src/lib/truebeep-client';

export type RouteError = { status: 'error' | 'not_connected'; message: string; code?: string };

/**
 * Wraps an app route so the front component always gets JSON it can show:
 * not connected, a TrueBeep refusal with its code, or a readable failure.
 */
export const route =
  <T>(name: string, fn: (event: RoutePayload) => Promise<T>) =>
  async (event: RoutePayload): Promise<T | RouteError> => {
    try {
      return await fn(event);
    } catch (error) {
      if (error instanceof TrueBeepNotConnectedError) return { status: 'not_connected', message: error.message };
      if (error instanceof TrueBeepApiError) return { status: 'error', message: error.message, code: error.code };
      console.error(`${name} failed`, error);
      return { status: 'error', message: error instanceof Error ? error.message : 'Unexpected error' };
    }
  };

export const bodyOf = <T>(event: RoutePayload): Partial<T> => {
  if (event.body && typeof event.body === 'object') return event.body as Partial<T>;
  if (typeof event.rawBody === 'string' && event.rawBody) {
    try {
      return JSON.parse(event.rawBody) as Partial<T>;
    } catch {
      return {};
    }
  }
  return {};
};
