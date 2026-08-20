import useLocalizedText from '../i18n/useLocalizedText';
import usePageTitle from '../hooks/usePageTitle';
import { useState, useEffect, useRef } from 'react';
import { Users, Check, X, ArrowRight, Sprout, DollarSign, AlertTriangle, Shield, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const competitors = [
  { name: 'Jobber Connect', base: '$139', perUser: '$29', crew2: '$168', crew3: '$197', color: 'text-red-500' },
  { name: 'Housecall Pro', base: '$79', perUser: '$25', crew2: '$129', crew3: '$154', color: 'text-red-500' },
  { name: 'LawnPro Starter', base: '$39', perUser: '$15', crew2: '$69', crew3: '$84', color: 'text-amber-500' },
];

const features = [
  { feature: 'Flat pricing — no per-user fees', mowgo: true, jobber: false, hcp: false },
  { feature: 'Rain delay auto-reschedule', mowgo: true, jobber: 'paid add-on', hcp: false },
  { feature: 'Offline mode', mowgo: true, jobber: false, hcp: false },
  { feature: 'Unlimited clients', mowgo: true, jobber: false, hcp: 'limited' },
  { feature: 'GPS route navigation', mowgo: true, jobber: 'paid tier', hcp: 'paid tier' },
  { feature: 'Auto invoicing', mowgo: true, jobber: true, hcp: true },
  { feature: 'Data export anytime', mowgo: true, jobber: false, hcp: false },
  { feature: 'Dark mode built-in', mowgo: true, jobber: false, hcp: false },
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

export default function NoPerUserFees() {
  const { tr } = useLocalizedText('noPerUserFees');
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
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Users className="w-4 h-4" />
              {tr("Built for small crews")}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              {tr("Lawn care software")}<br />
              <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">{tr("with no per-user fees.")}</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {tr("Stop paying $29/user every time you add a crew member. MowGo Solo is $39/mo flat for your whole crew — no per-user fees. Even Crew is $79/mo with your first crew member included, then just $10/mo per extra.")}
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200">
                {tr("Try MowGo Free")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button onClick={() => document.getElementById('math')?.scrollIntoView({ behavior: 'smooth' })} className="group inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50 active:scale-[0.97] transition-all duration-200">
                {tr("See the Math")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">{tr("Free for 5 clients. No credit card. 2 minutes to set up.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* The Problem */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
            {tr("The")} <span className="text-red-500">{tr("per-user fee trap")}</span>
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">
            {tr("Most lawn care software charges you for every crew member. Here's how that adds up.")}
          </p>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-5">
          {competitors.map(({ name, base, perUser, crew2, crew3, color }, i) => (
            <FadeIn key={name} delay={i * 100}>
              <div className="card p-6 text-center">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{tr(name)}</h3>
                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{base}</span>
                  <span className="text-gray-400 dark:text-gray-500">/mo base</span>
                </div>
                <div className={`mt-2 text-sm font-medium ${color}`}>
                  +{perUser}/user
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>2-person crew:</span>
                    <span className={`font-bold ${color}`}>{crew2}/mo</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>3-person crew:</span>
                    <span className={`font-bold ${color}`}>{crew3}/mo</span>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* The Math */}
      <section id="math" className="bg-gray-50 dark:bg-gray-900 py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
              {tr("The")} <span className="text-emerald-500">{tr("MowGo difference")}</span>
            </h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto text-lg">
              {tr("MowGo Solo is $39/mo flat — no per-user fees. Crew is $79/mo with your first crew member included, then $10/mo per additional.")}
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <FadeIn delay={100}>
              <div className="card p-6 ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 relative">
                <div className="absolute -top-3 inset-x-0 flex justify-center"><span className="bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">{tr("MowGo Solo")}</span></div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">$39</span>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">{tr("/mo flat")}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{tr("What you get:")}</p>
                  <ul className="space-y-2 mt-3">
                    {['Unlimited clients & jobs', 'Rain delay auto-reschedule', 'Offline mode', 'GPS route navigation', 'One-tap invoicing', 'No per-user fees ever'].map(f => (
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
                <h3 className="text-lg font-bold text-gray-400 dark:text-gray-500">{tr("Typical Competitor")}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-extrabold text-gray-400 dark:text-gray-500">$168+</span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">{tr("/mo for 2 users")}</span>
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{tr("What you get:")}</p>
                <ul className="space-y-2 mt-3">
                  {['Base plan + per-user fee', 'Features locked behind tiers', 'Add-ons for rain delay', 'Online only', 'No data export'].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400 dark:text-gray-500">
                      <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                      <span>{tr(f)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 italic">{tr("\"Per-user\" means you pay every time your crew grows.")}</p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
            {tr("Feature comparison")}
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto text-lg">
            {tr("MowGo includes what others charge extra for.")}
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
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("Jobber")}</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("Housecall Pro")}</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map(({ feature, mowgo, jobber, hcp }) => (
                    <tr key={feature} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{tr(feature)}</td>
                      <td className="py-3 px-4 text-center">
                        {mowgo === true ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : mowgo === false ? (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-gray-400">{tr(mowgo)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {jobber === true ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : jobber === false ? (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-gray-400">{tr(jobber)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {hcp === true ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : hcp === false ? (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-gray-400">{tr(hcp)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 dark:bg-gray-900 py-24">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-10 tracking-tight">
              {tr("Frequently asked questions")}
            </h2>
          </FadeIn>
          <div className="space-y-4">
            {[
              { q: 'What are per-user fees in lawn care software?', a: 'Per-user fees mean you pay a separate monthly charge for every crew member who uses the software. For example, Jobber charges $29/user/mo on top of the base plan. A 2-person crew pays $168/mo total on Jobber Connect, while MowGo charges $39/mo flat for the entire crew.' },
              { q: 'Does MowGo really have no per-user fees?', a: 'MowGo Solo is $39/mo flat — no per-user fees, your whole crew uses it for one price. Crew is $79/mo with your first crew member included, then $10/mo per additional. Either way, you save hundreds vs Jobber.' },
              { q: 'Why do other lawn care apps charge per user?', a: 'Per-user pricing is a common SaaS model that scales revenue with team size. It works well for enterprise tools but penalizes small crews. MowGo was built specifically for 1-3 person operations, so flat pricing makes more sense.' },
            ].map(({ q, a }, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{tr(q)}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{tr(a)}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-green-700" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">{tr("One price. Your whole crew.")}</h2>
            <p className="text-emerald-100 text-lg mb-10">{tr("MowGo Solo: $39/mo flat. No per-user fees. Free for 5 clients. No credit card to start.")}</p>
            <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
              {tr("Start Free")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-emerald-200/80 text-sm">{tr("Works on iPhone, Android, and desktop as an installable home-screen app (PWA).")}</p>
          </FadeIn>
        </div>
      </section>

      {/* Related */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">Related</h2>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--color-text-muted)]">
          <Link to="/jobber-too-expensive" className="hover:text-emerald-400">Jobber is too expensive</Link>
          <Link to="/best-for-small-crews" className="hover:text-emerald-400">Best for small crews</Link>
          <Link to="/compare" className="hover:text-emerald-400">Compare lawn care software</Link>
          <Link to="/switch-from-lawnpro" className="hover:text-emerald-400">Switch from LawnPro</Link>
        </p>
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
            <a href="mailto:hello@mowgoapp.com" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
