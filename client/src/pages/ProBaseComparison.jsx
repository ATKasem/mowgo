import { useState, useRef, useEffect } from 'react';
import useLocalizedText from '../i18n/useLocalizedText';
import { Sprout, Check, X, ArrowRight, CloudRain, WifiOff, Smartphone, Calculator, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Verified pricing & facts (August 3, 2026)
// ProBase: $0/mo forever, marketplace-funded (take % of marketplace jobs), PWA only, no rain delay,
// no offline, no dedicated mobile apps, no QuickBooks/Xero (their own Jobber page admits it).
// MowGo: Free (5 clients) / Solo $39 / Crew $79. Flat fee, no take-rate, no per-user fees.

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

// true = MowGo wins this row, false = ProBase wins, 'tie' = both have it
const features = [
  { label: 'Rain delay auto-reschedule', desc: 'One tap moves today\u2019s route to tomorrow', mowgo: true, probase: false, star: true },
  { label: 'Offline mode', desc: 'Keep working with no cell service, syncs later', mowgo: true, probase: false },
  { label: 'Installable web app (PWA)', desc: 'Works on iPhone, Android, and desktop from the home screen', mowgo: true, probase: true },
  { label: 'QuickBooks / accounting sync', desc: 'Via Zapier webhooks (ProBase: \u201cnot designed for businesses that need accounting sync\u201d)', mowgo: true, probase: false },
  { label: 'Client self-booking link', desc: 'Clients book their own slot from your link', mowgo: true, probase: false },
  { label: 'Flat fee, no take-rate', desc: 'MowGo charges a flat monthly fee. No % of your revenue', mowgo: true, probase: false },
  { label: 'Price', desc: 'ProBase is genuinely free. That\u2019s the trade-off', mowgo: 'Free \u2013 $79/mo', probase: '$0 forever', winner: 'probase' },
  { label: 'Marketplace job leads', desc: 'ProBase can feed you jobs from their marketplace (they take a cut)', mowgo: false, probase: true },
  { label: 'Tip collection', desc: 'Built into online payments', mowgo: false, probase: true },
  { label: 'AI service notes', desc: 'Plain-language notes \u2192 structured records', mowgo: false, probase: true },
  { label: 'Automated review requests', desc: 'Prompts customers to leave Google reviews', mowgo: false, probase: true },
];

function Cell({ value, column }) {
  if (typeof value === 'boolean') {
    return (
      <td className={`py-3 px-3 text-center ${column === 'mowgo' ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}>
        {value
          ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-sm"><Check className="w-4 h-4" aria-hidden="true" /> Yes</span>
          : <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-600 font-medium text-sm"><X className="w-4 h-4" aria-hidden="true" /> No</span>}
      </td>
    );
  }
  return (
    <td className={`py-3 px-3 text-center font-semibold text-sm ${column === 'mowgo' ? 'bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
      {value}
    </td>
  );
}

export default function ProBaseComparison() {
  const { tr } = useLocalizedText('probaseComparison');

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
        <div className="absolute top-20 -right-20 w-96 h-96 bg-linear-to-br from-blue-200/30 to-cyan-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-linear-to-tr from-emerald-200/40 to-green-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-b from-transparent dark:from-transparent to-gray-50 dark:to-gray-950 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-24 md:py-32 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              {tr("The honest comparison")}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              {tr("ProBase is free.")}<br className="hidden sm:block" />{' '}
              <span className="bg-linear-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{tr("Until it rains.")}</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {tr("ProBase costs $0. But it has no rain delay, no offline mode, and no accounting sync. When a storm hits at 6am, MowGo moves your whole route in one tap.")}
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#features" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
                {tr("See the real difference")} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </a>
              <a href="#honest" className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
                {tr("When MowGo isn\u2019t right")}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* The 10pm Reschedule — rain delay wedge */}
      <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
        <FadeIn>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
                <CloudRain className="w-4 h-4" aria-hidden="true" /> {tr("The rain delay test")}
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
                {tr("It\u2019s 6am. Storm\u2019s rolling in. What does your software do?")}
              </h2>
              <p className="mt-4 text-gray-500 dark:text-gray-400 leading-relaxed">
                {tr("ProBase has zero weather features. You\u2019re opening every client, rescheduling every stop by hand \u2014 20, 30, 40 texts \u2014 while the rain starts. MowGo users tap one button and the whole route shifts to tomorrow. Clients get notified automatically.")}
              </p>
              <p className="mt-4 text-gray-500 dark:text-gray-400 leading-relaxed">
                {tr("That difference can save a whole day of revenue.")}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                    <CloudRain className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{tr("ProBase \u2014 $0/mo")}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr("Open 22 client records. Reschedule each job by hand. Text each client. Pray you didn\u2019t miss one.")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <CloudRain className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{tr("MowGo \u2014 free tier")}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr("One button. Every job shifts to tomorrow. Clients notified. Done in 3 seconds.")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Feature comparison */}
      <section id="features" className="max-w-4xl mx-auto px-4 pb-16 md:pb-20">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-gray-900 dark:text-white tracking-tight mb-3">{tr("Feature Comparison")}</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10">{tr("Verified August 2026. ProBase wins on free \u2014 we\u2019ll say it. Here\u2019s everything else.")}</p>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="overflow-x-auto -mx-4 px-4" role="region" aria-label={tr("Feature comparison table \u2014 scroll horizontally on mobile")}>
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-800">
                  <th scope="col" className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-950 z-10">{tr("Feature")}</th>
                  <th scope="col" className="py-3 px-2 text-center font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20">
                    <div>{tr("MowGo")}</div>
                    <div className="text-[10px] font-normal text-emerald-500/70 dark:text-emerald-400/60">Free \u2013 $79/mo</div>
                  </th>
                  <th scope="col" className="py-3 px-2 text-center font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20">
                    <div>{tr("ProBase")}</div>
                    <div className="text-[10px] font-normal text-blue-500/70 dark:text-blue-400/60">$0/mo</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.label} className={`border-b border-gray-100 dark:border-gray-800 ${f.star ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}`}>
                    <th scope="row" className="text-left py-3 px-3 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-950">
                      {f.label}
                      {f.star && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 rounded px-1.5 py-0.5">{tr("MowGo only")}</span>}
                      <div className="text-xs font-normal text-gray-400 dark:text-gray-500 mt-0.5">{f.desc}</div>
                    </th>
                    <Cell value={f.mowgo} column="mowgo" />
                    <Cell value={f.probase} column="probase" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </section>

      {/* Honest: when MowGo isn't right */}
      <section id="honest" className="max-w-4xl mx-auto px-4 pb-16 md:pb-24">
        <FadeIn>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-10">
            <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {tr("Honest answer: choose ProBase if\u2026")}
            </div>
            <ul className="space-y-3 text-gray-600 dark:text-gray-300">
              <li className="flex gap-2"><span className="text-amber-500 font-bold" aria-hidden="true">•</span> {tr("You\u2019re a solo operator who never needs to reschedule for weather, and $0/mo forever matters more than anything else.")}</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold" aria-hidden="true">•</span> {tr("You want marketplace job leads \u2014 ProBase can feed you work from their marketplace (and takes a cut of those jobs).")}</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold" aria-hidden="true">•</span> {tr("You run a pool service \u2014 they cover chemical logging and water testing.")}</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold" aria-hidden="true">•</span> {tr("You never work in the rain, never lose signal, and don\u2019t need accounting sync.")}</li>
            </ul>
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              {tr("If that\u2019s you \u2014 ProBase is legitimately free and you should use it. MowGo is built for the other 95%: crews who lose a day of revenue every time it rains, and who want software that isn\u2019t trying to be a marketplace.")}
            </p>
          </div>
        </FadeIn>
      </section>

      {/* Why MowGo is paid */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
                <WifiOff className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr("Works in the field")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{tr("MowGo's installable web app keeps working offline, so your schedule stays available when signal drops.")}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr("Install on every screen")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{tr("Works on iPhone, Android, and desktop as an installable home-screen app (PWA).")}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
                <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr("Flat fee, not a take-rate")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{tr("ProBase makes money when you take marketplace jobs. MowGo charges a flat monthly fee \u2014 your revenue and your data aren\u2019t the product.")}</p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* CTA */}
      <section className="bg-linear-to-br from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-800">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{tr("Try MowGo free. Rain delay included.")}</h2>
          <p className="mt-3 text-emerald-100 max-w-xl mx-auto">{tr("5 clients free forever. No credit card. When it rains, you\u2019ll see why we built this.")}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login?mode=signup" className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 font-bold rounded-xl px-8 py-3.5 text-base shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              {tr("Start free")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link to="/compare" className="inline-flex items-center justify-center gap-2 bg-emerald-600/60 hover:bg-emerald-600/80 text-white font-semibold rounded-xl px-8 py-3.5 text-base border border-emerald-400/40 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              {tr("See all comparisons")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-emerald-100/80">{tr("30-day Rain-Proof Guarantee on Solo. Cancel anytime.")}</p>
        </div>
      </section>
    </div>
  );
}
