import useLocalizedText from '../i18n/useLocalizedText';
import usePageTitle from '../hooks/usePageTitle';
import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, CloudRain, Shield, Zap, Sprout, ArrowRight, DollarSign } from 'lucide-react';
import { startCheckout } from '../lib/payments';
import { supabase } from '../lib/supabase';

const competitors = [
  { name: 'MowGo', price: '$0–$199/mo', highlight: true },
  { name: 'QuoteIQ', price: '$29.99–$699/mo' },
  { name: 'Jobber', price: '$49–$249/mo' },
  { name: 'Yardbook', price: 'Free (ads)' },
  { name: 'LawnPro', price: '$0–$39' },
  { name: 'Housecall Pro', price: '$79–$189' },
  { name: 'GreenRoute', price: '$29–$59' },
  { name: 'LawnBoss', price: 'New / TBD' },
  { name: 'SoloOp', price: '$0/mo' },
  { name: 'TurfHop', price: '$49–$129' },
  { name: 'Servinix', price: '$300/mo (AI) · $20/tech (FSM)' },
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
  { label: 'Installable Web App', key: 'pwa', desc: 'Works on iPhone, Android, and desktop as a PWA' },
  { label: 'No Data Selling', key: 'privacy', desc: 'Your customer data stays yours' },
  { label: 'Zero-Fee Payments', key: 'stripe', desc: 'Venmo, Zelle, Cash App — no card processing fees' },
  { label: 'GPS Navigation', key: 'gps', desc: 'Tap to navigate to client' },
  { label: 'Route Optimization', key: 'route', desc: 'One-tap optimized routes + send stops to your maps app' },
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
  pwa:          [ true,   true,  true,  false, false, true,  false, false, false, false ],
  privacy:      [ true,  true,  false, false, true,  true,  true,  false, false, false ],
  stripe:       [ true,  false, false, false, false, false, false, false, false, false ],
  gps:          [ true,  true,  true,  false, true,  true,  true,  false, false, false ],
  // Route Optimization availability — researched Aug 5, 2026: QuoteIQ (myquoteiq.com, all plans), Jobber (help.getjobber.com, Connect+), Yardbook (support.yardbook.com), LawnPro (lawnprosoftware.com/features/routing), Housecall Pro 'soon' (alpha per help.housecallpro.com), GreenRoute (greenrouteapp.com), LawnBoss (lawnboss.app), SoloOp (solo-op.com), TurfHop (youraspire.com lawn routing list)
  route:        [ true,  true,  true,  true,  true,  'soon', true,  true,  true,  true ],
};

const mowgoTiers = [
  { name: 'Solo', price: '$39/mo', annualPrice: '$390/year · 2 months free', features: ['Unlimited clients & jobs', 'Recurring job automation', 'GPS route navigation', 'Client notes, codes & pets', 'Offline mode'], cta: 'Start Free Trial' },
  { name: 'Crew', price: '$79/mo', annualPrice: '$790/year · 2 months free', features: ['Everything in Solo', 'Job assignment & tracking', 'Team progress dashboard'], cta: 'Start Free Trial' },
  {
    name: 'Premium',
    price: '$199/mo',
    annualPrice: '$1,990/year · 2 months free',
    features: [
      'Everything in Crew',
      'Premium concierge priority — your request moves to the front of the setup queue',
    ],
    cta: 'Start Premium',
  },
];

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
  const [checkoutError, setCheckoutError] = useState('');
  const [billingInterval, setBillingInterval] = useState('year');
  const checkoutPendingRef = useRef(false);
  usePageTitle(tr('seo.title'), tr('seo.description'));

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

  async function handleTierCheckout(plan) {
    if (checkoutPendingRef.current) return;
    checkoutPendingRef.current = true;
    setCheckoutError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        localStorage.setItem('mowgo_plan_intent', plan.toLowerCase());
        localStorage.setItem('mowgo_interval_intent', billingInterval);
        localStorage.setItem('mowgo_intent_time', String(Date.now()));
        navigate(`/login?mode=signup&plan=${plan.toLowerCase()}&interval=${billingInterval}`);
        return;
      }
      const result = await startCheckout(plan.toLowerCase(), billingInterval);
      if (result?.error) setCheckoutError(result.error);
    } catch (error) {
      setCheckoutError(error.message || tr('Payment failed'));
    } finally {
      checkoutPendingRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
      {/* Skip to content */}
      <a
        href="#comparison"
        onClick={(e) => { e.preventDefault(); const el = document.getElementById('comparison'); if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: 'smooth' }); } }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:dark:bg-gray-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold"
      >
        {tr("Skip to comparison table")}
      </a>

      {/* Sticky Nav */}
      <nav aria-label={tr("Compare page navigation")} className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-bold text-lg no-underline min-h-[44px] inline-flex items-center">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            MowGo
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/compare" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] inline-flex items-center">
              {tr("Compare")}
            </Link>
            <a
              href="/#pricing"
              onClick={goToPricing}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] inline-flex items-center"
            >
              {tr("Pricing")}
            </a>
            <Link to="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] inline-flex items-center">
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
            {tr("See what your crew gets")} <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">{tr("for less")}</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            {tr('We built MowGo because the other options are either too expensive, too complicated, or sell your data.')}{' '}
            {tr("Compare price and field tools side by side. No fluff. No hidden catches.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              {tr("Try MowGo Free")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </Link>
            <a href="#comparison" onClick={(e) => { e.preventDefault(); const el = document.getElementById('comparison'); if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: 'smooth' }); } }} className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              {tr("See the table")}
            </a>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pt-12">
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <img src="/landing/dashboard.png" alt={tr("MowGo dashboard screenshot")} className="w-full h-auto rounded-xl" />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <Link to="/compare/ruunly" className="min-h-[44px] inline-flex items-center px-3 hover:underline">{tr("Compare Ruunly")}</Link>
          <Link to="/compare/probase" className="min-h-[44px] inline-flex items-center px-3 hover:underline">{tr("Compare ProBase")}</Link>
          <Link to="/quoteiq-alternative" className="min-h-[44px] inline-flex items-center px-3 hover:underline">{tr("QuoteIQ alternative")}</Link>
          <Link to="/switch-from-lawnpro" className="min-h-[44px] inline-flex items-center px-3 hover:underline">{tr("Switch from LawnPro")}</Link>
          <Link to="/blog/jobber-price-increase-2026" className="min-h-[44px] inline-flex items-center px-3 hover:underline">{tr("Jobber pricing")}</Link>
        </div>
      </section>

      {/* Standout features */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-5 mb-16">
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CloudRain className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr("Rain delay included on MowGo Free")}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tr("Rain tomorrow? Tap once. Every job moves, even on MowGo's free plan.")}</p>
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

      {/* MowGo tier comparison */}
      <section className="max-w-4xl mx-auto px-4 pb-20" aria-labelledby="mowgo-tier-heading">
        <h2 id="mowgo-tier-heading" className="text-2xl md:text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-8">{tr('Compare MowGo plans')}</h2>
        {checkoutError && <p role="alert" className="mb-5 text-center text-sm font-medium text-red-600 dark:text-red-400">{checkoutError}</p>}
        <div className="flex justify-center mb-8">
          <div role="group" aria-label={tr("Billing interval")} className="inline-flex items-center rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1">
            <button
              type="button"
              aria-pressed={billingInterval === 'year'}
              onClick={() => setBillingInterval('year')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${billingInterval === 'year' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {tr("Annual")} <span className={`ml-1 text-[11px] font-bold ${billingInterval === 'year' ? 'text-white/90' : 'text-emerald-600 dark:text-emerald-400'}`}>{tr("2 months free")}</span>
            </button>
            <button
              type="button"
              aria-pressed={billingInterval === 'month'}
              onClick={() => setBillingInterval('month')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${billingInterval === 'month' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {tr("Monthly")}
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {mowgoTiers.map(tier => (
            <div key={tier.name} className={`rounded-2xl border p-6 flex flex-col ${tier.name === 'Premium' ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tr(tier.name)}</h3>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{tr(billingInterval === 'year' && tier.annualPrice ? tier.annualPrice : tier.price)}</p>
              <ul className="space-y-3 mt-5 flex-1">
                {tier.features.map(feature => <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"><Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" /><span>{tr(feature)}</span></li>)}
              </ul>
              {tier.cta && <button type="button" onClick={() => handleTierCheckout(tier.name)} className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">{tr(tier.cta)} <ArrowRight className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      </section>

      {/* Jobber unselle — honest annual-price block */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl p-6 md:p-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-3">{tr("Jobber looks cheaper. Look closer.")}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">{tr("Straight talk: if you only need a calendar for your jobs, Jobber Core at $49/mo (annual billing) is a fair deal. This page isn't here to convince you otherwise.")}</p>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <X className="w-4 h-4 text-red-500 shrink-0" /> {tr("Payments automation isn't in that plan.")}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr("Jobber's own pricing page: automated reminders and collect payments automatically start at Connect — $129/mo billed annually ($1,548/yr) or $139/mo month-to-month. MowGo Solo: $390/yr, both included.")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <X className="w-4 h-4 text-red-500 shrink-0" /> {tr("Every extra crew member costs $29/mo more.")}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr("Jobber's $29/mo per-user fee adds up: a 2-person crew on Connect runs $1,896/yr ($1,548 base + $348 for the second user). MowGo Crew: $790/yr, flat, whole crew included.")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {tr("Rain delay that moves your whole day in one tap — MowGo only.")}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr("One tap moves every job. Clients get notified automatically. Included even on MowGo Free.")}</p>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 mb-6 text-sm text-center font-medium text-gray-700 dark:text-gray-300">
            {tr("Jobber Core $588/yr (calendar only) · Jobber Connect $1,548/yr (what MowGo does) · MowGo Solo $390/yr (everything, flat)")}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{tr("The gap between MowGo and Jobber's cheapest is $198 a year — about $16.50 a month. The gap in what you get is the whole difference.")}</p>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40 p-5 mb-8">
            <div className="flex items-start gap-2.5">
              <Shield className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">{tr("Switching is the risky part — so we made it the safe part. On eligible paid plans, we import your clients and prepare your first operating week within 48 hours. And if MowGo doesn't make you more organized in 30 days, we refund you. Jobber doesn't offer that.")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/blog/jobber-price-increase-2026" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white font-semibold px-6 py-3 hover:bg-emerald-700 min-h-[44px] transition-colors">{tr("Jobber pricing, explained")} <ArrowRight className="w-4 h-4" /></Link>
            <a
              href="#comparison"
              onClick={(e) => { e.preventDefault(); const el = document.getElementById('comparison'); if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: 'smooth' }); } }}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold px-6 py-3 hover:bg-gray-200 dark:hover:bg-gray-700 min-h-[44px] transition-colors"
            >{tr("See the full comparison")}</a>
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
                    <div>{c.name === 'Ruunly' ? <Link to="/compare/ruunly" className="hover:underline">{c.name}</Link> : c.name === 'ProBase' ? <Link to="/compare/probase" className="hover:underline">{c.name}</Link> : c.name === 'QuoteIQ' ? <Link to="/quoteiq-alternative" className="hover:underline">{c.name}</Link> : c.name === 'LawnPro' ? <Link to="/switch-from-lawnpro" className="hover:underline">{c.name}</Link> : c.name === 'Jobber' ? <Link to="/blog/jobber-price-increase-2026" className="hover:underline">{c.name}</Link> : c.name}</div>
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
            {tr("TurfHop's pricing page was down for 5 days (Aug 1–6, 2026, 500 errors) — its features page is still down. Verify current features with them before you buy.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Jobber's ladder moved again (verified Aug 8, 2026): Core $49/mo (raised from $39), Connect $129–$139/mo, Grow $249/mo — plus $29/mo for every extra user, and their new AI Receptionist is another $29/mo add-on (free only on Plus $399+). Their 'Starting at $24/mo' promo expired Aug 12, 2026 — the entry anchor is now $29/mo. MowGo is $39–$79 flat, month-to-month, whole crew included — and missed-call text-back is on our roadmap, not a paid add-on.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Service Autopilot's $49/mo is ONE mobile license — a 2-person crew runs $199+/mo with a signup fee and annual-only billing. MowGo Crew is $79 flat, whole crew included.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Planado (new in the band) charges per user — $12–$29/user/mo — and has no invoicing or payments at all. MowGo's auto-invoice + SMS pay link is included at $39 flat.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Servinix ($300/mo AI Service Assistant flat) launches Aug 17 (beta) with an invoice-coupon switcher hook — but their entire stack starts above MowGo's total price. Commercial-focused (1–100 tech), not a direct lawn-crew competitor. Still worth noting: $300 for their AI layer alone exceeds MowGo's whole stack.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr("LMN (design-build estimating) starts around $197/mo for quote-only and runs $297–$697/mo for the design-build band (verified Aug 8, 2026) — built for a different business than a 1–2 person mow crew. MowGo covers scheduling through payment at $39/$79 flat.")}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("Some competitors charge a sign-up fee and hide their top tier behind a sales call — MowGo publishes $39/$79 and takes a card.")}
          </p>
        </div>

        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>{tr("QuoteIQ note:")}</strong> {tr('QuoteIQ is a solid product — 4.7★ across 4,100+ reviews, native iOS/Android apps, AI features on every tier. If you run multiple trades or need AI estimates, QuoteIQ is the better fit. For lawn-only crews who want rain delay, offline mode, and no platform surcharge — QuoteIQ adds its own 1% processing fee on top of Stripe, and its Price-Lock Guarantee arrived right after July\u2019s hike — MowGo is purpose-built for you.')}
          </p>
        </div>

        <div className="mt-10 text-center space-y-6">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {tr("Think something's wrong?")} <a href="mailto:hello@mowgoapp.com" className="text-emerald-500 hover:underline">{tr("Tell us")}</a> {tr("and we'll fix it. We're not afraid of the truth.")}
          </p>
          <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
            {tr("Try MowGo Free")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-br from-emerald-500 via-green-600 to-green-700 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">{tr("Run your next 5 clients free.")}</h2>
          <p className="text-emerald-100 text-lg mb-8">{tr("Tap once to move every rain-day job. Pay nothing for your first 5 clients.")}</p>
          <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
            {tr("Start Free")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Link>
          <p className="mt-4 text-sm text-emerald-100/80">{tr("30-day Rain-Proof Guarantee on Solo. Cancel anytime.")}</p>
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
            <Link to="/compare" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Compare")}</Link>
            <a href="#" onClick={goToPricing} className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Pricing")}</a>
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Log In")}</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Privacy")}</Link>
            <a href="mailto:hello@mowgoapp.com" className="hover:text-gray-600 dark:hover:text-gray-300 py-2 px-2 rounded-lg">{tr("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
