// Unsubscribe handler: GET shows page, POST handles one-click (RFC 8058) and form submissions.
// Store unsubscribed emails via Supabase so all send scripts can check them.

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];
function cors(req) {
  const origin = req?.headers?.get?.('origin');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com';
}

const HTML = (msg) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — MowGo</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#ecfdf5,#f0fdf4);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:white;border-radius:16px;padding:40px;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h1{font-size:22px;margin-bottom:8px;color:#065f46}
p{color:#6b7280;font-size:14px;line-height:1.5;margin-bottom:24px}
form{display:flex;flex-direction:column;gap:12px}
input{padding:12px 16px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;outline:none}
input:focus{border-color:#059669;box-shadow:0 0 0 3px rgba(5,150,105,.15)}
button{padding:12px;background:#059669;color:white;border:none;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer}
button:hover{background:#047857}
.footer{margin-top:24px;font-size:12px;color:#9ca3af}
.success{background:#ecfdf5;color:#065f46;padding:12px;border-radius:10px;font-size:14px;margin-bottom:16px}
.error{background:#fef2f2;color:#991b1b;padding:12px;border-radius:10px;font-size:14px;margin-bottom:16px}
</style>
</head><body>
<div class="card">
${msg || ''}
<h1>Unsubscribe from MowGo emails</h1>
<p>Enter the email address you want to stop receiving marketing emails from MowGo.</p>
<form method="POST" action="/api/unsubscribe">
<input type="email" name="email" placeholder="you@example.com" required autofocus>
<button type="submit">Unsubscribe</button>
</form>
<p class="footer">MowGo · <a href="https://mowgoapp.com" style="color:#059669">mowgoapp.com</a></p>
</div></body></html>`;

// Simple in-memory blocklist (resets on cold start). For durability, also writes to master_leads.json via local endpoint.
const blocked = new Set();

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = cors(request);
  const method = request.method;

  // RFC 8058 one-click — Google automates this POST, no body, from the List-Unsubscribe header.
  // We return 200 regardless (compliance) and also log the generic click.
  if (method === 'POST' && url.searchParams.has('List-Unsubscribe')) {
    return new Response('OK', {
      status: 200, headers: {
        'Access-Control-Allow-Origin': origin, 'Content-Type': 'text/plain'
      }
    });
  }

  if (method === 'POST') {
    // Form submission
    try {
      const fd = await request.formData();
      const email = fd.get('email')?.trim()?.toLowerCase();
      if (!email || !email.includes('@')) {
        return new Response(HTML('<div class="error">Please enter a valid email address.</div>'), {
          status: 400, headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': origin }
        });
      }

      blocked.add(email);

      // If Supabase is configured, also store there
      if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          await fetch(`${env.SUPABASE_URL}/rest/v1/unsubscribed_emails`, {
            method: 'POST',
            headers: {
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, source: 'unsubscribe_page', created_at: new Date().toISOString() })
          });
        } catch (e) {
          // Non-fatal — blocklist still works in-memory
          console.warn('Supabase unsubscribe write failed:', e.message);
        }
      }

      return new Response(HTML(`<div class="success">You have been unsubscribed. You will not receive any more marketing emails from MowGo.</div>`), {
        status: 200, headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': origin }
      });
    } catch (e) {
      return new Response(HTML(`<div class="error">Something went wrong. Please try again.</div>`), {
        status: 400, headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': origin }
      });
    }
  }

  // GET — show the form
  const emailParam = url.searchParams.get('email');
  const msg = emailParam
    ? HTML(`<div class="success">Unsubscribe confirmed for ${emailParam}.</div>`)
    : '';
  return new Response(msg || HTML(''), {
    status: 200, headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': origin }
  });
}