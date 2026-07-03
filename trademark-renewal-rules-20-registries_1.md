# Trademark Renewal Rules — 20 Registries
#
# Purpose: Auto-calculate renewal dates where filing/registration dates exist
#          but renewal/expiry dates are missing from imported records.
#
# CRITICAL: term_from is either "filing" or "registration". Using the wrong
#           one shifts deadlines by months or years. Six registries use
#           registration date; the rest use filing date.
#
# Last verified: July 2026. Cross-checked against second independent review.
# Spot-check before relying on calculated deadlines for live portfolios.

---

## Rules by registry

### UKIPO (United Kingdom)
- code: UKIPO
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: late fee per class
- restoration: yes — additional 6 months after grace (unintentional lapse test, total 12 months from expiry)
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5
- notes: Term runs from filing date per Trade Marks Act 1994. UKIPO sends reminder ~6 months before expiry but no obligation to do so.

### EUIPO (European Union)
- code: EUIPO
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: 25% on renewal fee
- restoration: no — mark cancelled if grace period missed
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5
- notes: Covers all 27 EU member states. EUIPO sends written reminder 6 months before expiry. Since 23/03/2016 due date is the anniversary date, no longer end of month.

### USPTO (United States)
- code: USPTO
- term_years: 10
- term_from: registration
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: $100/class per filing
- restoration: no
- use_declaration_at_renewal: yes
- non_use_cancellation_years: 3
- special_obligations:
  - type: section_8
    description: Declaration of Continued Use
    due_years_from_registration: 5-6
    grace_period_months: 6
    consequence_if_missed: registration cancelled
  - type: section_15
    description: Declaration of Incontestability (optional)
    due_years_from_registration: 5-6
    required: false
  - type: section_8_and_9
    description: Combined Declaration of Use and Renewal
    due_years_from_registration: 9-10
    grace_period_months: 6
    recurring_years: 10
    consequence_if_missed: registration cancelled/expired
- notes: Most complex maintenance regime. Missing §8 at year 6 cancels registration regardless of renewal. For Madrid designations, §71 replaces §8; renewal handled through WIPO not USPTO.

### CNIPA (China)
- code: CNIPA
- term_years: 10
- term_from: registration
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: additional fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 3
- notes: First-to-file jurisdiction. 12-month early window (not 6). No use declaration at renewal but any third party can petition for cancellation after 3 years non-use.

### JPO (Japan)
- code: JPO
- term_years: 10
- term_from: registration
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: double fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 3
- notes: Fee may be paid in two 5-year instalments (higher total). JPO does not issue renewal certificates — sends postcard confirmation. Foreign applicants must use local representative.

### KIPO (South Korea)
- code: KIPO
- term_years: 10
- term_from: registration
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: additional fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 3
- notes: Old Korean classification registrations must be reclassified to Nice upon renewal.

### IP India
- code: IPINDIA
- term_years: 10
- term_from: filing
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: surcharge per class (currently ~₹4,500; check current schedule)
- restoration: yes — up to 1 year from expiry (additional restoration fee ~₹9,000/class)
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5
- notes: Expiry calculated from filing/application date, not registration certificate date. Marks taking years to register may have shortened effective protection from grant. Trade Marks Act 1999, Section 25.

### INPI Brazil
- code: INPIBR
- term_years: 10
- term_from: registration
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: additional fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5
- notes: Term runs from GRANT date, not filing date — distinguishes Brazil from most registries. Early window is last year of term (12 months). Single-class applications only. INPI processing times can be very long (2+ years).

### IMPI (Mexico)
- code: IMPI
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: higher fee
- restoration: no — irrevocable expiry if grace period missed
- use_declaration_at_renewal: yes
- non_use_cancellation_years: 3
- special_obligations:
  - type: declaration_of_use_3yr
    description: Declaration of actual and effective use in commerce
    due: 3 months after 3rd anniversary of GRANT date
    applies_to: marks registered after August 2018
    consequence_if_missed: automatic cancellation, no remedy
    notes: Separate obligation from renewal. Deadline runs from grant date, not filing date. IMPI does not send reminders.
  - type: declaration_of_use_at_renewal
    description: Declaration of use must accompany every renewal application
    consequence_if_missed: renewal refused
- notes: Most dangerous jurisdiction for missed deadlines. Two independent date-based obligations (3-year use declaration from grant, 10-year renewal from filing). IMPI sends no reminders for either.

### CIPO (Canada)
- code: CIPO
- term_years: 10
- term_from: registration
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: additional fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 3
- notes: Changed from 15-year terms to 10-year terms on 17 June 2019 (Madrid Protocol accession). Pre-2019 registrations retain 15-year term until next renewal. Engine should check registration date against this cutoff.

### IP Australia
- code: IPAU
- term_years: 10
- term_from: filing
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: late fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 3
- notes: Early window is 12 months before expiry (corrected from 6).

### IPOS (Singapore)
- code: IPOS
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: additional fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5

### IPONZ (New Zealand)
- code: IPONZ
- term_years: 10
- term_from: filing
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: late fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 3
- notes: Early window is 12 months before due date (corrected from vague original).

### INPI France
- code: INPIFR
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: surcharge
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5

### DPMA (Germany)
- code: DPMA
- term_years: 10
- term_from: filing
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: surcharge
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5
- notes: DPMA sends reminder but has no legal obligation to do so.

### BOIP (Benelux)
- code: BOIP
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: surcharge
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5
- notes: Covers Belgium, Netherlands, Luxembourg.

### TURKPATENT (Turkey)
- code: TURKPATENT
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: higher fee
- restoration: no
- use_declaration_at_renewal: no
- non_use_cancellation_years: 5
- notes: Foreign applicants must appoint local Turkish trademark attorney.

### SAIP (Saudi Arabia)
- code: SAIP
- term_years: 10
- term_calendar: hijri
- term_from: filing
- early_window_months: 12
- grace_period_months: 6
- grace_surcharge: SAR 6,500 vs SAR 5,500 standard
- restoration: no
- use_declaration_at_renewal: no
- CRITICAL: Uses Hijri (Islamic lunar) calendar. 10 Hijri years ≈ 9 years 8 months Gregorian (~3,531 days vs ~3,652 days). Engine must either use a Hijri date library or apply: 1 Hijri year ≈ 354.37 days. Getting this wrong by ~111 days could mean a missed deadline.

### UAE (Ministry of Economy)
- code: UAEMOE
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: additional fee
- restoration: no
- use_declaration_at_renewal: no
- notes: Grace period is 6 months in current sources (some older sources cite 90 days — verify if a UAE mark has a tight deadline). Federal registration covers all emirates but enforcement may require separate emirate-level action.

### DGIP (Indonesia)
- code: DGIP
- term_years: 10
- term_from: filing
- early_window_months: 6
- grace_period_months: 6
- grace_surcharge: additional fee
- restoration: possible in some circumstances
- use_declaration_at_renewal: no
- non_use_cancellation_years: 3
- notes: Multi-class applications allowed since 2016 (Law No. 20 of 2016).

---

## Implementation notes

### Registries where term runs from REGISTRATION date (not filing):
USPTO, CNIPA, JPO, KIPO, CIPO, INPIBR

All others use filing date.

### Special obligations beyond 10-year renewal:
- USPTO: Section 8 declaration at years 5–6 from registration
- Mexico: Declaration of use at 3 years from grant (post-August 2018)
- Mexico: Declaration of use at every renewal

### Where filing date is missing from imported data:
If only registration date is known and the jurisdiction calculates from
filing date, flag the mark as "renewal date uncertain — filing date
required" rather than guessing. Do not estimate filing date from
registration date — the gap varies from weeks to years.

### Alert thresholds:
Grace periods are safety nets, not targets. Alert at the standard
renewal window (early_window_months before expiry), not at the grace
period deadline. Default alert thresholds: 180 / 90 / 30 days before
the expiry date.

### Canada transitional:
Marks registered before 17 June 2019 may have a 15-year term. Check
registration date against this cutoff before applying the 10-year rule.

### Saudi Arabia Hijri conversion:
Either use a proper Hijri date library (recommended) or apply:
expiry_gregorian = filing_date + (10 * 354.37 days)
This is approximate. For marks with deadlines within 6 months, verify
against the SAIP system directly.
