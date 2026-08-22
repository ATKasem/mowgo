import useLocalizedText from '../i18n/useLocalizedText';
import usePageTitle from '../hooks/usePageTitle';
import { useState, useEffect, useRef } from 'react';
import { DollarSign, AlertTriangle, Check, X, ArrowRight, Sprout, Users, Calculator, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

const painPoints = [
  { icon: Calculator, title: 'Per-User Fees Add Up Fast', desc: 'Jobber charges $29/user/mo on top of the base plan. A 2-person crew on Connect pays $168/mo — over 4× more than MowGo Solo.', color: 'from-red-500 to-rose-500' },
  { icon: TrendingDown, title: 'Add-Ons Everywhere', desc: 'Features like advanced reporting, job costing, and GPS tracking are locked behind higher tiers or separate add-ons.', color: 'from-amber-500 to-orange-500' },
  { icon: AlertTriangle, title: 'Price Increases Without Notice', desc: 'Jobber has raised prices multiple times. What starts affordable gets expensive — and you find out on your bill.', color: 'from-violet-500 to-purple-500' },
];

const pricingPlans = [
  { plan: 'Jobber Core', price: '$49', per: '/mo', users: '+$29/user', features: ['1 user included', 'Basic scheduling', 'No GPS tracking', 'No job costing'], highlight: false },
  { plan: 'Jobber Connect', price: '$139', per: '/mo', users: '+$29/user', features: ['1 user included', 'GPS tracking', 'Online booking', 'Basic automation'], highlight: false },
  { plan: 'Jobber Grow', price: '$349', per: '/mo', users: '+$29/user', features: ['1 user included', 'Advanced reporting', 'Job costing', 'Expense tracking'], highlight: false },
  { plan: 'MowGo Free', price: '$0', per: '/mo', users: 'Free', features: ['Up to 5 clients', 'Rain delay', 'Basic scheduling', 'Data export'], highlight: false },
  { plan: 'MowGo Solo', price: '$39', per: '/mo', users: '$0/user', features: ['Unlimited clients', 'Rain delay auto-reschedule', 'Offline mode', 'GPS routing', 'Auto invoicing'], highlight: true },
  { plan: 'MowGo Crew', price: '$79', per: '/mo', users: '$0/user', features: ['Everything in Solo', 'Crew scheduling', 'Multi-user', 'Priority support'], highlight: false },
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

export default function JobberIsTooExpensive() {
  const { tr } = useLocalizedText('jobberIsTooExpensive');
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
            <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <DollarSign className="w-4 h-4" />
              {tr("Pricing Transparency Report")}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              {tr("Jobber is too expensive")}<br />
              <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">{tr("for small crews.")}</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {tr("A 2-person crew on Jobber Connect pays $139 base + $29/user = $168/mo. MowGo Solo is $39/mo flat — for your entire crew. No per-user fees. No add-on surprises.")}
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200">
                {tr("Try MowGo Free")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button onClick={() => document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth' })} className="group inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50 active:scale-[0.97] transition-all duration-200">
                {tr("See the Price Comparison")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">{tr("Free for 5 clients. No credit card. 2 minutes to set up.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* The Real Math */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
            {tr("The")} <span className="text-red-500">{tr("real math")}</span> {tr("behind Jobber")}
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">
            {tr("Here's what a 2-person lawn crew actually pays on Jobber vs MowGo.")}
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

      {/* Price Comparison Table */}
      <section id="comparison" className="bg-gray-50 dark:bg-gray-900 py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
              {tr("Jobber vs MowGo")} <span className="text-emerald-500">{tr("pricing")}</span>
            </h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto text-lg">
              {tr("All prices as of 2026. Per-user fees are the hidden killer.")}
            </p>
          </FadeIn>
          <FadeIn delay={200}>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("Plan")}</th>
                      <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("Base Price")}</th>
                      <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("Per-User Fee")}</th>
                      <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{tr("2-Person Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingPlans.map(({ plan, price, per, users, features, highlight }) => (
                      <tr key={plan} className={`border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${highlight ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} transition-colors`}>
                        <td className={`py-3 px-4 font-semibold ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{tr(plan)}</td>
                        <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{price}{per}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={users.includes('$29') ? 'text-red-500 font-medium' : 'text-emerald-600 dark:text-emerald-400'}>{users}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${highlight ? 'text-emerald-600 dark:text-emerald-400' : users.includes('$29') ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                            {plan === 'Jobber Core' ? '$78' : plan === 'Jobber Connect' ? '$168' : plan === 'Jobber Grow' ? '$378' : plan === 'MowGo Free' ? '$0' : plan === 'MowGo Solo' ? '$39' : '$79'}
                          </span>
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
              {tr("* Based on publicly available pricing as of 2026. Verify on each provider's site before deciding.")}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* What You Get */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">
            {tr("What you get")} <span className="text-emerald-500">{tr("with MowGo Solo")}</span>
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">
            {tr("Everything a small crew needs. No per-user fees. No add-ons. No surprises.")}
          </p>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { title: 'Unlimited clients & jobs', desc: 'Add as many clients as you want. No limits, no per-client charges.' },
            { title: 'Rain delay auto-reschedule', desc: 'One tap to move rainy-day jobs to the next dry date. Crew is notified automatically.' },
            { title: 'Offline mode', desc: 'Works without internet. Rural areas, bad signal — doesn\'t matter.' },
            { title: 'GPS route navigation', desc: 'Daily optimized routes with turn-by-turn navigation.' },
            { title: 'One-tap invoicing', desc: 'Auto-generate invoices from completed jobs. Send in seconds.' },
            { title: 'Data export anytime', desc: 'Your data is yours. Export it whenever you want. We don\'t lock you in.' },
          ].map(({ title, desc }, i) => (
            <FadeIn key={title} delay={i * 80}>
              <div className="group card p-6 flex gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 cursor-default">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Check className="w-5 h-5 text-white" />
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

      {/* The Fine Print */}
      <section className="max-w-4xl mx-auto px-4 pb-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-10 tracking-tight">
            {tr("The Fine Print: What Jobber Leaves Out")}
          </h2>
          <div className="card p-6 md:p-8">
            <ul className="space-y-5">
              {[
                { label: 'Band billing', description: "Jobber's 2-5 person band costs $199/mo whether you have 2 people or 5. You're paying for 5 when you only have 2." },
                { label: 'Per-user add-ons', description: "Every person you add to Jobber costs $29/mo on top of the base plan. A 10-person crew on Plus pays $599 base + $290 = $889/mo." },
                { label: 'Hidden tiers', description: "Jobber's best prices require a 1-year commitment. Month-to-month users pay $29-$100/mo more — and that's before per-user fees. The price you see is rarely the price you pay." },
                { label: 'Missing features', description: "AI Receptionist is $29/mo extra on every plan except Plus. Marketing Suite is $79/mo extra. Pipeline is $49/mo extra. Jobber Core doesn't include GPS, online booking, or credit card processing without add-ons." },
              ].map(({ label, description }) => (
                <li key={label} className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  <strong className="text-gray-900 dark:text-white">{tr(label)}:</strong>{' '}
                  {tr(description)}
                </li>
              ))}
            </ul>
            <p className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
              {tr("All prices from getjobber.com, verified August 2026. We update this page when they change.")}
            </p>
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
              { q: 'How much does Jobber actually cost for a 2-person crew?', a: 'Jobber Connect costs $139/mo base, plus $29/user for each additional team member. A 2-person crew pays $168/mo. Jobber Grow with 2 users costs $378/mo. These fees add up fast for small operations.' },
              { q: 'Does MowGo charge per-user fees?', a: 'No. MowGo Solo is $39/mo flat for your entire crew. There are no per-user fees, no add-on charges, and no hidden costs. What you see is what you pay.' },
              { q: 'What features does MowGo include that Jobber charges extra for?', a: 'MowGo includes rain delay auto-reschedule, offline mode, GPS routing, auto invoicing, and unlimited clients on the Solo plan — all for $39/mo. Jobber locks many of these behind higher tiers or charges per-user.' },
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
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">{tr("Stop overpaying for lawn software.")}</h2>
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
          <Link to="/no-per-user-fees" className="hover:text-emerald-400">No per-user fees</Link>
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
