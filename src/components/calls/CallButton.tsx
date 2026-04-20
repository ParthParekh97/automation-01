"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type CallState = "idle" | "calling" | "in_progress" | "error";

interface CallButtonProps {
  leadId: string;
  clientId: string;
  phone: string | null;
  /** "full" = labelled button (lead detail page), "compact" = icon-only (table row) */
  variant?: "full" | "compact";
}

interface OutboundCallResponse {
  call_id: string;
  vapi_call_id: string;
  vapi_status: string;
  error?: string;
}

export function CallButton({ leadId, clientId, phone, variant = "full" }: CallButtonProps) {
  const [state, setState] = useState<CallState>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const noPhone = !phone;

  async function handleCall() {
    if (state === "calling" || state === "in_progress") return;

    setState("calling");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, client_id: clientId }),
      });

      const data: OutboundCallResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setCallId(data.call_id);
      setState("in_progress");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(msg);
      setState("error");
    }
  }

  function handleDismiss() {
    setState("idle");
    setCallId(null);
    setErrorMsg(null);
  }

  // ── Compact variant (table row) ──────────────────────────────────────────
  if (variant === "compact") {
    if (state === "in_progress") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <PulseDot />
          Live
        </span>
      );
    }
    if (state === "error") {
      return (
        <button
          onClick={handleDismiss}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
          title={errorMsg ?? "Call failed"}
        >
          Failed ✕
        </button>
      );
    }
    return (
      <button
        onClick={handleCall}
        disabled={noPhone || state === "calling"}
        title={noPhone ? "No phone number" : "Call lead"}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-150",
          noPhone
            ? "text-white/20 cursor-not-allowed"
            : "text-brand-400 hover:text-white hover:bg-brand-500/20 active:scale-95"
        )}
      >
        {state === "calling" ? <Spinner /> : "📞"}
        {state === "calling" ? "Calling…" : "Call"}
      </button>
    );
  }

  // ── Full variant (lead detail page) ─────────────────────────────────────
  if (state === "in_progress") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
          <PulseDot />
          Call in progress…
        </div>
        {callId && (
          <p className="text-white/20 text-xs font-mono">id: {callId.slice(0, 8)}…</p>
        )}
        <button onClick={handleDismiss} className="text-white/30 text-xs hover:text-white/50 transition-colors">
          dismiss
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          ⚠ {errorMsg}
        </div>
        <button
          onClick={handleDismiss}
          className="text-white/30 text-xs hover:text-white/50 transition-colors"
        >
          dismiss
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleCall}
      disabled={noPhone || state === "calling"}
      title={noPhone ? "Add a phone number to this lead first" : undefined}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.98]",
        noPhone
          ? "bg-white/5 text-white/25 cursor-not-allowed border border-white/5"
          : "bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40"
      )}
    >
      {state === "calling" ? <Spinner /> : "📞"}
      {state === "calling" ? "Calling…" : "Call Lead"}
    </button>
  );
}

// ── Micro components ────────────────────────────────────────────────────────

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    </span>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
