// Optional production notification bridge.
// Deploy as a Supabase Edge Function and store provider secrets in Supabase secrets.
// Do not put Gmail/WhatsApp API secrets in the frontend.
//
// Expected JSON:
// { "message": "...", "email": "optional@example.com", "whatsapp": "optional-number" }
//
// Add your chosen transactional email and WhatsApp provider here.
// This scaffold intentionally does not contain real provider credentials.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", {status:405});
  const body = await req.json();
  // TODO: authenticate the caller / verify admin role before sending.
  // TODO: call your email provider with Deno.env.get("EMAIL_API_KEY").
  // TODO: call your WhatsApp provider with Deno.env.get("WHATSAPP_API_KEY").
  return Response.json({
    ok: true,
    queued: true,
    note: "Connect your email/WhatsApp provider in this Edge Function."
  });
});
