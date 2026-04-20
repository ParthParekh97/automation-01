export type Plan = "starter" | "growth" | "scale";
export type LeadSource = "manual" | "web" | "facebook" | "instagram" | "google" | "referral" | "other";
export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "booked" | "closed_won" | "closed_lost";
export type CallOutcome = "no_answer" | "voicemail" | "callback" | "interested" | "not_interested" | "booked" | "other";
export type EmailStatus = "draft" | "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";
export type ConversationChannel = "sms" | "whatsapp" | "facebook" | "instagram" | "webchat" | "email";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "rescheduled" | "completed" | "no_show";
export type IntegrationProvider = "gmail" | "outlook" | "facebook" | "instagram";
export type EmailDirection = "outbound" | "inbound";
export type SequenceStatus = "active" | "paused" | "completed" | "cancelled";

export interface Client {
  id: string;
  name: string;
  email: string;
  token: string;
  active: boolean;
  plan: Plan;
  service_type: string | null;
  booking_link: string | null;
  created_at: string;
}

export interface ClientIntegration {
  id: string;
  client_id: string;
  provider: IntegrationProvider;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expiry: string | null;
  scope: string | null;
  connected_email: string | null;
  gmail_history_id: string | null;
  gmail_watch_expiry: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  client_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  created_at: string;
}

export interface Call {
  id: string;
  lead_id: string;
  client_id: string;
  outcome: CallOutcome;
  duration: number;
  transcript: string | null;
  recording_url: string | null;
  vapi_call_id: string | null;
  created_at: string;
}

export interface Email {
  id: string;
  lead_id: string;
  client_id: string;
  subject: string;
  body: string;
  status: EmailStatus;
  sent_at: string | null;
  direction: EmailDirection;
  gmail_message_id: string | null;
  thread_id: string | null;
  from_email: string | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  /** Optional extra fields stored in JSONB — used by email channel for subject, from, etc. */
  metadata?: Record<string, string>;
}

export interface Conversation {
  id: string;
  lead_id: string;
  client_id: string;
  channel: ConversationChannel;
  messages: Message[];
  created_at: string;
}

export interface Booking {
  id: string;
  lead_id: string;
  client_id: string;
  booking_date: string;
  status: BookingStatus;
  cal_event_id: string | null;
  created_at: string;
}

export interface EmailSequence {
  id: string;
  lead_id: string;
  client_id: string;
  status: SequenceStatus;
  current_step: number;
  next_send_at: string | null;
  replied: boolean;
  thread_id: string | null;
  last_email_id: string | null;
  cancelled_reason: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface LeadSummary extends Lead {
  call_count: number;
  email_count: number;
  conversation_count: number;
  booking_count: number;
  last_call_at: string | null;
  last_email_at: string | null;
}

export type Database = {
  public: {
    Tables: {
      clients: { Row: Client; Insert: Omit<Client, "id" | "token" | "created_at">; Update: Partial<Omit<Client, "id">> };
      client_integrations: { Row: ClientIntegration; Insert: Omit<ClientIntegration, "id" | "created_at" | "updated_at">; Update: Partial<Omit<ClientIntegration, "id">> };
      leads: { Row: Lead; Insert: Omit<Lead, "id" | "created_at">; Update: Partial<Omit<Lead, "id">> };
      calls: { Row: Call; Insert: Omit<Call, "id" | "created_at">; Update: Partial<Omit<Call, "id">> };
      emails: { Row: Email; Insert: Omit<Email, "id">; Update: Partial<Omit<Email, "id">> };
      conversations: { Row: Conversation; Insert: Omit<Conversation, "id" | "created_at">; Update: Partial<Omit<Conversation, "id">> };
      bookings: { Row: Booking; Insert: Omit<Booking, "id" | "created_at">; Update: Partial<Omit<Booking, "id">> };
      email_sequences: { Row: EmailSequence; Insert: Omit<EmailSequence, "id" | "created_at">; Update: Partial<Omit<EmailSequence, "id">> };
    };
    Views: {
      lead_summary: { Row: LeadSummary };
    };
  };
};
