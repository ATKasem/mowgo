import { Link } from 'react-router-dom';
import { Check, X, CloudRain, Wifi, Shield, Zap, Sprout, ArrowRight } from 'lucide-react';

const competitors = [
  { name: 'MowFlow', price: 'Free – $49', highlight: true },
  { name: 'Jobber', price: '$119+/mo' },
  { name: 'Yardbook', price: 'Free (ads)' },
  { name: 'LawnPro', price: '$39/mo' },
  { name: 'Housecall Pro', price: '$79–$189' },
  { name: 'GreenRoute', price: '$29–$59' },
  { name: 'LawnBoss', price: 'New / TBD' },
];

const features = [
  { label: 'Rain Delay', key: 'rainDelay', desc: 'One-tap reschedule when rain hits', star: true },
  { label: 'Offline Mode', key: 'offline', desc: 'Works without cell service, syncs later' },
  { label: 'Dark Mode', key: 'darkMode', desc: 'Built-in — not a browser hack' },
  { label: 'Free Tier', key: 'freeTier', desc: 'Full features, 10 clients, no card' },
  { label: 'Drag & Drop Route', key: 'dragDrop', desc: 'Reorder your day by dragging' },
  { label: 'Auto Invoicing', key: 'invoicing', desc: 'Invoice auto-created on job complete' },
  { label: 'Client Notes & Codes', key: 'notes', desc: 'Gate codes, pets, mow height' },
  { label: 'Recurring Jobs', key: 'recurring', desc: 'Weekly/biweekly/monthly auto-schedule' },
  { label: 'No Data Selling', key: 'privacy', desc: 'Your customer data stays yours' },
  { label: 'iOS + Android PWA', key: 'pwa', desc: 'Install to home screen, no App Store' },
  { label: 'Stripe Payments', key: 'stripe', desc: 'Accept cards online' },
  { label: 'GPS Navigation', key: 'gps', desc: 'Tap to navigate to client' },
];

// ✅ = confirmed, ❌ = not available, ⚠️ = partial/limited, 🔜 = coming soon
const data = {
  rainDelay:    [ true,  false, false, false, false, false, false ],
  offline:      [ true,  true,  false, false, true,  true,  false ],
  darkMode:     [ true,  false, false, false, false, false, false ],
  freeTier:     [ true,  false, true,  false, false, false, false ],
  dragDrop:     [ true,  true,  false, false, true,  false, false ],
  invoicing:    [ true,  true,  true,  true,  true,  false, false ],
  notes:        [ true,  true,  true,  true,  true,  false, false ],
  recurring:    [ true,  true,  true,  true,  true,  false, false ],
  privacy:      [ true,  false, false, true,  true,  true,  false ],
  pwa:          [ true,  true,  false, false, true,  false, false ],
  stripe:       [ 'soon', true,  false, true,  true,  false, false ],
  gps:          [ true,  true,  false, true,  true,  true,  false ],
};

function Cell({ value, isFirst }) {
  if (value === true) return <td className={`text-center py-2.5 px-2 ${isFirst ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}><Check className="w-4 h-4 text-emerald-500 mx-auto" /></td>;
  if (value === false) return <td className={`text-center py-2.5 px-2 ${isFirst ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}><X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" /></td>;
  if (value === 'soon') return <td className={`text-center py-2.5 px-2 ${isFirst ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}><span className="text-[10px] font-semibold uppercase text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">Soon</span></td>;
  return <td className={`text-center py-2.5 px-2 ${isFirst ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}><span className="text-xs text-gray-400">{value}</span></td>;
}

export default function Compare() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" /> The honest comparison
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-4">
            MowFlow vs <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">Everyone</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            We built MowFlow because the other options are either too expensive, too complicated, or sell your data.
            Here's how we compare — no fluff, no asterisks.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              Try MowFlow Free <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#comparison" className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
              See the table
            </a>
          </div>
        </div>
      </section>

      {/* Standout features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-5 mb-16">
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CloudRain className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Only app with rain delay</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Rain tomorrow? One tap moves your whole day. No competitor has this. Zero.</p>
          </div>
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/20">
              <Wifi className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Offline mode that works</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Rural routes with spotty cell service? MowFlow keeps going. GreenRoute charges extra for this.</p>
          </div>
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Your data is yours</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Yardbook is "free" because they sell your customer list. We never touch your data.</p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="comparison" className="max-w-5xl mx-auto px-4 pb-24">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-3">Feature comparison</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10">Updated July 2026. Based on public pricing pages and hands-on testing.</p>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-950 z-10">Feature</th>
                {competitors.map(c => (
                  <th key={c.name} className={`py-3 px-2 text-center font-semibold whitespace-nowrap ${c.highlight ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-gray-600 dark:text-gray-400'}`}>
                    <div>{c.name}</div>
                    <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-0.5">{c.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.key} className={`border-b border-gray-100 dark:border-gray-800/50 ${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''}`}>
                  <td className="py-3 px-3 sticky left-0 bg-inherit">
                    <div className="flex items-center gap-2">
                      {f.star && <span className="text-[10px] font-bold uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">⭐</span>}
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{f.label}</span>
                        <span className="hidden md:inline text-xs text-gray-400 dark:text-gray-500 ml-1.5">— {f.desc}</span>
                      </div>
                    </div>
                  </td>
                  {data[f.key].map((v, j) => <Cell key={j} value={v} isFirst={j === 0} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            Think something's wrong? <a href="mailto:hello@mowflow.app" className="text-emerald-500 hover:underline">Tell us</a> and we'll fix it. We're not afraid of the truth.
          </p>
          <Link to="/login" className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
            Try MowFlow Free <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-br from-emerald-500 via-green-600 to-green-700 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">The only lawn care app with free rain delay.</h2>
          <p className="text-emerald-100 text-lg mb-8">0 competitors. 0 asterisks. Just a better way to run your crew.</p>
          <Link to="/login" className="group inline-flex items-center gap-2 bg-white text-emerald-600 font-bold rounded-xl px-8 py-3.5 text-base hover:bg-emerald-50 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200">
            Start Free <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-3.5 h-3.5 text-white" />
            </div>
            MowFlow © 2026
          </div>
          <div className="flex gap-6 text-sm text-gray-400 dark:text-gray-500">
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-300">App</Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300">Privacy</Link>
            <a href="mailto:hello@mowflow.app" className="hover:text-gray-600 dark:hover:text-gray-300">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
