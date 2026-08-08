import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function SmsOptIn() {
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | ok | error
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!consent) { setErr('Please check the consent box.'); setState('error'); return; }
    setState('sending'); setErr('');
    try {
      const r = await fetch('/api/sms-optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setState('error'); setErr(d.error || 'Something went wrong — try again.'); return; }
      setState('ok');
    } catch {
      setState('error'); setErr('Network error — try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <img src="/mowgo-logo-full.svg" alt="MowGo" className="h-8" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Get lawn pricing reports by text</h1>
        <p className="text-gray-400 text-center text-sm mb-6">
          MowGo sends lawn care owners real market-rate reports and occasional
          offers by SMS. Marketing messages only — usually 1–2 a month.
        </p>

        {state === 'ok' ? (
          <div className="bg-green-900/40 border border-green-500/50 rounded-xl p-6 text-center">
            <p className="text-green-400 font-semibold mb-1">You're in ✅</p>
            <p className="text-gray-300 text-sm">We'll text you at {phone}. Reply STOP anytime to opt out.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Mobile number</label>
              <input
                type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(405) 555-0123"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-500"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 accent-green-500" />
              <span>
                I agree to receive <b>marketing</b> text messages from MowGo about lawn
                care pricing reports and offers (about 1–2 messages a month). This consent
                is separate from any informational or transactional messages. Message &amp;
                data rates may apply. Reply <b>STOP</b> to opt out. Consent applies only to
                MowGo and this campaign. See our <Link to="/privacy" className="text-green-400 underline">Privacy Policy</Link>{' '}
                and <Link to="/terms" className="text-green-400 underline">Terms</Link>.
              </span>
            </label>
            {state === 'error' && <p className="text-red-400 text-sm">{err}</p>}
            <button type="submit" disabled={state === 'sending'}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2.5">
              {state === 'sending' ? 'Sending…' : 'Sign me up'}
            </button>
          </form>
        )}

        <p className="text-gray-600 text-xs text-center mt-6">
          MowGo · Lawn care scheduling software built in Oklahoma City
        </p>
      </div>
    </div>
  );
}
