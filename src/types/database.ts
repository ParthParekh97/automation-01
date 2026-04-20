export type Plan = "starter" | "growth" | "scale";
export type LeadSource = "manual" | "web" | "facebook" | "instagram" | "google" | "referral" | "other";
export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "booked" | "closed_won" | "closed_lost";
export type CallOutcome = "no_answer" | "voicemail" | "callback" | "interested" | "not_interested" | "booked" | "other";
export type EmailStatus = "draft" | "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";
export type ConversationChannel = "sms" | "whatsapp" | "facebook" | "instagram" | "webchat" | "email";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "rescheduled" | "completed" | "no_show";

export interface Client {
  id: string;
  name: string;
  email: string;
  token: string;
  active: boolean;
  plan: Plan;
  created_at: string;
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
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
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
      leads: { Row: Lead; Insert: Omit<Lead, "id" | "created_at">; Update: Partial<Omit<Lead, "id">> };
      calls: { Row: Call; Insert: Omit<Call, "id" | "created_at">; Update: Partial<Omit<Call, "id">> };
      emails: { Row: Email; Insert: Omit<Email, "id">; Update: Partial<Omit<Email, "id">> };
      conversations: { Row: Conversation; Insert: Omit<Conversation, "id" | "created_at">; Update: Partial<Omit<Conversation, "id">> };
      bookings: { Row: Booking; Insert: Omit<Booking, "id" | "created_at">; Update: Partial<Omit<Booking, "id">> };
    };
    Views: {
      lead_summary: { Row: LeadSummary };
    };
  };
};
