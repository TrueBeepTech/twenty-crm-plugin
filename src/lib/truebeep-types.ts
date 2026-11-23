// Shapes of the TrueBeep public API (processor docs/sdk-api.md §7–10), shared by
// logic functions and front components.

export type TrueBeepChannel = 'email' | 'sms' | 'whatsapp';

export const CHANNEL_LABELS: Record<TrueBeepChannel, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };

export type CustomerSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  channels: Array<{ channel: TrueBeepChannel; value: string | null; canSend: boolean; reason: string | null }>;
  loyaltyPoints: number;
  recentInteractions: Array<{ id: string; channel: string; type: string; direction: string; summary: string | null; createdAt: string }>;
  recentCampaigns: Array<{ campaignId: string; name: string; channel: string; status: string | null; sentAt: string }>;
};

export type TrueBeepTemplate = { id: string; name: string; channel: TrueBeepChannel; subject: string | null; preview: string };

export type SentMessage = {
  id: string;
  status: 'sent' | 'queued';
  channel: TrueBeepChannel;
  customerId: string;
  createdCustomer: boolean;
  to: string;
};

/** One row of the composer's recipient list (POST /s/truebeep/preview). */
export type RecipientPreview = {
  personId: string;
  name: string;
  canSend: boolean;
  /** Why not, or a note such as "Will be added to TrueBeep". */
  note: string | null;
};

export type SendOutcome = { personId: string; name: string; ok: boolean; message: string };
