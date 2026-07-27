import useLocalizedText from '../i18n/useLocalizedText';
import { Sprout, ArrowRight, Check, X, DollarSign, Users, CloudRain, Smartphone, Wifi, Gift, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const whatToLookFor = [
  { icon: CloudRain, title: 'Rain Delay Auto-Reschedule', desc: 'One-tap rescheduling that actually moves your whole schedule. Not just a note field.' },
  { icon: Users, title: 'No Per-User Fees', desc: 'Your pricing should not double just because you added a crew member.' },
  { icon: Gift, title: 'Free Tier That Is Actually Useful', desc: 'Start with real features for free. Not a 14-day trial that requires a credit card.' },
  { icon: Smartphone, title: 'Mobile-First Design', desc: 'Built for the truck, not the office. Fast, simple, works on any phone.' },
  { icon: Wifi, title: 'Offline Mode', desc: 'Spotty cell service in rural areas? Your app should keep working without internet.' },
];

const comparisonRows = [
  { feature: 'Free tier', mowgo: 'Yes — 5 clients, forever', quoteiq: 'Discontinued (July 2026)' },
  { feature: 'Rain delay auto-reschedule', mowgo: 'Yes — one tap', quoteiq: 'Manual reschedule only' },
  { feature: 'Offline mode', mowgo: 'Yes — works without cell service', quoteiq: 'Not available' },
  { feature: 'Per-user fees', mowgo: 'None', quoteiq: 'Charges per user on paid plans' },
  { feature: 'Transaction fees', mowgo: 'None — you keep what you earn', quoteiq: 'Payment processing fees apply' },
  { feature: 'Drag-and-drop scheduling', mowgo: 'Yes — move jobs with one finger', quoteiq: 'Basic list-based scheduling' },
  { feature: 'Auto-invoicing', mowgo: 'Yes — automatic on job complete', quoteiq: 'Manual invoicing workflow' },
  { feature: 'Mobile-first design', mowgo: 'Yes — built for the truck', quoteiq: 'Desktop-oriented interface' },
];

export default function QuoteIQAlternative() {
  const { tr, t, i18n } = useLocalizedText('quoteIQAlternative');
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 selection:bg-emerald-200 dark:selection:bg-emerald-800">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-bold text-lg no-underline">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            MowGo
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {tr("Home")}
            </Link>
            <Link to="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {tr("Log In")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-emerald-200/40 to-green-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent dark:from-transparent to-gray-50 dark:to-gray-950 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <AlertTriangle className="w-4 h-4" />
            {tr("July 2026 Update")}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
            {tr("QuoteIQ Discontinued Free Plan? Here's a Better Alternative for Lawn Care Pros")}
          </h1>
          <p className="mt-6 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {tr("QuoteIQ just axed its free plan and displaced hundreds of lawn care pros. If you relied on QuoteIQ to run your business, here's what happened and what to look for next.")}
          </p>
        </div>
      </section>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 py-12 space-y-16">

        {/* Section 1: What Happened */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            {tr("What Happened to QuoteIQ's Free Plan?")}
          </h2>
          <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            <p>
              {tr("In July 2026, QuoteIQ announced it was")} <strong className="text-gray-900 dark:text-white">{tr("discontinuing its free plan")}</strong> {tr("entirely. If you were a small lawn care operator or solo mowing business using QuoteIQ's free tier to manage your clients and schedule, you were suddenly left scrambling for an alternative.")}
            </p>
            <p>
              {tr("The free plan had been QuoteIQ's biggest draw for small crews — a simple way to manage jobs without paying enterprise-level software fees. But the company decided to go all-in on paid plans, leaving the operators who built their workflow around the free tool out in the cold.")}
            </p>
            <div className="card p-5 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>{tr("The result:")}</strong> Hundreds of small lawn care businesses — many of them solo operators or crews of 1–3 people — lost the free tool they relied on daily. Some were pushed into paid plans they couldn't justify. Others had to export their data and start over somewhere else.
              </p>
            </div>
            <p>
              {tr("If that sounds familiar, you're not alone. And you don't have to settle for overpriced software just because QuoteIQ changed the rules. There are better options — and one of them is completely free.")}
            </p>
          </div>
        </section>

        {/* Section 2: What to Look For */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            {tr("What to Look for in a Replacement")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {tr("Not all lawn care apps are created equal. If QuoteIQ just burned you, don't rush into the first paid alternative. Here's what actually matters when you're looking for a replacement:")}
          </p>
          <div className="space-y-4">
            {whatToLookFor.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="card p-5 flex gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{tr(title)}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{tr(desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Feature Comparison Table */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            {tr("MowGo vs QuoteIQ")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {tr("Here's how MowGo stacks up against what QuoteIQ used to offer — and where it falls short now that the free plan is gone:")}
          </p>
          <div className="overflow-x-auto">
            <div className="card overflow-hidden min-w-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">{tr("Feature")}</th>
                    <th className="text-center px-5 py-3 font-semibold bg-emerald-50 dark:bg-emerald-950/30">
                      <span className="text-emerald-600 dark:text-emerald-400">{tr("MowGo")}</span>
                    </th>
                    <th className="text-center px-5 py-3 font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">{tr("QuoteIQ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.feature} className={`border-b border-gray-50 dark:border-gray-800/50 ${i % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/50'}`}>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{tr(row.feature)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check className="w-4 h-4 flex-shrink-0" />
                          {row.mowgo}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          {row.quoteiq.includes('Discontinued') || row.quoteiq.includes('Not') || row.quoteiq.includes('Manual') || row.quoteiq.includes('Basic') || row.quoteiq.includes('Charges') ? (
                            <X className="w-4 h-4 flex-shrink-0 text-gray-400" />
                          ) : null}
                          {row.quoteiq}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("MowGo is")} <strong className="text-emerald-600 dark:text-emerald-400">{tr("free for real use")}</strong> {tr("— with 5 clients on the forever-free plan. No credit card, no catch.")}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-green-700" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="relative px-8 py-12 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4 tracking-tight">{tr("Try MowGo Free")}</h2>
            <p className="text-emerald-100 mb-8 max-w-md mx-auto leading-relaxed">
              {tr("Start with 5 clients on the free plan — no credit card required. MowGo was built for lawn care pros like you: mobile-first, rain delay auto-reschedule, and zero per-user fees.")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
                {tr("Start Free")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/compare" className="group inline-flex items-center gap-2 bg-white/10 text-white font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-white/20 transition-all hover:-translate-y-0.5">
                {tr("See Full Comparison")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      </article>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"><Sprout className="w-3.5 h-3.5 text-white" /></div>
            MowGo &copy; 2026
          </div>
          <div className="flex gap-6 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Home")}</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Privacy")}</Link>
            <a href="mailto:hello@mowgo.app" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{tr("Contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
