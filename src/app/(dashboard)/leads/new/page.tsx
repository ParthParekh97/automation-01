"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SOURCES = ["manual", "web", "facebook", "instagram", "google", "referral", "other"] as const;

export default function NewLeadPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<typeof SOURCES[number]>("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Get client_id from current session
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      setError("Could not get session. Please refresh.");
      setLoading(false);
      return;
    }
    const { client_id } = await meRes.json();

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: email || undefined,
        phone: phone || undefined,
        source,
        client_id,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create lead");
      return;
    }

    router.push(`/leads/${data.id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/40 text-xs mb-3">
          <Link href="/leads" className="hover:text-white/70 transition-colors">
            Leads
          </Link>
          <span>/</span>
          <span className="text-white/60">New Lead</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Add New Lead</h1>
      </div>

      {/* Form */}
      <div className="glass-card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/60 text-xs block mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input w-full"
              placeholder="John Smith"
              required
            />
          </div>

          <div>
            <label className="text-white/60 text-xs block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input w-full"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs block mb-1.5">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="glass-input w-full"
              placeholder="+1234567890"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs block mb-1.5">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof SOURCES[number])}
              className="glass-input w-full"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Link href="/leads" className="glass-btn-secondary flex-1 py-2.5 text-center text-sm">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="glass-btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
