import { Sparkles, Calendar, MapPin, Users, FileText, Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  { icon: Calendar, title: 'Smart Scheduling', desc: 'Recurring jobs, drag-to-reschedule, color-coded calendar. Set it once, it runs forever.' },
  { icon: MapPin, title: 'Route Planning', desc: 'Optimized daily routes so you spend less time driving and more time cleaning.' },
  { icon: Users, title: 'Client Management', desc: 'Names, addresses, key codes, pet instructions — everything in one place.' },
  { icon: FileText, title: 'One-Tap Invoicing', desc: 'Job done → tap invoice. Client gets a text with a Stripe payment link.' },
];

const plans = [
  { name: 'Free', price: '0', period: 'forever', desc: 'For solo cleaners getting started', features: ['Up to 10 clients', 'Basic calendar', 'Route view (1 stop/day)', 'Manual invoicing'], cta: 'Start Free', highlight: false },
  { name: 'Solo', price: '39', period: 'month', desc: 'For independent cleaners with a full schedule', features: ['Unlimited clients', 'Full calendar + recurring jobs', 'Daily route optimization', 'One-tap invoicing + Stripe', 'Client notes + key codes', 'Email support'], cta: 'Start Trial', highlight: true },
  { name: 'Crew', price: '69', period: 'month', desc: 'For small teams of 2-3 cleaners', features: ['Everything in Solo', 'Multi-user team access', 'Job assignment + tracking', 'Team progress dashboard', 'Priority support', 'Coming: QuickBooks export'], cta: 'Start Trial', highlight: false },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-950 dark:to-sky-950 opacity-50" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Now on iOS & Android
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            Scheduling that actually works for cleaning crews
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            The only app built for 1-3 person cleaning teams. Schedule jobs, plan routes, invoice clients — all from your phone. No office staff required.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/app" className="btn-primary text-base px-8 py-3 gap-2 shadow-lg shadow-sky-200 dark:shadow-sky-900/30">
              Try the Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#pricing" className="btn-secondary text-base px-8 py-3">View Pricing</a>
          </div>
          <p className="mt-4 text-sm text-gray-400">Free forever plan. No credit card.</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">Everything you need, nothing you don't</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-xl mx-auto">Jobber is $169/month for a reason — it's built for 20-person crews. CleanFlow is built for you.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 dark:bg-gray-900 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12">Start free, upgrade when you're ready. Cancel anytime.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`card p-6 flex flex-col ${plan.highlight ? 'ring-2 ring-sky-500 dark:ring-sky-400 relative' : ''}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-500 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>
                )}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.desc}</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
                  <span className="text-gray-500 dark:text-gray-400">/{plan.period}</span>
                </div>
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/app" className={`mt-6 text-center py-2.5 rounded-xl font-semibold text-sm transition-all ${plan.highlight ? 'btn-primary w-full' : 'btn-secondary w-full'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Built for cleaners, by people who listen</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-10">We spent months talking to real cleaning crews in Oklahoma before writing a single line of code.</p>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {[
            { stat: '556K+', label: 'US cleaning businesses' },
            { stat: '$188B', label: 'Industry size' },
            { stat: '<1%', label: 'Revenue — our price' },
          ].map(({ stat, label }) => (
            <div key={label} className="card p-6">
              <div className="text-3xl font-bold text-sky-600 dark:text-sky-400">{stat}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-sky-500 to-blue-600 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to stop losing track of jobs?</h2>
          <p className="text-sky-100 mb-8">Join cleaning crews who've reclaimed 5+ hours a week.</p>
          <Link to="/app" className="inline-flex items-center gap-2 bg-white text-sky-600 font-bold rounded-xl px-8 py-3 text-base hover:bg-sky-50 transition-colors">
            Try CleanFlow Free <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-sky-200 text-sm">Available on iOS, Android, and web.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <Sparkles className="w-4 h-4" />
            CleanFlow &copy; 2026
          </div>
          <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/app" className="hover:text-gray-700 dark:hover:text-gray-300">App</Link>
            <a href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
