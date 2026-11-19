# Agnovyra Ventures — website

Website for **Agnovyra Ventures**, an integrated farm and agribusiness in Odeda, Ogun State, Nigeria (a business of Odusade Synergies Limited).

- `index.html`: the public website (shop, farm map, tours, academy, trade, invest)
- `admin.html`: private dashboard for orders, bookings, enquiries and product prices
- Data is stored in Supabase; orders and enquiries are also sent to WhatsApp.

Hosted free on Vercel. Every push to `main` goes live automatically.

## Agnovyra AI
- `plan.html`: AI business plan generator (free preview, paid unlock marked in the admin dashboard)
- Chat widget on `index.html`: Agnovyra AI farm advisor (free daily questions)
- Backend: Supabase Edge Function `supabase/functions/agnovyra-ai` using Google Gemini.
  Secrets (Supabase → Edge Functions → Secrets): `GEMINI_API_KEY` (required); optional `GEMINI_MODEL`, `PLAN_PRICE_NGN`, `CHAT_PER_DAY`.
