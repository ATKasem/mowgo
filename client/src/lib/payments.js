import { loadStripe } from '@stripe/stripe-js';

// Stripe will be loaded lazily on first use
let stripePromise = null;
function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (key) stripePromise = loadStripe(key);
  }
  return stripePromise;
}

// Price IDs — create these in your Stripe dashboard
// Products → Add Product → copy the API ID
export const PRICES = {
  solo_monthly: import.meta.env.VITE_STRIPE_PRICE_SOLO || 'price_solo_monthly',
  crew_monthly: import.meta.env.VITE_STRIPE_PRICE_CREW || 'price_crew_monthly',
};

/**
 * Redirect to Stripe Checkout for a subscription.
 * @param {'solo'|'crew'} plan
 */
export async function startCheckout(plan) {
  const stripe = await getStripe();
  if (!stripe) {
    alert('Stripe is not configured yet. Add your publishable key to .env.');
    return;
  }

  const priceId = plan === 'solo' ? PRICES.solo_monthly : PRICES.crew_monthly;

  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    successUrl: `${window.location.origin}/#/subscribe?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/#/pricing`,
    // Allow promo codes in checkout
    allowPromotionCodes: true,
  });

  if (error) {
    console.error('Stripe checkout error:', error);
    alert('Something went wrong. Please try again.');
  }
}
