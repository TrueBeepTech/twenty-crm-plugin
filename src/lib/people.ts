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

export const MAX_BULK_PEOPLE = 1000;
const BATCH = 50;

/** Many people in a few requests (bulk campaign path). */
export const getPeopleBulk = async (ids: string[]): Promise<TwentyPerson[]> => {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, MAX_BULK_PEOPLE);
  const twenty = new RestApiClient();
  const people: TwentyPerson[] = [];
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const { data } = await twenty.get<{ data: { people: TwentyPerson[] } }>('/rest/people', {
      query: { filter: `id[in]:[${chunk.map((id) => `"${id}"`).join(',')}]`, limit: BATCH },
    });
    people.push(...(data?.people ?? []));
  }
  return people;
};

type Connection<T> = { edges: Array<{ node: T }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

/** Pages a GraphQL connection (people or opportunities) under a record filter, up to MAX_BULK_PEOPLE. */
const pageByFilter = async <T>(field: 'people' | 'opportunities', filterType: string, selection: string, filter: unknown): Promise<T[]> => {
  const twenty = new RestApiClient();
  const out: T[] = [];
  let after: string | null = null;
  const query = `query($filter: ${filterType}, $after: String) { ${field}(filter: $filter, first: 200, after: $after) { edges { node { ${selection} } } pageInfo { hasNextPage endCursor } } }`;
  for (;;) {
    const res: { data?: Record<string, Connection<T>>; errors?: Array<{ message: string }> } = await twenty.post('/graphql', {
      query,
      variables: { filter: filter ?? {}, after },
    });
    if (res.errors?.length) throw new Error(res.errors[0].message);
    const conn = res.data?.[field];
    out.push(...(conn?.edges ?? []).map((e) => e.node));
    if (!conn?.pageInfo.hasNextPage || out.length >= MAX_BULK_PEOPLE) break;
    after = conn.pageInfo.endCursor;
  }
  return out.slice(0, MAX_BULK_PEOPLE);
};

/** People under the list's "select all" filter (Twenty passes a filter, not ids). */
export const getPeopleByFilter = (filter: unknown) =>
  pageByFilter<TwentyPerson>(
    'people',
    'PersonFilterInput',
    'id name { firstName lastName } emails { primaryEmail } phones { primaryPhoneNumber primaryPhoneCallingCode }',
    filter,
  );

/** Points of contact of the deals under a "select all" filter. */
export const getPointsOfContactByFilter = async (filter: unknown) => {
  const deals = await pageByFilter<{ pointOfContactId: string | null }>('opportunities', 'OpportunityFilterInput', 'pointOfContactId', filter);
  const personIds = [...new Set(deals.map((d) => d.pointOfContactId).filter((v): v is string => !!v))];
  return { personIds, skipped: deals.filter((d) => !d.pointOfContactId).length };
};

/** Many deals → their points of contact, in a few requests. */
export const getPointsOfContactBulk = async (opportunityIds: string[]): Promise<{ personIds: string[]; skipped: number }> => {
  const unique = [...new Set(opportunityIds.filter(Boolean))].slice(0, MAX_BULK_PEOPLE);
  const twenty = new RestApiClient();
  const personIds: string[] = [];
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const { data } = await twenty.get<{ data: { opportunities: Array<{ pointOfContactId?: string | null }> } }>('/rest/opportunities', {
      query: { filter: `id[in]:[${chunk.map((id) => `"${id}"`).join(',')}]`, limit: BATCH },
    });
    for (const o of data?.opportunities ?? []) if (o.pointOfContactId) personIds.push(o.pointOfContactId);
  }
  return { personIds: [...new Set(personIds)], skipped: unique.length - personIds.length };
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
