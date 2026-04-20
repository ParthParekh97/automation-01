"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  client_id: string;
}

interface Props {
  allLeads: Lead[];
  clientId: string;
  defaultLeadId?: string;
  defaultThreadId?: string;
  defaultLastEmailId?: string;
  onClose: () => void;
  onSent: () => void;
}

export function ComposeModal({
  allLeads,
  clientId,
  defaultLeadId,
  defaultThreadId,
  defaultLastEmailId,
  onClose,
  onSent,
}: Props) {
  const leadsWithEmail = allLeads.filter((l) => l.email);
  const [selectedLeadId, setSelectedLeadId] = useState(
    defaultLeadId ?? leadsWithEmail[0]?.id ?? ""
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLead = leadsWithEmail.find((l) => l.id === selectedLeadId);
  const canSend = !!selectedLead?.email && !!subject.trim() && !!body.trim() && !sending;

  async function handleGenerateDraft() {
    if (!selectedLead) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadName: selectedLead.name, subject: subject || undefined }),
      });
      const data = await res.json();
      if (data.draft) {
        setBody(data.draft);
      } else {
        setError(data.error ?? "Failed to generate draft");
      }
    } catch {
      setError("Network error — could not generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          client_id: clientId,
          subject,
          body,
          thread_id: defaultThreadId,
          in_reply_to: defaultLastEmailId,
        }),
      });
      if (res.ok) {
        onSent();
      } else {
        const err = await res.json();
        setError(err.error ?? "Failed to send email");
      }
    } catch {
      setError("Network error — could not send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl glass-card p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-xl">✏️</span> New Email
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* To */}
        <div>
          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wider">
            To
          </label>
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="glass-input w-full text-sm"
            style={{ colorScheme: "dark" }}
          >
            {leadsWithEmail.length === 0 && (
              <option value="">No leads with email addresses</option>
            )}
            {leadsWithEmail.map((lead) => (
              <option key={lead.id} value={lead.id} style={{ background: "#302b63" }}>
                {lead.name} — {lead.email}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wider">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject…"
            className="glass-input w-full text-sm"
          />
        </div>

        {/* Body label + AI button */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Body
          </label>
          <button
            onClick={handleGenerateDraft}
            disabled={!selectedLead || generating}
            className={cn(
              "glass-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {generating ? (
              <>
                <div className="w-3 h-3 border border-white/30 border-t-brand-400 rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>✨ Write with AI</>
            )}
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            generating
              ? "Generating AI draft…"
              : "Write your message, or click ✨ Write with AI to generate a draft…"
          }
          rows={9}
          className={cn(
            "glass-input w-full text-sm resize-none leading-relaxed font-[inherit]",
            generating && "opacity-50 pointer-events-none"
          )}
        />

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.07]">
          <button onClick={onClose} className="glass-btn-secondary text-sm py-2 px-4">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="glass-btn-primary text-sm py-2 px-5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              "Send Email →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
