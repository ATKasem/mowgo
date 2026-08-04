import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, MapPin } from 'lucide-react';
import Logo from '../components/Logo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIDPOINTS = { under_10: 7, '10_25': 17, '25_50': 37, '50_plus': 60 };

function reportFor(bucket) {
  const hours = Math.round(MIDPOINTS[bucket] * 0.75);
  const monthly = Math.round(MIDPOINTS[bucket] * 0.75 * 4.33 * 45);
  const annual = Math.round(MIDPOINTS[bucket] * 0.75 * 4.33 * 45 * 12 * 0.6);
  return { hours, monthly, annual };
}

export default function RouteAudit() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', zip: '', lawns_bucket: '', crew_bucket: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [serverError, setServerError] = useState('');

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = t('routeAudit.validation.name');
    if (!EMAIL_RE.test(form.email.trim()) || form.email.trim().length > 254) next.email = t('routeAudit.validation.email');
    if (!/^\d{5}$/.test(form.zip)) next.zip = t('routeAudit.validation.zip');
    if (!MIDPOINTS[form.lawns_bucket]) next.lawns_bucket = t('routeAudit.validation.lawns');
    if (!['solo', '2_3', '4_plus'].includes(form.crew_bucket)) next.crew_bucket = t('routeAudit.validation.crew');
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setServerError('');
    const lawnsBucket = form.lawns_bucket;
    const crewBucket = form.crew_bucket;
    try {
      const response = await fetch('/api/route-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim(), email: form.email.trim() }),
      });
      if (!response.ok) {
        await response.json().catch(() => ({}));
        throw new Error(response.status === 429 ? t('routeAudit.errors.rateLimit') : t('routeAudit.errors.submit'));
      }
      setResult(reportFor(lawnsBucket));
    } catch (error) {
      setServerError(error.message || t('routeAudit.errors.submit'));
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
            <MapPin className="h-4 w-4" />{t('routeAudit.eyebrow')}
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{t('routeAudit.headline')}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">{t('routeAudit.subheadline')}</p>
          <ul className="mt-8 space-y-4">
            {['hours', 'revenue', 'fixes'].map((key) => <li key={key} className="flex gap-3 text-gray-700"><span className="mt-0.5 rounded-full bg-emerald-100 p-1"><Check className="h-4 w-4 text-emerald-700" /></span>{t(`routeAudit.bullets.${key}`)}</li>)}
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-emerald-900/10 sm:p-8">
          {!result ? (
            <form onSubmit={submit} noValidate>
              <h2 className="text-2xl font-bold">{t('routeAudit.form.title')}</h2>
              <div className="mt-6 space-y-5">
                {[
                  ['name', 'text', 'name'], ['email', 'email', 'email'], ['zip', 'text', 'zip'],
                ].map(([name, type, translation]) => <label key={name} className="block text-sm font-semibold">{t(`routeAudit.form.${translation}`)}<input className={fieldClass} name={name} type={type} value={form[name]} onChange={update} placeholder={t(`routeAudit.form.${translation}Placeholder`)} maxLength={name === 'email' ? 254 : name === 'zip' ? 5 : 100} inputMode={name === 'zip' ? 'numeric' : undefined} disabled={submitting} aria-invalid={Boolean(errors[name])} />{errors[name] && <span className="mt-1 block text-sm font-normal text-red-600">{errors[name]}</span>}</label>)}
                <label className="block text-sm font-semibold">{t('routeAudit.form.lawns')}<select className={fieldClass} name="lawns_bucket" value={form.lawns_bucket} onChange={update} disabled={submitting}><option value="">{t('routeAudit.form.select')}</option><option value="under_10">{t('routeAudit.options.under10')}</option><option value="10_25">{t('routeAudit.options.10to25')}</option><option value="25_50">{t('routeAudit.options.25to50')}</option><option value="50_plus">{t('routeAudit.options.50plus')}</option></select>{errors.lawns_bucket && <span className="mt-1 block text-sm font-normal text-red-600">{errors.lawns_bucket}</span>}</label>
                <label className="block text-sm font-semibold">{t('routeAudit.form.crew')}<select className={fieldClass} name="crew_bucket" value={form.crew_bucket} onChange={update} disabled={submitting}><option value="">{t('routeAudit.form.select')}</option><option value="solo">{t('routeAudit.options.solo')}</option><option value="2_3">{t('routeAudit.options.2to3')}</option><option value="4_plus">{t('routeAudit.options.4plus')}</option></select>{errors.crew_bucket && <span className="mt-1 block text-sm font-normal text-red-600">{errors.crew_bucket}</span>}</label>
              </div>
              {serverError && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
              <button disabled={submitting} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">{submitting ? t('routeAudit.form.submitting') : t('routeAudit.form.submit')}</button>
              <p className="mt-3 text-center text-sm text-gray-500">{t('routeAudit.form.scarcity')}</p>
            </form>
          ) : (
            <div aria-live="polite">
              <span className="inline-flex rounded-full bg-emerald-100 p-3"><Check className="h-7 w-7 text-emerald-700" /></span>
              <h2 className="mt-5 text-2xl font-bold">{t('routeAudit.report.title')}</h2>
              <p className="mt-2 text-gray-600">{t('routeAudit.report.delivery', { email: form.email })}</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-emerald-50 p-3"><strong className="block text-2xl text-emerald-800">~{result.hours}</strong><span className="text-xs text-gray-600">{t('routeAudit.report.hours')}</span></div>
                <div className="rounded-xl bg-emerald-50 p-3"><strong className="block text-2xl text-emerald-800">${result.monthly.toLocaleString()}</strong><span className="text-xs text-gray-600">{t('routeAudit.report.monthly')}</span></div>
                <div className="rounded-xl bg-emerald-50 p-3"><strong className="block text-2xl text-emerald-800">${result.annual.toLocaleString()}</strong><span className="text-xs text-gray-600">{t('routeAudit.report.annual')}</span></div>
              </div>
              <p className="mt-4 text-xs font-medium text-gray-500">{t('routeAudit.report.estimate')}</p>
              <div className="mt-6 rounded-xl border border-gray-200 p-4"><h3 className="font-bold">{t('routeAudit.report.mathTitle')}</h3><p className="mt-2 text-sm leading-relaxed text-gray-600">{t('routeAudit.report.formula')}</p></div>
              {lawnsBucket === 'under_10' ? <><p className="mt-6 text-gray-700">{t('routeAudit.branches.small')}</p><Link to="/?section=pricing" onClick={() => setTimeout(() => document.getElementById('pricing')?.scrollIntoView(), 0)} className="mt-5 inline-flex font-bold text-emerald-700">{t('routeAudit.branches.pricing')} →</Link></> : lawnsBucket === '50_plus' ? <><p className="mt-6 text-gray-700">{t('routeAudit.branches.large')}</p><Link to="/compare" className="mt-5 inline-flex font-bold text-emerald-700">{t('routeAudit.branches.compare')} →</Link></> : crewBucket === '4_plus' ? <><p className="mt-6 text-gray-700">{t('routeAudit.branches.crew')}</p><Link to="/login?mode=signup" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{t('routeAudit.branches.crewCta')}<ArrowRight className="h-4 w-4" /></Link></> : <Link to="/login?mode=signup" className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{t('routeAudit.branches.qualifiedCta')}<ArrowRight className="h-4 w-4" /></Link>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
