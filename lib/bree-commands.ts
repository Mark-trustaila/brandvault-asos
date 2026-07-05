/**
 * Parse the text of a `/bree ...` slash command. Pure — testable without Slack.
 *   /bree                -> help
 *   /bree help           -> help
 *   /bree portfolio      -> portfolio
 *   /bree renewals       -> renewals
 *   /bree status ACME    -> status, arg "ACME"
 *   /bree wat            -> unknown
 */
export type BreeCommand =
  | { kind: 'help' }
  | { kind: 'portfolio' }
  | { kind: 'renewals' }
  | { kind: 'status'; query: string }
  | { kind: 'unknown'; input: string };

export function parseBreeCommand(text: string): BreeCommand {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { kind: 'help' };
  const [verb, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(' ').trim();
  switch (verb.toLowerCase()) {
    case 'help':
      return { kind: 'help' };
    case 'portfolio':
      return { kind: 'portfolio' };
    case 'renewals':
      return { kind: 'renewals' };
    case 'status':
      return { kind: 'status', query: arg };
    default:
      return { kind: 'unknown', input: trimmed };
  }
}
