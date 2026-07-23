import { useState, useEffect, useRef } from 'react';
import { Sparkles, CloudRain, Calendar, MapPin, Users, FileText, Check, ArrowRight, Zap, Wifi, Moon, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { startCheckout } from '../lib/payments';

const features = [
  { icon: CloudRain, title: 'Rain Delay Auto-Reschedule', desc: 'Rain tomorrow? One tap moves your whole schedule forward. Nobody else offers this on a free plan — Lawn.Best charges $49 for it.', color: 'from-emerald-500 to-green-500' },
  { icon: MapPin, title: 'Route Planning', desc: 'Optimized daily routes so you spend less time driving and more time mowing. Jobber locks this behind a $199/mo plan.', color: 'from-emerald-500 to-teal-500' },
  { icon: Users, title: 'Built for Lawn Crews', desc: 'Gate codes, pet instructions, mow height, chemical notes — fields you actually need. Generic apps like Jobber make you use "custom fields."', color: 'from-violet-500 to-purple-500' },
  { icon: FileText, title: 'One-Tap Invoicing', desc: 'Job done → tap invoice. Client pays via Stripe link. Track paid vs unpaid at a glance. No hidden processing fees like DoorstepHQ.', color: 'from-amber-500 to-orange-500' },
];

const differentiators = [
  { icon: Wifi, title: 'Works Offline', desc: 'Crews in rural areas with spotty cell service? MowFlow works without internet and syncs when you\'re back online. Yardbook only syncs GPS every 4 hours.' },
  { icon: Moon, title: 'Dark Mode Built In', desc: 'Early morning starts? Dark mode keeps the screen easy on your eyes at 6am. Most lawn care apps are still blinding white in 2026.' },
  { icon: Shield, title: 'No Data Selling', desc: 'Yardbook is "free" because they sell your customer data to advertisers. MowFlow never touches your data — you\'re the customer, not the product.' },
  { icon: Sparkles, title: 'Works Everywhere', desc: 'MowFlow runs on iPhone, Android, and desktop — no App Store download needed. LawnPro and Yardbook are stuck in a browser tab.', },
];

const plans = [
  { name: 'Free', price: '0', period: 'forever', desc: 'For solo operators just getting started', features: ['Up to 10 clients', 'Daily job scheduling', 'Rain delay auto-reschedule', 'Invoice tracking', 'Dark mode + installable PWA'], cta: 'Start Free', highlight: false },
  { name: 'Solo', price: '49', period: 'month', desc: 'For independent landscapers with a full schedule', features: ['Unlimited clients & jobs', 'Recurring job automation', 'GPS route navigation', 'Client notes, codes & pets', 'Offline mode', 'Online payments (Stripe)'], cta: 'Start Free Trial', highlight: true, coming: ['Online payments (Stripe)'] },
  { name: 'Crew', price: '79', period: 'month', desc: 'For small teams of 2-3 landscapers', features: ['Everything in Solo', 'Multi-user team access', 'Route optimization', 'Job assignment & tracking', 'Team progress dashboard', 'Priority support'], cta: 'Start Free Trial', highlight: false, coming: ['Multi-user team access', 'Route optimization'] },
];

const stats = [
  { value: '556K+', label: 'US lawn care businesses', suffix: 'and growing' },
  { value: '0', label: 'Competitors with free rain delay', suffix: '— we\'re the only one' },
  { value: '<1%', label: 'of your revenue', suffix: '— Solo plan costs less than one missed job' },
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
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-emerald-200/40 to-green-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-gradient-to-tr from-violet-200/30 to-purple-300/20 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-24 md:py-32 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Available on iPhone, Android & desktop
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              The only lawn care app with <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">free rain delay</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Built for 1–3 person crews. Rain delay, routes, invoicing — all from your phone. Jobber's usable plan runs $119+/mo. MowFlow starts free.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login" className="group inline-flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-gray-900/10 hover:shadow-2xl hover:shadow-gray-900/20 hover:-translate-y-0.5 transition-all duration-200">
                Try the Demo
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#pricing" className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                View Pricing
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Rain delay on free tier. No credit card required.</p>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">Built for lawn care, <span className="text-emerald-500">not office work</span></h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">Jobber and Housecall Pro are built for 20-person operations. Yardbook is "free" because they sell your data. We're different.</p>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-5 mb-20">
          {features.map(({ icon: Icon, title, desc, color }, i) => (
            <FadeIn key={title} delay={i * 100}>
              <div className="group card p-6 flex gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 cursor-default">
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

        {/* Differentiators */}
        <FadeIn>
          <h3 className="text-xl font-bold text-center text-gray-800 dark:text-gray-200 mb-10">Things our competitors won't tell you</h3>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-5">
          {differentiators.map(({ icon: Icon, title, desc }, i) => (
            <FadeIn key={title} delay={i * 100}>
              <div className="card p-5 flex gap-3">
                <Icon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{desc}</p>
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
              <div className="card p-6 text-center hover:border-emerald-200 dark:hover:border-emerald-800 transition-all">
                <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">{value}</div>
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
            <p className="text-center text-gray-500 dark:text-gray-400 mb-4 text-lg">Start free. Upgrade when you're ready. Cancel anytime.</p>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-14">Compare: Jobber's usable plan is $119+/mo plus $29 per extra user. Yardbook is "free" but sells your customer data.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 100}>
                <div className={`card p-6 flex flex-col transition-all duration-300 ${plan.highlight ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 scale-[1.02] relative' : 'hover:scale-[1.01]'}`}>
                  {plan.highlight && <div className="absolute -top-3 inset-x-0 flex justify-center"><span className="bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">Most Popular</span></div>}
                  <h3 className={`text-lg font-bold ${plan.highlight ? 'text-emerald-600 dark:text-emerald-400 mt-3' : 'text-gray-900 dark:text-white'}`}>{plan.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.desc}</p>
                  <div className="mt-5 mb-6">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{plan.price === '0' ? 'Free' : `$${plan.price}`}</span>
                    {plan.price !== '0' && <span className="text-gray-400 dark:text-gray-500 font-medium">/{plan.period}</span>}
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
                    <Link to="/login" className="mt-6 text-center py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">{plan.cta}</Link>
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
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-green-700" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Ready to stop losing track of jobs?</h2>
            <p className="text-emerald-100 text-lg mb-10">Get it on iPhone, Android, or use it on desktop. App Store coming soon.</p>
            <Link to="/login" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
              Try MowFlow Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-emerald-200/80 text-sm">Available on iPhone, Android, and desktop.</p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
            MowFlow &copy; 2026
          </div>
          <div className="flex gap-6 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">App</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Privacy</Link>
            <a href="mailto:hello@mowflow.app" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
