/**
 * NL intent layer for Bree's WEB input (the sidebar). A single Claude call
 * routes free text into exactly one of Bree's three supported queries, or
 * "unsupported". Input tolerance only — this does NOT expand what Bree can
 * answer. Slack slash commands never pass through here.
 */
import Anthropic from '@anthropic-ai/sdk';

export const BREE_INTENT_MODEL = process.env.BREE_INTENT_MODEL ?? 'claude-haiku-4-5';

export type BreeIntent = { intent: 'portfolio' | 'renewals' | 'status' | 'unsupported'; markText?: string };

const SYSTEM = `You route one message from a user of a trademark portfolio tool to exactly one thing the assistant ("Bree") can do. Bree answers ONLY three things:
- portfolio — a summary of the company's trademark portfolio (counts, what needs attention).
- renewals — the upcoming renewal deadlines.
- status — the status of ONE specific trademark the user names.

Anything else — filing, drafting, legal advice, adding/editing marks, deadlines other than renewals, small talk, or anything you're unsure about — is unsupported.

Classify the message into exactly one intent. For "status", also extract the trademark name the user names (mark_text), copied verbatim from their message — never invent or normalise it. If it fits none of the three, return unsupported (do not guess). Reply only by calling the tool.`;

const TOOL = {
  name: 'route',
  description: 'Route the message to one supported Bree query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      intent: { type: 'string', enum: ['portfolio', 'renewals', 'status', 'unsupported'] },
      mark_text: { type: 'string', description: 'For status only: the trademark name from the message, verbatim.' },
    },
    required: ['intent'],
  },
};

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  return (client ??= new Anthropic());
}

/**
 * Classify one message. Throws on API failure/timeout — the caller
 * (handleBreeQuery) converts that into the unsupported fallback so no raw error
 * reaches the panel.
 */
export async function classifyIntent(text: string): Promise<BreeIntent> {
  const res = await anthropic().messages.create(
    {
      model: BREE_INTENT_MODEL,
      max_tokens: 64,
      temperature: 0,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'route' },
      messages: [{ role: 'user', content: text }],
    },
    { timeout: 4000 }
  );
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!block) throw new Error('classifier returned no structured result');
  const input = block.input as { intent: BreeIntent['intent']; mark_text?: string };
  return { intent: input.intent, markText: input.mark_text };
}
