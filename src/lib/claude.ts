const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface SequenceEmailParams {
  step: 1 | 2 | 3;
  leadName: string;
  businessName: string;
  serviceType: string;
  bookingLink: string;
}

interface GeneratedEmail {
  subject: string;
  html: string;
}

const STEP_INSTRUCTIONS: Record<number, string> = {
  1: `Write a warm, personalised cold outreach email. This is the first contact.
- Briefly introduce the business and what it offers
- Highlight one key benefit relevant to their service type
- End with a soft call-to-action: invite them to book a quick call or visit the booking link
- Tone: friendly, professional, concise (under 150 words)`,

  2: `Write a follow-up email (2nd in a sequence, sent ~3 days after the first).
- Acknowledge you reached out recently and wanted to follow up
- Share a short value proposition or social proof (e.g., "We've helped similar businesses...")
- Include the booking link again as the CTA
- Tone: warm, not pushy, slightly more direct (under 120 words)`,

  3: `Write a final breakup email (3rd and last in the sequence, sent ~7 days after email 2).
- Acknowledge this is your last outreach
- Keep it short and leave the door open for future contact
- Offer the booking link one last time
- Tone: respectful, no pressure, brief (under 100 words)`,
};

export async function generateSequenceEmail(
  params: SequenceEmailParams
): Promise<GeneratedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const { step, leadName, businessName, serviceType, bookingLink } = params;

  const userMessage = `Generate a personalised outreach email with these details:
- Recipient name: ${leadName}
- Our business name: ${businessName}
- Our service type: ${serviceType}
- Booking link: ${bookingLink}

${STEP_INSTRUCTIONS[step]}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{"subject": "email subject here", "html": "<p>email body here</p>"}`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "You are an expert B2B copywriter. Always respond with valid JSON only — no markdown fences, no extra text.",
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";

  try {
    const parsed = JSON.parse(raw) as GeneratedEmail;
    if (!parsed.subject || !parsed.html) throw new Error("Missing fields");
    return parsed;
  } catch {
    throw new Error(`Failed to parse Claude response: ${raw}`);
  }
}
