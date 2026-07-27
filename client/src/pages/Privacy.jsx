import useLocalizedText from '../i18n/useLocalizedText';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  const { tr, t, i18n } = useLocalizedText('privacy');
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400 text-sm mb-8 hover:underline">
          <ArrowLeft className="w-4 h-4" /> {tr("Back to MowGo")}
        </Link>

        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="w-6 h-6 text-emerald-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr("Privacy Policy")}</h1>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{tr("Last updated: July 22, 2026")}</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{tr("1. Information We Collect")}</h2>
            <p>{tr("MowGo collects only the information necessary to provide our scheduling and invoicing service:")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>{tr("Account information:")}</strong> {tr("name, email, business name, and phone number when you create an account.")}</li>
              <li><strong>{tr("Client data:")}</strong> {tr("names, addresses, phone numbers, and service notes you enter for your lawn care clients.")}</li>
              <li><strong>{tr("Usage data:")}</strong> {tr("anonymous analytics about how you use the app to help us improve.")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{tr("2. How We Use Your Data")}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{tr("To provide and maintain the MowGo service")}</li>
              <li>{tr("To process payments via Stripe (we never store your full payment details)")}</li>
              <li>{tr("To send service-related communications (appointment reminders, invoices)")}</li>
              <li>{tr("To improve and personalize the app experience")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{tr("3. Data Sharing")}</h2>
            <p>{tr("We do not sell your data. We share data only with:")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>{tr("Stripe")}</strong> — {tr("for payment processing")}</li>
              <li><strong>{tr("Supabase")}</strong> — {tr("our database provider (your data is encrypted at rest)")}</li>
              <li><strong>{tr("Law enforcement")}</strong> — {tr("only when required by valid legal process")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{tr("4. Your Rights")}</h2>
            <p>{tr("You can:")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{tr("Export all your data at any time")}</li>
              <li>{tr("Delete your account and all associated data")}</li>
              <li>{tr("Opt out of non-essential communications")}</li>
              <li>{tr("Request a copy of data we hold about you")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{tr("5. Contact")}</h2>
            <p>{tr("For privacy questions, contact us at")} <a href="mailto:privacy@mowgo.app" className="text-sky-600 dark:text-sky-400">privacy@mowgo.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
