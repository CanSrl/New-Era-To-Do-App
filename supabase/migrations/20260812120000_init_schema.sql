-- Faz 1: temel şema, tetikleyiciler ve RLS politikaları.
--
-- Not: Enum değerleri arayüzdeki Türkçe etiketler yerine sabit İngilizce
-- anahtarlar olarak saklanır. Etiket metni değiştiğinde veri taşıma
-- gerekmesin diye; eşleme istemci tarafında (src/lib/supabase.ts) yapılır.

-- ---------------------------------------------------------------------------
-- Enum tipleri
-- ---------------------------------------------------------------------------

create type public.task_priority as enum ('low', 'medium', 'high');

create type public.task_category as enum ('work', 'personal', 'shopping', 'school');

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------------

-- Her güncellemede updated_at damgasını tazeler.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- completed alanı değiştikçe completed_at damgasını yönetir.
-- İstatistikler (ör. "bugün tamamlanan") bu kolona dayanır.
create or replace function public.set_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.completed then
      new.completed_at = coalesce(new.completed_at, now());
    else
      new.completed_at = null;
    end if;
  else
    if new.completed and not old.completed then
      new.completed_at = now();
    elsif not new.completed then
      new.completed_at = null;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'auth.users kaydına 1-1 eşlik eden, uygulamaya açık kullanıcı profili.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Yeni kullanıcı kaydolduğunda profil satırını otomatik oluşturur.
-- auth şemasına yazma yetkisi gerektiği için security definer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (
    char_length(btrim(title)) > 0 and char_length(title) <= 200
  ),
  description text check (char_length(description) <= 2000),
  due_date date,
  priority public.task_priority not null default 'medium',
  category public.task_category not null default 'personal',
  completed boolean not null default false,
  completed_at timestamptz,
  -- Sürükle-bırak sıralaması. Kayan nokta seçildi: iki görev arasına
  -- ekleme yapılırken tüm listeyi yeniden numaralandırmak gerekmesin diye.
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is 'Kullanıcıya ait görevler. Erişim yalnızca RLS ile sahibiyle sınırlıdır.';
comment on column public.tasks.position is 'Kullanıcı tanımlı sıralama anahtarı; küçük değer listede üstte.';

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger tasks_set_completed_at
  before insert or update of completed on public.tasks
  for each row execute function public.set_completed_at();

-- Listeyi sıralı çekmek için birincil erişim yolu.
create index tasks_user_id_position_idx on public.tasks (user_id, position, created_at);

-- Aktif görev sayacı / filtresi için kısmi indeks.
create index tasks_user_id_active_idx on public.tasks (user_id) where not completed;

-- Yaklaşan bitiş tarihi sorguları.
create index tasks_user_id_due_date_idx on public.tasks (user_id, due_date) where due_date is not null;

-- ---------------------------------------------------------------------------
-- Yetkilendirme (GRANT)
-- ---------------------------------------------------------------------------
--
-- Postgres önce tablo yetkisine, sonra RLS politikasına bakar. Yetki
-- verilmezse politikalar hiç değerlendirilmez ve her istek "permission denied"
-- ile döner; bu yüzden yetkiler açıkça verilmelidir.
--
-- `anon` rolüne bilinçli olarak hiçbir yetki verilmez: oturum açmamış
-- istemciler bu tabloların varlığına dahi erişemez.

grant select, insert, update, delete on public.tasks to authenticated;

-- profiles üzerinde delete yoktur: profil, auth.users silindiğinde cascade olur.
grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- Politikalar yalnızca `authenticated` rolüne verilir; `anon` hiçbir satıra
-- erişemez. auth.uid() çağrıları (select ...) içine sarılır — böylece Postgres
-- her satır yerine sorgu başına bir kez değerlendirir.

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

-- profiles: kullanıcı yalnızca kendi profilini görür ve günceller.
-- Silme politikası bilinçli olarak yoktur; profil auth.users silinince cascade olur.

create policy "Kullanici kendi profilini gorebilir"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Kullanici kendi profilini olusturabilir"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Kullanici kendi profilini guncelleyebilir"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- tasks: tam sahiplik.

create policy "Kullanici kendi gorevlerini gorebilir"
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Kullanici kendi gorevlerini olusturabilir"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi gorevlerini guncelleyebilir"
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi gorevlerini silebilir"
  on public.tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);
