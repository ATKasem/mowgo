import useLocalizedText from '../i18n/useLocalizedText';
import usePageTitle from '../hooks/usePageTitle';
import { useState, useEffect, useRef } from 'react';
import { CloudRain, MapPin, Users, FileText, Check, X, ArrowRight, Zap, Wifi, DollarSign, Shield, AlertCircle, ChevronDown } from 'lucide-react';
import Logo from '../components/Logo';
import { Link, useNavigate } from 'react-router-dom';
import { startCheckout } from '../lib/payments';
import { supabase } from '../lib/supabase';

const features = [
  { icon: CloudRain, title: 'Rain Delay One-Tap Move', desc: 'Oklahoma spring storms? One tap moves every job to the next dry day. Clients are notified automatically. No phone calls, no rescheduling chaos.', color: 'from-emerald-500 to-green-500' },
  { icon: MapPin, title: 'Route Optimization', desc: 'Your crew spends less time on I-35 and more time mowing. MowGo plans the day\'s route so you hit more jobs per gallon.', color: 'from-emerald-500 to-teal-500' },
  { icon: Users, title: 'Built for Real Crews', desc: 'Gate codes, pet instructions, mow height, Bermuda vs fescue notes — the fields Oklahoma crews actually use. Not a generic CRM.', color: 'from-violet-500 to-purple-500' },
  { icon: FileText, title: 'One-Tap Invoicing', desc: 'Mark a job complete, invoice is created automatically. One tap copies a payment text to the client. No processing fees. Venmo, Zelle, or Cash App.', color: 'from-amber-500 to-orange-500' },
];

const differentiators = [
  { icon: Wifi, title: 'Works Offline', desc: 'Spotty cell service in rural Oklahoma? MowGo keeps working without internet and syncs when you are back in range.' },
  { icon: DollarSign, title: 'No Per-User Fees', desc: 'Jobber charges $29/mo per extra crew member. MowGo charges once — your whole crew is included.' },
  { icon: Shield, title: 'Built in OKC, Not Silicon Valley', desc: 'We are not a VC-funded startup in California guessing what Oklahoma crews need. We talk to local operators every week.' },
  { icon: Users, title: 'Works Everywhere', desc: 'iPhone, Android, desktop — installs to your home screen like a native app. No App Store download needed.', },
];

const plans = [
  { name: 'Free', price: '0', period: 'forever', desc: 'Try it with your first 5 clients', features: ['Up to 5 clients', 'Daily job scheduling', 'Rain delay suggestions with owner confirmation', 'Invoice tracking', 'Dark mode + installable PWA'], cta: 'Start Free', highlight: false },
  {
    name: 'Solo',
    price: '39',
    annualPrice: '390',
    period: 'month',
    desc: 'For independent landscapers with a full schedule',
    features: ['Unlimited clients & jobs', 'Recurring job automation', 'GPS route navigation', 'Client notes, codes & pets', 'Offline mode'],
    bonuses: [
      { text: 'We import your clients and prepare your first operating week within 48 hours.', value: '$150 value' },
      { text: '"What to Charge in Your City" report: real mow prices from your market.', value: '$49 value' },
      { text: 'Template pack: 15 ready-to-send scripts — invoices, reminders, price raises, no-show follow-ups.', value: '$79 value' },
    ],
    scarcity: 'Setup is limited to 20 new businesses per week — estimated wait ~3 days.',
    cta: 'Start Free Trial',
    highlight: true,
  },
  { name: 'Crew', price: '79', annualPrice: '790', period: 'month', desc: 'For 2-3 person crews', features: ['Everything in Solo', 'Job assignment & tracking', 'Team progress dashboard'], cta: 'Start Free Trial', highlight: false },
  {
    name: 'Premium',
    price: '199',
    annualPrice: '1990',
    period: 'month',
    desc: 'Everything in Crew',
    features: [
      'Everything in Crew',
      'Premium concierge priority — your request moves to the front of the setup queue',
    ],
    cta: 'Start Premium',
    highlight: false,
  },
];

const stats = [
  { value: '556k+', label: 'Landscaping businesses in the US', suffix: 'IBISWorld, 2026' },
  { value: '0', label: 'per-user fees on any plan', suffix: 'Solo is $39 flat. Crew is $79 flat. Premium is $199 flat.' },
  { value: '<1%', label: 'of your revenue', suffix: 'Solo costs less than one missed job. Solo is $39/mo — under 1% for any crew billing over $3,900/mo.' },
];

// Testimonials are fetched from the approved queue (users submit in-app at the 10th job).
// Section stays hidden until real approved quotes exist — never fabricate proof.

const faqs = [
  { q: 'Is it really free?', a: 'Free for your first 5 clients, forever. No credit card. Rain delay, scheduling, and invoicing included.' },
  { q: 'What happens if I want to switch from Jobber or LawnPro?', a: 'On eligible paid plans, we import your clients and prepare your first operating week within 48 hours.' },
  { q: 'Does it work without cell service?', a: 'Yes. Offline mode keeps working in rural Oklahoma and syncs when you are back in range.' },
  { q: "What's the catch?", a: "No catch. Cancel anytime. 14-day free trial. 30-day money-back guarantee. If Solo does not make you more organized in 30 days, we refund your first month in full." },
  { q: 'Why should I pay yearly?', a: 'Two months free ($78 off Solo, $158 off Crew) and one payment covers the whole season — no card hits in winter. The Rain-Proof Guarantee still applies: unused months are refunded.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data stays yours, always. Export it anytime. If you cancel, we delete your data on request.' },
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
  const { tr, t, i18n } = useLocalizedText('landing');
  const navigate = useNavigate();
  const [paymentError, setPaymentError] = useState('');
  const [billingInterval, setBillingInterval] = useState('year');
  const [kitOpen, setKitOpen] = useState(false);
  const [testimonials, setTestimonials] = useState([]);
  const errorTimerRef = useRef(null);
  const checkoutPendingRef = useRef(false);
  usePageTitle(tr('seo.title'), tr('seo.description'));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('testimonials')
          .select('quote, name, role')
          .eq('approved', true)
          .order('created_at', { ascending: false })
          .limit(6);
        if (!cancelled && Array.isArray(data)) setTestimonials(data);
      } catch (e) {
        // No proof section is fine — never render fabricated quotes
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, []);

  async function handleStartCheckout(plan, interval = 'month') {
    if (checkoutPendingRef.current) return;
    checkoutPendingRef.current = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        localStorage.setItem('mowgo_plan_intent', plan);
        localStorage.setItem('mowgo_interval_intent', interval);
        localStorage.setItem('mowgo_intent_time', String(Date.now()));
        navigate(`/login?mode=signup&plan=${plan}&interval=${interval}`);
        return;
      }
      const r = await startCheckout(plan, interval);
      if (r?.error) {
        setPaymentError(r.error);
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setPaymentError(''), 5000);
      }
    } catch (e) {
      setPaymentError(e.message || tr('Payment failed'));
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setPaymentError(''), 5000);
    } finally {
      checkoutPendingRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
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
      <nav className="sticky top-0 z-50 bg-[var(--color-surface)]/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-[var(--color-text-primary)] dark:text-white font-bold text-lg no-underline">
            <Logo size="sm" />
            MowGo
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/compare" className="text-sm font-medium text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] hover:text-brand-hover dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-[var(--color-surface-secondary)] dark:hover:bg-gray-800 min-h-[44px]">
              {tr("Compare")}
            </Link>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-medium text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] hover:text-brand-hover dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-[var(--color-surface-secondary)] dark:hover:bg-gray-800 min-h-[44px]">
              {tr("Pricing")}
            </button>
            <Link to="/login" className="text-sm font-semibold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] hover:text-brand-hover dark:hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-[var(--color-surface-secondary)] dark:hover:bg-gray-800 min-h-[44px]">
              {tr("Log In")}
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
              {tr("Built in Oklahoma City, for crews everywhere")}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-[var(--color-text-primary)] dark:text-white tracking-tight leading-[1.1]">
              {tr("Stop losing jobs to scheduling chaos.")} <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">{tr("MowGo handles the routing, invoicing, and rain delays so you don't have to.")}</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
              {tr("One missed job costs more than a month of MowGo. Oklahoma crews use it to schedule smarter, route faster, and get paid — without an office manager.")}
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200">
                {tr("Start Free — No Credit Card")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="group inline-flex items-center gap-2 bg-[var(--color-surface-secondary)] dark:bg-gray-800 text-[var(--color-text-primary)] dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-[var(--color-surface-hover)] dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50 active:scale-[0.97] transition-all duration-200">{tr("See Plans & Pricing")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></button>
            </div>
            <p className="mt-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr("Free for 5 clients. No credit card. 2 minutes to start.")}</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <Shield className="w-4 h-4" />
              <span>{tr("30-Day Rain-Proof Guarantee. Cancel anytime. Full refund.")}</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Product Screenshot */}
      <section className="max-w-4xl mx-auto px-4 -mt-8">
        <FadeIn>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <img src="/landing/dashboard.png" alt={tr("MowGo dashboard screenshot")} className="w-full h-auto" loading="eager" />
          </div>
          <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">{tr("See every job for the week in one place.")}</p>
        </FadeIn>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] dark:text-white mb-4 tracking-tight">{tr("Built for Oklahoma crews,")} <span className="text-brand">{tr("not office managers")}</span></h2>
          <p className="text-center text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mb-14 max-w-xl mx-auto text-lg">{tr("Other apps were built in Silicon Valley for 20-person operations. MowGo was built by a lawn care operator who runs crews — for crews like yours.")}</p>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-5 mb-20">
          {features.map(({ icon: Icon, title, desc, color, soon }, i) => (
            <FadeIn key={title} delay={i * 100}>
              <div className="group card p-6 flex gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 cursor-default">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white">{tr(title)}{soon && <span className="ml-2 inline-block bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">{tr("Coming soon")}</span>}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-1 leading-relaxed">{tr(desc)}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Differentiators */}
        <FadeIn>
          <h3 className="text-xl font-bold text-center text-[var(--color-text-primary)] dark:text-gray-200 mb-12">{tr("Things our competitors won't tell you")}</h3>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-5">
          {differentiators.map(({ icon: Icon, title, desc }, i) => (
            <FadeIn key={title} delay={i * 100}>
              <div className="card p-5 flex gap-3">
                <Icon className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-[var(--color-text-primary)] dark:text-white">{tr(title)}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-1 leading-relaxed">{tr(desc)}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Rain-Proof Guarantee */}
        <FadeIn delay={200}>
          <div className="mt-16 bg-gray-900 dark:bg-gray-800 rounded-2xl p-6 md:p-8 border border-gray-800 dark:border-gray-700 text-center">
            <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-2">{tr('The Rain-Proof Guarantee')}</h3>
            <p className="text-sm text-gray-300 max-w-2xl mx-auto mb-4">{tr("We built MowGo for crews like yours. Use Solo for 30 days, send 10 invoices, and schedule 5 recurring clients. If you don't feel more organized, we refund your first month in full. No questions, no hoops. Your data stays yours, always.")}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{tr('Applies to Solo. No setup fees. No contracts. Cancel anytime.')}{billingInterval === 'year' && <span> {tr("Annual? Unused months refunded.")}</span>}</p>
          </div>
        </FadeIn>

        {/* Comparison Callout */}
        <FadeIn delay={200}>
          <div className="mt-16 bg-gray-900 dark:bg-gray-800 rounded-2xl p-6 md:p-8 border border-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-bold text-white mb-1">{tr("How MowGo Solo stacks up")}</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">{tr("See what $39/mo gets your crew.")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2.5 pr-4 text-[var(--color-text-muted)] font-medium"></th>
                    <th className="text-center py-2.5 px-3">
                      <span className="text-emerald-400 font-bold">{tr("MowGo Solo")}</span>
                      <span className="block text-xs text-[var(--color-text-secondary)] font-normal">{tr("$39/mo")}</span>
                    </th>
                    <th className="text-center py-2.5 px-3">
                      <span className="text-gray-300 font-semibold">{tr("Jobber Grow")}</span>
                      <span className="block text-xs text-[var(--color-text-secondary)] font-normal">{tr("$139/mo")}</span>
                    </th>
                    <th className="text-center py-2.5 pl-3">
                      <span className="text-gray-300 font-semibold">{tr("LawnPro")}</span>
                      <span className="block text-xs text-[var(--color-text-secondary)] font-normal">{tr("$39/mo")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{tr("Rain Delay")}</td>
                    <td className="text-center py-2.5 px-3"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="text-center py-2.5 px-3"><X className="w-4 h-4 text-[var(--color-text-secondary)] mx-auto" /></td>
                    <td className="text-center py-2.5 pl-3"><X className="w-4 h-4 text-[var(--color-text-secondary)] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{tr("Per-User Fees")}</td>
                    <td className="text-center py-2.5 px-3"><span className="text-emerald-400 font-medium">{tr("None")}</span></td>
                    <td className="text-center py-2.5 px-3"><span className="text-[var(--color-text-secondary)]">{tr("$29 per additional user")}</span></td>
                    <td className="text-center py-2.5 pl-3"><span className="text-[var(--color-text-secondary)]">{tr("N/A")}</span></td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{tr("Offline Mode")}</td>
                    <td className="text-center py-2.5 px-3"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="text-center py-2.5 px-3"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="text-center py-2.5 pl-3"><X className="w-4 h-4 text-[var(--color-text-secondary)] mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{tr("Price")}</td>
                    <td className="text-center py-2.5 px-3"><span className="text-emerald-400 font-bold">{tr("$39/mo")}</span></td>
                    <td className="text-center py-2.5 px-3"><span className="text-[var(--color-text-secondary)] line-through">{tr("$139/mo")}</span></td>
                    <td className="text-center py-2.5 pl-3"><span className="text-[var(--color-text-secondary)]">{tr("$39/mo")}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-4 text-center">{tr("Jobber Grow is $139/mo ($99/mo billed annually) plus $29/mo per additional user. LawnPro's apps are live, but they don't offer rain delay, offline mode, or dark mode.")}</p>
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
                <div className="text-sm font-medium text-[var(--color-text-primary)] dark:text-gray-300 mt-1">{tr(label)}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{tr(suffix)}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Testimonials (hidden until real quotes exist) */}
      {testimonials.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-24">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] dark:text-white mb-14 tracking-tight">{tr("Operators on MowGo")}</h2>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="card p-6 h-full flex flex-col">
                  <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] flex-1 leading-relaxed">"{t.quote}"</p>
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text-primary)] dark:text-white">{t.name || tr('MowGo operator')}</p>
                  {t.role && <p className="text-xs text-[var(--color-text-muted)]">{t.role}</p>}
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      )}

      {/* Pricing */}
      <section id="pricing" className="bg-[var(--color-surface-bg)] dark:bg-gray-900 py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] dark:text-white mb-4 tracking-tight">{tr("Know what you pay every month")}</h2>
            <p className="text-center text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mb-2 text-lg">{tr("Start free. Pay only when your client list grows. Cancel anytime.")}</p>
            <p className="text-center text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mb-2">{tr("Solo costs {{price}} and is built for crews who don't need a {{competitorPrice}} enterprise system.", { price: '$39/month', competitorPrice: '$200+/month' })}</p>
            <p className="text-center text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mb-14">{tr("14-day free trial on paid plans. No setup fees. No contracts.")}</p>
          </FadeIn>
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center rounded-xl bg-[var(--color-surface-secondary)] dark:bg-gray-800 p-1 gap-1">
              <button
                onClick={() => setBillingInterval('year')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${billingInterval === 'year' ? 'bg-brand text-white shadow' : 'text-[var(--color-text-secondary)] dark:text-gray-300 hover:text-[var(--color-text-primary)]'}`}
              >
                {tr("Annual")} <span className={`ml-1 text-[11px] font-bold ${billingInterval === 'year' ? 'text-white/90' : 'text-brand'}`}>{tr("2 months free")}</span>
              </button>
              <button
                onClick={() => setBillingInterval('month')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${billingInterval === 'month' ? 'bg-brand text-white shadow' : 'text-[var(--color-text-secondary)] dark:text-gray-300 hover:text-[var(--color-text-primary)]'}`}
              >
                {tr("Monthly")}
              </button>
            </div>
          </div>
          {billingInterval === 'year' && (
            <p className="text-center text-sm font-medium text-brand dark:text-emerald-400 mb-6 -mt-2">{tr("One payment covers the whole season. No card hits in winter.")}</p>
          )}
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 100}>
                <div className={`card p-6 flex flex-col h-full transition-all duration-300 ${plan.highlight ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 scale-[1.02] relative' : 'hover:scale-[1.01]'}`}>
                  {plan.highlight && <div className="absolute -top-3 inset-x-0 flex justify-center"><span className="bg-brand text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">{tr("Most Popular")}</span></div>}
                  <h3 className={`text-lg font-bold ${plan.highlight ? 'text-brand-hover dark:text-emerald-400 mt-3' : 'text-[var(--color-text-primary)] dark:text-white'}`}>{plan.name}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-1">{tr(plan.desc)}</p>
                  <div className="mt-5 mb-6 min-h-[72px]">
                    <span className="text-4xl font-extrabold text-[var(--color-text-primary)] dark:text-white">{plan.price === '0' ? tr('Free') : `$${billingInterval === 'year' && plan.annualPrice ? plan.annualPrice : plan.price}`}</span>
                    {plan.price !== '0' && <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] font-medium">/{tr(billingInterval === 'year' && plan.annualPrice ? 'year' : plan.period)}</span>}
                    {billingInterval === 'year' && plan.annualPrice && plan.price !== '0' && (
                      <span className="ml-2 inline-block align-middle text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2 py-0.5">{tr('Save ${{savings}}', { savings: String(Number(plan.price) * 12 - Number(plan.annualPrice)) })}</span>
                    )}
                    {billingInterval === 'year' && plan.price !== '0' && (
                      <p className="text-[11px] text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-1.5">{tr("Billed once a year. Cancel anytime.")}</p>
                    )}
                  </div>
                  <ul className="space-y-3 flex-1 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">
                        <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand" />
                        <span>{tr(f)}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.highlight && (
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
                      <button
                        type="button"
                        onClick={() => setKitOpen(!kitOpen)}
                        aria-expanded={kitOpen}
                        aria-controls="launch-kit-panel"
                        className="w-full flex items-center justify-between gap-2 text-left min-h-[44px]"
                      >
                        <span className="text-sm font-bold uppercase tracking-wide text-brand">{tr('Free Launch Kit — $278 value, included with Solo')}</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${kitOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {kitOpen && (
                        <div id="launch-kit-panel" className="mt-3 space-y-3">
                          {plan.bonuses.map(bonus => (
                            <div key={bonus.text} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-brand" />
                              <span className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] flex-1">{tr(bonus.text)}</span>
                              <span className="text-xs font-semibold text-brand bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2 py-0.5 whitespace-nowrap">{tr(bonus.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {plan.highlight && (
                    <p className="mt-4 flex items-start gap-2 text-xs font-semibold text-[var(--color-text-primary)] dark:text-gray-200">
                      <Shield className="w-4 h-4 flex-shrink-0 text-brand" />
                      <span>{tr("30-day Rain-Proof Guarantee — refund if you're not more organized.")}{billingInterval === 'year' && plan.annualPrice ? ` ${tr("Annual? Unused months refunded.")}` : ''}</span>
                    </p>
                  )}
                  {plan.name === 'Free' ? (
                    <Link to="/login?mode=signup" className="group mt-6 text-center inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-[var(--color-surface-secondary)] dark:bg-gray-800 text-[var(--color-text-primary)] dark:text-gray-300 hover:bg-[var(--color-surface-hover)] dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50 active:scale-[0.97] transition-all duration-200 min-h-[44px]">{tr(plan.cta)} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></Link>
                  ) : (
                    <button onClick={() => handleStartCheckout(plan.name.toLowerCase(), billingInterval)} className={`group mt-6 text-center inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm active:scale-[0.97] transition-all duration-200 min-h-[44px] ${plan.highlight ? 'bg-gray-900 dark:bg-[var(--color-surface)] text-white dark:text-[var(--color-text-primary)] hover:bg-gray-800 dark:hover:bg-[var(--color-surface-secondary)] shadow-lg hover:shadow-xl hover:shadow-gray-900/25 dark:hover:shadow-white/20 hover:-translate-y-0.5' : 'bg-[var(--color-surface-secondary)] dark:bg-gray-800 text-[var(--color-text-primary)] dark:text-gray-300 hover:bg-[var(--color-surface-hover)] dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-200 dark:hover:shadow-gray-800/50'}`}>{tr(plan.cta)} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></button>
                  )}
                  {plan.highlight && <p className="text-[11px] text-[var(--color-text-muted)] mt-2 text-center">{tr(plan.scarcity)}</p>}
                  {plan.name === 'Crew' && <p className="text-[11px] text-[var(--color-text-muted)] mt-2 text-center">{tr("14-day free trial. Cancel anytime.")}</p>}
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={400}>
            <p className="text-center text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-8">{tr("Route optimization is live — included on Solo, Crew, and Premium.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 py-20">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] dark:text-white mb-12 tracking-tight">{tr("Questions, answered straight")}</h2>
        </FadeIn>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <FadeIn key={f.q} delay={i * 75}>
              <details className="group card p-5">
                <summary className="flex items-center justify-between gap-4 cursor-pointer text-[var(--color-text-primary)] dark:text-white font-semibold min-h-[44px] list-none [&::-webkit-details-marker]:hidden">
                  {tr(f.q)}
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] leading-relaxed">{tr(f.a)}</p>
              </details>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-green-700" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-surface)]/10 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">{tr("Run your next 5 clients free.")}</h2>
            <p className="text-emerald-100 text-lg mb-10">{tr("Free for 5 clients. No credit card. 2 minutes.")}</p>
            <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-[var(--color-surface)] text-brand-hover font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
              {tr("Start Free")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-emerald-200/80 text-sm">{tr("Works on iPhone, Android, and desktop as an installable home-screen app (PWA).")}</p>
            <p className="mt-2 text-emerald-100/80 text-sm">{tr("30-day Rain-Proof Guarantee on Solo. Cancel anytime.")}</p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-surface-bg)] dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] text-sm">
            <Logo size="xs" />
            MowGo &copy; 2026
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">
            <Link to="/compare" className="hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Compare")}</Link>
            <Link to="/blog/jobber-price-increase-2026" className="hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Jobber pricing")}</Link>
            <Link to="/switch-from-lawnpro" className="hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("LawnPro alternative")}</Link>
            <Link to="/quoteiq-alternative" className="hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("QuoteIQ alternative")}</Link>
            <Link to="/login" className="hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Log In")}</Link>
            <Link to="/privacy" className="hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Privacy")}</Link>
            <a href="mailto:hello@mowgoapp.com" className="hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300 transition-colors py-2 px-2 rounded-lg">{tr("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
