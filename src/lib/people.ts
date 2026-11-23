import { RestApiClient } from 'twenty-client-sdk/rest';

import { TrueBeepApiError, type TrueBeepClient } from 'src/lib/truebeep-client';

// Reading Twenty people server side, and finding their TrueBeep customer.

export type TwentyPerson = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null; primaryPhoneCallingCode?: string | null } | null;
  /** Written by TrueBeep's native connector when it links a person; the app only reads it. */
  truebeepSubscriberId?: string | null;
  pointOfContactId?: string | null;
};

export const MAX_PEOPLE_PER_REQUEST = 25;

export const personEmail = (p: TwentyPerson) => p.emails?.primaryEmail?.trim().toLowerCase() || undefined;

export const personPhone = (p: TwentyPerson) => {
  const digits = `${p.phones?.primaryPhoneCallingCode ?? ''}${p.phones?.primaryPhoneNumber ?? ''}`.replace(/\D/g, '');
  return digits.length >= 6 ? digits : undefined;
};

export const personName = (p: TwentyPerson) =>
  [p.name?.firstName, p.name?.lastName].filter(Boolean).join(' ').trim() || personEmail(p) || 'Unnamed person';

export const getPeople = async (ids: string[]): Promise<TwentyPerson[]> => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  if (unique.length > MAX_PEOPLE_PER_REQUEST) {
    throw new Error(`Select up to ${MAX_PEOPLE_PER_REQUEST} people at a time.`);
  }
  const twenty = new RestApiClient();
  const people: TwentyPerson[] = [];
  for (const id of unique) {
    const { data } = await twenty.get<{ data: { person: TwentyPerson } }>(`/rest/people/${encodeURIComponent(id)}`);
    if (data?.person) people.push(data.person);
  }
  return people;
};

/** Opportunity ids → their point-of-contact person ids (deals without a contact are skipped). */
export const getPointsOfContact = async (opportunityIds: string[]): Promise<{ personIds: string[]; skipped: number }> => {
  const twenty = new RestApiClient();
  const personIds: string[] = [];
  let skipped = 0;
  for (const id of [...new Set(opportunityIds)].slice(0, MAX_PEOPLE_PER_REQUEST)) {
    const { data } = await twenty.get<{ data: { opportunity: { pointOfContactId?: string | null } } }>(
      `/rest/opportunities/${encodeURIComponent(id)}`,
    );
    if (data?.opportunity?.pointOfContactId) personIds.push(data.opportunity.pointOfContactId);
    else skipped += 1;
  }
  return { personIds, skipped };
};

const isNotFound = (error: unknown) =>
  error instanceof TrueBeepApiError && (error.status === 404 || /not found/i.test(error.message));

export type CustomerMatch = { customerId: string; matchedBy: 'link' | 'email' | 'phone' } | null;

/** The person's TrueBeep customer: the connector's link first, then email, then phone. */
export const findCustomer = async (trueBeep: TrueBeepClient, person: TwentyPerson): Promise<CustomerMatch> => {
  if (person.truebeepSubscriberId) {
    try {
      await trueBeep.request('GET', `/v1/customer/${encodeURIComponent(person.truebeepSubscriberId)}`);
      return { customerId: person.truebeepSubscriberId, matchedBy: 'link' };
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  const email = personEmail(person);
  if (email) {
    try {
      const res = await trueBeep.request<{ data: { id: string } }>('GET', `/v1/customer/email/${encodeURIComponent(email)}`);
      return { customerId: res.data.id, matchedBy: 'email' };
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  const phone = personPhone(person);
  if (phone) {
    try {
      const res = await trueBeep.request<{ data: { id: string } }>('GET', `/v1/customer/mobile/${phone}`);
      return { customerId: res.data.id, matchedBy: 'phone' };
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return null;
};
