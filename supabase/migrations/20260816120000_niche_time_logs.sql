-- Faz 3 / niş modül 2. dilim: zaman kaydı.
--
-- Niş modül artık İKİ migration dosyasıdır. Modülü çıkarmak ikisini birden
-- silmek demektir ve sıra önemlidir (time_logs clients/projects'e bağlı).
-- Ayrıca bu dosya jenerik `tasks` tablosuna dokunan tek bir kısıt ekliyor
-- (tasks_id_user_id_key); çıkarma yordamı onu da düşürmeli.

-- ---------------------------------------------------------------------------
-- Ücret sütunları
-- ---------------------------------------------------------------------------

-- Miras kuralı: projects.hourly_rate null ise müşterininki geçerlidir.
-- null ile 0 FARKLIDIR: 0 "bu proje ücretsiz" demektir ve mirası ezer.
alter table public.clients
  add column hourly_rate numeric(10,2) not null default 0
    check (hourly_rate >= 0),
  add column currency text not null default 'TRY'
    check (char_length(currency) = 3);

alter table public.projects
  add column hourly_rate numeric(10,2)
    check (hourly_rate is null or hourly_rate >= 0);

-- ---------------------------------------------------------------------------
-- Bileşik FK'nın hedefi
-- ---------------------------------------------------------------------------
--
-- tasks bugüne kadar hiç referans hedefi olmamıştı, dolayısıyla (id, user_id)
-- benzersizliği yok. Bileşik FK ancak tam olarak referans verdiği sütun
-- listesinin üzerindeki bir benzersizliğe bağlanabilir.
alter table public.tasks add constraint tasks_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- time_logs
-- ---------------------------------------------------------------------------

create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Görev opsiyonel: "Acme ile 40 dk telefon görüşmesi" için görev açmak
  -- zorunda olmamalı. Görev silinince kayıt DURUR, yalnızca bağı kopar.
  task_id uuid,

  -- Müşteri zorunlu: faturalanamayan saat bu modülün konusu değil.
  client_id uuid not null,
  project_id uuid,

  started_at timestamptz not null,
  -- 1440 tavanı: 24 saatten uzun tek kayıt neredeyse kesinlikle unutulmuş
  -- bir sayaçtır, veri değil.
  duration_minutes integer not null
    check (duration_minutes > 0 and duration_minutes <= 1440),
  note text check (note is null or char_length(note) <= 200),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.time_logs is 'Niş modül: faturalanabilir zaman kayıtları. Her kayıt kendi id''si olan ayrı bir giriştir; iki cihazın kayıtları birleşmede toplanır.';

create trigger time_logs_set_updated_at
  before update on public.time_logs
  for each row execute function public.set_updated_at();

-- Faz 2'deki (tasks) benzer check YOKTUR burada. Oradaki kısıt, MATCH SIMPLE
-- boşluğunu (bileşik FK'da sütunlardan biri null ise kısıt hiç
-- değerlendirilmez) kapatmak için gerekliydi çünkü tasks.client_id
-- NULLABLE'dır. Burada client_id `not null`, yani project_id dolu / client_id
-- boş bir satır zaten NOT NULL kısıtına takılır — üçlü FK boşluğuna hiç
-- ulaşılamaz. Bu kısıt gerçekte ölü koddu (hiçbir girdi onu tetikleyemezdi).
-- ⚠️ client_id NULLABLE yapılırsa bu yorum geçersiz olur ve
-- `check (project_id is null or client_id is not null)` buraya GERİ
-- EKLENMELİDİR — Faz 2'deki desene bakıp otomatik eklemeyin, önce bu notu
-- silin.

-- Sütun listesi ŞART: listesiz "on delete set null" referansın BÜTÜN
-- sütunlarını (user_id dahil) boşaltmaya çalışır ve not null ile patlar.
alter table public.time_logs
  add constraint time_logs_task_id_user_id_fkey
  foreign key (task_id, user_id) references public.tasks (id, user_id)
  on delete set null (task_id);

-- client_id not null olduğu için boşaltılamaz: müşteri silinince kayıt da
-- gider. Geçmişi korumanın yolu arşivlemektir.
alter table public.time_logs
  add constraint time_logs_client_id_user_id_fkey
  foreign key (client_id, user_id) references public.clients (id, user_id)
  on delete cascade;

-- client_id referansa katıldığı için "kayıt A müşterisine bağlı ama projesi
-- B müşterisinin" durumu ŞEMADA imkânsız.
alter table public.time_logs
  add constraint time_logs_project_id_client_id_user_id_fkey
  foreign key (project_id, client_id, user_id)
    references public.projects (id, client_id, user_id)
  on delete set null (project_id)
  on update cascade;

create index time_logs_user_id_started_at_idx
  on public.time_logs (user_id, started_at desc);
create index time_logs_client_id_idx on public.time_logs (client_id);
create index time_logs_project_id_idx
  on public.time_logs (project_id) where project_id is not null;
create index time_logs_task_id_idx
  on public.time_logs (task_id) where task_id is not null;

-- ---------------------------------------------------------------------------
-- Yetkilendirme ve RLS
-- ---------------------------------------------------------------------------
--
-- GRANT olmadan RLS politikaları HİÇ değerlendirilmez ve her istek
-- "permission denied" ile döner. Bu bir kez gerçek bir hataya yol açtı.

grant select, insert, update, delete on public.time_logs to authenticated;

alter table public.time_logs enable row level security;

create policy "Kullanici kendi zaman kayitlarini gorebilir"
  on public.time_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Kullanici kendi zaman kayitlarini olusturabilir"
  on public.time_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi zaman kayitlarini guncelleyebilir"
  on public.time_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Kullanici kendi zaman kayitlarini silebilir"
  on public.time_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);
