interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: { type: string; text: string }[];
}

interface SlackPayload {
  text: string;
  blocks?: SlackBlock[];
}

export async function sendSlackNotification(payload: SlackPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] SLACK_WEBHOOK_URL not configured — skipping notification");
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack notification failed: HTTP ${res.status} — ${body}`);
  }
}

const OUTCOME_EMOJI: Record<string, string> = {
  booked: "✅",
  not_interested: "❌",
  no_answer: "📵",
  voicemail: "📬",
  callback: "🔄",
  interested: "🌟",
  other: "📞",
};

interface CallSummaryParams {
  leadName: string;
  phone: string;
  outcome: string;
  durationSeconds: number;
  transcript: string | null;
  isNewLead: boolean;
}

interface EmailReplyParams {
  leadName: string;
  leadEmail: string;
  subject: string;
  snippet: string;
}

export function buildEmailReplyPayload(params: EmailReplyParams): SlackPayload {
  const { leadName, leadEmail, subject, snippet } = params;
  return {
    text: `📧 Email reply from *${leadName}* — "${subject}"`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📧 Lead Replied by Email" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Lead*\n${leadName}` },
          { type: "mrkdwn", text: `*From*\n${leadEmail}` },
          { type: "mrkdwn", text: `*Subject*\n${subject}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Preview*\n>${snippet.slice(0, 280)}`,
        },
      },
    ],
  };
}

export function buildCallSummaryPayload(params: CallSummaryParams): SlackPayload {
  const { leadName, phone, outcome, durationSeconds, transcript, isNewLead } = params;
  const emoji = OUTCOME_EMOJI[outcome] ?? "📞";
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const duration = `${mins}m ${secs}s`;
  const newBadge = isNewLead ? " _(new lead)_" : "";

  const snippetLines = transcript
    ? transcript.split("\n").slice(-6).join("\n")
    : "_No transcript available_";

  return {
    text: `${emoji} Vapi call ended — *${outcome}* for ${leadName}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} Vapi Call Ended` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Lead*\n${leadName}${newBadge}` },
          { type: "mrkdwn", text: `*Phone*\n${phone}` },
          { type: "mrkdwn", text: `*Outcome*\n${outcome}` },
          { type: "mrkdwn", text: `*Duration*\n${duration}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Transcript (last lines)*\n\`\`\`${snippetLines}\`\`\``,
        },
      },
    ],
  };
}
