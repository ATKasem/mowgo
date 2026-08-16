Batch all these MowGo fixes. Make each change in order, verify syntax after each.

## 1. Landing.jsx — hero rewrite + positioning fix + email capture

File: client/src/pages/Landing.jsx

### 1a. Fix positioning (line ~191-193)
Change the hero badge text from:
`{tr("Built in Oklahoma City, for Oklahoma crews")}`
To:
`{tr("Built in Oklahoma City, for Oklahoma lawn crews")}`

### 1b. Rewrite hero headline (line ~196-198)
Change the hero heading from:
`{tr("Rain on Tuesday. Eight clients to rebook.")} <span>...{tr("You confirm the move.")}</span>`
To:
`{tr("Run your crew without an office manager.")} <span>...{tr("Scheduling, routing, invoicing in one app.")}</span>`

### 1c. Rewrite hero subheadline (line ~201-203)
Change from:
`{tr("When Oklahoma rain hits, MowGo suggests a dry date...")}`
To:
`{tr("MowGo handles the scheduling, routing, and invoicing so you can focus on the mowing. Built for Oklahoma crews by an Oklahoma operator.")}`

### 1d. Add email capture link in the hero CTA row (around line 212)
Add a new link after the route-audit link:
```jsx
<Link to="/rates" className="group inline-flex items-center gap-2 text-[var(--color-text-secondary)] dark:text-gray-300 font-semibold text-sm underline underline-offset-4 hover:text-[var(--color-text-primary)] transition-colors">{tr("Free pricing guide")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></Link>
```

### 1e. Update the hero guarantee text (line ~214-215)
Change from:
`{tr("Rain delay on free tier. No credit card required.")}`
To:
`{tr("Free for 5 clients. No credit card. 2 minutes to start.")}`

## 2. Update en.json locale — add new translation keys

File: client/src/i18n/locales/en.json

Add these keys under the "landing" section:
```json
"landing": {
  "built_in_oklahoma_city_for_oklahoma_lawn_crews": "Built in Oklahoma City, for Oklahoma lawn crews",
  "run_your_crew_without_an_office_manager": "Run your crew without an office manager.",
  "scheduling_routing_invoicing_in_one_app": "Scheduling, routing, invoicing in one app.",
  "mowgo_handles_the_scheduling_routing_and_invoicing_so_you_can_focus_on_the_mowing_built_for_oklahoma_crews_by_an_oklahoma_operator": "MowGo handles the scheduling, routing, and invoicing so you can focus on the mowing. Built for Oklahoma crews by an Oklahoma operator.",
  "free_pricing_guide": "Free pricing guide",
  "free_for_5_clients_no_credit_card_2_minutes_to_start": "Free for 5 clients. No credit card. 2 minutes to start."
}
```

## 3. Update es.json locale — add Spanish translations for the same keys

File: client/src/i18n/locales/es.json

Add these keys under the "landing" section:
```json
"landing": {
  "built_in_oklahoma_city_for_oklahoma_lawn_crews": "Construido en Oklahoma City, para cuadrillas de Oklahoma",
  "run_your_crew_without_an_office_manager": "Dirige tu cuadrilla sin un gerente de oficina.",
  "scheduling_routing_invoicing_in_one_app": "Programación, rutas, facturación en una sola aplicación.",
  "mowgo_handles_the_scheduling_routing_and_invoicing_so_you_can_focus_on_the_mowing_built_for_oklahoma_crews_by_an_oklahoma_operator": "MowGo maneja la programación, rutas y facturación para que puedas concentrarte en cortar el césped. Construido para cuadrillas de Oklahoma por un operador de Oklahoma.",
  "free_pricing_guide": "Guía de precios gratuita",
  "free_for_5_clients_no_credit_card_2_minutes_to_start": "Gratis para 5 clientes. Sin tarjeta de crédito. 2 minutos para empezar."
}
```

## 4. Update functions/api/lead-touch.js welcome email

File: functions/api/lead-touch.js

Find the welcomeHtml() function and change the welcome email. Replace the current content with a 3-step checklist:

```javascript
function welcomeHtml() {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6">
<h1>Welcome to MowGo</h1>
<p>You're set up. Here's how to get your first week running in 3 minutes:</p>
<ol>
<li><strong>Add your first client.</strong> Tap the Clients tab → Add Client. Name, address, phone, rate. That's it.</li>
<li><strong>Schedule their first job.</strong> Tap Today → Schedule Job. Pick the date, assign the crew, set recurring if it's weekly/bi-weekly.</li>
<li><strong>Send the first invoice.</strong> Mark the job complete → the invoice is created automatically. One tap copies a payment text for Venmo, Zelle, or Cash App.</li>
</ol>
<p>That's it. You're running.</p>
<p style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">Need help? Reply to this email — we'll import your clients and set up your first week. <a href="https://mowgoapp.com/#/app" style="color:#047857">Open MowGo →</a></p>
</body></html>`;
}
```

## 5. Add "book a call" CTA to rates lead magnet success page

File: client/src/pages/Rates.jsx

Around line 157 (the "Start scheduling with MowGo" link), change it from:
```jsx
<Link to="/login?mode=signup" className="...">Start scheduling with MowGo<ArrowRight /></Link>
```
To:
```jsx
<div className="mt-6 flex flex-col gap-3">
  <Link to="/login?mode=signup" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Start scheduling with MowGo<ArrowRight className="h-4 w-4" /></Link>
  <a href="https://calendly.com/aaron-mowgo/15min" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 px-5 py-3 font-semibold text-emerald-700 hover:bg-emerald-50">Book a free setup call →</a>
</div>
```

## 6. Add "book a call" CTA to nurture emails

File: scripts/lead_nurture.py

In the DAY7_EMAIL_HTML (around line 129-137), replace the existing CTA paragraph:
```python
'<p><a href="https://mowgoapp.com/#/login?mode=signup">Start free</a></p>'
```
With:
```python
'<p><a href="https://mowgoapp.com/#/login?mode=signup">Start free</a></p>'
'<p style="margin-top:12px"><a href="https://calendly.com/aaron-mowgo/15min" style="color:#047857">Book a free setup call →</a></p>'
```

## Verification
After all changes:
1. python3 -c "import ast; ast.parse(open('scripts/lead_nurture.py').read()); print('nurture OK')"
2. node --check functions/api/lead-touch.js
3. node --check functions/api/rates.js
4. Check Landing.jsx with: grep -n "landingCta\|rates\|Free pricing" client/src/pages/Landing.jsx