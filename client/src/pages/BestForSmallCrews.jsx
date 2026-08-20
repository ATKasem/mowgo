import useLocalizedText from '../i18n/useLocalizedText';
import usePageTitle from '../hooks/usePageTitle';
import { useState, useEffect, useRef } from 'react';
import { CloudRain, Check, X, ArrowRight, Sprout, Shield, Wifi, DollarSign, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  { icon: DollarSign, title: 'Flat $39/mo Pricing', desc: 'No per-user fees. No hidden charges. Your whole crew included on one plan.', color: 'from-emerald-500 to-green-500' },
  { icon: CloudRain, title: 'Rain Delay One-Tap Move', desc: 'Rain tomorrow? One tap moves every job to the next dry day. Clients are notified automatically.', color: 'from-blue-500 to-indigo-500' },
  { icon: Wifi, title: 'Offline Mode', desc: 'Works without cell service. Rural areas, bad signal, your data syncs when you are back in range.', color: 'from-teal-500 to-cyan-500' },
  { icon: Shield, title: 'No Per-User Fees', desc: 'Jobber charges $29/mo per extra crew member. MowGo charges once for your whole crew.', color: 'from-amber-500 to-orange-500' },
  { icon: Zap, title: '2-Minute Setup', desc: 'No onboarding calls. No training. Sign up and add your first client in under 2 minutes.', color: 'from-violet-500 to-purple-500' },
  { icon: Users, title: 'Auto Invoicing', desc: 'Mark a job complete, invoice is created. One tap copies a payment request to the client. Venmo, Zelle, Cash App.', color: 'from-rose-500 to-pink-500' },
];

const comparisons = [
  { feature: 'Flat price (no per-user fees)', mowgo: true, jobber: false, lawnpro: false, yardbook: true },
  { feature: 'Rain delay reschedule', mowgo: true, jobber: false, lawnpro: false, yardbook: false },
  { feature: 'Offline mode', mowgo: true, jobber: false, lawnpro: false, yardbook: false },
  { feature: 'Unlimited clients', mowgo: true, jobber: false, lawnpro: false, yardbook: false },
  { feature: 'Auto invoicing', mowgo: true, jobber: true, lawnpro: true, yardbook: true },
  { feature: 'Route planning', mowgo: true, jobber: true, lawnpro: true, yardbook: false },
  { feature: 'Client notes & gate codes', mowgo: true, jobber: true, lawnpro: true, yardbook: true },
  { feature: 'Dark mode', mowgo: true, jobber: false, lawnpro: false, yardbook: false },
  { feature: 'Free tier available', mowgo: true, jobber: false, lawnpro: true, yardbook: true },
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

export default function BestForSmallCrews() {
  const { tr, t, i18n } = useLocalizedText('bestForSmallCrews');
  usePageTitle(tr('seo.title'), tr('seo.description'));
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
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

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950"></div>
        <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-emerald-200/40 to-green-300/20 rounded-full blur-3xl dark:from-emerald-900/20 dark:to-green-800/10"></div>
        <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium mb-6">
              <Sprout className="w-4 h-4" />
              Built for 1-3 person crews
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
              Best Lawn Care Software for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500">Small Crews</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mb-8">
              Most software was built for 20-person operations with office managers. MowGo was built for 1-3 person crews who need scheduling, routing, and invoicing without the bloat or the price tag.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/login?mode=signup" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors">
                Try MowGo Free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/compare" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                See the Comparison
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">6 Things Small Crews Actually Need</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-10">Bigger is not better when you are a 1-3 person operation. Here is what matters.</p>
        </FadeIn>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-800 transition-all">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-900/50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">How MowGo Stacks Up for Small Crews</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-10">MowGo Solo at $39/mo flat beats every competitor on price and features that matter to 1-3 person crews.</p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">Feature</th>
                    <th className="text-center px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">MowGo Solo</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Jobber</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">LawnPro</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Yardbook</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">Price (1 crew)</td>
                    <td className="text-center px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">$39/mo</td>
                    <td className="text-center px-4 py-3 text-gray-500 dark:text-gray-400">$49-$249/mo</td>
                    <td className="text-center px-4 py-3 text-gray-500 dark:text-gray-400">$39/mo</td>
                    <td className="text-center px-4 py-3 text-gray-500 dark:text-gray-400">Free/$35</td>
                  </tr>
                  {comparisons.map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.feature}</td>
                      <td className="text-center px-4 py-3">{c.mowgo ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}</td>
                      <td className="text-center px-4 py-3">{c.jobber ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}</td>
                      <td className="text-center px-4 py-3">{c.lawnpro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}</td>
                      <td className="text-center px-4 py-3">{c.yardbook ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">Updated August 2026 from public pricing pages.</p>
          </FadeIn>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <FadeIn>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Run your next 5 clients free.</h2>
            <p className="text-emerald-100 mb-8 max-w-md mx-auto">No credit card. No setup fees. 2 minutes to start.</p>
            <Link to="/login?mode=signup" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-colors">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeIn>
      </section>

      <footer className="border-t border-gray-100 dark:border-gray-800 py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">MowGo &copy; 2026</p>
          <div className="flex gap-4 text-sm">
            <Link to="/compare" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">Compare</Link>
            <Link to="/login" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">Log In</Link>
            <Link to="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">Privacy</Link>
            <a href="mailto:hello@mowgoapp.com" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">Contact</a>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 mt-4 flex gap-4 text-xs text-gray-400">
          <Link to="/rates" className="hover:text-emerald-400">Lawn rates by city</Link>
          <Link to="/route-audit" className="hover:text-emerald-400">Free route audit</Link>
          <Link to="/no-per-user-fees" className="hover:text-emerald-400">No per-user fees</Link>
          <Link to="/jobber-too-expensive" className="hover:text-emerald-400">Jobber too expensive?</Link>
        </div>
      </footer>
    </div>
  );
}