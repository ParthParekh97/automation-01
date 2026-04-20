"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatDate, formatDateTime, formatDuration, statusColor } from "@/lib/utils";
import { CallButton } from "@/components/calls/CallButton";
import { ComposeModal } from "@/components/emails/ComposeModal";

// ── Timeline types ────────────────────────────────────────────────────────────

export type TimelineEventType =
  | "call"
  | "email_out"
  | "email_in"
  | "conversation"
  | "booking"
  | "note"
  | "status_change";

export interface TimelineEvent {
  id: string;
  at: string;
  type: TimelineEventType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

// ── Lead shape passed from server ─────────────────────────────────────────────

export interface LeadProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  client_id: string;
  created_at: string;
}

// ── Timeline item config ──────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  TimelineEventType,
  { icon: string; dot: string; label: string }
> = {
  call:          { icon: "📞", dot: "bg-blue-500",    label: "Call"            },
  email_out:     { icon: "→",  dot: "bg-brand-500",   label: "Email sent"      },
  email_in:      { icon: "←",  dot: "bg-emerald-500", label: "Email received"  },
  conversation:  { icon: "💬", dot: "bg-amber-500",   label: "Conversation"    },
  booking:       { icon: "📅", dot: "bg-green-500",   label: "Booking"         },
  note:          { icon: "📝", dot: "bg-white/40",    label: "Note"            },
  status_change: { icon: "↻",  dot: "bg-violet-500",  label: "Status change"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

// ── Timeline card renderers ───────────────────────────────────────────────────

function CallCard({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`status-badge text-xs ${statusColor(data.outcome as string)}`}>
          {(data.outcome as string).replace(/_/g, " ")}
        </span>
        <span className="text-xs text-white/30">{formatDuration(data.duration as number)}</span>
      </div>
      {data.transcript && (
        <div>
          <p
            className={cn(
              "text-xs text-white/50 leading-relaxed",
              !expanded && "line-clamp-3"
            )}
          >
            {data.transcript as string}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-brand-400 hover:text-brand-300 mt-1"
          >
            {expanded ? "Show less" : "Read full transcript →"}
          </button>
        </div>
      )}
    </div>
  );
}

function EmailCard({ data }: { data: Record<string, unknown> }) {
  const isInbound = data.direction === "inbound";
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-white">{data.subject as string}</p>
      {isInbound && data.from_email && (
        <p className="text-xs text-white/35">From: {data.from_email as string}</p>
      )}
      {!isInbound && (
        <span className={`status-badge text-[10px] ${statusColor(data.status as string)}`}>
          {data.status as string}
        </span>
      )}
    </div>
  );
}

function ConversationCard({ data }: { data: Record<string, unknown> }) {
  const messages = (data.messages as Array<{ role: string; content: string }>) ?? [];
  const preview = messages[messages.length - 1];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-amber-400 capitalize">
          {data.channel as string}
        </span>
        <span className="text-xs text-white/30">{messages.length} messages</span>
      </div>
      {preview && (
        <p className="text-xs text-white/45 line-clamp-2">
          <span className="capitalize text-white/30">{preview.role}: </span>
          {preview.content}
        </p>
      )}
      <Link
        href={`/conversations?id=${data.id as string}`}
        className="text-[10px] text-brand-400 hover:text-brand-300"
      >
        View full conversation →
      </Link>
    </div>
  );
}

function BookingCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-white">{formatDateTime(data.booking_date as string)}</p>
      <span className={`status-badge text-xs ${statusColor(data.status as string)}`}>
        {data.status as string}
      </span>
    </div>
  );
}

function NoteCard({ data }: { data: Record<string, unknown> }) {
  return (
    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
      {data.content as string}
    </p>
  );
}

function StatusChangeCard({ data }: { data: Record<string, unknown> }) {
  const meta = data.metadata as { from?: string; to?: string };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`status-badge text-xs ${statusColor(meta.from ?? "")}`}>
        {(meta.from ?? "").replace(/_/g, " ")}
      </span>
      <span className="text-white/30 text-xs">→</span>
      <span className={`status-badge text-xs ${statusColor(meta.to ?? "")}`}>
        {(meta.to ?? "").replace(/_/g, " ")}
      </span>
    </div>
  );
}

// ── Timeline item ─────────────────────────────────────────────────────────────

function TimelineItem({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const cfg = EVENT_CONFIG[event.type];
  return (
    <div className="flex gap-4">
      {/* Line + dot */}
      <div className="flex flex-col items-center flex-shrink-0 w-8">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10",
            cfg.dot
          )}
        >
          {cfg.icon}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-white/[0.06] mt-1" />}
      </div>

      {/* Card */}
      <div className={cn("flex-1 pb-5", isLast && "pb-2")}>
        <div className="glass-card-sm p-3.5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              {cfg.label}
            </span>
            <span className="text-[10px] text-white/25 flex-shrink-0">
              {relativeTime(event.at)}
            </span>
          </div>

          {event.type === "call" && <CallCard data={event.data} />}
          {(event.type === "email_out" || event.type === "email_in") && (
            <EmailCard data={event.data} />
          )}
          {event.type === "conversation" && <ConversationCard data={event.data} />}
          {event.type === "booking" && <BookingCard data={event.data} />}
          {event.type === "note" && <NoteCard data={event.data} />}
          {event.type === "status_change" && <StatusChangeCard data={event.data} />}
        </div>
      </div>
    </div>
  );
}

// ── Add Note modal ────────────────────────────────────────────────────────────

function NoteModal({
  leadId,
  clientId,
  onClose,
  onSaved,
}: {
  leadId: string;
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, client_id: clientId }),
      });
      if (res.ok) { onSaved(); }
      else { const d = await res.json(); setError(d.error ?? "Failed to save note"); }
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">📝 Add Note</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xl">×</button>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your note here…"
          rows={5}
          className="glass-input w-full text-sm resize-none"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-between pt-1">
          <button onClick={onClose} className="glass-btn-secondary text-sm py-2 px-4">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className="glass-btn-primary text-sm py-2 px-5 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Book Appointment modal ────────────────────────────────────────────────────

function BookingModal({
  leadId,
  clientId,
  onClose,
  onSaved,
}: {
  leadId: string;
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBook() {
    setSaving(true);
    setError(null);
    const booking_date = new Date(`${date}T${time}:00`).toISOString();
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, client_id: clientId, booking_date, notes }),
      });
      if (res.ok) { onSaved(); }
      else { const d = await res.json(); setError(d.error ?? "Failed to book"); }
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">📅 Book Appointment</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xl">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Date</label>
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)}
              className="glass-input w-full text-sm" style={{ colorScheme: "dark" }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="glass-input w-full text-sm" style={{ colorScheme: "dark" }} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Notes (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Meeting topic, location…" className="glass-input w-full text-sm" />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-between pt-1">
          <button onClick={onClose} className="glass-btn-secondary text-sm py-2 px-4">Cancel</button>
          <button onClick={handleBook} disabled={saving}
            className="glass-btn-primary text-sm py-2 px-5 disabled:opacity-40">
            {saving ? "Booking…" : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Recommendation widget ──────────────────────────────────────────────────

function AIRecommendation({ leadId }: { leadId: string }) {
  const [rec, setRec] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/recommendation`)
      .then((r) => r.json())
      .then((d) => setRec(d.recommendation ?? null))
      .catch(() => setRec(null))
      .finally(() => setLoading(false));
  }, [leadId]);

  return (
    <div className="glass-card-sm p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">✨</span>
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          AI Recommendation
        </span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-3.5 h-3.5 border border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
          <span className="text-xs text-white/30">Analysing lead…</span>
        </div>
      ) : rec ? (
        <p className="text-sm text-white/70 leading-relaxed">{rec}</p>
      ) : (
        <p className="text-xs text-white/30">No recommendation available.</p>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

interface Props {
  lead: LeadProfile;
  timeline: TimelineEvent[];
  totalTouchpoints: number;
  activeSequence: boolean;
}

export function LeadProfileClient({ lead, timeline, totalTouchpoints, activeSequence }: Props) {
  const router = useRouter();
  const [showCompose, setShowCompose] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showBooking, setShowBooking] = useState(false);

  const daysPipeline = daysSince(lead.created_at);

  function afterMutation() {
    setShowNote(false);
    setShowBooking(false);
    router.refresh();
  }

  return (
    <div className="flex gap-6 items-start">
      {/* ── Left: Timeline ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Timeline
            <span className="text-white/25 font-normal ml-2 normal-case">
              {timeline.length} events
            </span>
          </h2>
        </div>

        {timeline.length === 0 ? (
          <div className="glass-card-sm p-8 text-center">
            <p className="text-white/30 text-sm">No activity recorded yet</p>
            <p className="text-white/20 text-xs mt-1">
              Calls, emails, and notes will appear here
            </p>
          </div>
        ) : (
          <div>
            {timeline.map((event, idx) => (
              <TimelineItem
                key={event.id}
                event={event}
                isLast={idx === timeline.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Sidebar ──────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-4 sticky top-6">
        {/* Lead details */}
        <div className="glass-card-sm p-4 space-y-3">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Lead Details</h3>
          <div className="space-y-2">
            {[
              { label: "Status", value: <span className={`status-badge text-xs ${statusColor(lead.status)}`}>{lead.status.replace(/_/g, " ")}</span> },
              { label: "Phone", value: lead.phone ?? <span className="text-white/25">—</span> },
              { label: "Email", value: lead.email ?? <span className="text-white/25">—</span> },
              { label: "Source", value: <span className="capitalize">{lead.source}</span> },
              { label: "Added", value: formatDate(lead.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <span className="text-xs text-white/35 flex-shrink-0 pt-0.5">{label}</span>
                <span className="text-xs text-white/80 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="glass-card-sm p-4 space-y-3">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Touchpoints", value: totalTouchpoints },
              { label: "Days in pipeline", value: daysPipeline },
            ].map(({ label, value }) => (
              <div key={label} className="glass-card-sm p-2.5 text-center">
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {activeSequence && (
            <div className="flex items-center gap-2 text-xs text-brand-400 bg-brand-400/10 rounded-lg px-3 py-2">
              <span>⚡</span>
              <span>Email sequence active</span>
            </div>
          )}
        </div>

        {/* AI Recommendation */}
        <AIRecommendation leadId={lead.id} />

        {/* Action buttons */}
        <div className="space-y-2">
          <CallButton
            leadId={lead.id}
            clientId={lead.client_id}
            phone={lead.phone}
            variant="full"
          />
          <button
            onClick={() => setShowCompose(true)}
            disabled={!lead.email}
            className="glass-btn-secondary w-full text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-30"
          >
            ✉️ Send Email
          </button>
          <button
            onClick={() => setShowBooking(true)}
            className="glass-btn-secondary w-full text-sm py-2.5 flex items-center justify-center gap-2"
          >
            📅 Book Appointment
          </button>
          <button
            onClick={() => setShowNote(true)}
            className="glass-btn-secondary w-full text-sm py-2.5 flex items-center justify-center gap-2"
          >
            📝 Add Note
          </button>
        </div>
      </div>

      {/* Modals */}
      {showCompose && (
        <ComposeModal
          allLeads={[{ id: lead.id, name: lead.name, email: lead.email, client_id: lead.client_id }]}
          clientId={lead.client_id}
          defaultLeadId={lead.id}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); router.refresh(); }}
        />
      )}
      {showNote && (
        <NoteModal
          leadId={lead.id}
          clientId={lead.client_id}
          onClose={() => setShowNote(false)}
          onSaved={afterMutation}
        />
      )}
      {showBooking && (
        <BookingModal
          leadId={lead.id}
          clientId={lead.client_id}
          onClose={() => setShowBooking(false)}
          onSaved={afterMutation}
        />
      )}
    </div>
  );
}
