import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    new: "text-blue-400 bg-blue-400/10",
    contacted: "text-yellow-400 bg-yellow-400/10",
    qualified: "text-purple-400 bg-purple-400/10",
    proposal: "text-orange-400 bg-orange-400/10",
    booked: "text-green-400 bg-green-400/10",
    closed_won: "text-emerald-400 bg-emerald-400/10",
    closed_lost: "text-red-400 bg-red-400/10",
    pending: "text-yellow-400 bg-yellow-400/10",
    confirmed: "text-green-400 bg-green-400/10",
    cancelled: "text-red-400 bg-red-400/10",
    completed: "text-emerald-400 bg-emerald-400/10",
    no_show: "text-gray-400 bg-gray-400/10",
  };
  return map[status] ?? "text-gray-400 bg-gray-400/10";
}
