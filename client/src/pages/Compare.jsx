import useLocalizedText from '../i18n/useLocalizedText';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, CloudRain, Shield, Zap, Sprout, ArrowRight, DollarSign } from 'lucide-react';

const competitors = [
  { name: 'MowGo', price: 'Free – $79', highlight: true },
  { name: 'QuoteIQ', price: '$29.99–$699/mo' },
  { name: 'Jobber', price: '$29–$199/mo' },
  { name: 'Yardbook', price: 'Free (ads)' },
  { name: 'LawnPro', price: '$0–$39' },
  { name: 'Housecall Pro', price: '$79–$189' },
  { name: 'GreenRoute', price: '$29–$59' },
  { name: 'LawnBoss', price: 'New / TBD' },
  { name: 'SoloOp', price: '$0/mo' },
  { name: 'TurfHop', price: '$49–$129' },
];

const features = [
  { label: 'Rain Delay', key: 'rainDelay', desc: 'One-tap reschedule when rain hits', star: true },
  { label: 'Offline Mode', key: 'offline', desc: 'Works without cell service, syncs later' },
  { label: 'Dark Mode', key: 'darkMode', desc: 'Built-in — not a browser hack' },
  { label: 'Free Tier', key: 'freeTier', desc: 'Full features, 5 clients, no card' },
  { label: 'Transaction Fees', key: 'txFees', desc: 'QuoteIQ adds 1% on top of Stripe', star: true },
  { label: 'AI Features', key: 'ai', desc: 'AI estimates, measurements, or receptionist' },
  { label: 'Drag & Drop Route', key: 'dragDrop', desc: 'Reorder your day by dragging' },
  { label: 'Auto Invoicing', key: 'invoicing', desc: 'Invoice auto-created on job complete' },
  { label: 'Client Notes & Codes', key: 'notes', desc: 'Gate codes, pets, mow height' },
  { label: 'Recurring Jobs', key: 'recurring', desc: 'Weekly/biweekly/monthly auto-schedule' },
  { label: 'Native Apps', key: 'native', desc: 'App Store + Google Play (not just PWA)' },
  { label: 'No Data Selling', key: 'privacy', desc: 'Your customer data stays yours' },
  { label: 'Stripe Payments', key: 'stripe', desc: 'Accept cards online' },
  { label: 'GPS Navigation', key: 'gps', desc: 'Tap to navigate to client' },
];

// ✅ = confirmed, ❌ = not available, 🔜 = coming soon
const data = {
  rainDelay:    [ true,  false, false, false, false, false, false, false, true,  false ],
  offline:      [ true,  false, true,  false, false, true,  true,  false, true,  false ],
  darkMode:     [ true,  false, false, false, false, false, false, false, false, false ],
  freeTier:     [ true,  false, false, true,  true,  false, false, false, true,  false ],
  txFees:       [ false, true,  false, false, false, false, false, false, true,  true  ],
  ai:           [ false, true,  false, false, false, 'soon', false, false, false, true  ],
  dragDrop:     [ true,  true,  true,  false, false, true,  false, false, false, false ],
  invoicing:    [ true,  true,  true,  true,  true,  true,  false, false, true,  true  ],
  notes:        [ true,  true,  true,  true,  true,  true,  false, false, false, false ],
  recurring:    [ true,  true,  true,  true,  true,  true,  false, false, true,  true  ],
  native:       [ 'soon', true,  true,  false, false, true,  false, false, false, false ],
  privacy:      [ true,  true,  false, false, true,  true,  true,  false, false, false ],
  stripe:       [ true,  true,  true,  false, true,  true,  false, false, true,  true  ],
  gps:          [ true,  true,  true,  false, true,  true,  true,  false, false, false ],
};

function Cell({ value, isFirst }) {
  const { tr } = useLocalizedText('compare');
  const base = `text-center py-2.5 px-2${isFirst ? ' bg-emerald-50 dark:bg-emerald-950/20' : ''}`;
  if (value === true) return <td className={base} aria-label={tr("Available")}><Check className="w-4 h-4 text-emerald-500 mx-auto" aria-hidden="true" /></td>;
  if (value === false) return <td className={base} aria-label={tr("Not available")}><X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" aria-hidden="true" /></td>;
  if (value === 'soon') return <td className={base} aria-label={tr("Coming soon")}><span className="text-[10px] font-semibold uppercase text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">{tr("Soon")}</span></td>;
  return <td className={base} aria-label={tr('Value: {{value}}', { value })}><span className="text-xs text-gray-400">{value}</span></td>;
}

export default function Compare() {
  const { tr, t, i18n } = useLocalizedText('compare');
  const navigate = useNavigate();

  function goToPricing(e) {
    e.preventDefault();
    navigate('/');
    // Poll via rAF until the #pricing element is mounted, then scroll
    const tryScroll = (attempts = 0) => {
      const el = document.getElementById('pricing');
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
      if (attempts < 30) requestAnimationFrame(() => tryScroll(attempts + 1));
    };
    requestAnimationFrame(() => tryScroll());
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
      {/* Skip to content */}
      <a
        href="#comparison"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:dark:bg-gray-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold"
      >
        {tr("Skip to comparison table")}
      </a>

      {/* Sticky Nav */}
      <nav aria-label={tr("Compare page navigation")} className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-bold text-lg no-underline">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            MowGo
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="/#pricing"
              onClick={goToPricing}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {tr("Pricing")}
            </a>
            <Link to="/compare/ruunly" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {tr("vs Ruunly")}
            </Link>
            <Link to="/compare/probase" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {tr("vs ProBase")}
            </Link>
            <Link to="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {tr("Log In")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" aria-hidden="true" /> {tr("The honest comparison")}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-4">
            {tr("MowGo vs")} <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">{tr("Everyone")}</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            {tr('We built MowGo because the other options are either too expensive, too complicated, or sell your data.')}{' '}
            {tr("Here's how we compare — no fluff, no asterisks.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              {tr("Try MowGo Free")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </Link>
            <a href="#comparison" className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              {tr("See the table")}
            </a>
          </div>
        </div>
      </section>

      {/* Standout features */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-5 mb-16">
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CloudRain className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr("Only app with rain delay")}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tr("Rain tomorrow? One tap moves your whole day. No competitor has this — not QuoteIQ, not Jobber, not anyone.")}</p>
          </div>
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/20">
              <DollarSign className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr("No platform fees")}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tr("QuoteIQ charges 1% on every transaction on top of Stripe. We don't touch your money — Stripe takes their cut, that's it.")}</p>
          </div>
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
              <Shield className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr("Your data is yours")}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tr("Yardbook is \"free\" because they sell your customer list. We never touch your data — no ads, no selling, no funny business.")}</p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="comparison" className="max-w-4xl mx-auto px-4 pb-24">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-3">{tr("Feature comparison")}</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10">{tr("Updated August 2026. Based on public pricing pages and hands-on testing.")}</p>

        <div className="overflow-x-auto -mx-4 px-4" role="region" aria-label={tr("Feature comparison table — scroll horizontally on mobile")}>
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">{tr("Feature comparison between MowGo and 9 competitors including pricing and availability of 14 key features")}</caption>
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th scope="col" className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-950 z-10">{tr("Feature")}</th>
                {competitors.map(c => (
                  <th key={c.name} scope="col" className={`py-3 px-2 text-center font-semibold whitespace-nowrap ${c.highlight ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-gray-600 dark:text-gray-400'}`}>
                    <div>{c.name}</div>
                    <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-0.5">{c.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.key} className={`border-b border-gray-100 dark:border-gray-800/50 ${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''}`}>
                  <th scope="row" className="py-3 px-3 sticky left-0 bg-inherit text-left font-normal">
                    <div className="flex items-center gap-2">
                      {f.star && <span className="text-[10px] font-bold uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">⭐</span>}
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{tr(f.label)}</span>
                        <span className="hidden md:inline text-xs text-gray-400 dark:text-gray-500 ml-1.5">— {tr(f.desc)}</span>
                      </div>
                    </div>
                  </th>
                  {(data[f.key] ?? []).map((v, j) => <Cell key={j} value={v} isFirst={j === 0} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Six apps now offer a permanent free tier — Grassly, MowStack, Yardbook, ProBase, LawnPro Solo, and SoloOp. Grassly skims 2% of every card payment. MowGo's free plan takes nothing.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("TurfHop's own pricing and features pages were down (500 errors) on Aug 3, 2026 — verify current features with them before you buy.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Jobber's $29 plan is the hook — automated reminders and auto-pay start at Connect $99, and the AI Receptionist is a $29/mo add-on (or bundled in Plus $199). MowGo includes them all at $49–$79 flat.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Some competitors charge a sign-up fee and hide their top tier behind a sales call — MowGo publishes $39/$79 and takes a card.")}
          </p>
        </div>

        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>{tr("QuoteIQ note:")}</strong> {tr('QuoteIQ is a solid product — 4.7★ across 4,100+ reviews, native iOS/Android apps, AI features on every tier. If you run multiple trades or need AI estimates, QuoteIQ is the better fit. For lawn-only crews who want rain delay, offline mode, and no platform surcharge, MowGo is purpose-built for you.')}
          </p>
        </div>

        <div className="mt-10 text-center space-y-6">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {tr("Think something's wrong?")} <a href="mailto:hello@mowgo.app" className="text-emerald-500 hover:underline">{tr("Tell us")}</a> {tr("and we'll fix it. We're not afraid of the truth.")}
          </p>
          <Link to="/login" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
            {tr("Try MowGo Free")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-br from-emerald-500 via-green-600 to-green-700 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">{tr("The only lawn care app with free rain delay.")}</h2>
          <p className="text-emerald-100 text-lg mb-8">{tr("0 competitors. 0 asterisks. Just a better way to run your crew.")}</p>
          <Link to="/login" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
            {tr("Start Free")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            MowGo © 2026
          </div>
          <div className="flex gap-2 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Home")}</Link>
            <a href="#" onClick={goToPricing} className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Pricing")}</a>
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("App")}</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Privacy")}</Link>
            <a href="mailto:hello@mowgo.app" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
