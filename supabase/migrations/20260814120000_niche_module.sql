-- Faz 5 / 1. dilim: niş modül — müşteriler ve projeler.
--
-- Serbest çalışanlar ve küçük ajanslar için görevi müşteriye ve projeye
-- bağlama. Bu migration bilinçli olarak tek dosyada duruyor: starter kit
-- alıcısı niş modülü istemiyorsa dosyayı silip VITE_NICHE_MODULE'ü kapatarak
-- modülü tamamen çıkarabilsin.
--
-- `categories` ile aynı gerekçeyle burada da benzersizlik kısıtı YOKTUR:
-- iki cihaz çevrimdışıyken aynı adla müşteri oluşturabilir ve 23505 o turdaki
-- bütün senkronizasyonu düşürürdü. Tekilleştirme istemcideki birleştirme
-- motorunda, tekrar engelleme arayüzdedir.

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 80 karakter: kategorilerdeki 40'tan uzun, şirket adları uzayabiliyor.
  name text not null check (
    char_length(btrim(name)) > 0 and char_length(name) <= 80
  ),
  -- Serbest çalışan iki yılda onlarca müşteri biriktirir. Silme tek seçenek
  -- olsaydı geçmiş görevlerin bağı kopardı; arşiv seçiciden gizler ama
  -- geçmişi korur.
  archived boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clients is 'Niş modül: kullanıcının müşterileri. Ad benzersiz DEĞİLDİR; çakışma istemcide birleştirilir.';

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create index clients_user_id_position_idx on public.clients (user_id, position, created_at);

-- Bileşik yabancı anahtarların hedefi. Hem projects hem tasks buraya
-- (id, user_id) ikilisiyle bağlanacak ve referans ancak bu benzersizlik
-- varsa kurulabilir.
alter table public.clients add constraint clients_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Proje her zaman bir müşteriye aittir; müşterisiz proje anlamsız.
  client_id uuid not null,
  name text not null check (
    char_length(btrim(name)) > 0 and char_length(name) <= 80
  ),
  archived boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- user_id referansa katılıyor çünkü FK kontrolü RLS'i ATLAR. Tek sütunlu
  -- referans olsaydı kullanıcı başkasının müşteri id'sini bilirse projesini
  -- ona bağlayabilirdi. Veri sızmazdı ama proje yabancı bir müşteriye asılı
  -- kalırdı — categories/tasks ilişkisindeki gerekçenin aynısı.
  constraint projects_client_id_user_id_fkey
    foreign key (client_id, user_id) references public.clients (id, user_id)
    on delete cascade
);

comment on table public.projects is 'Niş modül: müşteriye ait projeler. Müşteri silinince cascade ile silinir.';

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create index projects_user_id_position_idx on public.projects (user_id, position, created_at);
create index projects_client_id_idx on public.projects (client_id);

-- tasks tarafındaki üçlü referansın hedefi. (id, user_id) DEĞİL: bir yabancı
-- anahtar ancak tam olarak referans verdiği sütun listesinin üzerindeki bir
-- benzersizlik kısıtına bağlanabilir.
alter table public.projects
  add constraint projects_id_client_id_user_id_key unique (id, client_id, user_id);

-- ---------------------------------------------------------------------------
-- tasks: müşteri ve proje bağları
-- ---------------------------------------------------------------------------

-- İkisi de nullable: görev müşterisiz olabilir, müşterili ama projesiz de
-- olabilir ("Acme için telefon görüşmesi").
alter table public.tasks add column client_id uuid;
alter table public.tasks add column project_id uuid;

-- Bileşik yabancı anahtarlar varsayılan MATCH SIMPLE ile çalışır: sütunlardan
-- HERHANGİ BİRİ null ise kısıt hiç değerlendirilmez. Bu check olmasaydı
-- project_id dolu / client_id boş bir satır aşağıdaki üçlü FK'yı sessizce
-- atlar ve müşterisiz bir projeye asılı görev oluşurdu.
alter table public.tasks
  add constraint tasks_project_requires_client
  check (project_id is null or client_id is not null);

-- Müşteri bağı. Referans eylemi yok: müşteri silmeyi aşağıdaki tetikleyici
-- üstlenir, çünkü iki alanın birden boşalması gerekiyor.
alter table public.tasks
  add constraint tasks_client_id_user_id_fkey
  foreign key (client_id, user_id) references public.clients (id, user_id);

-- Tasarımın kilit noktası: client_id referansa katıldığı için "görev A
-- müşterisine bağlı ama projesi B müşterisinin" durumu ŞEMADA imkânsız.
-- Uygulama katmanında kontrol etmek yetmezdi; doğrudan API çağrısıyla aşılırdı.
--
-- on delete set null (project_id): tek bir proje silinince görev silinmez,
--   yalnızca proje bağı kopar; client_id yerinde kalır, dolayısıyla yukarıdaki
--   check bozulmaz. Sütun listeli biçim Postgres 15+ ile geliyor.
-- on update cascade: kullanıcı bir projeyi başka müşteriye taşırsa
--   (projects.client_id güncellenir) bağlı görevlerin client_id'si de otomatik
--   taşınır; bu olmasaydı güncelleme FK hatasıyla düşerdi.
alter table public.tasks
  add constraint tasks_project_id_client_id_user_id_fkey
  foreign key (project_id, client_id, user_id)
    references public.projects (id, client_id, user_id)
  on delete set null (project_id)
  on update cascade;

create index tasks_client_id_idx on public.tasks (client_id) where client_id is not null;
create index tasks_project_id_idx on public.tasks (project_id) where project_id is not null;

-- ---------------------------------------------------------------------------
-- Müşteri silme: görevlerin iki bağını da boşalt
-- ---------------------------------------------------------------------------
--
-- Neden tetikleyici gerekiyor: müşteri silinince projeleri cascade ile gitmeli
-- AMA görevlerin İKİ alanı birden boşalmalı. Bunu yalnızca referans
-- eylemleriyle ifade etmek mümkün değil — tasks_client_id_user_id_fkey'e
-- "on delete set null" verilseydi sadece client_id boşalır, project_id dolu
-- kalır ve tasks_project_requires_client patlardı. set null'un sütun listesi
-- yalnızca o kısıtın KENDİ referans sütunlarını kabul eder; project_id oraya
-- yazılamaz.
--
-- Tek where yetiyor: projesi üzerinden bağlı her görevin client_id'si zaten
-- aynı müşteriyi gösterir — üstteki üçlü FK bunu garanti ediyor.
--
-- security definer DEĞİL: tetikleyici çağıran kullanıcının yetkisiyle çalışır,
-- güncellediği satırlar zaten onun kendi görevleridir ve tasks üzerindeki RLS
-- update politikası buna izin verir. Gereksiz bir yetki yükseltmesi olurdu.
create function public.clear_tasks_for_deleted_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.tasks
     set client_id = null, project_id = null
   where client_id = old.id;
  return old;
end;
$$;

-- Satır bazlı before delete tetikleyicisi, yabancı anahtarların referans
-- eylemlerinden (bunlar dahili after tetikleyicileridir) ÖNCE çalışır.
-- Görevler temizlendikten sonra cascade projeleri siler ve ortada onlara
-- işaret eden görev kalmaz.
create trigger clients_clear_tasks
  before delete on public.clients
  for each row execute function public.clear_tasks_for_deleted_client();

-- ---------------------------------------------------------------------------
-- Yetkilendirme (GRANT)
-- ---------------------------------------------------------------------------
--
-- Postgres önce tablo yetkisine, sonra RLS politikasına bakar. Yetki
-- verilmezse politikalar hiç değerlendirilmez ve her istek "permission denied"
-- ile döner. `anon` rolüne bilinçli olarak hiçbir yetki verilmez.

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.clients enable row level security;

create policy "Kullanici kendi musterilerini gorebilir"
  on public.clients for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Kullanici kendi musterilerini olusturabilir"
  on public.clients for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi musterilerini guncelleyebilir"
  on public.clients for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi musterilerini silebilir"
  on public.clients for delete
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.projects enable row level security;

create policy "Kullanici kendi projelerini gorebilir"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Kullanici kendi projelerini olusturabilir"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi projelerini guncelleyebilir"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi projelerini silebilir"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);
