-- Faz 4: abonelik tablosu, is_pro ve client_count.
--
-- Faturalama starter kit'in kendisine aittir (niş modüle değil). Kullanıcı
-- kendi satırını yazamaz — yazan yalnızca webhook (service role). GRANT
-- verilmezse RLS politikaları hiç değerlendirilmez.

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'lemonsqueezy',
  provider_subscription_id text not null unique,
  provider_customer_id text,
  -- Sağlayıcının kendi durum metni; uygulama enum'una çevrilmez.
  status text not null,
  variant_id text,
  renews_at timestamptz,
  ends_at timestamptz,
  trial_ends_at timestamptz,
  test_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Hesap başına tek abonelik. Kullanıcıya salt okunur; yazan webhook (service role).';

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Pro: aktif, deneme veya dönem sonuna kadar geçerli iptal.
-- cancelled LS'de "iptal edildi ama dönem bitene kadar açık" demektir.
create or replace function public.is_pro(uid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = uid
      and s.status in ('active', 'on_trial', 'cancelled')
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

comment on function public.is_pro(uuid) is
  'Abonelik Pro sayılır mı. cancelled, ends_at geçene kadar Pro''dur.';

-- clients INSERT politikası içinden sayım: aynı tabloyu RLS altında
-- okumak iç içe geçerdi. security definer RLS'i atlar, arşivli dahil sayar.
create or replace function public.client_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  -- auth.uid() kontrolü yoksa herkes başkasının müşteri sayısını öğrenirdi.
  select case
    when uid is not distinct from auth.uid()
      then (select count(*)::integer from public.clients where user_id = uid)
    else 0
  end;
$$;

comment on function public.client_count(uuid) is
  'Kullanıcının müşteri sayısı (arşivli dahil). Kapı WITH CHECK için.';

-- Yeni fonksiyonlara PUBLIC execute gelir; kapatılmazsa anon da çağırır.
revoke all on function public.is_pro(uuid) from public;
revoke all on function public.client_count(uuid) from public;
grant execute on function public.is_pro(uuid) to authenticated, service_role;
grant execute on function public.client_count(uuid) to authenticated, service_role;

grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

create policy "Kullanici kendi aboneligini gorebilir"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);
