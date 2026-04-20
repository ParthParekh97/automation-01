"use client";

import { useMemo, useState } from "react";
import { cn, formatDateTime, formatDuration } from "@/lib/utils";
import { CallButton } from "@/components/calls/CallButton";
import type { CallOutcome } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallRow {
  id: string;
  lead_id: string;
  client_id: string;
  outcome: CallOutcome;
  duration: number;
  transcript: string | null;
  recording_url: string | null;
  vapi_call_id: string | null;
  created_at: string;
  leads: { name: string; phone: string | null } | null;
}

type Filter = "today" | "week" | "month" | "all";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OUTCOME_META: Record<
  CallOutcome,
  { label: string; color: string; dot: string }
> = {
  booked: {
    label: "Booked",
    color: "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  not_interested: {
    label: "Not Interested",
    color: "text-red-400 bg-red-400/10 border border-red-400/20",
    dot: "bg-red-400",
  },
  no_answer: {
    label: "No Answer",
    color: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
    dot: "bg-yellow-400",
  },
  voicemail: {
    label: "Voicemail",
    color: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
    dot: "bg-yellow-400",
  },
  interested: {
    label: "Interested",
    color: "text-blue-400 bg-blue-400/10 border border-blue-400/20",
    dot: "bg-blue-400",
  },
  callback: {
    label: "Callback",
    color: "text-purple-400 bg-purple-400/10 border border-purple-400/20",
    dot: "bg-purple-400",
  },
  other: {
    label: "In Progress",
    color: "text-white/40 bg-white/5 border border-white/10",
    dot: "bg-white/40",
  },
};

function startOf(unit: "today" | "week" | "month"): Date {
  const d = new Date();
  if (unit === "today") {
    d.setHours(0, 0, 0, 0);
  } else if (unit === "week") {
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - ((day + 6) % 7)); // rewind to Monday
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function applyFilter(calls: CallRow[], filter: Filter): CallRow[] {
  if (filter === "all") return calls;
  const cutoff = startOf(filter === "today" ? "today" : filter === "week" ? "week" : "month");
  return calls.filter((c) => new Date(c.created_at) >= cutoff);
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm font-medium">{label}</p>
        <span
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center text-lg",
            accent
          )}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="text-white/35 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript modal
// ---------------------------------------------------------------------------

interface TranscriptModalProps {
  call: CallRow;
  onClose: () => void;
}

function TranscriptModal({ call, onClose }: TranscriptModalProps) {
  const leadName = call.leads?.name ?? "Unknown Lead";

  // Parse "Role: message" lines into structured bubbles
  const lines = (call.transcript ?? "").split("\n").filter(Boolean);
  const parsed = lines.map((line) => {
    const match = line.match(/^(User|Assistant|Agent|AI|Human):\s*(.+)$/i);
    if (match) return { role: match[1].toLowerCase(), text: match[2] };
    return { role: "unknown", text: line };
  });

  const hasParsed = parsed.some((p) => p.role !== "unknown");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative glass-card w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/[0.07]">
          <div>
            <h2 className="font-semibold text-white text-lg">Call Transcript</h2>
            <p className="text-white/40 text-sm mt-0.5">
              {leadName} · {formatDateTime(call.created_at)} · {formatDuration(call.duration)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>

        {/* Outcome pill */}
        <div className="px-6 pt-4 pb-0">
          <span className={cn("status-badge text-xs", OUTCOME_META[call.outcome].color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", OUTCOME_META[call.outcome].dot)} />
            {OUTCOME_META[call.outcome].label}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {!call.transcript ? (
            <p className="text-white/30 text-sm text-center py-8">
              No transcript recorded for this call.
            </p>
          ) : hasParsed ? (
            parsed.map((line, i) => {
              const isAgent =
                line.role === "assistant" ||
                line.role === "agent" ||
                line.role === "ai";
              return (
                <div
                  key={i}
                  className={cn("flex gap-3", isAgent ? "flex-row" : "flex-row-reverse")}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5",
                      isAgent
                        ? "bg-brand-500/30 text-brand-400"
                        : "bg-white/10 text-white/50"
                    )}
                  >
                    {isAgent ? "AI" : "U"}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      isAgent
                        ? "bg-brand-500/10 border border-brand-500/20 text-white/80 rounded-tl-sm"
                        : "bg-white/5 border border-white/10 text-white/70 rounded-tr-sm"
                    )}
                  >
                    {line.text}
                  </div>
                </div>
              );
            })
          ) : (
            // Raw transcript fallback
            <pre className="text-white/60 text-sm whitespace-pre-wrap leading-relaxed font-mono">
              {call.transcript}
            </pre>
          )}
        </div>

        {/* Footer */}
        {call.recording_url && (
          <div className="p-6 border-t border-white/[0.07]">
            <a
              href={call.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-btn-secondary text-sm inline-flex items-center gap-2"
            >
              🎧 Listen to Recording
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

interface CallsDashboardProps {
  calls: CallRow[];
}

export function CallsDashboard({ calls }: CallsDashboardProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [transcriptCall, setTranscriptCall] = useState<CallRow | null>(null);

  const filtered = useMemo(() => applyFilter(calls, filter), [calls, filter]);

  // Derived stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const bookings = filtered.filter((c) => c.outcome === "booked").length;
    const noAnswer = filtered.filter(
      (c) => c.outcome === "no_answer" || c.outcome === "voicemail"
    ).length;
    const noAnswerRate =
      total > 0 ? Math.round((noAnswer / total) * 100) : 0;
    const totalSeconds = filtered.reduce((sum, c) => sum + c.duration, 0);
    const avgSeconds = total > 0 ? Math.round(totalSeconds / total) : 0;

    return { total, bookings, noAnswerRate, avgDuration: formatDuration(avgSeconds) };
  }, [filtered]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "all", label: "All Time" },
  ];

  return (
    <>
      {/* Filter tabs */}
      <div className="inline-flex items-center gap-1 p-1 glass-card-sm rounded-xl">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
              filter === f.key
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                : "text-white/50 hover:text-white/80"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Calls"
          value={stats.total}
          sub={filter === "all" ? "All time" : `This ${filter}`}
          icon="📞"
          accent="bg-brand-500/15 text-brand-400"
        />
        <StatCard
          label="Bookings"
          value={stats.bookings}
          sub={
            stats.total > 0
              ? `${Math.round((stats.bookings / stats.total) * 100)}% conversion`
              : "No calls yet"
          }
          icon="✅"
          accent="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          label="No Answer Rate"
          value={`${stats.noAnswerRate}%`}
          sub="Incl. voicemails"
          icon="📵"
          accent="bg-yellow-500/15 text-yellow-400"
        />
        <StatCard
          label="Avg Duration"
          value={stats.avgDuration}
          sub="Per connected call"
          icon="⏱"
          accent="bg-purple-500/15 text-purple-400"
        />
      </div>

      {/* Calls table */}
      <div className="glass-card overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <h2 className="font-semibold text-white">
            Call Log{" "}
            <span className="text-white/30 text-sm font-normal ml-1">
              {filtered.length} {filtered.length === 1 ? "call" : "calls"}
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["Lead", "Date & Time", "Duration", "Outcome", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[11px] font-semibold text-white/30 px-6 py-3 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((call) => {
                  const meta = OUTCOME_META[call.outcome];
                  const leadName = call.leads?.name ?? "Unknown";
                  const phone = call.leads?.phone;

                  return (
                    <tr
                      key={call.id}
                      className="group border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors duration-100"
                    >
                      {/* Lead */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-white">{leadName}</p>
                        {phone && (
                          <p className="text-xs text-white/35 mt-0.5 tabular-nums">
                            {phone}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-white/60 tabular-nums">
                          {formatDateTime(call.created_at)}
                        </p>
                      </td>

                      {/* Duration */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/60 tabular-nums">
                            {formatDuration(call.duration)}
                          </span>
                          {call.duration > 0 && (
                            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-400/60 rounded-full"
                                style={{
                                  width: `${Math.min(100, (call.duration / 300) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Outcome */}
                      <td className="px-6 py-4">
                        <span className={cn("status-badge", meta.color)}>
                          <span
                            className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", meta.dot)}
                          />
                          {meta.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          {/* View Transcript */}
                          <button
                            onClick={() => setTranscriptCall(call)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95",
                              call.transcript
                                ? "bg-white/8 hover:bg-white/12 border border-white/10 text-white/70 hover:text-white"
                                : "bg-white/4 border border-white/[0.06] text-white/20 cursor-not-allowed"
                            )}
                            disabled={!call.transcript}
                            title={!call.transcript ? "No transcript for this call" : undefined}
                          >
                            📄 Transcript
                          </button>

                          {/* Call Again */}
                          <CallButton
                            leadId={call.lead_id}
                            clientId={call.client_id}
                            phone={phone ?? null}
                            variant="compact"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <p className="text-white/20 text-sm">
                      No calls recorded{filter !== "all" ? " in this period" : ""}.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transcript modal */}
      {transcriptCall && (
        <TranscriptModal
          call={transcriptCall}
          onClose={() => setTranscriptCall(null)}
        />
      )}
    </>
  );
}
