# MowGo Web Batch: Landing Offer Copy + Settings Data Export (v1)

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement the spec below directly, immediately, in one pass. Do NOT attempt any build or dev-server verification (vite build is run by the coordinator afterwards). Do NOT git commit or push. Do NOT use Google Translate or write real Spanish translations: for es.json, add the same keys with the literal value `TODO_ES` — the coordinator re-translates them after you finish.

Repo root: /opt/data/mowgo. All paths relative to it. Web app lives in `client/` (React 19 + Vite + Tailwind v4 + i18next via `useLocalizedText('section')`). The app is en/es; every user-facing string goes through `tr()` with keys auto-generated from visible text (snake_case of the English string).

## PART A — Landing page offer copy (`client/src/pages/Landing.jsx`)

### A1. Hero microcopy
In the hero CTA block, directly below the existing line `{tr("Rain delay on free tier. No credit card required.")}` (around line 135), add one more small line:
`{tr("Cancel anytime. 30-day money-back guarantee. No contracts.")}`
Same styling as the line above it (`mt-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]`).

### A2. Solo plan card: Free Launch Kit bonuses + guarantee + scarcity
The `plans` array at the top of Landing.jsx (lines ~22-26) defines Free/Solo/Crew. Extend the Solo plan object with three new fields:

```js
bonuses: [
  { text: 'Done-for-you setup: we import your clients and pre-schedule your first 30 days within 48 hours.', value: '$150 value' },
  { text: '"What to Charge in Your City" report: real mow prices from your Oklahoma market.', value: '$49 value' },
  { text: 'Template pack: 15 ready-to-send scripts — invoices, reminders, price raises, no-show follow-ups.', value: '$79 value' },
],
guarantee: 'The Rain-Proof Guarantee: use Solo for 30 days, send 10 invoices, schedule 5 recurring clients. Not more organized? Full refund of your first month. No questions, no hoops.',
scarcity: 'Concierge setup is limited to 20 new businesses per week.',
```

Render on the Solo card (the highlighted one, `plan.highlight === true`), between the features `<ul>` and the CTA button:

1. Bonus block: a heading line `{tr('Free Launch Kit — $278 value, included with Solo')}` styled `text-xs font-bold uppercase tracking-wide text-brand` with a top border (`border-t border-gray-100 dark:border-gray-800 pt-4 mt-4`), then each bonus as a row: a small `+` (or `Check`) icon in brand green, the bonus text (`text-xs`), and a value badge on the right (`text-[10px] font-semibold text-brand bg-emerald-50 dark:bg-emerald-900/30 rounded-full px-2 py-0.5 whitespace-nowrap`). Wrap the bonus block in a rounded box (`bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-3`) so it visually pops as a "kit".
2. Guarantee line: directly ABOVE the CTA button, `text-xs font-semibold text-[var(--color-text-primary)] dark:text-gray-200` with a small Shield icon in brand green, `mt-4`.
3. Scarcity line: directly BELOW the CTA button, `text-[11px] text-[var(--color-text-muted)] mt-2` centered.

Free and Crew cards stay unchanged (crew CTA/features untouched).

### A3. Guarantee band below the plans grid
In the pricing section, between the plans grid closing and the existing footnote FadeIn (the one containing "Stripe payments are live..." around line 289), insert a full-width guarantee card:

```jsx
<FadeIn delay={200}>
  <div className="mt-10 bg-gray-900 dark:bg-gray-800 rounded-2xl p-6 md:p-8 border border-gray-800 dark:border-gray-700 text-center">
    <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
    <h3 className="text-xl font-bold text-white mb-2">{tr('The Rain-Proof Guarantee')}</h3>
    <p className="text-sm text-gray-300 max-w-2xl mx-auto mb-4">{tr('We built MowGo for Oklahoma crews. Use Solo for 30 days, send 10 invoices, and schedule 5 recurring clients. If you don't feel more organized, we refund your first month in full. No questions, no hoops. Your data stays yours, always.')}</p>
    <p className="text-xs text-[var(--color-text-secondary)]">{tr('Applies to Solo and Crew. No setup fees. No contracts. Cancel anytime.')}</p>
  </div>
</FadeIn>
```
`Shield` is already imported in Landing.jsx (lucide-react import line includes Shield).

Do NOT touch the plans prices, the stats band, the comparison table, or any existing copy. Do NOT add any mention of AI anywhere.

### A4. i18n keys
Add every new visible string above as a key in the `landing` namespace of `client/src/i18n/locales/en.json`, plus the same keys in `client/src/i18n/locales/es.json` with the literal value `TODO_ES`. Also add the plan-card strings: the bonus texts, `$150 value`/`$49 value`/`$79 value`, the guarantee, the scarcity line, the kit heading, and the two band strings. Keys auto-generated from text via the project's `textKey()` convention (snake_case, punctuation stripped). Keep en.json valid JSON (no trailing commas).

## PART B — Data export in Settings (`client/src/pages/Settings.jsx` + `client/src/lib/data.js`)

### B1. CSV helper — new file `client/src/lib/csv.js`
- `export function toCsv(rows)` — rows is an array of plain objects (all same shape). Header = keys of the first row in insertion order, snake_case as-is. Escape every cell: wrap in double quotes and double any embedded quotes; escape commas, quotes, newlines (replace `\r`/`\n` inside cells with a space). Join with `\r\n` line endings. Prepend the UTF-8 BOM (`\uFEFF`) so Excel opens accents correctly.
- `export function downloadCsv(filename, csv)` — create a Blob (`type: 'text/csv;charset=utf-8'`), `URL.createObjectURL`, create an `<a download>` click it, revoke the URL.

### B2. Data layer (`client/src/lib/data.js`)
Add four export functions, each mirroring the EXISTING load functions' role branches and demo-mode fallback (read `loadClients`, `loadJobs`, `loadInvoices`, `loadLeads` first and reuse their query shape + role logic; crew users must get jobs filtered by `assigned_to` exactly like the existing code):
- `export async function fetchClientsForExport()` — returns full client rows array (no transformation).
- `export async function fetchJobsForExport()`
- `export async function fetchInvoicesForExport()`
- `export async function fetchLeadsForExport()`
Demo mode: return the same demo arrays the existing load functions return in demo mode.

### B3. Settings UI (`client/src/pages/Settings.jsx`)
Add a new section between the Booking link card and the Webhooks/other sections (or right before the About/sign-out area — pick the spot that fits the existing layout structure). Look at how existing sections are structured (cards with `SectionHeader`-like styling) and match it:

- Section title: `{tr('Export data')}`
- Description line: `{tr('Download your business data as CSV. Your data, yours to keep.')}`
- Four buttons in a 2x2 grid (or stacked rows, match existing card styles): `{tr('Export Clients')}`, `{tr('Export Jobs')}`, `{tr('Export Invoices')}`, `{tr('Export Leads')}`.
- Each button: on click, set its own loading state (per-button, NOT shared), call the matching fetch function, `downloadCsv('mowgo-clients.csv', toCsv(rows))` (filenames: mowgo-clients.csv / mowgo-jobs.csv / mowgo-invoices.csv / mowgo-leads.csv), show a transient success state (button text flips to a check or 'Exported'), and show a small error message under the section if the fetch throws (error text via `tr('Export failed. Please try again.')`). Use icons already imported or add `Download` from lucide-react.

### B4. i18n keys
Add all new Settings strings to the `settings` namespace in `en.json` (and `TODO_ES` in es.json): section title, description, 4 button labels, error string, exporting state string.

## Done criteria
- All code in `client/` only. No other directories touched.
- No real Spanish anywhere (es.json new values are literally `TODO_ES`).
- No AI mentions. No pricing changes.
- Do not commit, do not push, do not run builds.
