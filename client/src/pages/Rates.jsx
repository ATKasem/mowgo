import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, MapPin } from 'lucide-react';
import Logo from '../components/Logo';
import usePageTitle from '../hooks/usePageTitle';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keep in sync with functions/api/rates.js CITY_PRICES — same 10 OK cities,
// same figures. Two separate runtimes (SPA bundle vs CF function) so this
// can't be a shared import; the email server-side is the source of truth.
const CITY_PRICES = [
  ['Broken Arrow', '$67.08'],
  ['Claremore', '$65.13'],
  ['Yukon', '$59.36'],
  ['Edmond', '$58.02'],
  ['Tulsa', '$56.93'],
  ['Oklahoma City', '$54.73'],
  ['Norman', '$52.89'],
  ['Guthrie', '$51.22'],
  ['Chickasha', '$50.82'],
  ['Bethany', '$48.01'],
];
const CITY_NAMES = CITY_PRICES.map(([city]) => city);
const STATE_AVERAGE = '$55.25';

export default function Rates() {
  const [form, setForm] = useState({ email: '', city: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [serverError, setServerError] = useState('');
  usePageTitle(
    'What to Charge in Your City — Free Oklahoma Lawn Rates Report | MowGo',
    'Real Oklahoma lawn mowing rates by city. See what 10 OK cities charge, then get the full report with yard-size pricing and revenue math — free.'
  );

  const update = (event) => {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  };

  async function submit(event) {
    event.preventDefault();
    const next = {};
    const email = form.email.trim();
    if (!EMAIL_RE.test(email) || email.length > 254) next.email = 'Enter a valid email address.';
    if (!CITY_NAMES.includes(form.city)) next.city = 'Select your city.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setServerError('');
    const city = form.city;
    try {
      const response = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, city }),
      });
      if (!response.ok) {
        await response.json().catch(() => ({}));
        throw new Error(response.status === 429 ? 'Too many requests. Please try again later.' : 'Could not send report. Please try again.');
      }
      setResult({ email, city });
    } catch (error) {
      setServerError(error.message || 'Could not send report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass = 'mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 text-gray-900">
      <nav className="border-b border-emerald-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold no-underline"><Logo size="sm" />MowGo</Link>
        </div>
      </nav>
      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <section>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
            <MapPin className="h-4 w-4" />Free Report
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">What to Charge in Your City</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">Real Oklahoma lawn rates, by city. Free.</p>

          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-800">Oklahoma state average</p>
            <p className="text-3xl font-extrabold text-emerald-900">{STATE_AVERAGE}<span className="ml-2 text-base font-medium text-emerald-700">per mow, across all yard sizes</span></p>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">City</th><th className="px-4 py-3 text-right">Avg. mow price</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {CITY_PRICES.map(([city, price]) => (
                  <tr key={city}>
                    <td className="px-4 py-2.5 font-medium">{city}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">Data: LawnStarter OK market, refreshed August 2026.</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-emerald-900/10 sm:p-8 lg:sticky lg:top-8 lg:self-start">
          {!result ? (
            <form onSubmit={submit} noValidate>
              <h2 className="text-2xl font-bold">Get the full report</h2>
              <p className="mt-2 text-sm text-gray-600">Yard-size pricing, revenue math, and honest caveats — sent straight to your inbox.</p>
              <div className="mt-6 space-y-5">
                <label className="block text-sm font-semibold">
                  Email
                  <input className={fieldClass} name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" maxLength={254} disabled={submitting} aria-invalid={Boolean(errors.email)} />
                  {errors.email && <span className="mt-1 block text-sm font-normal text-red-600">{errors.email}</span>}
                </label>
                <label className="block text-sm font-semibold">
                  City
                  <select className={fieldClass} name="city" value={form.city} onChange={update} disabled={submitting} aria-invalid={Boolean(errors.city)}>
                    <option value="">Select your city</option>
                    {CITY_NAMES.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                  {errors.city && <span className="mt-1 block text-sm font-normal text-red-600">{errors.city}</span>}
                </label>
              </div>
              {serverError && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
              <button disabled={submitting} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">{submitting ? 'Sending…' : 'Send Me the Full Report'}</button>
              <p className="mt-3 text-center text-sm text-gray-500">Free. No spam. Unsubscribe anytime.</p>
            </form>
          ) : (
            <div aria-live="polite">
              <span className="inline-flex rounded-full bg-emerald-100 p-3"><Check className="h-7 w-7 text-emerald-700" /></span>
              <h2 className="mt-5 text-2xl font-bold">Check your inbox ✅</h2>
              <p className="mt-2 text-gray-600">We sent the full rates report to <strong>{result.email}</strong>.</p>
              <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr><th className="px-3 py-2">City</th><th className="px-3 py-2 text-right">Avg. mow price</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {CITY_PRICES.map(([city, price]) => (
                      <tr key={city} className={city === result.city ? 'bg-emerald-50 font-semibold' : ''}>
                        <td className="px-3 py-2">{city}</td>
                        <td className="px-3 py-2 text-right">{price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <Link to="/login?mode=signup" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Start scheduling with MowGo<ArrowRight className="h-4 w-4" /></Link>
                <a href="https://calendly.com/aaron-mowgo/15min" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 px-5 py-3 font-semibold text-emerald-700 hover:bg-emerald-50">Book a free setup call →</a>
              </div>
            </div>
          )}
        </section>
        <section className="mt-10 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">Related</h2>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--color-text-muted)]">
            <Link to="/compare" className="hover:text-emerald-400">Compare lawn care software</Link>
            <Link to="/route-audit" className="hover:text-emerald-400">Free route audit</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
