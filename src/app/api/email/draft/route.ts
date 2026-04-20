import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadName, subject } = body as { leadName?: string; subject?: string };
  if (!leadName) return NextResponse.json({ error: "leadName is required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured — add ANTHROPIC_API_KEY" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system:
        "You are an expert B2B email copywriter. Return only the email body — no subject line, no 'Subject:' label. Start directly with the greeting (e.g. 'Hi [Name],'). Keep it concise, warm, and professional. Plain text only, no markdown.",
      messages: [
        {
          role: "user",
          content: `Write a professional outreach email body to ${leadName}${
            subject ? ` about "${subject}"` : ""
          }. Under 150 words.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Claude API error ${res.status}: ${err}` }, { status: 502 });
  }

  const data = await res.json();
  const draft: string = data.content?.[0]?.text ?? "";
  return NextResponse.json({ draft });
}
