-- Faz 1 tamamlama: sabit task_category enum'ı yerine kullanıcı tanımlı
-- kategoriler.
--
-- Enum dört değerle sınırlıydı ve değiştirmek migration gerektiriyordu.
-- Kategoriler artık kullanıcıya ait satırlar; ad ve renk serbestçe düzenlenir.
--
-- Kasıtlı olarak `unique (user_id, name)` YOKTUR. Uygulama local-first
-- çalışır: iki cihaz çevrimdışıyken aynı adla kategori oluşturabilir ve
-- ikisi de kendi id'sini üretir. Benzersizlik kısıtı olsaydı ikinci cihazın
-- push'u 23505 ile düşer, bununla birlikte o turdaki bütün görev
-- senkronizasyonu da başarısız olurdu. Bunun yerine aynı adlı kategoriler
-- istemcideki birleştirme motorunda (src/lib/sync-merge.ts) tekilleştirilir;
-- arayüz de aynı adı yeniden oluşturmayı engeller.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (
    char_length(btrim(name)) > 0 and char_length(name) <= 40
  ),
  -- Rozet rengi. Serbest metin değil: arayüz bunu doğrudan stile yazdığı için
  -- biçim veritabanı seviyesinde sabitlenir.
  color text not null default '#6366f1' check (color ~ '^#[0-9a-f]{6}$'),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categories is 'Kullanıcı tanımlı görev kategorileri. Ad benzersiz DEĞİLDİR; çakışma istemcide birleştirilir.';

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create index categories_user_id_position_idx on public.categories (user_id, position, created_at);

-- Bileşik yabancı anahtarın hedefi. Tek başına anlamsız görünür (id zaten
-- birincil anahtar) ama tasks tarafındaki (category_id, user_id) referansı
-- ancak bu benzersizlik varsa kurulabilir.
alter table public.categories add constraint categories_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- tasks.category -> tasks.category_id
-- ---------------------------------------------------------------------------

-- Nullable: kategori silmek görevi silmemeli, görev "Kategorisiz" olarak kalır.
-- Yabancı anahtar aşağıda, veri taşındıktan sonra eklenir.
alter table public.tasks add column category_id uuid;

-- Mevcut veriyi taşı: enum değeri olan her kullanıcı için dört varsayılan
-- kategori oluşturulur ve görevler bunlara bağlanır.
with defaults (key, name, color, pos) as (
  values
    ('work',     'İş',        '#3b82f6', 0::double precision),
    ('personal', 'Kişisel',   '#8b5cf6', 1),
    ('shopping', 'Alışveriş', '#10b981', 2),
    ('school',   'Okul',      '#f59e0b', 3)
),
owners as (
  select distinct user_id from public.tasks
),
inserted as (
  insert into public.categories (user_id, name, color, position)
  select o.user_id, d.name, d.color, d.pos
  from owners o
  cross join defaults d
  returning id, user_id, name
)
update public.tasks t
set category_id = i.id
from inserted i
join defaults d on d.name = i.name
where i.user_id = t.user_id
  and d.key = t.category::text;

alter table public.tasks drop column category;

drop type public.task_category;

-- Bileşik yabancı anahtar: (category_id, user_id).
--
-- Yalnızca `references categories (id)` yazmak yetmez. FK kontrolü RLS'i
-- atlar, dolayısıyla kullanıcı başkasının kategori id'sini bilirse görevini
-- ona bağlayabilirdi. Veri sızmaz (o satırı yine okuyamaz) ama görev yabancı
-- bir kategoriye asılı kalır. user_id'yi de referansa katmak bunu şemada
-- imkânsız kılar.
--
-- `set null (category_id)`: sütun listesi olmadan Postgres user_id'yi de
-- null'a çekmeye çalışır ve NOT NULL kısıtına takılırdı. Sütun listeli biçim
-- Postgres 15+ ile geliyor.
alter table public.tasks
  add constraint tasks_category_id_user_id_fkey
  foreign key (category_id, user_id) references public.categories (id, user_id)
  on delete set null (category_id);

create index tasks_category_id_idx on public.tasks (category_id) where category_id is not null;

-- ---------------------------------------------------------------------------
-- Yetkilendirme (GRANT)
-- ---------------------------------------------------------------------------
--
-- Postgres önce tablo yetkisine, sonra RLS politikasına bakar. Yetki
-- verilmezse politikalar hiç değerlendirilmez ve her istek "permission denied"
-- ile döner. `anon` rolüne bilinçli olarak hiçbir yetki verilmez.

grant select, insert, update, delete on public.categories to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;

create policy "Kullanici kendi kategorilerini gorebilir"
  on public.categories for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Kullanici kendi kategorilerini olusturabilir"
  on public.categories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi kategorilerini guncelleyebilir"
  on public.categories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi kategorilerini silebilir"
  on public.categories for delete
  to authenticated
  using ((select auth.uid()) = user_id);
