import { useState, useRef, useEffect } from 'react';
import useLocalizedText from '../i18n/useLocalizedText';
import usePageTitle from '../hooks/usePageTitle';
import { Sprout, Check, X, ArrowRight, AlertTriangle, DollarSign, CloudRain, Calculator, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

// Ruunly platform fee rates (percentage of monthly revenue)
const RUUNLY_PLANS = {
  starter: { name: 'Starter', base: 19, feeRate: 0.025, feeCap: Infinity },
  pro:     { name: 'Pro',     base: 59, feeRate: 0.015, feeCap: 118 },
  growth:  { name: 'Growth',  base: 129, feeRate: 0.0075, feeCap: 258 },
};

const MOWGO_SOLO = 39;

function calcRuunlyTotal(plan, revenue) {
  const p = RUUNLY_PLANS[plan];
  const fee = Math.min(p.feeRate * revenue, p.feeCap);
  return Math.round(p.base + fee);
}

const features = [
  { label: 'Price',             mowgoFree: '$0',          mowgoSolo: '$39/mo',    ruunlyStarter: '$19 + fees',   ruunlyPro: '$59 + fees',  type: 'price' },
  { label: 'Clients',           mowgoFree: '5',           mowgoSolo: 'Unlimited',  ruunlyStarter: '25',           ruunlyPro: '100',         type: 'text' },
  { label: 'Rain Delay',        mowgoFree: true,          mowgoSolo: true,         ruunlyStarter: false,          ruunlyPro: true,          type: 'bool' },
  { label: 'Route Optimization', mowgoFree: false, mowgoSolo: true, ruunlyStarter: false, ruunlyPro: false, type: 'qualified' },
  { label: 'SMS Campaigns',     mowgoFree: false,         mowgoSolo: true,         ruunlyStarter: false,          ruunlyPro: true,          type: 'bool' },
  { label: 'QuickBooks',        mowgoFree: false,         mowgoSolo: true,         ruunlyStarter: false,          ruunlyPro: false,         type: 'bool' },
  { label: 'Installable Web App (PWA)', mowgoFree: true,  mowgoSolo: true,         ruunlyStarter: false,          ruunlyPro: false,         type: 'bool' },
  { label: 'Platform Fees',     mowgoFree: '$0',          mowgoSolo: '$0',         ruunlyStarter: '2.5%',        ruunlyPro: '1.5%',        type: 'fee' },
  { label: 'Lawn-Specific Fields', mowgoFree: true,       mowgoSolo: true,         ruunlyStarter: false,          ruunlyPro: false,         type: 'bool' },
];

const exposeRevenues = [4000, 6000, 10000];
// Computed from RUUNLY_PLANS — always stays in sync
function getExposeRows() {
  return exposeRevenues.map(revenue => ({
    revenue,
    ruunlyStarterCost: calcRuunlyTotal('starter', revenue),
    ruunlyProCost: calcRuunlyTotal('pro', revenue),
  }));
}

function FadeIn({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export default function RuunlyComparison() {
  const { tr } = useLocalizedText('ruunlyComparison');
  usePageTitle(tr('seo.title'), tr('seo.description'));

  // Calculator state
  const [revenue, setRevenue] = useState(4000);
  const [plan, setPlan] = useState('starter');

  const ruunlyTotal = calcRuunlyTotal(plan, revenue);
  const savings = ruunlyTotal - MOWGO_SOLO;
  const yearlySavings = savings * 12;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-bold text-lg no-underline min-h-[44px] inline-flex items-center">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            MowGo
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/compare" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] inline-flex items-center">
              {tr("Compare")}
            </Link>
            <Link to="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] inline-flex items-center">
              {tr("Log In")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-gray-100 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-linear-to-br from-red-200/30 to-orange-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-linear-to-tr from-emerald-200/40 to-green-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-b from-transparent dark:from-transparent to-gray-50 dark:to-gray-950 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-24 md:py-32 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              {tr("Real cost analysis")}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              {tr("Ruunly says $19/mo. ")}<br className="hidden sm:block" />
              <span className="bg-linear-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">{tr("The math says $169/mo.")}</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {tr("Enter your monthly revenue. See what Ruunly costs next to MowGo. No asterisks. Just the math.")}
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#calculator" onClick={(e) => { e.preventDefault(); const el = document.getElementById('calculator'); if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: 'smooth' }); } }} className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
                {tr("See the real cost")} <Calculator className="w-4 h-4" aria-hidden="true" />
              </a>
              <a href="#features" onClick={(e) => { e.preventDefault(); const el = document.getElementById('features'); if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: 'smooth' }); } }} className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
                {tr("Feature comparison")}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Interactive Cost Calculator */}
      <section id="calculator" className="max-w-4xl mx-auto px-4 py-16 md:py-24">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{tr("Interactive Cost Calculator")}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{tr("Drag the revenue slider to see what Ruunly really costs you.")}</p>
          </div>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8">
            {/* Revenue slider */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {tr("Monthly Revenue")}
                <span className="ml-2 text-emerald-500 font-bold text-lg">${revenue.toLocaleString()}</span>
              </label>
              <input
                type="range"
                min="1000"
                max="20000"
                step="500"
                value={revenue}
                onChange={(e) => setRevenue(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                aria-label={tr("Monthly revenue slider")}
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>$1,000</span>
                <span>$20,000</span>
              </div>
            </div>

            {/* Plan selector */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{tr("Ruunly Plan")}</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(RUUNLY_PLANS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setPlan(key)}
                    className={`py-3 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      plan === key
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.name}
                    <span className="block text-xs font-normal mt-0.5 opacity-80">${p.base}/mo</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Ruunly total */}
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-5">
                <div className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">{tr("Ruunly")} ({RUUNLY_PLANS[plan].name})</div>
                <div className="text-3xl font-extrabold text-red-600 dark:text-red-400">
                  ${ruunlyTotal}<span className="text-base font-medium">/mo</span>
                </div>
                <div className="text-xs text-red-500/70 dark:text-red-400/60 mt-1">
                  ${RUUNLY_PLANS[plan].base} plan + ${ruunlyTotal - RUUNLY_PLANS[plan].base} platform fee
                </div>
              </div>

              {/* MowGo total */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-1">{tr("MowGo Solo")}</div>
                <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  ${MOWGO_SOLO}<span className="text-base font-medium">/mo</span>
                </div>
                <div className="text-xs text-emerald-500/70 dark:text-emerald-400/60 mt-1">
                  {tr("Flat rate. No platform fees. Forever.")}
                </div>
              </div>
            </div>

            {/* Savings */}
            {savings > 0 && (
              <div className="mt-6 bg-emerald-500 rounded-xl p-5 text-center">
                <div className="text-emerald-100 text-sm font-medium">{tr("You save with MowGo")}</div>
                <div className="text-3xl font-extrabold text-white">
                  ${savings.toLocaleString()}<span className="text-base font-medium">/mo</span>
                </div>
                <div className="text-emerald-200 text-sm mt-1">
                  ${yearlySavings.toLocaleString()}{tr("/year")}
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </section>

      {/* Feature Comparison Table */}
      <section id="features" className="max-w-4xl mx-auto px-4 pb-16 md:pb-24">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-gray-900 dark:text-white tracking-tight mb-3">{tr("Feature Comparison")}</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10">{tr("Compare each plan, fee, and field tool side by side.")}</p>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="overflow-x-auto -mx-4 px-4" role="region" aria-label={tr("Feature comparison table — scroll horizontally on mobile")}>
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-800">
                  <th scope="col" className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-950 z-10">{tr("Feature")}</th>
                  <th scope="col" className="py-3 px-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20">
                    <div>{tr("MowGo Free")}</div>
                  </th>
                  <th scope="col" className="py-3 px-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20">
                    <div>{tr("MowGo Solo")}</div>
                    <div className="text-[10px] font-normal text-emerald-500/70 dark:text-emerald-400/60">$39/mo</div>
                  </th>
                  <th scope="col" className="py-3 px-2 text-center font-semibold text-red-600 dark:text-red-400">
                    <div>{tr("Ruunly Starter")}</div>
                    <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500">$19 + 2.5%</div>
                  </th>
                  <th scope="col" className="py-3 px-2 text-center font-semibold text-red-600 dark:text-red-400">
                    <div>{tr("Ruunly Pro")}</div>
                    <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500">$59 + 1.5%</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={f.label} className={`border-b border-gray-100 dark:border-gray-800/50 ${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''}`}>
                    <th scope="row" className="py-3 px-3 sticky left-0 bg-inherit text-left font-medium text-gray-900 dark:text-white">{tr(f.label)}</th>
                    {['mowgoFree', 'mowgoSolo', 'ruunlyStarter', 'ruunlyPro'].map((col, j) => {
                      const val = f[col];
                      const isMowGo = col.startsWith('mowgo');
                      const cellBg = isMowGo ? ' bg-emerald-50 dark:bg-emerald-950/20' : '';
                      if (f.type === 'bool') {
                        return (
                          <td key={col} className={`text-center py-3 px-2${cellBg}`}>
                            {val ? (
                              <Check className="w-5 h-5 text-emerald-500 mx-auto" aria-hidden="true" />
                            ) : (
                              <X className="w-5 h-5 text-red-400 mx-auto" aria-hidden="true" />
                            )}
                          </td>
                        );
                      }
                      if (f.type === 'qualified') {
                        return (
                          <td key={col} className={`text-center py-3 px-2${cellBg}`}>
                            {val === true ? <Check className="w-5 h-5 text-emerald-500 mx-auto" aria-hidden="true" />
                              : val === 'Coming soon' ? <span className="text-[10px] font-semibold uppercase text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">{tr("Coming soon")}</span>
                              : <X className="w-5 h-5 text-red-400 mx-auto" aria-hidden="true" />}
                          </td>
                        );
                      }
                      return (
                        <td key={col} className={`text-center py-3 px-2 text-xs font-medium${cellBg}`}>
                          <span className={f.type === 'fee' && !isMowGo ? 'text-red-500 dark:text-red-400' : f.type === 'fee' && isMowGo ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}>
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </section>

      {/* Rain Delay Section */}
      <section className="max-w-4xl mx-auto px-4 pb-16 md:pb-24">
        <FadeIn>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <CloudRain className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">{tr("MowGo")}</h3>
              </div>
              <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-2">
                {tr("Rain delay is FREE")}
              </p>
              <p className="text-emerald-700/80 dark:text-emerald-300/70 text-sm">
                {tr("On every plan — including Free. One tap moves your whole schedule. Clients get notified automatically.")}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <DollarSign className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-red-700 dark:text-red-300 text-lg">Ruunly</h3>
              </div>
              <p className="text-2xl md:text-3xl font-extrabold text-red-600 dark:text-red-400 mb-2">
                {tr("Rain delay costs $59/mo")}
              </p>
              <p className="text-red-700/80 dark:text-red-300/70 text-sm">
                {tr("You must upgrade to the Pro plan ($59/mo) just to get rain delay. Starter plan doesn't include it.")}
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Platform Fee Exposé */}
      <section className="bg-gray-50 dark:bg-gray-900 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{tr("Platform Fee Exposé")}</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">{tr("Add Ruunly's platform fee to the sticker price. Here is the monthly total.")}</p>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-800">
                    <th scope="col" className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">{tr("Monthly Revenue")}</th>
                    <th scope="col" className="text-center py-3 px-4 font-semibold text-red-600 dark:text-red-400">{tr("Ruunly Starter")}</th>
                    <th scope="col" className="text-center py-3 px-4 font-semibold text-red-600 dark:text-red-400">{tr("Ruunly Pro")}</th>
                    <th scope="col" className="text-center py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">{tr("MowGo Solo")}</th>
                    <th scope="col" className="text-center py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">{tr("You Save")}</th>
                  </tr>
                </thead>
                <tbody>
                  {getExposeRows().map((row, i) => {
                    const savingsStarter = row.ruunlyStarterCost - MOWGO_SOLO;
                    const savingsPro = row.ruunlyProCost - MOWGO_SOLO;
                    return (
                      <tr key={row.revenue} className={`border-b border-gray-200 dark:border-gray-800 ${i % 2 === 0 ? 'bg-white dark:bg-gray-950' : ''}`}>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">${row.revenue.toLocaleString()}{tr("/mo")}</td>
                        <td className="text-center py-3 px-4">
                          <span className="text-red-600 dark:text-red-400 font-bold">${row.ruunlyStarterCost}/mo</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="text-red-500 dark:text-red-400 font-medium">${row.ruunlyProCost}/mo</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">${MOWGO_SOLO}/mo</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">${savingsStarter.toLocaleString()}{tr("/mo")}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">{tr("* Based on Ruunly's published platform fee percentages applied to monthly revenue. MowGo Solo is $39 flat — no percentage fees.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-emerald-500 via-green-600 to-green-700" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">{tr("The math doesn't lie.")}</h2>
            <p className="text-emerald-100 text-lg mb-10">{tr("MowGo Solo: $39/mo flat. No platform fees. Free rain delay. Try it free.")}</p>
            <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
              {tr("Try MowGo Free")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-sm text-emerald-100/80">{tr("30-day Rain-Proof Guarantee on Solo. Cancel anytime.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-linear-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            MowGo &copy; 2026
          </div>
          <div className="flex gap-2 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/compare" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Compare")}</Link>
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Log In")}</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Privacy")}</Link>
            <a href="mailto:hello@mowgoapp.com" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
