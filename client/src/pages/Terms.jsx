import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-5 text-sm leading-relaxed">
        <h1 className="text-2xl font-bold text-white">MowGo Terms of Service</h1>
        <p className="text-gray-400">Last updated: August 5, 2026</p>

        <h2 className="text-lg font-semibold text-white pt-2">1. Service</h2>
        <p>
          MowGo ("we", "us") provides lawn care scheduling, routing, invoicing, and client
          communication software to lawn care businesses. By using MowGo you agree to these
          terms and to pay any applicable subscription fees for the plan you select
          (Solo, Crew, or Premium) as presented at checkout.
        </p>

        <h2 className="text-lg font-semibold text-white pt-2">2. Accounts</h2>
        <p>
          You are responsible for the accuracy of the information you provide, for keeping
          your login credentials secure, and for activity under your account. You must be
          at least 18 years old to use MowGo.
        </p>

        <h2 className="text-lg font-semibold text-white pt-2">3. Subscriptions &amp; Billing</h2>
        <p>
          Subscriptions are billed in advance on a monthly or annual basis as selected.
          You can cancel anytime; cancellation takes effect at the end of the current
          billing period. Fees are non-refundable except where required by law.
        </p>

        <h2 className="text-lg font-semibold text-white pt-2">4. Acceptable Use</h2>
        <p>
          You agree not to misuse the service — including attempting unauthorized access,
          reselling the service, or using it to send unlawful communications. You are
          responsible for messages you send through MowGo and must honor recipients'
          opt-out requests.
        </p>

        <h2 className="text-lg font-semibold text-white pt-2">5. SMS Messaging</h2>
        <p>
          MowGo may send SMS messages (scheduling, rain-delay, invoicing, or marketing
          communications) to numbers you provide. Message and data rates may apply.
          You can opt out of marketing texts at any time by replying STOP. By providing a
          phone number you confirm you have authority to receive messages at that number.
        </p>

        <h2 className="text-lg font-semibold text-white pt-2">6. Data &amp; Privacy</h2>
        <p>
          Your data is handled per our <Link to="/privacy" className="text-green-400 underline">Privacy Policy</Link>.
          You own your business data; we use it only to operate and improve the service.
          We do not sell your data.
        </p>

        <h2 className="text-lg font-semibold text-white pt-2">7. Limitation of Liability</h2>
        <p>
          The service is provided "as is" without warranties of any kind. To the maximum
          extent permitted by law, MowGo is not liable for indirect, incidental, or
          consequential damages, or for lost profits, arising from use of the service.
          Weather, market, and scheduling outcomes depend on factors outside our control.
        </p>

        <h2 className="text-lg font-semibold text-white pt-2">8. Changes &amp; Contact</h2>
        <p>
          We may update these terms with notice. Continued use after changes means
          acceptance. Questions: <span className="text-gray-400">support@mowgoapp.com</span>.
        </p>
      </div>
    </div>
  );
}
