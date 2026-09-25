# RAVENOID — Production Build

This package keeps the RV-02 futuristic interface and upgrades the application to a Supabase-backed architecture.

## Live features included
- Supabase email/password authentication
- User profiles and admin roles
- Persistent private support tickets
- User ↔ admin realtime ticket chat
- Ticket status management
- Public Room posts
- Public Room image uploads
- Realtime admin dashboard
- In-app notification records
- Supabase Storage policies
- Row Level Security
- Production-safe frontend config pattern (public anon/publishable key only)

## Important
A real deployment cannot be made live without YOUR Supabase project. `js/config.js` intentionally contains placeholders.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Copy your Project URL and public anon/publishable key into `js/config.js`.
4. Deploy the folder to GitHub Pages, Netlify, Cloudflare Pages, etc.
5. Create your first account.
6. In Supabase SQL Editor, promote your account:
   `update public.profiles set role='admin' where id='YOUR_USER_UUID';`
7. Sign in again and open the Admin Command Center.

## Security
- NEVER place a `service_role`/secret key in `config.js`.
- The admin role is checked server-side through Supabase RLS; the old demo PIN is not trusted.
- For Gmail/WhatsApp notifications, deploy `supabase/functions/notify-external` and store provider credentials as Supabase secrets.

## Current limitation
The outbound Gmail/WhatsApp function is a provider-neutral scaffold. A specific email provider and WhatsApp Business/API provider must be connected and configured with their credentials before messages can be sent externally.
