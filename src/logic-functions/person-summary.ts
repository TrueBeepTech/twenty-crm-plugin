import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/define';

import { TRUEBEEP_CONNECTION_STATUS_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { TrueBeepApiError, TrueBeepNotConnectedError, getTrueBeep } from 'src/lib/truebeep-client';

type TwentyPerson = {
  id: string;
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string | null };
  phones?: { primaryPhoneNumber?: string | null; primaryPhoneCallingCode?: string | null };
};

type TrueBeepChannel = { type: string; value: string; isVerified?: boolean };
type TrueBeepCustomer = { id: string; firstName?: string; lastName?: string; channels?: TrueBeepChannel[] };

export type PersonSummaryResponse =
  | { status: 'not_connected'; message: string }
  | { status: 'error'; message: string }
  | { status: 'no_contact'; message: string }
  | { status: 'not_found'; lookedUp: { email?: string; phone?: string } }
  | { status: 'found'; matchedBy: 'email' | 'phone'; customer: TrueBeepCustomer };

const isNotFound = (error: unknown) =>
  error instanceof TrueBeepApiError && /not found/i.test(error.message);

// The person is read server side by id, so the client can only ask about records
// it can open in this workspace; it never sends an email or phone to look up.
const summarize = async (event: RoutePayload): Promise<PersonSummaryResponse> => {
  const personId = event.queryStringParameters.personId;
  if (!personId) {
    return { status: 'error', message: 'personId is required' };
  }

  let trueBeep;
  try {
    trueBeep = await getTrueBeep();
  } catch (error) {
    if (error instanceof TrueBeepNotConnectedError) {
      return { status: 'not_connected', message: error.message };
    }
    throw error;
  }

  const twenty = new RestApiClient();
  const { data } = await twenty.get<{ data: { person: TwentyPerson } }>(`/rest/people/${encodeURIComponent(personId)}`);
  const person = data.person;

  const email = person.emails?.primaryEmail?.trim().toLowerCase() || undefined;
  const digits = `${person.phones?.primaryPhoneCallingCode ?? ''}${person.phones?.primaryPhoneNumber ?? ''}`.replace(/\D/g, '');
  const phone = digits.length >= 6 ? digits : undefined;

  if (!email && !phone) {
    return { status: 'no_contact', message: 'This person has no email or phone in Twenty.' };
  }

  try {
    if (email) {
      try {
        const res = await trueBeep.request<{ data: TrueBeepCustomer }>('GET', `/v1/customer/email/${encodeURIComponent(email)}`);
        return { status: 'found', matchedBy: 'email', customer: res.data };
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    if (phone) {
      try {
        const res = await trueBeep.request<{ data: TrueBeepCustomer }>('GET', `/v1/customer/mobile/${phone}`);
        return { status: 'found', matchedBy: 'phone', customer: res.data };
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    return { status: 'not_found', lookedUp: { email, phone } };
  } catch (error) {
    if (error instanceof TrueBeepApiError) {
      return { status: 'error', message: error.message };
    }
    throw error;
  }
};

// The panel shows a readable message instead of a bare 500.
const handler = async (event: RoutePayload): Promise<PersonSummaryResponse> => {
  try {
    return await summarize(event);
  } catch (error) {
    console.error('truebeep-person-summary failed', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Unexpected error' };
  }
};

export default defineLogicFunction({
  universalIdentifier: TRUEBEEP_CONNECTION_STATUS_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'truebeep-person-summary',
  description: 'Looks up the TrueBeep customer for a Twenty person',
  timeoutSeconds: 15,
  httpRouteTriggerSettings: {
    path: '/truebeep/person-summary',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
  handler,
});
