import { RestApiClient } from 'twenty-client-sdk/rest';

// Front components call the app's own routes (/s/truebeep/*); those hold the
// TrueBeep credential and talk to TrueBeep. Every route answers with JSON that
// has a `status`, so callers only handle `ok` vs a message to show.

export type RouteFailure = { status: 'error' | 'not_connected'; message: string; code?: string };

export const isFailure = (value: unknown): value is RouteFailure =>
  !!value && typeof value === 'object' && ['error', 'not_connected'].includes((value as { status?: string }).status ?? '');

export const getRoute = async <T>(path: string, query?: Record<string, string>): Promise<T | RouteFailure> => {
  try {
    return await new RestApiClient().get<T>(`/s/truebeep/${path}`, { query });
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not reach TrueBeep.' };
  }
};

export const postRoute = async <T>(path: string, body: unknown): Promise<T | RouteFailure> => {
  try {
    return await new RestApiClient().post<T>(`/s/truebeep/${path}`, body);
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not reach TrueBeep.' };
  }
};

export const newRequestId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
