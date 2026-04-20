"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface GmailConnectCardProps {
  connected: boolean;
  connectedEmail: string | null;
  connectedAt: string | null;
  /** URL search-param status passed from the server page after OAuth redirect */
  oauthStatus: string | null;
}

export function GmailConnectCard({
  connected,
  connectedEmail,
  connectedAt,
  oauthStatus,
}: GmailConnectCardProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [localStatus, setLocalStatus] = useState(oauthStatus);

  async function handleDisconnect() {
    if (!confirm("Disconnect Gmail? Outbound email and reply detection will stop working.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/gmail/disconnect", { method: "POST" });
      if (res.redirected || res.ok) {
        window.location.href = "/settings?gmail=disconnected";
      } else {
        setLocalStatus("disconnect_error");
      }
    } catch {
      setLocalStatus("disconnect_error");
    } finally {
      setDisconnecting(false);
    }
  }

  const statusBanner = (() => {
    switch (localStatus) {
      case "connected":
        return { text: "Gmail connected successfully.", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
      case "disconnected":
        return { text: "Gmail disconnected.", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" };
      case "denied":
        return { text: "Google authorisation was denied.", color: "text-red-400 bg-red-400/10 border-red-400/20" };
      case "disconnect_error":
        return { text: "Disconnect failed — try again.", color: "text-red-400 bg-red-400/10 border-red-400/20" };
      default:
        if (localStatus?.startsWith("error"))
          return { text: `OAuth failed (${localStatus}).`, color: "text-red-400 bg-red-400/10 border-red-400/20" };
        return null;
    }
  })();

  return (
    <div className="glass-card-sm p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Gmail logo placeholder */}
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center text-lg">
            ✉️
          </div>
          <div>
            <p className="text-sm font-medium text-white">Gmail</p>
            <p className="text-xs text-white/40">
              {connected && connectedEmail ? connectedEmail : "Send + receive emails for leads"}
            </p>
          </div>
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              connected ? "bg-emerald-400" : "bg-white/20"
            )}
          />
          <span className={cn("text-xs font-medium", connected ? "text-emerald-400" : "text-white/40")}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>

      {/* Status banner after OAuth redirect */}
      {statusBanner && (
        <div
          className={cn(
            "text-xs px-3 py-2 rounded-lg border",
            statusBanner.color
          )}
        >
          {statusBanner.text}
        </div>
      )}

      {/* Connected detail */}
      {connected && connectedAt && (
        <p className="text-xs text-white/30">
          Connected {new Date(connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {connected ? (
          <>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="glass-btn-secondary text-xs py-1.5 px-3 text-red-400 hover:text-red-300 border-red-400/20 hover:bg-red-400/5"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
            <a
              href="/api/auth/gmail"
              className="glass-btn-secondary text-xs py-1.5 px-3"
            >
              Reconnect
            </a>
          </>
        ) : (
          <a
            href="/api/auth/gmail"
            className="glass-btn-primary text-sm py-2 px-4 inline-flex items-center gap-2"
          >
            Connect Gmail
          </a>
        )}
      </div>
    </div>
  );
}
