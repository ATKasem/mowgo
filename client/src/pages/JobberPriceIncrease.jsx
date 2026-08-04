import useLocalizedText from '../i18n/useLocalizedText';
import { Sprout, ArrowRight, Check, X, DollarSign, Users, CloudRain, Smartphone, Wifi, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';

const jobberPlans = [
  { name: 'Core', price: '39', desc: 'Basic scheduling and CRM', note: 'Limited features, no invoicing' },
  { name: 'Connect', price: '139', desc: 'Month-to-month ($99/mo annual)', note: '$29/mo per additional user' },
  { name: 'Grow', price: '349', desc: 'Advanced reporting, team management', note: 'Overkill for most small crews' },
];

const whatToLookFor = [
  { icon: DollarSign, title: 'No Per-User Fees', desc: 'Your pricing should not double just because you added a crew member.' },
  { icon: CloudRain, title: 'Rain Delay Auto-Reschedule', desc: 'One-tap rescheduling that actually moves your whole schedule. Not just a note field.' },
  { icon: Smartphone, title: 'Mobile-First Design', desc: 'Built for the truck, not the office. Fast, simple, works on any phone.' },
  { icon: Wifi, title: 'Offline Mode', desc: 'Spotty cell service in rural areas? Your app should keep working without internet.' },
  { icon: Gift, title: 'Free Tier That Is Actually Useful', desc: 'Start with real features for free. Not a 14-day trial that requires a credit card.' },
];

const comparisonRows = [
  { feature: 'Monthly price (solo operator)', mowgo: '$39/mo', jobber: '$139/mo (Connect)' },
  { feature: 'Per-user fees', mowgo: 'None', jobber: '$29/mo per additional user' },
  { feature: 'Free tier', mowgo: 'Yes — 5 clients, forever', jobber: '14-day trial only' },
  { feature: 'Rain delay auto-reschedule', mowgo: 'Yes — one tap', jobber: 'No built-in rain delay' },
  { feature: 'Offline mode', mowgo: 'Yes — works without cell service', jobber: 'Limited offline support' },
  { feature: 'Mobile-first design', mowgo: 'Yes — built for the truck', jobber: 'Desktop-first, mobile feels secondary' },
  { feature: 'One-tap invoicing', mowgo: 'Yes — automatic on job complete', jobber: 'Manual invoicing workflow' },
  { feature: 'Setup required', mowgo: 'None — start in 2 minutes', jobber: 'Sales call + onboarding' },
];

export default function JobberPriceIncrease() {
  const { tr, t, i18n } = useLocalizedText('jobberPriceIncrease');
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
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent dark:from-transparent to-gray-50 dark:to-gray-950 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <DollarSign className="w-4 h-4" />
            {tr("Pricing as of August 2026")}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
            {tr("Jobber's 2026 Price Increase: What a 1–3 Person Lawn Crew Pays")}
            <span className="block text-emerald-500 mt-2 text-2xl sm:text-3xl md:text-4xl">{tr("(And Better Alternatives)")}</span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {tr("Run a 1–3 person lawn crew? See Jobber's August 2026 price, the added-user math, and a lower-cost option.")}
          </p>
        </div>
      </section>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 py-12 space-y-16">

        {/* Section 1: The 2026 Pricing Changes */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            {tr("The 2026 Pricing Changes")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {tr("Pricing as of August 2026. Jobber Connect is $139/mo month-to-month or $99/mo with annual billing:")}
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {jobberPlans.map((plan) => (
              <div key={plan.name} className="card p-5 hover:border-amber-200 dark:hover:border-amber-800 transition-all">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{plan.name}</h3>
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white">${plan.price}</span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">{tr("/mo")}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{tr(plan.desc)}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">{tr(plan.note)}</p>
              </div>
            ))}
          </div>
          <div className="card p-5 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>{tr("The catch:")}</strong> {tr("Jobber Connect charges $29/mo for each additional user. A 3-person crew pays $197/month on month-to-month billing once two additional users are included.")}
            </p>
          </div>
        </section>

        {/* Section 2: Why It Matters for Small Crews */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            {tr("Why It Matters for Small Crews")}
          </h2>
          <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            <p>
              {tr("For a solo operator or 1–3 person crew, each added user raises the bill. Here is the math:")}
            </p>
            <div className="card p-5">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white min-w-[2rem]">1</span>
                  <span>{tr("A solo operator on Jobber Connect pays {{price}} for features they might not need (advanced reporting and team management). You're paying for a business you don't have yet.", { price: '$139/month' })}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white min-w-[2rem]">2</span>
                  <span>{tr("A 3-person crew on Jobber Connect pays a {{base}} base plus {{perUser}} for each of two additional users, totaling {{total}}. For a lawn care business earning {{revenue}} per month, that is a meaningful software expense.", { base: '$139', perUser: '$29/month', total: '$197/month', revenue: '$8–12K' })}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white min-w-[2rem]">3</span>
                  <span><strong className="text-gray-900 dark:text-white">{tr("Grow plan at $349/mo:")}</strong> {tr("That's over $4,000/year on software. Most small crews don't need advanced reporting dashboards — they need to know where to mow next and whether it's going to rain.")}</span>
                </li>
              </ul>
            </div>
            <p>
              {tr("If software costs squeeze your small crew, compare the monthly total before you renew. You have options.")}
            </p>
          </div>
        </section>

        {/* Section 3: What to Look For */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            {tr("What to Look for in an Alternative")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {tr("Check these four things before you move your crew to another app:")}
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

        {/* Section 4: Comparison Table */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            {tr("MowGo vs Jobber")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {tr("Compare MowGo Solo ($39/mo) with Jobber Connect ($139/mo) side by side:")}
          </p>
          <div className="overflow-x-auto">
            <div className="card overflow-hidden min-w-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">{tr("Feature")}</th>
                    <th className="text-center px-5 py-3 font-semibold bg-emerald-50 dark:bg-emerald-950/30">
                      <span className="text-emerald-600 dark:text-emerald-400">{tr("MowGo Solo")}</span>
                    </th>
                    <th className="text-center px-5 py-3 font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">{tr("Jobber Connect")}</th>
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
                          {row.jobber.includes('No') || row.jobber.includes('Limited') ? (
                            <X className="w-4 h-4 flex-shrink-0 text-gray-400" />
                          ) : null}
                          {row.jobber}
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
              {tr("MowGo Solo costs {{price}}, 72% less than Jobber Connect, with no per-user fees.", { price: '$39/month' })}
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
              {tr("Run 5 clients free with no credit card. Upgrade to Solo when you are ready — still less than a third of Jobber Connect.")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login?mode=signup" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 transition-all hover:shadow-xl hover:-translate-y-0.5">
                {tr("Start Free")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/compare" className="group inline-flex items-center gap-2 bg-white/10 text-white font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-white/20 transition-all hover:-translate-y-0.5">
                {tr("See Full Comparison")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <p className="mt-4 text-sm text-emerald-100/80">{tr("30-day Rain-Proof Guarantee on Solo. Cancel anytime.")}</p>
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
