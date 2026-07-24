import { useState, useEffect, useRef } from 'react';
import { Sprout, CloudRain, MapPin, Users, FileText, Check, X, ArrowRight, Zap, Wifi, Moon, Shield, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { startCheckout } from '../lib/payments';

const features = [
  { icon: CloudRain, title: 'Rain Delay Auto-Reschedule', desc: 'Rain tomorrow? One tap moves your whole schedule forward. Clients get notified automatically. The feature no other app has.', color: 'from-emerald-500 to-green-500' },
  { icon: MapPin, title: 'Route Planning', desc: 'Optimized daily routes so you spend less time driving and more time mowing. Your route builds itself every morning.', color: 'from-emerald-500 to-teal-500' },
  { icon: Users, title: 'Built for Lawn Crews', desc: 'Gate codes, pet instructions, mow height, chemical notes — the fields you actually use every day. Not generic "custom fields."', color: 'from-violet-500 to-purple-500' },
  { icon: FileText, title: 'One-Tap Invoicing', desc: 'Mark a job complete. Invoice sends automatically. Client pays via Stripe link. Track paid vs unpaid at a glance.', color: 'from-amber-500 to-orange-500' },
];

const differentiators = [
  { icon: Wifi, title: 'Works Offline', desc: 'Spotty cell service in rural areas? MowFlow keeps working without internet and syncs when you are back online.' },
  { icon: Moon, title: 'Dark Mode Built In', desc: 'Early mornings are hard enough. Dark mode keeps the screen easy on your eyes at 6am. Most lawn care apps are still blinding white.' },
  { icon: Shield, title: 'Your Data Is Yours', desc: 'Some "free" apps sell your customer data to advertisers. MowFlow never touches your data. You are the customer, not the product.' },
  { icon: Sprout, title: 'Works Everywhere', desc: 'iPhone, Android, desktop — installs to your home screen like a native app. No App Store download needed.', },
];

const plans = [
  { name: 'Free', price: '0', period: 'forever', desc: 'Try it with your first 5 clients', features: ['Up to 5 clients', 'Daily job scheduling', 'Rain delay auto-reschedule', 'Invoice tracking', 'Dark mode + installable PWA'], cta: 'Start Free', highlight: false },
  { name: 'Solo', price: '49', period: 'month', desc: 'For independent landscapers with a full schedule', features: ['Unlimited clients & jobs', 'Recurring job automation', 'GPS route navigation', 'Client notes, codes & pets', 'AI Autopilot — chat to your CRM', 'Offline mode'], cta: 'Start Free Trial', highlight: true },
  { name: 'Crew', price: '79', period: 'month', desc: 'For small teams of 2-3 landscapers', features: ['Everything in Solo', 'Job assignment & tracking', 'Team progress dashboard', 'Priority support'], cta: 'Start Free Trial', highlight: false },
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
  const [paymentError, setPaymentError] = useState('');

  async function handleStartCheckout(plan) {
    try {
      const r = await startCheckout(plan);
      if (r?.error) {
        setPaymentError(r.error);
        setTimeout(() => setPaymentError(''), 5000);
      }
    } catch (e) {
      setPaymentError(e.message || 'Payment failed');
      setTimeout(() => setPaymentError(''), 5000);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
      {/* Payment error toast */}
      {paymentError && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center pointer-events-none" style={{ animation: 'slideDown 0.3s ease-out' }}>
          <div className="card bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center gap-2 pointer-events-auto shadow-lg max-w-sm mx-4">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">{paymentError}</p>
          </div>
        </div>
      )}
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-bold text-lg no-underline">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            MowFlow
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/compare" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              Compare
            </Link>
            <Link to="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              Log In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-emerald-200/40 to-green-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-gradient-to-tr from-violet-200/30 to-purple-300/20 rounded-full blur-3xl" />
        {/* Fade to next section */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent dark:from-transparent to-gray-50 dark:to-gray-950 pointer-events-none" />
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
              Scheduling, routes, and invoicing that just works. No demos. No setup calls. Free for 5 clients — no credit card.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200">
                Start Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="group inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50 active:scale-[0.97] transition-all duration-200">View Pricing <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></button>
            </div>
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Rain delay on free tier. No credit card required.</p>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-4 tracking-tight">Built for lawn care, <span className="text-emerald-500">not office work</span></h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-14 max-w-xl mx-auto text-lg">The other apps are built for 20-person operations with office staff. MowFlow does less. That is the point.</p>
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
          <h3 className="text-xl font-bold text-center text-gray-800 dark:text-gray-200 mb-12">Things our competitors won't tell you</h3>
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

        {/* Comparison Callout */}
        <FadeIn delay={200}>
          <div className="mt-16 bg-gray-900 dark:bg-gray-800 rounded-2xl p-6 md:p-8 border border-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-bold text-white mb-1">How MowFlow Solo stacks up</h3>
            <p className="text-sm text-gray-400 mb-6">Same features, fraction of the price.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2.5 pr-4 text-gray-400 font-medium"></th>
                    <th className="text-center py-2.5 px-3">
                      <span className="text-emerald-400 font-bold">MowFlow Solo</span>
                      <span className="block text-xs text-gray-500 font-normal">$39/mo</span>
                    </th>
                    <th className="text-center py-2.5 px-3">
                      <span className="text-gray-300 font-semibold">Jobber Connect</span>
                      <span className="block text-xs text-gray-500 font-normal">$139/mo</span>
                    </th>
                    <th className="text-center py-2.5 pl-3">
                      <span className="text-gray-300 font-semibold">LawnPro</span>
                      <span className="block text-xs text-gray-500 font-normal">$39/mo</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <td className="py-2.5 pr-4 text-gray-400">Rain Delay</td>
                    <td className="text-center py-2.5 px-3"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="text-center py-2.5 px-3"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                    <td className="text-center py-2.5 pl-3"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2.5 pr-4 text-gray-400">Per-User Fees</td>
                    <td className="text-center py-2.5 px-3"><span className="text-emerald-400 font-medium">None</span></td>
                    <td className="text-center py-2.5 px-3"><span className="text-gray-500">$30/user</span></td>
                    <td className="text-center py-2.5 pl-3"><span className="text-gray-500">N/A</span></td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2.5 pr-4 text-gray-400">Offline Mode</td>
                    <td className="text-center py-2.5 px-3"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="text-center py-2.5 px-3"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="text-center py-2.5 pl-3"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-gray-400">Price</td>
                    <td className="text-center py-2.5 px-3"><span className="text-emerald-400 font-bold">$39/mo</span></td>
                    <td className="text-center py-2.5 px-3"><span className="text-gray-500 line-through">$139/mo</span></td>
                    <td className="text-center py-2.5 pl-3"><span className="text-gray-500">$39/mo</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">LawnPro is currently broken — no active mobile app or web dashboard. Jobber Connect charges $30/user/seat on top of $139.</p>
          </div>
        </FadeIn>
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
            <p className="text-center text-gray-500 dark:text-gray-400 mb-2 text-lg">Start free. Upgrade when you are ready. Cancel anytime.</p>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-2">Solo <strong>$39/mo</strong> — that's <strong>72% less</strong> than Jobber Connect at $139/mo. Same rain delay, better price.</p>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-14">14-day free trial on paid plans. No setup fees. No contracts.</p>
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
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                        <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.name === 'Free' ? (
                    <Link to="/login" className="group mt-6 text-center inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50 active:scale-[0.97] transition-all duration-200 min-h-[44px]">{plan.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></Link>
                  ) : (
                    <button onClick={() => handleStartCheckout(plan.name.toLowerCase())} className={`group mt-6 text-center inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm active:scale-[0.97] transition-all duration-200 min-h-[44px] ${plan.highlight ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 shadow-lg hover:shadow-xl hover:shadow-gray-900/25 dark:hover:shadow-white/20 hover:-translate-y-0.5' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50'}`}>{plan.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></button>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={400}>
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8">Coming later this summer: online payments via Stripe, multi-user team access, and route optimization. Early adopters get these at no price increase.</p>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-green-700" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Stop running your business on texts and a notebook</h2>
            <p className="text-emerald-100 text-lg mb-10">Free for 5 clients. No credit card. 2 minutes.</p>
            <Link to="/login" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
              Start Free
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
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"><Sprout className="w-3.5 h-3.5 text-white" /></div>
            MowFlow &copy; 2026
          </div>
          <div className="flex gap-2 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">App</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">Privacy</Link>
            <a href="mailto:hello@mowflow.app" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
