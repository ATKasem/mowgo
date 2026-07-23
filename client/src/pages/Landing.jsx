import { useState, useEffect, useRef } from 'react';
import { Sparkles, Calendar, MapPin, Users, FileText, Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { startCheckout } from '../lib/payments';

const features = [
  { icon: Calendar, title: 'Smart Scheduling', desc: 'Recurring jobs, drag-to-reschedule, color-coded calendar. Set it once, it runs forever.', color: 'from-blue-500 to-cyan-500' },
  { icon: MapPin, title: 'Route Planning', desc: 'Optimized daily routes so you spend less time driving and more time mowing.', color: 'from-emerald-500 to-teal-500' },
  { icon: Users, title: 'Client Management', desc: 'Names, addresses, key codes, pet instructions — everything in one place.', color: 'from-violet-500 to-purple-500' },
  { icon: FileText, title: 'One-Tap Invoicing', desc: 'Job done → tap invoice. Client gets a text with a Stripe payment link.', color: 'from-amber-500 to-orange-500' },
];

const plans = [
  { name: 'Free', price: '0', period: 'forever', desc: 'For solo landscapers getting started', features: ['Up to 10 clients', 'Daily job scheduling', 'Recurring job auto-regenerate', 'Invoice tracking', 'Rain delay reschedule', 'Dark mode + mobile PWA'], cta: 'Start Free', highlight: false },
  { name: 'Solo', price: '49', period: 'month', desc: 'For independent landscapers with a full schedule', features: ['Unlimited clients & jobs', 'Recurring job automation', 'Client notes, codes & pets', 'GPS navigate to job site', 'Offline mode', 'Stripe payments'], cta: 'Start Free Trial', highlight: true, coming: ['Stripe payments'] },
  { name: 'Crew', price: '79', period: 'month', desc: 'For small teams of 2-3 landscapers', features: ['Everything in Solo', 'Multi-user team access', 'Route optimization', 'Team progress dashboard', 'Priority support', 'QuickBooks export'], cta: 'Start Free Trial', highlight: false, coming: ['Multi-user team access', 'Route optimization', 'QuickBooks export'] },
];

const stats = [
  { value: '556K+', label: 'US lawn care businesses', suffix: 'and growing' },
  { value: '$188B', label: 'Industry market size', suffix: 'in 2026' },
  { value: '<1%', label: 'of your revenue', suffix: '— our price' },
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

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-sky-200 dark:selection:bg-sky-800">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-950 dark:to-sky-950" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-sky-200/40 to-blue-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-gradient-to-tr from-violet-200/30 to-purple-300/20 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-24 md:py-32 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6 hover:scale-105 transition-transform cursor-default">
              <Sparkles className="w-4 h-4" />
              Now on iOS, Android & Web
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              Scheduling that <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">actually works</span> for lawn care crews
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              The only app built for 1–3 person lawn care teams. Schedule jobs, plan routes, invoice clients — all from your phone. No office staff required.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/app" className="group inline-flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-gray-900/10 hover:shadow-2xl hover:shadow-gray-900/20 hover:-translate-y-0.5 transition-all duration-200">
                Try the Demo
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#pricing" className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                View Pricing
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Free forever plan. No credit card required.</p>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">Everything you need, <span className="text-sky-500">nothing you don't</span></h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">Jobber is $169/month for a reason — it's built for 20-person crews. MowFlow is built for you.</p>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-5">
          {features.map(({ icon: Icon, title, desc, color }, i) => (
            <FadeIn key={title} delay={i * 100}>
              <div className="group card p-6 flex gap-4 hover:border-sky-200 dark:hover:border-sky-800 cursor-default">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(({ value, label, suffix }) => (
            <FadeIn key={label}>
              <div className="card p-6 text-center hover:border-sky-200 dark:hover:border-sky-800 transition-all">
                <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">{value}</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{suffix}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 dark:bg-gray-900 py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">Simple, transparent pricing</h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-14 text-lg">Start free. Upgrade when you're ready. Cancel anytime.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 100}>
                <div className={`card p-6 flex flex-col transition-all duration-300 ${plan.highlight ? 'ring-2 ring-sky-500 dark:ring-sky-400 shadow-lg shadow-sky-100 dark:shadow-sky-900/20 scale-[1.02] relative' : 'hover:scale-[1.01]'}`}>
                  {plan.highlight && <div className="absolute -top-3 inset-x-0 flex justify-center"><span className="bg-sky-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">Most Popular</span></div>}
                  <h3 className={`text-lg font-bold ${plan.highlight ? 'text-sky-600 dark:text-sky-400 mt-3' : 'text-gray-900 dark:text-white'}`}>{plan.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.desc}</p>
                  <div className="mt-5 mb-6">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">${plan.price}</span>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">/{plan.period}</span>
                  </div>
                  <ul className="space-y-3 flex-1 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {plan.features.map(f => {
                      const isComing = plan.coming?.includes(f);
                      return (
                        <li key={f} className={`flex items-start gap-2.5 text-sm ${isComing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>
                          <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isComing ? 'text-gray-300 dark:text-gray-600' : 'text-emerald-500'}`} />
                          <span>{f}{isComing && <span className="ml-1.5 text-[10px] font-semibold uppercase text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">Soon</span>}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {plan.name === 'Free' ? (
                    <Link to="/app" className={`mt-6 text-center py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700`}>{plan.cta}</Link>
                  ) : (
                    <button onClick={() => startCheckout(plan.name.toLowerCase())} className={`mt-6 text-center py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${plan.highlight ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{plan.cta}</button>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Ready to stop losing track of jobs?</h2>
            <p className="text-sky-100 text-lg mb-10">Join lawn care crews who've reclaimed 5+ hours a week.</p>
            <Link to="/app" className="group inline-flex items-center gap-2 bg-white text-sky-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-sky-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
              Try MowFlow Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-sky-200/80 text-sm">Available on iOS, Android, and web.</p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
            MowFlow &copy; 2026
          </div>
          <div className="flex gap-6 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/app" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">App</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Privacy</Link>
            <a href="mailto:hello@mowflow.app" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
