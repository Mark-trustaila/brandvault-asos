/**
 * BreeService — headless, channel-agnostic query/answer for Bree.
 *
 * Read-only. Returns plain data (a BreeAnswer); it does NOT format. The Slack
 * slash handler and the web sidebar are both thin clients: they resolve a
 * companyId (Slack via team_id → AlertPreference; web via Clerk auth), call
 * answerBree, then render the answer for their channel. This is the
 * headless-first architecture — one place owns Bree's query capability.
 */
import { prisma } from './db';
import type { BreeCommand } from './bree-commands';
import { portfolioSummary, upcomingRenewals, markStatus, type MarkStatusGroup } from './bree-queries';

export type BreeAnswer =
  | { kind: 'portfolio'; companyName: string; total: number; registered: number; pending: number; published: number; needsAttention: number }
  | { kind: 'renewals'; items: { markText: string; registry: string; dueDate: string; daysRemaining: number }[] }
  | { kind: 'status'; query: string; groups: MarkStatusGroup[] } // groups empty ⇒ not found
  | { kind: 'help' };

/**
 * Answer a parsed Bree command for a company. The "workspace not connected"
 * case is a Slack-caller concern (resolved before this is called), so it isn't
 * a BreeAnswer variant. Same read-only scope as the slash commands.
 */
export async function answerBree(companyId: string, cmd: BreeCommand): Promise<BreeAnswer> {
  switch (cmd.kind) {
    case 'portfolio': {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      const data = await portfolioSummary(companyId);
      return { kind: 'portfolio', companyName: company?.name ?? 'Your portfolio', ...data };
    }
    case 'renewals':
      return { kind: 'renewals', items: await upcomingRenewals(companyId, 5) };
    case 'status': {
      if (!cmd.query) return { kind: 'help' };
      return { kind: 'status', query: cmd.query, groups: await markStatus(companyId, cmd.query) };
    }
    case 'help':
    case 'unknown':
    default:
      return { kind: 'help' };
  }
}
