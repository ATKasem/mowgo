import useLocalizedText from '../i18n/useLocalizedText';
import usePageTitle from '../hooks/usePageTitle';
import { useState, useEffect, useRef } from 'react';
import { CloudRain, AlertTriangle, Check, X, ArrowRight, Sprout, Shield, Users, Zap, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';

const painPoints = [
  { icon: AlertTriangle, title: 'Data Loss Reports', desc: 'Former LawnPro users have reported lost scheduling data and client records after updates. Your business depends on that data.', color: 'from-red-500 to-rose-500' },
  { icon: AlertTriangle, title: 'Slow Sync Issues', desc: 'Job data that takes minutes to sync — or doesn\'t sync at all. When you\'re out in the field, slow = broken.', color: 'from-amber-500 to-orange-500' },
  { icon: AlertTriangle, title: 'Price Creep', desc: 'What started affordable has climbed over time. Features that were included now cost extra, and the "free" tier is barely usable.', color: 'from-violet-500 to-purple-500' },
  { icon: AlertTriangle, title: 'Rain Delay? Still Extra', desc: 'The #1 feature you need in lawn care — automatic rain delay rescheduling — is still not included in the base plan.', color: 'from-blue-500 to-indigo-500' },
];

const solutions = [
  { icon: CloudRain, title: 'Rain Delay Auto-Reschedule', desc: 'One tap moves your entire schedule forward when it rains. Clients get notified automatically. Included on every plan — even free.', color: 'from-emerald-500 to-green-500' },
  { icon: Wifi, title: 'Offline Mode', desc: 'MowGo works without internet. Rural areas, bad signal, doesn\'t matter. Your data syncs when you\'re back online.', color: 'from-teal-500 to-cyan-500' },
  { icon: Shield, title: '$39 Flat Pricing', desc: 'Solo plan: $39/mo. That\'s it. No per-user fees, no hidden charges, no "gotcha" upsells. Unlimited clients and jobs.', color: 'from-amber-500 to-orange-500' },
  { icon: Sprout, title: 'Your Data Is Yours', desc: 'We don\'t sell your customer data to advertisers. You are the customer, not the product. Full data export whenever you want.', color: 'from-violet-500 to-purple-500' },
];

const comparisons = [
  { feature: 'Rain delay auto-reschedule', mowgo: true, lawnpro: false },
  { feature: 'Offline mode', mowgo: true, lawnpro: false },
  { feature: 'Unlimited clients on Solo', mowgo: true, lawnpro: false },
  { feature: 'Client notes & gate codes', mowgo: true, lawnpro: true },
  { feature: 'Invoice tracking', mowgo: true, lawnpro: true },
  { feature: 'Daily route planning', mowgo: true, lawnpro: true },
  { feature: 'Data export anytime', mowgo: true, lawnpro: false },
  { feature: 'No data selling', mowgo: true, lawnpro: 'unclear' },
  { feature: 'Dark mode built-in', mowgo: true, lawnpro: false },
  { feature: 'PWA install to home screen', mowgo: true, lawnpro: false },
];

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

export default function SwitchingFromLawnPro() {
  const { tr, t, i18n } = useLocalizedText('switchingFromLawnPro');
  usePageTitle(tr('seo.title'), tr('seo.description'));
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-bold text-lg no-underline min-h-[44px] inline-flex items-center">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
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
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-emerald-200/40 to-green-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-gradient-to-tr from-amber-200/30 to-orange-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent dark:from-transparent to-gray-50 dark:to-gray-950 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-24 md:py-32 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <AlertTriangle className="w-4 h-4" />
              {tr("Looking for a better option?")}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              {tr("Leave LawnPro without losing your week.")}<br />
              <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">{tr("Move your first 5 clients free.")}</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {tr("You trusted LawnPro with your business. If reports from former LawnPro users about lost data, broken sync, or surprise price hikes sound familiar, keep reading. MowGo was built for operators who are tired of that.")}
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200">
                {tr("Start Free")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button onClick={() => document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth' })} className="group inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50 active:scale-[0.97] transition-all duration-200">
                {tr("See the Comparison")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">{tr("Free for 5 clients. No credit card. 2 minutes to set up.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* Pain Points */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
            {tr("Why users are")} <span className="text-red-500">{tr("leaving LawnPro")}</span>
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">
            {tr("These are reports from former LawnPro users as of mid-2026. If any of them sound familiar, keep reading.")}
          </p>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-5">
          {painPoints.map(({ icon: Icon, title, desc, color }, i) => (
            <FadeIn key={title} delay={i * 100}>
              <div className="group card p-6 flex gap-4 hover:border-red-200 dark:hover:border-red-800 cursor-default">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{tr(title)}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{tr(desc)}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Solutions */}
      <section className="bg-gray-50 dark:bg-gray-900 py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
              {tr("What MowGo")} <span className="text-emerald-500">{tr("does differently")}</span>
            </h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">
              {tr("Built from talks with lawn care operators. These tools keep a small crew moving.")}
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-5">
            {solutions.map(({ icon: Icon, title, desc, color }, i) => (
              <FadeIn key={title} delay={i * 100}>
                <div className="group card p-6 flex gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 cursor-default">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{tr(title)}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{tr(desc)}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="comparison" className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
            {tr("Quick feature comparison")}
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto text-lg">
            {tr("Side-by-side, no spin. You decide.")}
          </p>
        </FadeIn>
        <FadeIn delay={200}>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("Feature")}</th>
                    <th className="text-center py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{tr("MowGo")}</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("LawnPro")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(({ feature, mowgo, lawnpro }) => (
                    <tr key={feature} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{tr(feature)}</td>
                      <td className="py-3 px-4 text-center">
                        {mowgo === true ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : mowgo === false ? (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-gray-400">?</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {lawnpro === true ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : lawnpro === false ? (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-gray-400">{tr("unclear")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={300}>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
            {tr("* Feature availability based on publicly documented info. Verify on each provider's site before deciding.")}
          </p>
        </FadeIn>
      </section>

      {/* Pricing Callout */}
      <section className="bg-gray-50 dark:bg-gray-900 py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
              {tr("Let's talk")} <span className="text-emerald-500">{tr("pricing")}</span>
            </h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6 mt-10 max-w-3xl mx-auto">
            <FadeIn delay={100}>
              <div className="card p-6 ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 relative">
                <div className="absolute -top-3 inset-x-0 flex justify-center"><span className="bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">{tr("MowGo Solo")}</span></div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">$39</span>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">{tr("/mo")}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{tr("What you get:")}</p>
                  <ul className="space-y-2 mt-3">
                    {['Unlimited clients & jobs', 'Rain delay auto-reschedule', 'Offline mode', 'GPS route navigation', 'One-tap invoicing', 'Data export anytime'].map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                        <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                        <span>{tr(f)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-4 font-medium">{tr("14-day free trial. No credit card to start.")}</p>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="card p-6 opacity-75">
                <h3 className="text-lg font-bold text-gray-400 dark:text-gray-500">{tr("LawnPro Starter")}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-extrabold text-gray-400 dark:text-gray-500">$39</span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">{tr("/mo")}</span>
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{tr("What you get:")}</p>
                <ul className="space-y-2 mt-3">
                  {['Limited client slots', 'Manual rain reschedule', 'Online only', 'Basic invoicing', 'No data export'].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400 dark:text-gray-500">
                      <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                      <span>{tr(f)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 italic">{tr("\"Cheaper\" isn't cheaper if the features don't work.")}</p>
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={300}>
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-6">
              {tr("Both are $39/mo — compare the included features above to decide which fits your business.")}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Social Proof */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-10 tracking-tight">
            {tr("Built by someone who's")} <span className="text-emerald-500">{tr("been there")}</span>
          </h2>
        </FadeIn>
        <div className="card p-8 text-center max-w-2xl mx-auto">
          <FadeIn delay={100}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed italic">
              {tr("\"MowGo was born because I got tired of losing client data in other apps. Every feature exists because a real operator asked for it. No VC fluff. No 'enterprise features' nobody needs. Just the tools that keep your crew moving.\"")}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-4 font-medium">{tr("— The MowGo Team")}</p>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-green-700" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">{tr("Move your first 5 clients free.")}</h2>
            <p className="text-emerald-100 text-lg mb-10">{tr("Free for 5 clients. No credit card. Import your data in minutes.")}</p>
            <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
              {tr("Start Free")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-emerald-200/80 text-sm">{tr("Works on iPhone, Android, and desktop as an installable home-screen app (PWA).")}</p>
            <p className="mt-2 text-emerald-100/80 text-sm">{tr("30-day Rain-Proof Guarantee on Solo. Cancel anytime.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"><Sprout className="w-3.5 h-3.5 text-white" /></div>
            MowGo &copy; 2026
          </div>
          <div className="flex gap-6 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/compare" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Compare")}</Link>
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Log In")}</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Privacy")}</Link>
            <a href="mailto:hello@mowgo.app" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
