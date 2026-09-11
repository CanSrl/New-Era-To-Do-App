# Stripping the niche module

The niche (clients, projects, delivery view, time logs, CSV) is this repo’s product **and** an optional add-on for a generic starter-kit buyer.

Turning the flag off is not enough if you also want the **database** gone. Do both.

## 1. Flag

```
VITE_NICHE_MODULE=false
```

With only the flag:

- `/app/clients`, `/app/delivery`, `/app/time` are not registered
- Task form does not send `client_id` / `project_id`
- Sync does not query `clients` / `projects` / `time_logs` (otherwise a kit without those tables would fail **task** sync every tour)
- Local client/project rows are **not** deleted; they come back if you turn the flag on

Prove the bundle:

```bash
npm run verify:niche
```

## 2. Migrations (order matters)

Delete **both** files, **time logs first**:

1. `supabase/migrations/20260816120000_niche_time_logs.sql`
2. `supabase/migrations/20260814120000_niche_module.sql`

The time-logs migration also adds `tasks_id_user_id_key` on the generic `tasks` table. Removing that file on a database that already applied it is not enough — drop the constraint if you already pushed:

```sql
alter table public.tasks drop constraint if exists tasks_id_user_id_key;
alter table public.tasks drop column if exists client_id;
alter table public.tasks drop column if exists project_id;
```

Do **not** delete `20260901120000_billing.sql` unless you are also removing billing. Billing is starter-kit core.

If the database never left local Docker, `npx supabase db reset` after deleting the files is enough.

## 3. What stays

Auth, profiles, categories, tasks, sync, PWA, i18n, billing schema. The marketing page still mentions clients until you edit `src/components/ui/saas-template.tsx` — that copy is not behind `NICHE_MODULE`.
