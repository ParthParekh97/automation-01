"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatDate, formatDateTime, statusColor } from "@/lib/utils";
import { ComposeModal } from "./ComposeModal";

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadActivity {
  id: string;
  name: string;
  email: string | null;
  status: string;
  client_id: string;
  email_count: number;
  latest_email: {
    subject: string;
    sent_at: string | null;
    direction: string;
    status: string;
  };
}

interface EmailRecord {
  id: string;
  lead_id: string;
  client_id: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  direction: string;
  from_email: string | null;
  thread_id: string | null;
  gmail_message_id: string | null;
}

interface AllLead {
  id: string;
  name: string;
  email: string | null;
  client_id: string;
}

interface Props {
  leadsWithActivity: LeadActivity[];
  allLeads: AllLead[];
  clientId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return formatDate(dateStr);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailDashboard({ leadsWithActivity, allLeads, clientId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedLeadId = searchParams.get("lead");

  const [thread, setThread] = useState<EmailRecord[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedLead =
    leadsWithActivity.find((l) => l.id === selectedLeadId) ??
    allLeads.find((l) => l.id === selectedLeadId);

  // ── Fetch thread ───────────────────────────────────────────────────────────
  const fetchThread = useCallback(
    async (leadId: string) => {
      setThreadLoading(true);
      try {
        const res = await fetch(
          `/api/email/thread?lead_id=${leadId}&client_id=${clientId}`
        );
        const data = await res.json();
        setThread(Array.isArray(data) ? data : []);
      } catch {
        setThread([]);
      } finally {
        setThreadLoading(false);
      }
    },
    [clientId]
  );

  useEffect(() => {
    if (selectedLeadId) {
      fetchThread(selectedLeadId);
    } else {
      setThread([]);
    }
  }, [selectedLeadId, fetchThread]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function selectLead(leadId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", leadId);
    router.push(`?${params.toString()}`);
  }

  const lastEmail = thread[thread.length - 1];

  // ── Filter left panel ──────────────────────────────────────────────────────
  const filteredLeads = leadsWithActivity.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.latest_email.subject.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-11rem)] glass-card overflow-hidden">
      {/* ── Left Panel: Lead List ─────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-white/[0.07]">
        {/* Panel header */}
        <div className="p-4 border-b border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Conversations
            </span>
            <button
              onClick={() => setShowCompose(true)}
              className="glass-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              ✏️ Compose
            </button>
          </div>
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input w-full text-sm py-2"
          />
        </div>

        {/* Lead rows */}
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-white/25 text-sm">
                {leadsWithActivity.length === 0
                  ? "No email activity yet"
                  : "No results"}
              </p>
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = lead.id === selectedLeadId;
              const isInbound = lead.latest_email.direction === "inbound";
              return (
                <button
                  key={lead.id}
                  onClick={() => selectLead(lead.id)}
                  className={cn(
                    "w-full p-4 text-left border-b border-white/[0.04] transition-all",
                    isSelected
                      ? "bg-brand-500/10 border-l-2 border-l-brand-400"
                      : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5",
                        isSelected
                          ? "bg-brand-500/30 text-brand-200"
                          : "bg-white/10 text-white/50"
                      )}
                    >
                      {getInitials(lead.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span
                          className={cn(
                            "text-sm font-semibold truncate",
                            isSelected ? "text-white" : "text-white/80"
                          )}
                        >
                          {lead.name}
                        </span>
                        <span className="text-[10px] text-white/30 flex-shrink-0">
                          {relativeTime(lead.latest_email.sent_at)}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 truncate mb-1">
                        {lead.latest_email.subject}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-[10px] font-semibold",
                            isInbound ? "text-emerald-400" : "text-brand-400/80"
                          )}
                        >
                          {isInbound ? "← reply" : "→ sent"}
                        </span>
                        <span className="text-white/20 text-[10px]">·</span>
                        <span className="text-[10px] text-white/30">
                          {lead.email_count}{" "}
                          {lead.email_count === 1 ? "email" : "emails"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel: Thread ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedLead ? (
          <>
            {/* Thread header */}
            <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-white leading-tight">
                  {selectedLead.name}
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {selectedLead.email ?? "No email address"}
                </p>
              </div>
              <button
                onClick={() => setShowCompose(true)}
                className="glass-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                ↩ Reply
              </button>
            </div>

            {/* Emails */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {threadLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-6 h-6 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
                </div>
              ) : thread.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">
                  No emails yet
                </div>
              ) : (
                thread.map((email) => {
                  const isInbound = email.direction === "inbound";
                  return (
                    <div
                      key={email.id}
                      className={cn(
                        "glass-card-sm p-4 border-l-2",
                        isInbound
                          ? "border-l-emerald-400/50"
                          : "border-l-brand-400/50"
                      )}
                    >
                      {/* Email meta row */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-[10px] font-semibold uppercase tracking-wider",
                              isInbound ? "text-emerald-400" : "text-brand-400"
                            )}
                          >
                            {isInbound ? "← Received" : "→ Sent"}
                          </span>
                          {!isInbound && (
                            <span
                              className={`status-badge text-[10px] py-0 px-2 ${statusColor(
                                email.status
                              )}`}
                            >
                              {email.status}
                            </span>
                          )}
                          {isInbound && email.from_email && (
                            <span className="text-[10px] text-white/30">
                              {email.from_email}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/30 flex-shrink-0">
                          {email.sent_at ? formatDateTime(email.sent_at) : "Draft"}
                        </span>
                      </div>

                      {/* Subject */}
                      <p className="text-sm font-semibold text-white mb-2">
                        {email.subject}
                      </p>

                      {/* Body — renders HTML from Gmail/Claude or plain text */}
                      <div
                        className="text-sm text-white/65 leading-relaxed [&_p]:mb-2 [&_a]:text-brand-400 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: email.body }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-5">
              ✉️
            </div>
            <h3 className="text-white/60 font-medium text-base mb-1">
              Select a conversation
            </h3>
            <p className="text-white/25 text-sm max-w-xs">
              Choose a lead from the left panel to view their full email thread
            </p>
            <button
              onClick={() => setShowCompose(true)}
              className="glass-btn-primary text-sm py-2 px-5 mt-6 flex items-center gap-2"
            >
              ✏️ Compose New Email
            </button>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          allLeads={allLeads}
          clientId={clientId}
          defaultLeadId={selectedLeadId ?? undefined}
          defaultThreadId={lastEmail?.thread_id ?? undefined}
          defaultLastEmailId={lastEmail?.gmail_message_id ?? undefined}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            if (selectedLeadId) fetchThread(selectedLeadId);
          }}
        />
      )}
    </div>
  );
}
