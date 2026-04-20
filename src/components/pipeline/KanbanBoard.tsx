"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { LeadCard, type LeadCardData } from "./LeadCard";

// ── Column definitions ────────────────────────────────────────────────────────

interface Column {
  id: string;
  targetStatus: string;       // status written to DB on drop
  matchStatuses: string[];    // statuses that render in this column
  label: string;
  icon: string;
  accent: string;             // Tailwind colour token prefix
  automation: string | null;  // description shown in toast
}

const COLUMNS: Column[] = [
  {
    id: "new",
    targetStatus: "new",
    matchStatuses: ["new"],
    label: "New Lead",
    icon: "⭐",
    accent: "blue",
    automation: null,
  },
  {
    id: "contacted",
    targetStatus: "contacted",
    matchStatuses: ["contacted"],
    label: "Contacted",
    icon: "📞",
    accent: "amber",
    automation: null,
  },
  {
    id: "qualified",
    targetStatus: "qualified",
    matchStatuses: ["qualified", "booked"],
    label: "Appointment Set",
    icon: "📅",
    accent: "violet",
    automation: "Confirmation email sent automatically",
  },
  {
    id: "proposal",
    targetStatus: "proposal",
    matchStatuses: ["proposal"],
    label: "Appointment Done",
    icon: "✅",
    accent: "orange",
    automation: null,
  },
  {
    id: "closed_won",
    targetStatus: "closed_won",
    matchStatuses: ["closed_won"],
    label: "Converted",
    icon: "🏆",
    accent: "emerald",
    automation: "Welcome email sent automatically",
  },
  {
    id: "closed_lost",
    targetStatus: "closed_lost",
    matchStatuses: ["closed_lost"],
    label: "Lost",
    icon: "✕",
    accent: "rose",
    automation: null,
  },
];

// Tailwind accent classes — must be string literals for purge to work
const ACCENT: Record<string, { header: string; badge: string; ring: string; glow: string }> = {
  blue:    { header: "text-blue-400",    badge: "bg-blue-400/15 text-blue-300",    ring: "ring-blue-400/40",    glow: "bg-blue-400/5" },
  amber:   { header: "text-amber-400",   badge: "bg-amber-400/15 text-amber-300",  ring: "ring-amber-400/40",   glow: "bg-amber-400/5" },
  violet:  { header: "text-violet-400",  badge: "bg-violet-400/15 text-violet-300",ring: "ring-violet-400/40",  glow: "bg-violet-400/5" },
  orange:  { header: "text-orange-400",  badge: "bg-orange-400/15 text-orange-300",ring: "ring-orange-400/40",  glow: "bg-orange-400/5" },
  emerald: { header: "text-emerald-400", badge: "bg-emerald-400/15 text-emerald-300",ring:"ring-emerald-400/40",glow: "bg-emerald-400/5" },
  rose:    { header: "text-rose-400",    badge: "bg-rose-400/15 text-rose-300",    ring: "ring-rose-400/40",    glow: "bg-rose-400/5" },
};

// ── Notification ──────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  auto: string | null; // automation note
  ok: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialLeads: LeadCardData[];
}

export function KanbanBoard({ initialLeads }: Props) {
  const [leads, setLeads] = useState<LeadCardData[]>(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverColId, setHoverColId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Toast helpers ────────────────────────────────────────────────────────────
  function addToast(message: string, auto: string | null, ok: boolean) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, auto, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleCardDragStart = useCallback(
    (e: React.DragEvent, leadId: string) => {
      e.dataTransfer.setData("text/plain", leadId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingId(leadId);
    },
    []
  );

  const handleCardDragEnd = useCallback(() => {
    setDraggingId(null);
    setHoverColId(null);
  }, []);

  function handleColumnDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoverColId !== colId) setHoverColId(colId);
  }

  function handleColumnDragLeave(e: React.DragEvent) {
    // Only clear if leaving the column entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setHoverColId(null);
    }
  }

  async function handleColumnDrop(e: React.DragEvent, col: Column) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setHoverColId(null);
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Already in this column — no-op
    if (col.matchStatuses.includes(lead.status)) return;

    const oldStatus = lead.status;
    const newStatus = col.targetStatus;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    setMovingId(leadId);

    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        addToast(`Moved to "${col.label}"`, col.automation, true);
      } else {
        // Revert
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: oldStatus } : l))
        );
        addToast("Failed to update status", null, false);
      }
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: oldStatus } : l))
      );
      addToast("Network error — status reverted", null, false);
    } finally {
      setMovingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const totalLeads = leads.length;

  return (
    <div className="relative">
      {/* Board stats */}
      <div className="flex items-center gap-4 mb-4 text-xs text-white/40">
        <span>{totalLeads} leads in pipeline</span>
        <span>·</span>
        <span>
          {leads.filter((l) => l.status === "closed_won").length} converted
        </span>
        <span>·</span>
        <span>Drag cards to update status</span>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 14rem)" }}>
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) =>
            col.matchStatuses.includes(l.status)
          );
          const isHovered = hoverColId === col.id;
          const ac = ACCENT[col.accent];

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleColumnDragOver(e, col.id)}
              onDragLeave={handleColumnDragLeave}
              onDrop={(e) => handleColumnDrop(e, col)}
              className={cn(
                "flex-shrink-0 w-64 flex flex-col rounded-2xl border border-white/[0.07] transition-all duration-150",
                "bg-white/[0.02]",
                isHovered && `ring-2 ${ac.ring} ${ac.glow}`
              )}
            >
              {/* Column header */}
              <div className="px-3 pt-3 pb-2.5 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icon}</span>
                    <span className={cn("text-xs font-semibold", ac.header)}>
                      {col.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      ac.badge
                    )}
                  >
                    {colLeads.length}
                  </span>
                </div>
                {col.automation && (
                  <p className="text-[10px] text-white/25 mt-1.5 leading-tight">
                    ⚡ {col.automation}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {colLeads.length === 0 ? (
                  <div
                    className={cn(
                      "h-20 rounded-xl border border-dashed border-white/[0.08] flex items-center justify-center",
                      isHovered && "border-white/20 bg-white/[0.02]"
                    )}
                  >
                    <span className="text-xs text-white/20">Drop here</span>
                  </div>
                ) : (
                  colLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isDragging={draggingId === lead.id}
                      isMoving={movingId === lead.id}
                      onDragStart={handleCardDragStart}
                      onDragEnd={handleCardDragEnd}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "glass-card px-4 py-3 max-w-xs text-sm shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200",
              t.ok ? "border-emerald-400/20" : "border-red-400/20"
            )}
          >
            <p className={cn("font-medium", t.ok ? "text-white" : "text-red-400")}>
              {t.ok ? "✓" : "✕"} {t.message}
            </p>
            {t.auto && (
              <p className="text-xs text-white/40 mt-0.5">⚡ {t.auto}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
