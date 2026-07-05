/**
 * Bree's Slack messages — pure Block Kit formatters (no I/O, fully testable).
 * The assistant is Bree; every message is signed "Bree · BrandVault".
 */
type Block = Record<string, unknown>;
export type BreeMessage = { text: string; blocks: Block[] };

const section = (text: string): Block => ({ type: 'section', text: { type: 'mrkdwn', text } });
const header = (text: string): Block => ({ type: 'header', text: { type: 'plain_text', text, emoji: true } });
const context = (): Block => ({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Bree · BrandVault' }] });

const withBree = (text: string, blocks: Block[]): BreeMessage => ({ text, blocks: [...blocks, context()] });

// ---- Outbound alerts ----

export function renewalAlert(o: { markText: string; registry: string; type: string; dueDate: string; daysRemaining: number }): BreeMessage {
  return withBree(
    `${o.type} for ${o.markText} (${o.registry}) due in ${o.daysRemaining} days — ${o.dueDate}`,
    [
      header('⏰ Renewal approaching'),
      section(`*${o.markText}* · ${o.registry}\n${o.type} due *${o.dueDate}* — *${o.daysRemaining} days* remaining`),
    ]
  );
}

export function statusChange(o: { markText: string; registry: string; from: string; to: string }): BreeMessage {
  return withBree(`${o.markText} (${o.registry}) status: ${o.from} → ${o.to}`, [
    section(`🔄 *${o.markText}* · ${o.registry}\nStatus changed: *${o.from}* → *${o.to}*`),
  ]);
}

export function weeklyDigest(o: {
  companyName: string;
  upcoming: { markText: string; registry: string; type: string; dueDate: string; daysRemaining: number }[];
}): BreeMessage {
  const lines = o.upcoming.length
    ? o.upcoming.map((u) => `• *${u.markText}* (${u.registry}) — ${u.type} in ${u.daysRemaining}d · ${u.dueDate}`).join('\n')
    : '_Nothing due soon._';
  return withBree(`Weekly digest for ${o.companyName}: ${o.upcoming.length} upcoming`, [
    header(`📋 Weekly digest — ${o.companyName}`),
    section(o.upcoming.length ? `*${o.upcoming.length}* upcoming deadline${o.upcoming.length === 1 ? '' : 's'}:` : 'Nothing due soon.'),
    section(lines),
  ]);
}

// ---- Slash-command responses ----

export function portfolioSummary(o: { companyName: string; total: number; registered: number; pending: number; published: number; needsAttention: number }): BreeMessage {
  return withBree(`${o.companyName}: ${o.total} marks`, [
    header(`📊 ${o.companyName}`),
    section(
      `*${o.total}* marks · *${o.registered}* registered · *${o.pending + o.published}* in prosecution\n` +
        `*${o.needsAttention}* need attention (renewal within 12 months)`
    ),
  ]);
}

export function renewalsList(o: { items: { markText: string; registry: string; dueDate: string; daysRemaining: number }[] }): BreeMessage {
  if (o.items.length === 0) return withBree('No upcoming renewals', [section('✅ No renewals coming up.')]);
  const lines = o.items.map((i) => `• *${i.markText}* (${i.registry}) — *${i.daysRemaining}d* · ${i.dueDate}`).join('\n');
  return withBree(`${o.items.length} upcoming renewals`, [header('🗓️ Next renewals'), section(lines)]);
}

export function markStatusMsg(o: { markText: string; registry: string; status: string; nextDeadline?: { type: string; dueDate: string; daysRemaining: number } }): BreeMessage {
  const next = o.nextDeadline
    ? `\nNext: ${o.nextDeadline.type} *${o.nextDeadline.dueDate}* (${o.nextDeadline.daysRemaining}d)`
    : '\nNo upcoming deadline.';
  return withBree(`${o.markText}: ${o.status}`, [section(`*${o.markText}* · ${o.registry}\nStatus: *${o.status}*${next}`)]);
}

export function notFound(query: string): BreeMessage {
  return withBree(`No mark matching "${query}"`, [section(`🔍 No mark matching *${query}*.`)]);
}

export function help(): BreeMessage {
  return withBree('Bree commands', [
    header("👋 Hi, I'm Bree"),
    section(
      '`/bree portfolio` — portfolio summary\n' +
        '`/bree renewals` — next 5 upcoming renewals\n' +
        '`/bree status [mark]` — a mark’s status + next deadline\n' +
        '`/bree help` — this message'
    ),
  ]);
}
