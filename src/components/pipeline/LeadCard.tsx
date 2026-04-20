"use client";

import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { CallButton } from "@/components/calls/CallButton";

export interface LeadCardData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  client_id: string;
  last_activity: {
    type: "call" | "email" | "none";
    label: string;
    at: string | null;
  };
}

interface Props {
  lead: LeadCardData;
  isDragging: boolean;
  isMoving: boolean;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onDragEnd: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  web: "text-sky-400 bg-sky-400/10",
  facebook: "text-blue-400 bg-blue-400/10",
  instagram: "text-pink-400 bg-pink-400/10",
  google: "text-yellow-400 bg-yellow-400/10",
  referral: "text-violet-400 bg-violet-400/10",
  manual: "text-white/40 bg-white/5",
  other: "text-white/40 bg-white/5",
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  none: "○",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function LeadCard({ lead, isDragging, isMoving, onDragStart, onDragEnd }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "glass-card-sm p-3 space-y-2.5 select-none transition-all duration-150",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-[0.97] rotate-1",
        isMoving && "opacity-60 pointer-events-none"
      )}
    >
      {/* Top row: avatar + name + source */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 flex-shrink-0">
          {getInitials(lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">
            {lead.name}
          </p>
          <span
            className={cn(
              "inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize mt-0.5",
              SOURCE_COLORS[lead.source] ?? SOURCE_COLORS.other
            )}
          >
            {lead.source}
          </span>
        </div>
        {isMoving && (
          <div className="w-3.5 h-3.5 border-2 border-brand-400/40 border-t-brand-400 rounded-full animate-spin flex-shrink-0 mt-1" />
        )}
      </div>

      {/* Last activity */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{ACTIVITY_ICONS[lead.last_activity.type]}</span>
        <span className="text-xs text-white/45 truncate flex-1">
          {lead.last_activity.label}
        </span>
        <span className="text-[10px] text-white/25 flex-shrink-0">
          {relativeTime(lead.last_activity.at)}
        </span>
      </div>

      {/* Quick actions */}
      <div
        className="flex items-center gap-1.5 pt-0.5 border-t border-white/[0.06]"
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
      >
        <CallButton
          leadId={lead.id}
          clientId={lead.client_id}
          phone={lead.phone}
          variant="compact"
        />
        <Link
          href={`/emails?lead=${lead.id}`}
          className="glass-btn-secondary text-[10px] py-1 px-2 flex-shrink-0"
          draggable={false}
        >
          ✉️ Email
        </Link>
        <Link
          href={`/leads/${lead.id}`}
          className="glass-btn-secondary text-[10px] py-1 px-2 flex-shrink-0"
          draggable={false}
        >
          👁 View
        </Link>
      </div>
    </div>
  );
}
