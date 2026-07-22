import { Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400 text-sm mb-8 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to MowFlow
        </Link>

        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="w-6 h-6 text-sky-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: July 22, 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">1. Information We Collect</h2>
            <p>MowFlow collects only the information necessary to provide our scheduling and invoicing service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account information:</strong> name, email, business name, and phone number when you create an account.</li>
              <li><strong>Client data:</strong> names, addresses, phone numbers, and service notes you enter for your lawn care clients.</li>
              <li><strong>Usage data:</strong> anonymous analytics about how you use the app to help us improve.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">2. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and maintain the MowFlow service</li>
              <li>To process payments via Stripe (we never store your full payment details)</li>
              <li>To send service-related communications (appointment reminders, invoices)</li>
              <li>To improve and personalize the app experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">3. Data Sharing</h2>
            <p>We do not sell your data. We share data only with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Stripe</strong> — for payment processing</li>
              <li><strong>Supabase</strong> — our database provider (your data is encrypted at rest)</li>
              <li><strong>Law enforcement</strong> — only when required by valid legal process</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">4. Your Rights</h2>
            <p>You can:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Export all your data at any time</li>
              <li>Delete your account and all associated data</li>
              <li>Opt out of non-essential communications</li>
              <li>Request a copy of data we hold about you</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">5. Contact</h2>
            <p>For privacy questions, contact us at <a href="mailto:privacy@mowflow.app" className="text-sky-600 dark:text-sky-400">privacy@mowflow.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
