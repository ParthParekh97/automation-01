import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import type { Message } from "@/types/database";

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, leads(name)")
    .order("created_at", { ascending: false });

  const channelIcon: Record<string, string> = {
    sms: "💬", whatsapp: "🟢", facebook: "🔵", instagram: "🟣", webchat: "🌐", email: "✉️",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Conversations</h1>
        <p className="text-white/50 text-sm mt-1">{conversations?.length ?? 0} conversations</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {conversations?.length ? conversations.map((conv) => {
          const messages = conv.messages as Message[];
          const lastMsg = messages[messages.length - 1];
          return (
            <Link
              key={conv.id}
              href={`/conversations/${conv.id}`}
              className="glass-card p-4 hover:bg-white/[0.03] transition-colors flex items-center gap-4"
            >
              <span className="text-2xl">{channelIcon[conv.channel] ?? "💬"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white text-sm">
                    {(conv.leads as { name: string } | null)?.name ?? "Unknown lead"}
                  </p>
                  <span className="text-white/30 text-xs">{formatDateTime(conv.created_at)}</span>
                </div>
                {lastMsg && (
                  <p className="text-white/40 text-xs mt-0.5 truncate">
                    <span className="capitalize">{lastMsg.role}</span>: {lastMsg.content}
                  </p>
                )}
                <p className="text-white/20 text-xs mt-0.5 capitalize">{conv.channel} · {messages.length} messages</p>
              </div>
            </Link>
          );
        }) : (
          <p className="text-center text-white/30 text-sm py-12">No conversations yet</p>
        )}
      </div>
    </div>
  );
}
