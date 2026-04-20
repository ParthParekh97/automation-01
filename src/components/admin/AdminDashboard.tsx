"use client";

import { useState } from "react";
import type { Client } from "@/types/database";

type ClientWithStats = Client & { leads: number; calls: number; emails: number };

const PLAN_PRICE: Record<string, number> = {
  starter: 49,
  growth: 149,
  scale: 299,
};

const PLAN_COLOR: Record<string, string> = {
  starter: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  growth: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  scale: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};

interface Props {
  clients: ClientWithStats[];
}

export default function AdminDashboard({ clients: initialClients }: Props) {
  const [clients, setClients] = useState(initialClients);
  const [showCreate, setShowCreate] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([]);

  const activeClients = clients.filter((c) => c.active);
  const mrr = activeClients.reduce((sum, c) => sum + (PLAN_PRICE[c.plan] ?? 0), 0);
  const totalLeads = clients.reduce((s, c) => s + c.leads, 0);
  const totalCalls = clients.reduce((s, c) => s + c.calls, 0);

  const planCounts = clients.reduce(
    (acc, c) => {
      if (c.active) acc[c.plan] = (acc[c.plan] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  function addToast(msg: string, ok: boolean) {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  async function handleToggle(client: ClientWithStats) {
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, active: !c.active } : c))
    );
    const res = await fetch(`/api/admin/clients/${client.id}/toggle`, {
      method: "PATCH",
    });
    if (!res.ok) {
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, active: client.active } : c))
      );
      addToast("Failed to update client status", false);
    } else {
      addToast(`${client.name} ${client.active ? "deactivated" : "activated"}`, true);
    }
  }

  async function handleImpersonate(client: ClientWithStats) {
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.email }),
    });
    if (!res.ok) {
      addToast("Failed to generate impersonation link", false);
      return;
    }
    const { link } = await res.json();
    window.open(link, "_blank");
  }

  function handleClientCreated(newClient: ClientWithStats) {
    setClients((prev) => [newClient, ...prev]);
    setShowCreate(false);
    addToast(`${newClient.name} created successfully`, true);
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Super Admin</h1>
        <p className="text-white/40 text-sm mt-1">Platform management & client oversight</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Clients"
          value={activeClients.length}
          sub={`${clients.length} total`}
          icon="🏢"
        />
        <StatCard
          label="Monthly Revenue"
          value={`$${mrr.toLocaleString()}`}
          sub="MRR (active plans)"
          icon="💰"
        />
        <StatCard
          label="Total Leads"
          value={totalLeads.toLocaleString()}
          sub="across all clients"
          icon="👤"
        />
        <StatCard
          label="Total Calls"
          value={totalCalls.toLocaleString()}
          sub="all time"
          icon="📞"
        />
      </div>

      {/* MRR by plan */}
      <div className="glass-card p-5">
        <h2 className="text-white font-semibold mb-4">Revenue Breakdown</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["starter", "growth", "scale"] as const).map((plan) => {
            const count = planCounts[plan] ?? 0;
            const rev = count * PLAN_PRICE[plan];
            return (
              <div key={plan} className="glass-card-sm p-4 text-center">
                <div
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mb-2 capitalize ${PLAN_COLOR[plan]}`}
                >
                  {plan}
                </div>
                <div className="text-xl font-bold text-white">
                  ${rev.toLocaleString()}/mo
                </div>
                <div className="text-white/40 text-xs mt-1">
                  {count} client{count !== 1 ? "s" : ""} × ${PLAN_PRICE[plan]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clients table */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Clients ({clients.length})</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="glass-btn-primary text-sm px-4 py-2"
          >
            + New Client
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/[0.07]">
                <th className="pb-2 pr-6 font-medium">Client</th>
                <th className="pb-2 pr-6 font-medium">Plan</th>
                <th className="pb-2 pr-6 font-medium">Usage</th>
                <th className="pb-2 pr-6 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {clients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  onToggle={handleToggle}
                  onImpersonate={handleImpersonate}
                />
              ))}
            </tbody>
          </table>
          {clients.length === 0 && (
            <p className="text-center text-white/30 py-10">
              No clients yet — create one to get started
            </p>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={handleClientCreated}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${
              t.ok
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/40 text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-white/30 text-xs mt-1">{sub}</p>
        </div>
        <span className="text-xl">{icon}</span>
      </div>
    </div>
  );
}

function ClientRow({
  client,
  onToggle,
  onImpersonate,
}: {
  client: ClientWithStats;
  onToggle: (c: ClientWithStats) => void;
  onImpersonate: (c: ClientWithStats) => void;
}) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="py-3 pr-6">
        <div className="font-medium text-white">{client.name}</div>
        <div className="text-white/40 text-xs">{client.email}</div>
        {client.service_type && (
          <div className="text-white/30 text-xs mt-0.5">{client.service_type}</div>
        )}
      </td>
      <td className="py-3 pr-6">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${PLAN_COLOR[client.plan]}`}
        >
          {client.plan}
        </span>
        <div className="text-white/30 text-xs mt-1">${PLAN_PRICE[client.plan]}/mo</div>
      </td>
      <td className="py-3 pr-6">
        <div className="flex gap-3 text-white/50 text-xs">
          <span>👤 {client.leads}</span>
          <span>📞 {client.calls}</span>
          <span>✉️ {client.emails}</span>
        </div>
      </td>
      <td className="py-3 pr-6">
        <button
          onClick={() => onToggle(client)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            client.active ? "bg-emerald-500/60" : "bg-white/10"
          }`}
          title={client.active ? "Deactivate" : "Activate"}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              client.active ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className={`ml-2 text-xs ${client.active ? "text-emerald-400" : "text-white/30"}`}
        >
          {client.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="py-3">
        <button
          onClick={() => onImpersonate(client)}
          className="glass-btn-secondary text-xs px-3 py-1.5"
        >
          Impersonate
        </button>
      </td>
    </tr>
  );
}

function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: ClientWithStats) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"starter" | "growth" | "scale">("starter");
  const [serviceType, setServiceType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        plan,
        service_type: serviceType.trim() || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setInviteLink(data.invite_link ?? "");
    onCreated({ ...data.client, leads: 0, calls: 0, emails: 0 });
  }

  // Success state — show invite link
  if (inviteLink) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="glass-card p-6 w-full max-w-md">
          <h2 className="text-white font-semibold text-lg mb-1">Client Created!</h2>
          <p className="text-white/50 text-sm mb-4">
            Share this one-time login link with the client:
          </p>
          <div className="glass-card-sm p-3 rounded text-xs text-white/70 break-all font-mono mb-4 leading-relaxed">
            {inviteLink}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigator.clipboard.writeText(inviteLink)}
              className="glass-btn-secondary flex-1 py-2.5 text-sm"
            >
              Copy Link
            </button>
            <button onClick={onClose} className="glass-btn-primary flex-1 py-2.5 text-sm">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Create New Client</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/60 text-xs block mb-1.5">Business Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input w-full"
              placeholder="Acme Plumbing"
              required
            />
          </div>

          <div>
            <label className="text-white/60 text-xs block mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input w-full"
              placeholder="owner@acmeplumbing.com"
              required
            />
          </div>

          <div>
            <label className="text-white/60 text-xs block mb-1.5">
              Service Type{" "}
              <span className="text-white/30">(optional)</span>
            </label>
            <input
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="glass-input w-full"
              placeholder="e.g. Plumbing, Roofing, HVAC"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs block mb-1.5">Plan</label>
            <select
              value={plan}
              onChange={(e) =>
                setPlan(e.target.value as "starter" | "growth" | "scale")
              }
              className="glass-input w-full"
            >
              <option value="starter">Starter — $49/mo</option>
              <option value="growth">Growth — $149/mo</option>
              <option value="scale">Scale — $299/mo</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="glass-btn-secondary flex-1 py-2.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="glass-btn-primary flex-1 py-2.5 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
