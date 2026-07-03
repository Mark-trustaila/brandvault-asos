/**
 * Throwaway verification for the config-driven renewal engine.
 *   npx tsx scripts/verify-renewal-rules.ts
 */
import type { Trademark } from '../types/trademark';
import { getObligationsForTrademark } from '../lib/utils';
import { computeRenewalDate } from '../lib/renewal-rules';

let pass = 0;
let fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ->  ${got}${ok ? '' : ` (expected ${want})`}`);
  ok ? pass++ : fail++;
};

const mark = (registry_name: string, filing_date: string | null, registration_date: string | null): Trademark =>
  ({ registry_name, filing_date, registration_date } as unknown as Trademark);

// 1. UKIPO renews from FILING (not registration)
check('UKIPO from filing', computeRenewalDate('UKIPO', '2015-06-01', '2016-03-15'), '2025-06-01');

// 2. USPTO renews from REGISTRATION + has a §8 obligation
check('USPTO from registration', computeRenewalDate('USPTO', '2015-01-01', '2016-06-01'), '2026-06-01');
// §8 falls due registration+6; use a recent registration so it's within the window
const usptoObs = getObligationsForTrademark(mark('USPTO', '2020-01-01', '2021-06-01'));
check('USPTO has Section 8 obligation', usptoObs.some((o) => /Section 8/.test(o.type)), true);

// 3. Canada transitional: pre-2019-06-17 => 15yr, post => 10yr (from registration)
check('CIPO pre-2019 => 15yr', computeRenewalDate('CIPO', '', '2018-01-01'), '2033-01-01');
check('CIPO post-2019 => 10yr', computeRenewalDate('CIPO', '', '2020-01-01'), '2030-01-01');

// 4. Saudi Hijri: 10 Hijri years is ~111 days short of Gregorian
const saip = computeRenewalDate('SAIP', '2015-01-01', '');
check('SAIP Hijri lands in 2024 (short of 2025)', saip.startsWith('2024'), true);

// 5. Missing required date => uncertain flag, and no auto-fill
const uncertain = getObligationsForTrademark(mark('UKIPO', null, '2016-01-01'));
check('UKIPO missing filing => uncertain', uncertain.some((o) => o.uncertain === true), true);
check('UKIPO missing filing => no auto-fill', computeRenewalDate('UKIPO', '', '2016-01-01'), '');

// 6. Aliases: INPI -> Brazil (registration), IP Australia -> IPAU (filing), WIPO carried forward (registration)
check('INPI => Brazil (from registration)', computeRenewalDate('INPI', '2015-01-01', '2017-01-01'), '2027-01-01');
check('IP Australia => IPAU (from filing)', computeRenewalDate('IP Australia', '2015-01-01', '2016-01-01'), '2025-01-01');
check('WIPO carried forward (from registration)', computeRenewalDate('WIPO', '2015-01-01', '2016-01-01'), '2026-01-01');

// 7. Unknown registry => no obligations, no auto-fill
check('Unknown registry => no obligations', getObligationsForTrademark(mark('NOPE', '2015-01-01', '2016-01-01')).length, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
