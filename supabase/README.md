# Supabase setup (Lotery demo)

1. Create a Supabase project from https://supabase.com/dashboard.
2. In Project Settings / Connect, copy the Project URL and the publishable key.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. In Supabase Dashboard, open SQL Editor and run the complete file
   `supabase/migrations/001_initial_demo_schema.sql` from this repository.
5. Register your own account in Supabase Authentication before promoting any account to admin.
6. Once your account exists, run this statement in SQL Editor after replacing the placeholder with your actual Auth user UUID:

   ```sql
   update public.profiles
   set role = 'admin', updated_at = now()
   where id = 'REPLACE-WITH-YOUR-AUTH-USER-UUID';
   ```

   Get the UUID from Authentication -> Users. Do not use a user-controlled signup field to assign roles.

7. Install dependencies and run locally:
   ```bash
   npm install
   npm run dev
   ```

Security notes:
- Never commit `.env.local`, database passwords, or secret/service_role keys.
- The publishable key is intended for client apps; RLS and SQL grants must still protect every table.
- This schema is only for the demonstration POS: demo receipts must use a `DEMO-` reference. It is not a licensed lottery ticket, wager, or payout system.
- The UI has not yet been wired to persist receipts or enforce sign-in. Do not treat the current demo UI as a production POS.
- Before production, add and test auth flows, session refresh middleware/proxy, RLS tests, audit triggers, backup/restore procedures, and jurisdiction-specific legal review.
