-- Demo data for a fresh local stack (`npx supabase db reset`).
--
-- Sign in as demo@example.com / demodemo1 after `npx supabase start`.
-- Seeded as a free-plan account: one client (the INSERT cap). Extra
-- clients here would only work because this script runs as the database
-- owner and bypasses RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Demo user
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo@example.com',
  crypt('demodemo1', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Demo"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000001',
    'email', 'demo@example.com',
    'email_verified', true
  ),
  'email',
  '00000000-0000-4000-8000-000000000001',
  now(),
  now(),
  now()
);

-- Profile row is created by handle_new_user.

-- ---------------------------------------------------------------------------
-- Categories (English names — README and docs are English)
-- ---------------------------------------------------------------------------

insert into public.categories (id, user_id, name, color, position) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Work',     '#3b82f6', 0),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Personal', '#8b5cf6', 1),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Shopping', '#10b981', 2),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'School',   '#f59e0b', 3);

-- ---------------------------------------------------------------------------
-- One client + two projects (free-plan shaped)
-- ---------------------------------------------------------------------------

insert into public.clients (
  id, user_id, name, archived, position, hourly_rate, currency
) values (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'Acme Agency',
  false,
  0,
  1500.00,
  'TRY'
);

insert into public.projects (id, user_id, client_id, name, archived, position, hourly_rate) values
  (
    '00000000-0000-4000-8000-000000000020',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'Website',
    false,
    0,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'Brand',
    false,
    1,
    0
  );

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

insert into public.tasks (
  id, user_id, title, description, due_date, priority,
  category_id, client_id, project_id, completed, completed_at, position
) values
  (
    '00000000-0000-4000-8000-000000000031',
    '00000000-0000-4000-8000-000000000001',
    'Deliver homepage draft',
    'First pass of the marketing homepage.',
    '2026-09-15',
    'high',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000020',
    false,
    null,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000032',
    '00000000-0000-4000-8000-000000000001',
    'Review brand guide',
    null,
    '2026-09-18',
    'medium',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000021',
    false,
    null,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000033',
    '00000000-0000-4000-8000-000000000001',
    'Send invoice',
    null,
    '2026-09-12',
    'high',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000020',
    true,
    '2026-09-11T16:00:00Z',
    2
  ),
  (
    '00000000-0000-4000-8000-000000000034',
    '00000000-0000-4000-8000-000000000001',
    'Buy oat milk',
    null,
    null,
    'low',
    '00000000-0000-4000-8000-000000000004',
    null,
    null,
    false,
    null,
    3
  );

-- ---------------------------------------------------------------------------
-- Time logs (Website inherits 1500 TRY/h; Brand is unpaid)
-- ---------------------------------------------------------------------------

insert into public.time_logs (
  id, user_id, task_id, client_id, project_id, started_at, duration_minutes, note
) values
  (
    '00000000-0000-4000-8000-000000000041',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000031',
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000020',
    '2026-09-10T09:00:00Z',
    90,
    'Wireframes'
  ),
  (
    '00000000-0000-4000-8000-000000000042',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000032',
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000021',
    '2026-09-10T13:00:00Z',
    45,
    'Type pass'
  );
