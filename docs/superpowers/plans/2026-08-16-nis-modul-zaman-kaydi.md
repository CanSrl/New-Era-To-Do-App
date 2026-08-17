# Niş modül 2. dilim: zaman kaydı ve dışa aktarım — uygulama planı

> **Ajan çalışanlar için:** ZORUNLU ALT SKILL: Bu planı görev görev uygulamak
> için `superpowers:subagent-driven-development` (önerilen) ya da
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox
> (`- [ ]`) söz dizimi kullanır.

**Hedef:** Serbest çalışan harcadığı süreyi görev/müşteri/proje bazında
ölçebilsin, faturalanabilir tutarı görsün ve CSV olarak dışarı çıkarsın;
starter kit alıcısı aynı modülü tek bayrakla izsiz çıkarabilsin.

**Mimari:** `time_logs` motorun dördüncü senkron varlığıdır ve `mergeTasks`
kalıbını izler (adı yok → ada göre tekilleştirme ve `idRemap` yok). Çalışan
sayaç cihaza özeldir, tek tanedir ve **senkronlanmaz**; yalnızca durdurulmuş
kayıt buluta gider. Her kaydın kendi UUID'si olduğu için iki cihazın kayıtları
birleşmede toplanır — TIME-04 tasarımla karşılanır.

**Yığın:** React 19, TypeScript, Vite 8, Zustand (persist), Supabase (Postgres
+ RLS), Radix, react-i18next, Vitest, Playwright, `papaparse` (yeni).

**Spec:** `docs/superpowers/specs/2026-08-16-nis-modul-zaman-kaydi-design.md`

## Global Constraints

Bu bölüm her görevin gereksinimlerine örtük olarak dâhildir.

- **Dil:** Kod içi yorumlar ve commit mesajları Türkçe; dosya/klasör yolları,
  tip adları ve fonksiyon adları İngilizce. Mevcut kod tabanının deseni budur.
- **`tsconfig.app.json` katı ayarları korunur:** `strict`, `noUnusedLocals`,
  `erasableSyntaxOnly`. Sonuncusu constructor parametre özelliğini
  (`constructor(public readonly x)`) **yasaklar** — alan açıkça tanımlanır.
- **Çeviri anahtarları tiplidir.** `src/i18n/i18next.d.ts` Türkçe dosyayı
  referans alır; olmayan anahtar **derleme hatası** verir. Niş anahtarlar
  `src/i18n/locales/tr.niche.json` ve `en.niche.json` içine, `time.*` ön ekiyle.
  İki dosya aynı şekli taşımalı — `src/i18n/i18n.test.ts` bunu doğrular.
- **Kullanıcıya metin döndüren saf katmanlar `TranslationKey` döndürür**, hazır
  metin değil.
- **Saf fonksiyonlar `Date.now()`/`new Date()` çağırmaz**; `now` parametre
  olarak geçer. Testte sahte saat kurmak gerekmesin diye.
- **`NICHE_MODULE`** `src/config/features.ts`'ten gelen **çıplak sabittir**
  (nesne özelliği değil — `vite.config.ts` → `define` ile ham boolean enjekte
  edilir, özellik erişimi derleme zamanında katlanmaz).
- **Bayrak koşulu modül gövdesinde / rota kaydı seviyesinde olur**, render
  içinde değil (DEC-NICHE-01).
- **Para alanı `numeric(10,2)`**, `double precision` değil. İstemcide `number`.
- **Miras kuralında `??` kullanılır, `||` kullanılmaz.** `projects.hourly_rate`
  `null` = "müşteriden miras", `0` = "bu proje ücretsiz". `0 || rate` mirası
  yanlışlıkla geri getirirdi.
- **Yerel Supabase gerekir** (`npx supabase start`). `.env.local` **yerel**
  yığını göstermeli, bulut projesini değil — aksi halde E2E bulutun hız
  sınırına takılır ve hata bir kod regresyonu gibi görünür.
- **Her görev testleri yeşilken kapanır.** `npm test` (birim), `npm run lint`,
  `npx tsc --noEmit`.

---

### Task 1: Şema — `time_logs`, ücret sütunları, RLS

**Files:**
- Create: `supabase/migrations/20260816120000_niche_time_logs.sql`
- Modify: `supabase/tests/rls.test.mjs` (yeni testler eklenir)
- Modify: `src/lib/database.types.ts` (üretilir, elle yazılmaz)

**Interfaces:**
- Consumes: mevcut `clients`, `projects`, `tasks` tabloları ve
  `public.set_updated_at()` tetikleyici fonksiyonu
- Produces: `public.time_logs` tablosu; `clients.hourly_rate`,
  `clients.currency`, `projects.hourly_rate` sütunları; `tasks_id_user_id_key`
  benzersizlik kısıtı. `Database['public']['Tables']['time_logs']['Row' |
  'Insert']` tipleri Task 4 tarafından kullanılır.

- [ ] **Step 1: Migration dosyasını yaz**

`supabase/migrations/20260816120000_niche_time_logs.sql`:

```sql
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

-- Bileşik FK'lar varsayılan MATCH SIMPLE ile çalışır: sütunlardan HERHANGİ
-- BİRİ null ise kısıt hiç değerlendirilmez. Bu check olmasaydı project_id
-- dolu / client_id boş satır aşağıdaki üçlü FK'yı sessizce atlardı.
alter table public.time_logs
  add constraint time_logs_project_requires_client
  check (project_id is null or client_id is not null);

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
```

- [ ] **Step 2: Migration'ı uygula ve tipleri üret**

```bash
npx supabase db reset
npm run db:types
```

Beklenen: reset hatasız biter, `src/lib/database.types.ts` içinde `time_logs`
görünür. `db reset` sonrası API 502 dönerse ağ geçidi eski adresi
önbelleklemiştir: `docker restart supabase_kong_yapilacaklar-listesi`.

- [ ] **Step 3: Şema güvenlik testlerini yaz (önce, düşmeleri için)**

`supabase/tests/rls.test.mjs` içine, mevcut niş testlerinin yanına. Dosyadaki
mevcut yardımcı (iki kullanıcı açan) kullanılır — yeni bir yardımcı yazılmaz.

Eklenecek sekiz test:

1. B kullanıcısı A'nın zaman kaydını **okuyamaz** (select boş döner)
2. B kullanıcısı A'nın zaman kaydını **güncelleyemez/silemez**
3. Başkasının müşterisine zaman kaydı **yazılamaz** (FK reddi)
4. Tutarsız `(project_id, client_id)` çifti **reddedilir**
5. `project_id` dolu / `client_id` boş satır **reddedilir** (check)
6. `duration_minutes` 0, negatif ve 1441 **reddedilir**; 1440 kabul edilir
7. Görev silinince kayıt **durur** ve `task_id` null olur
8. Müşteri silinince kayıt **silinir**; proje silinince kayıt **durur** ve
   `project_id` null olur

Örnek (kalanları aynı desende yazın):

```js
test('musteri silinince zaman kaydi da silinir, gorev silinince kayit durur', async () => {
    const { userA } = await twoUsers();

    const client = await insertClient(userA, { name: 'Acme' });
    const task = await insertTask(userA, { title: 'Rapor', client_id: client.id });

    const { data: log } = await userA
        .from('time_logs')
        .insert({
            user_id: userA.userId,
            task_id: task.id,
            client_id: client.id,
            started_at: '2026-08-16T09:00:00Z',
            duration_minutes: 90,
        })
        .select()
        .single();

    // Görev silinince kayıt DURUR, yalnızca bağı kopar.
    await userA.from('tasks').delete().eq('id', task.id);
    const { data: afterTask } = await userA
        .from('time_logs').select('*').eq('id', log.id).maybeSingle();
    assert.ok(afterTask, 'gorev silinince zaman kaydi silinmemeli');
    assert.equal(afterTask.task_id, null);

    // Müşteri silinince kayıt GİDER: client_id not null, bosaltilamaz.
    await userA.from('clients').delete().eq('id', client.id);
    const { data: afterClient } = await userA
        .from('time_logs').select('*').eq('id', log.id).maybeSingle();
    assert.equal(afterClient, null, 'musteri silinince zaman kaydi da gitmeli');
});
```

- [ ] **Step 4: Şema testlerini koştur**

Run: `npm run test:rls`
Beklenen: **PASS** — bu adımda testler zaten geçmeli, çünkü Step 1'deki
migration davranışları sağlıyor. Bir tanesi düşerse şemada hata var; testi
değil migration'ı düzeltin.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260816120000_niche_time_logs.sql \
        supabase/tests/rls.test.mjs src/lib/database.types.ts
git commit -m "Zaman kaydi semasi: time_logs, ucret sutunlari, tam RLS"
```

---

### Task 2: Tipler ve saf yardımcılar

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/time-logs.ts`
- Test: `src/lib/time-logs.test.ts`

**Interfaces:**
- Consumes: `createId`, `toIsoTimestamp` (`src/lib/tasks.ts`)
- Produces:
  - `interface TimeLog { id, taskId: string|null, clientId: string,
    projectId: string|null, startedAt: string, durationMinutes: number,
    note: string|null, createdAt: string, updatedAt: string }`
  - `interface ActiveTimer { taskId, clientId, projectId, startedAt, note }`
  - `Client.hourlyRate: number`, `Client.currency: string`,
    `Project.hourlyRate: number | null`
  - `effectiveRate(client: Client, project?: Project | null): number`
  - `amountFor(log: TimeLog, client: Client, project?: Project | null): number`
  - `elapsedMinutes(timer: ActiveTimer, now: string): number`
  - `normalizeTimeLog(raw: unknown): TimeLog | null`
  - `createTimeLog(input, now?): TimeLog`
  - `TIME_LOG_MAX_MINUTES = 1440`, `TIME_LOG_NOTE_MAX = 200`

- [ ] **Step 1: Failing test'i yaz**

`src/lib/time-logs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { amountFor, effectiveRate, elapsedMinutes, normalizeTimeLog } from './time-logs';
import type { Client, Project, TimeLog } from './types';

const client: Client = {
    id: 'c1', name: 'Acme', archived: false, position: 0,
    hourlyRate: 1500, currency: 'TRY',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};

const project = (hourlyRate: number | null): Project => ({
    ...client, id: 'p1', clientId: 'c1', name: 'Site', hourlyRate,
});

describe('effectiveRate', () => {
    it('proje ucreti null ise musteriden miras alir', () => {
        expect(effectiveRate(client, project(null))).toBe(1500);
    });

    it('proje yoksa musteri ucreti gecerlidir', () => {
        expect(effectiveRate(client, null)).toBe(1500);
    });

    // Regresyon: `project.hourlyRate || client.hourlyRate` yazilsaydi 0
    // mirasa duser ve ucretsiz proje sessizce faturalanirdi.
    it('projenin 0 ucreti mirasi EZER — ucretsiz proje demektir', () => {
        expect(effectiveRate(client, project(0))).toBe(0);
    });

    it('proje ucreti doluysa musteriyi ezer', () => {
        expect(effectiveRate(client, project(2000))).toBe(2000);
    });
});

describe('amountFor', () => {
    const log: TimeLog = {
        id: 'l1', taskId: null, clientId: 'c1', projectId: null,
        startedAt: '2026-08-16T09:00:00.000Z', durationMinutes: 90, note: null,
        createdAt: '2026-08-16T09:00:00.000Z', updatedAt: '2026-08-16T09:00:00.000Z',
    };

    it('sure x etkin ucret', () => {
        expect(amountFor(log, client, null)).toBe(2250); // 1.5 saat x 1500
    });
});

describe('elapsedMinutes', () => {
    it('now ile startedAt arasindaki farki dakika olarak verir', () => {
        const timer = {
            taskId: 't1', clientId: 'c1', projectId: null,
            startedAt: '2026-08-16T09:00:00.000Z', note: null,
        };
        expect(elapsedMinutes(timer, '2026-08-16T10:30:00.000Z')).toBe(90);
    });

    // Sayac startedAt damgasindan turetilir; sekme uykuya dalsa da dogru kalir.
    it('gecmise donuk saat farkinda negatif dondurmez', () => {
        const timer = {
            taskId: null, clientId: 'c1', projectId: null,
            startedAt: '2026-08-16T10:00:00.000Z', note: null,
        };
        expect(elapsedMinutes(timer, '2026-08-16T09:00:00.000Z')).toBe(0);
    });
});

describe('normalizeTimeLog', () => {
    it('musterisiz kaydi reddeder', () => {
        expect(normalizeTimeLog({ id: 'l1', durationMinutes: 30 })).toBeNull();
    });

    it('suresi tavani asan kaydi reddeder', () => {
        expect(normalizeTimeLog({
            id: 'l1', clientId: 'c1',
            startedAt: '2026-08-16T09:00:00.000Z', durationMinutes: 1441,
        })).toBeNull();
    });

    it('projeli ama musterisiz kaydi reddeder', () => {
        expect(normalizeTimeLog({
            id: 'l1', projectId: 'p1',
            startedAt: '2026-08-16T09:00:00.000Z', durationMinutes: 30,
        })).toBeNull();
    });
});
```

- [ ] **Step 2: Test'i koştur, düştüğünü doğrula**

Run: `npx vitest run src/lib/time-logs.test.ts`
Beklenen: FAIL — `Failed to resolve import "./time-logs"`

- [ ] **Step 3: Tipleri ekle**

`src/lib/types.ts` içinde `Client`'a iki alan, `Project`'e bir alan:

```ts
export interface Client {
    // ...mevcut alanlar...
    /**
     * Saatlik ücret. Zorunlu ve varsayılanı 0 — "ücret girilmemiş" ile
     * "ücretsiz" arasında müşteri seviyesinde ayrım yapılmıyor; ayrım
     * projedeki null/0 farkında yaşıyor.
     */
    hourlyRate: number;
    /** ISO 4217, üç harf. Dönüşüm yapılmaz; toplamlar para birimi başına alınır. */
    currency: string;
}

export interface Project extends Client {
    clientId: string;
    /**
     * Müşteriyi ezen opsiyonel ücret. `null` = miras, `0` = bu proje
     * ücretsiz. İkisi FARKLIDIR; çözerken `??` kullanılır, `||` değil.
     */
    hourlyRate: number | null;
}
```

Ve `TimeLog` + `ActiveTimer` (spec §2'deki tam gövde).

⚠️ `Project extends Client` olduğu için `hourlyRate` daraltması TypeScript'te
**hata verir** (`number | null` `number`'a atanamaz). `Project` bu yüzden
`extends Client` olmaktan çıkarılıp `Omit<Client, 'hourlyRate'>` üzerine
kurulur:

```ts
export interface Project extends Omit<Client, 'hourlyRate'> {
    clientId: string;
    hourlyRate: number | null;
}
```

`byArchivedThenPosition` gibi ortak karşılaştırıcılar `Client`'ı değil
`{ archived: boolean; position: number; createdAt: string }` yapısal tipini
almalı — aksi halde `Project` artık geçmez. `src/lib/clients.ts` içindeki üç
karşılaştırıcının imzası buna göre daraltılır.

- [ ] **Step 4: `time-logs.ts`'i yaz**

```ts
import type { ActiveTimer, Client, Project, TimeLog } from './types';
import { createId, toIsoTimestamp } from './tasks';

/** Veritabanı kısıtıyla aynı: 24 saatten uzun tek kayıt unutulmuş sayaçtır. */
export const TIME_LOG_MAX_MINUTES = 1440;
export const TIME_LOG_NOTE_MAX = 200;

/**
 * Etkin saatlik ücret.
 *
 * `??` ŞART: projenin `0` ücreti "bu proje ücretsiz" demektir ve mirası ezer.
 * `||` yazılsaydı 0 mirasa düşer, ücretsiz proje sessizce faturalanırdı.
 */
export function effectiveRate(client: Client, project?: Project | null): number {
    return project?.hourlyRate ?? client.hourlyRate;
}

/** Kaydın tutarı. Saklanmaz, her okumada hesaplanır (bkz. spec §1.2). */
export function amountFor(
    log: TimeLog,
    client: Client,
    project?: Project | null
): number {
    return (log.durationMinutes / 60) * effectiveRate(client, project);
}

/**
 * Çalışan sayacın süresi. `startedAt` damgasından türetilir — ekrandaki
 * `setInterval` bir sayaç değil, yalnızca yeniden render tetikleyicisidir.
 * Sekme uykuya dalsa da süre doğru kalır.
 */
export function elapsedMinutes(timer: ActiveTimer, now: string): number {
    const ms = new Date(now).getTime() - new Date(timer.startedAt).getTime();
    // Saat geri alındıysa negatif çıkabilir; süre negatif olamaz.
    return Math.max(0, Math.floor(ms / 60_000));
}

/** Dışarıdan gelen ham veriyi geçerli bir TimeLog'a çevirir. */
export function normalizeTimeLog(raw: unknown): TimeLog | null {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;

    const clientId = typeof source.clientId === 'string' ? source.clientId : '';
    if (!clientId) return null;

    const projectId = typeof source.projectId === 'string' ? source.projectId : null;
    // Şemadaki time_logs_project_requires_client'in istemci karşılığı.
    if (projectId && !clientId) return null;

    const durationMinutes = typeof source.durationMinutes === 'number'
        ? Math.floor(source.durationMinutes)
        : NaN;
    if (
        !Number.isFinite(durationMinutes)
        || durationMinutes <= 0
        || durationMinutes > TIME_LOG_MAX_MINUTES
    ) return null;

    const createdAt = toIsoTimestamp(source.createdAt);
    const note = typeof source.note === 'string' && source.note.trim()
        ? source.note.trim().slice(0, TIME_LOG_NOTE_MAX)
        : null;

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        taskId: typeof source.taskId === 'string' ? source.taskId : null,
        clientId,
        projectId,
        startedAt: toIsoTimestamp(source.startedAt),
        durationMinutes,
        note,
        createdAt,
        updatedAt: source.updatedAt == null ? createdAt : toIsoTimestamp(source.updatedAt),
    };
}

/** Yeni bir zaman kaydı üretir. */
export function createTimeLog(
    input: {
        taskId?: string | null;
        clientId: string;
        projectId?: string | null;
        startedAt: string;
        durationMinutes: number;
        note?: string | null;
    },
    now: string = new Date().toISOString()
): TimeLog {
    return {
        id: createId(),
        taskId: input.taskId ?? null,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        startedAt: input.startedAt,
        durationMinutes: Math.min(
            Math.max(1, Math.floor(input.durationMinutes)),
            TIME_LOG_MAX_MINUTES
        ),
        note: input.note?.trim().slice(0, TIME_LOG_NOTE_MAX) || null,
        createdAt: now,
        updatedAt: now,
    };
}
```

- [ ] **Step 5: Test'i koştur, geçtiğini doğrula**

Run: `npx vitest run src/lib/time-logs.test.ts`
Beklenen: PASS

- [ ] **Step 6: Mevcut testleri koştur (tip daraltması kırmış olabilir)**

Run: `npm test && npx tsc --noEmit && npm run lint`
Beklenen: hepsi PASS. `Project extends Omit<Client, 'hourlyRate'>`
değişikliği `clients.ts`, `projects.ts`, `sync-merge-niche.ts` ve
`niche-mapping.ts`'te tip hatası verirse **imzaları yapısal tipe daraltarak**
düzeltin; `as` ile bastırmayın.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/time-logs.ts src/lib/time-logs.test.ts \
        src/lib/clients.ts src/lib/projects.ts
git commit -m "Zaman kaydi tipleri ve saf yardimcilari"
```

---

### Task 3: Store — alanlar, eylemler, v5 → v6 göçü

**Files:**
- Modify: `src/store/index.ts`
- Test: `src/store/index.test.ts`

**Interfaces:**
- Consumes: `createTimeLog`, `normalizeTimeLog`, `elapsedMinutes` (Task 2)
- Produces: store alanları `timeLogs: TimeLog[]`, `activeTimer: ActiveTimer|null`,
  `dirtyTimeLogIds: string[]`, `timeLogTombstones: Tombstone[]`; eylemler
  `startTimer(input)`, `stopTimer(now?)`, `discardTimer()`,
  `addTimeLog(input)`, `updateTimeLog(id, patch)`, `deleteTimeLog(id)`.
  `applySyncResult` üç opsiyonel alan daha alır: `timeLogs?`,
  `syncedTimeLogIds?`, `clearedTimeLogTombstoneIds?` (Task 4 kullanır).
  Sayaç eylemlerinin imzaları: `startTimer(input, now?: string)`,
  `stopTimer(now?: string)` — `now` opsiyoneldir ve testler açıkça geçirir.

- [ ] **Step 1: Failing test'leri yaz**

`src/store/index.test.ts` içine:

```ts
describe('zaman kaydi', () => {
    // `now` acikca gecirilir: sahte saat kurmadan sure uretebilmek icin
    // startTimer/stopTimer ikisi de opsiyonel bir `now` aliyor.
    const T0 = '2026-08-16T09:00:00.000Z';
    const T30 = '2026-08-16T09:30:00.000Z';

    it('startTimer calisan sayaci ONCE durdurup kaydeder — tek sayac kurali', () => {
        const store = useTaskStore.getState();
        store.startTimer({ taskId: 't1', clientId: 'c1', projectId: null }, T0);
        store.startTimer({ taskId: 't2', clientId: 'c1', projectId: null }, T30);

        const state = useTaskStore.getState();
        expect(state.activeTimer?.taskId).toBe('t2');
        expect(state.activeTimer?.startedAt).toBe(T30);
        expect(state.timeLogs).toHaveLength(1);
        expect(state.timeLogs[0].taskId).toBe('t1');
        expect(state.timeLogs[0].durationMinutes).toBe(30);
        // Kayit gonderilmeyi bekler; pendingCount bunu gormek zorunda.
        expect(state.dirtyTimeLogIds).toEqual([state.timeLogs[0].id]);
    });

    it('stopTimer 1 dakikadan kisa sureyi kaydetmez', () => {
        const store = useTaskStore.getState();
        store.startTimer({ taskId: 't1', clientId: 'c1', projectId: null }, T0);
        store.stopTimer(T0); // aninda durdurulan sayac

        expect(useTaskStore.getState().timeLogs).toHaveLength(0);
        expect(useTaskStore.getState().activeTimer).toBeNull();
    });

    it('discardTimer kayit uretmeden sayaci atar', () => {
        const store = useTaskStore.getState();
        store.startTimer({ taskId: 't1', clientId: 'c1', projectId: null }, T0);
        store.discardTimer();

        expect(useTaskStore.getState().activeTimer).toBeNull();
        expect(useTaskStore.getState().timeLogs).toHaveLength(0);
    });

    it('deleteClient bagli zaman kayitlarini da siler (DB cascade ile ayni)', () => {
        const store = useTaskStore.getState();
        // ... musteri + zaman kaydi kur ...
        store.deleteClient(clientId);

        const state = useTaskStore.getState();
        expect(state.timeLogs.filter((l) => l.clientId === clientId)).toHaveLength(0);
        // Sunucu zaten cascade ile siliyor: mezar tasi BIRAKILMAZ.
        expect(state.timeLogTombstones).toHaveLength(0);
    });

    it('deleteProject kaydi silmez, yalnizca proje bagini bosaltir', () => {
        // ... kur ...
        store.deleteProject(projectId);
        const log = useTaskStore.getState().timeLogs[0];
        expect(log.projectId).toBeNull();
        expect(log.clientId).toBe(clientId);
    });

    it('deleteTask kaydi silmez, yalnizca gorev bagini bosaltir', () => {
        // ... kur ...
        store.deleteTask(taskId);
        expect(useTaskStore.getState().timeLogs[0].taskId).toBeNull();
    });
});

describe('v5 -> v6 gocu', () => {
    it('eski kayda bos zaman alanlari ekler, mevcut veriye dokunmaz', () => {
        const migrated = migrate(
            { tasks: [{ id: 't1', title: 'X' }], clients: [{ id: 'c1', name: 'Acme' }] },
            5
        );
        expect(migrated.timeLogs).toEqual([]);
        expect(migrated.activeTimer).toBeNull();
        expect(migrated.dirtyTimeLogIds).toEqual([]);
        expect(migrated.timeLogTombstones).toEqual([]);
        // Ucret alanlari eski musterilerde yok; varsayilana duser.
        expect(migrated.clients[0].hourlyRate).toBe(0);
        expect(migrated.clients[0].currency).toBe('TRY');
        expect(migrated.tasks).toHaveLength(1);
    });
});
```

Mevcut test dosyası göç fonksiyonuna nasıl eriştiğini (v4 → v5 testine bakın)
aynen izleyin; yeni bir erişim yolu icat etmeyin.

- [ ] **Step 2: Test'leri koştur, düştüklerini doğrula**

Run: `npx vitest run src/store/index.test.ts`
Beklenen: FAIL — `startTimer is not a function`

- [ ] **Step 3: Store alanlarını ve eylemleri ekle**

`TaskState` arayüzüne dört alan, başlangıç durumuna dört boş değer,
`partialize`'a dört alan (**`activeTimer` dâhil** — TIME-01 "sayfa
yenilemesinden sağ çıkar" tam olarak buna dayanır).

```ts
// `now` opsiyonel parametre: üretimde varsayılana düşer, testte açıkça
// geçirilir. Sahte saat kurmadan süre üretebilmenin tek yolu bu.
startTimer: (
    input: { taskId: string | null; clientId: string; projectId: string | null; note?: string | null },
    now: string = new Date().toISOString()
) =>
    set((state) => {
        // Tek sayaç kuralı BURADA uygulanır, arayüzde değil: yeni sayacı
        // başlatmak öncekini durdurup kaydeder.
        const stopped = state.activeTimer ? stopTimerInto(state, now) : {};

        return {
            ...stopped,
            activeTimer: {
                taskId: input.taskId,
                clientId: input.clientId,
                projectId: input.projectId,
                startedAt: now,
                note: input.note ?? null,
            },
        };
    }),

stopTimer: (now: string = new Date().toISOString()) =>
    set((state) => ({ ...stopTimerInto(state, now), activeTimer: null })),

/** Sayacı kayıt üretmeden atar (yanlışlıkla başlatılmış sayaç için). */
discardTimer: () => set({ activeTimer: null }),
```

Ortak yardımcı, `withDirty`'nin yanına:

```ts
/**
 * Çalışan sayacı kayda çevirir. 1 dakikadan kısa süre kaydedilmez:
 * veritabanı kısıtı `duration_minutes > 0` ve yanlışlıkla başlatılıp hemen
 * durdurulan sayaç veri değil gürültüdür.
 */
function stopTimerInto(state: TaskState, now: string): Partial<TaskState> {
    if (!state.activeTimer) return {};

    const minutes = elapsedMinutes(state.activeTimer, now);
    if (minutes < 1) return {};

    const log = createTimeLog({
        taskId: state.activeTimer.taskId,
        clientId: state.activeTimer.clientId,
        projectId: state.activeTimer.projectId,
        startedAt: state.activeTimer.startedAt,
        durationMinutes: minutes,
        note: state.activeTimer.note,
    }, now);

    return {
        timeLogs: [...state.timeLogs, log],
        dirtyTimeLogIds: withDirty(state.dirtyTimeLogIds, log.id),
    };
}
```

`addTimeLog` / `updateTimeLog` / `deleteTimeLog` mevcut kategori eylemlerinin
desenini birebir izler (dirty işaretleme, mezar taşı bırakma).

- [ ] **Step 4: `deleteClient` / `deleteProject` / `deleteTask`'ı genişlet**

`deleteClient`, veritabanındaki cascade ile **aynı sonucu** üretmek zorunda:

```ts
// Bağlı zaman kayıtları mezar taşı BIRAKMADAN silinir — sunucu zaten
// cascade ile siliyor, mezar taşı ikinci bir silme emri olurdu.
timeLogs: state.timeLogs.filter((l) => l.clientId !== id),
dirtyTimeLogIds: state.dirtyTimeLogIds.filter((d) => !removedLogIds.has(d)),
```

`deleteProject`: kayıtların yalnızca `projectId`'si boşalır, `clientId` durur.
`deleteTask`: yalnızca `taskId` boşalır.

⚠️ Üçünde de etkilenen kayıtlar **dirty işaretlenmez** — sunucu aynı işlemi
kendi referans eylemleriyle zaten yapıyor; işaretlemek başka cihazda
gereksiz bir yazma turu doğururdu. `deleteCategory`'deki aynı gerekçe.

- [ ] **Step 5: v5 → v6 göçünü yaz**

`version: 5` → `version: 6`, yorum bloğuna bir satır, ve:

```ts
if (version < 6) {
    // Zaman kaydı geldi. Eski kayıtta bu alanlar hiç yoktu; boş listelere
    // düşülür. Ücret alanları da yeni: veritabanı varsayılanlarıyla aynı.
    state.timeLogs = [];
    state.activeTimer = null;
    state.dirtyTimeLogIds = [];
    state.timeLogTombstones = [];
    state.clients = (state.clients ?? []).map((c) => ({
        ...c,
        hourlyRate: typeof c.hourlyRate === 'number' ? c.hourlyRate : 0,
        currency: typeof c.currency === 'string' ? c.currency : 'TRY',
    }));
    state.projects = (state.projects ?? []).map((p) => ({
        ...p,
        hourlyRate: typeof p.hourlyRate === 'number' ? p.hourlyRate : null,
    }));
}
```

`adoptGuestData` (ownerId geçişi) bloğuna da `dirtyTimeLogIds` ve
`timeLogTombstones` eklenir — **ikisi de**, yoksa hesap değişiminde eski
hesabın kayıtları yenisine sızar.

- [ ] **Step 6: Test'leri koştur**

Run: `npx vitest run src/store/index.test.ts`
Beklenen: PASS

- [ ] **Step 7: Commit**

```bash
git add src/store/index.ts src/store/index.test.ts
git commit -m "Store: zaman kaydi alanlari, tek sayac kurali, v5 -> v6 gocu"
```

---

### Task 4: Senkron — eşleme, birleştirme, repository, sıra, bayrak

**Files:**
- Modify: `src/lib/niche-mapping.ts` (ücret alanları + `timeLogToRow`/`rowToTimeLog`)
- Modify: `src/lib/sync-merge-niche.ts` (`mergeTimeLogs`)
- Modify: `src/lib/task-repository.ts` (dört fonksiyon)
- Modify: `src/lib/sync.ts` (sıra + bayrak kapısı)
- Modify: `src/components/SyncProvider.tsx` (`pendingCount`)
- Test: `src/lib/sync-merge-niche.test.ts`, `src/lib/sync.test.ts`,
  `src/lib/niche-mapping.test.ts`

**Interfaces:**
- Consumes: `TimeLog` (Task 2), store alanları (Task 3),
  `Database['public']['Tables']['time_logs']` (Task 1)
- Produces:
  - `mergeTimeLogs(input: TimeLogMergeInput): TimeLogMergePlan` — `MergePlan`
    ile **aynı şekil**, `tasks` yerine `timeLogs` alanı
  - `fetchRemoteTimeLogs()`, `pushRemoteTimeLogs(logs, userId)`,
    `deleteRemoteTimeLogs(ids)`
  - `timeLogToRow(log, userId)`, `rowToTimeLog(row)`

- [ ] **Step 1: `mergeTimeLogs` için failing test yaz**

`src/lib/sync-merge-niche.test.ts` içine:

```ts
describe('mergeTimeLogs', () => {
    const log = (id: string, updatedAt: string): TimeLog => ({
        id, taskId: null, clientId: 'c1', projectId: null,
        startedAt: '2026-08-16T09:00:00.000Z', durationMinutes: 60, note: null,
        createdAt: updatedAt, updatedAt,
    });

    // TIME-04'un ta kendisi: iki cihazin kayitlari BIRBIRINI EZMEZ, toplanir.
    // Bu, her kaydin kendi UUID'si oldugu icin ada gore tekillestirme
    // OLMADAN calisir — mergeCategories ailesinden ayrildigi nokta burasi.
    it('iki cihazda ayni gun girilen kayitlar TOPLANIR', () => {
        const plan = mergeTimeLogs({
            local: [log('a', '2026-08-16T10:00:00.000Z')],
            remote: [log('b', '2026-08-16T11:00:00.000Z')],
            dirtyIds: ['a'],
            tombstones: [],
        });

        expect(plan.timeLogs.map((l) => l.id).sort()).toEqual(['a', 'b']);
        expect(plan.toPush.map((l) => l.id)).toEqual(['a']);
    });

    it('ada gore tekillestirme YAPMAZ — idRemap dondurmez', () => {
        const plan = mergeTimeLogs({
            local: [log('a', '2026-08-16T10:00:00.000Z')],
            remote: [log('b', '2026-08-16T10:00:00.000Z')],
            dirtyIds: ['a'], tombstones: [],
        });
        expect('idRemap' in plan).toBe(false);
        expect(plan.timeLogs).toHaveLength(2);
    });

    it('cakismada updatedAt yenisi kazanir, esitlikte bulut', () => {
        const plan = mergeTimeLogs({
            local: [log('a', '2026-08-16T10:00:00.000Z')],
            remote: [log('a', '2026-08-16T10:00:00.000Z')],
            dirtyIds: ['a'], tombstones: [],
        });
        expect(plan.discardedIds).toEqual(['a']);
    });

    it('mezar tasi buluttaki kaydi silinmeye isaretler', () => {
        const plan = mergeTimeLogs({
            local: [], remote: [log('a', '2026-08-16T10:00:00.000Z')],
            dirtyIds: [], tombstones: [{ id: 'a', deletedAt: '2026-08-16T11:00:00.000Z' }],
        });
        expect(plan.toDelete).toEqual(['a']);
    });

    it('dirty OLMAYAN, uzakta bulunmayan kayit cihazdan duser', () => {
        const plan = mergeTimeLogs({
            local: [log('a', '2026-08-16T10:00:00.000Z')],
            remote: [], dirtyIds: [], tombstones: [],
        });
        expect(plan.timeLogs).toEqual([]);
    });
});
```

- [ ] **Step 2: Koştur, düştüğünü doğrula**

Run: `npx vitest run src/lib/sync-merge-niche.test.ts`
Beklenen: FAIL — `mergeTimeLogs is not exported`

- [ ] **Step 3: `mergeTimeLogs`'u yaz**

`src/lib/sync-merge-niche.ts` içine. **Gövde `mergeTasks`'ın birebir aynısıdır**
(`sync-merge.ts:51-106`), yalnızca `Task` yerine `TimeLog` ve `tasks` yerine
`timeLogs`. Dosya başına gerekçe yorumu:

```ts
/**
 * Zaman kayıtlarını birleştirir.
 *
 * `mergeClients`/`mergeProjects` DEĞİL, `mergeTasks` kalıbını izler: zaman
 * kaydının **adı yoktur**, dolayısıyla ada göre tekilleştirme ve `idRemap`
 * zinciri yoktur. Bu, TIME-04'ün ("iki cihazın kayıtları toplanır, biri
 * diğerini ezmez") karşılandığı yerdir — her kaydın kendi UUID'si olduğu için
 * birleşim zaten toplama demektir. Zaman `(görev, gün) → toplam süre` biçiminde
 * tek değiştirilebilir satır olarak modellenseydi son-yazan-kazanır veri yerdi;
 * gereksinim koda değil MODELE bağlıdır (spec §3.3).
 */
```

- [ ] **Step 4: Koştur, geçtiğini doğrula**

Run: `npx vitest run src/lib/sync-merge-niche.test.ts`
Beklenen: PASS

- [ ] **Step 5: Eşleme ve repository'yi yaz**

`niche-mapping.ts`: `clientToRow`/`rowToClient`'a `hourly_rate` + `currency`,
`projectToRow`/`rowToProject`'e `hourly_rate`, ve yeni
`timeLogToRow`/`rowToTimeLog` (mevcut desen: `normalizeTimeLog`'tan geçir,
`null` dönerse ham satırdan yedek üret, sunucu `updated_at`'i normalize
edilmiş değerin yerine geçsin).

✅ **Düzeltme (ölçüldü, 2026-08-17):** Bu planın ilk hali `numeric` sütununun
PostgREST'ten **string** geleceğini varsayıyor ve `Number(row.hourly_rate)`
çevrimi ile bir test istiyordu. Yerel yığına karşı ölçüldü: PostgREST `numeric`
değeri tırnaksız JSON sayısı olarak döndürüyor (`[{"hourly_rate":1500.00}]`,
`typeof === 'number'`). Ücret eşlemesi Task 2'de zaten doğrudan atamayla
yazıldı ve **doğru**; çevrim de "string gelirse" testi de eklenmemeli — o test
gerçekte olmayan bir davranışı sabitlerdi.

⚠️ Yine de dikkat: `normalizeClient`/`normalizeProject` sayı olmayan ücreti
**sessizce varsayılana düşürür** (müşteride 0, projede `null` = miras). Yani
tip beklentisi bir gün bozulursa hata gürültü çıkarmaz, ücret verisi sessizce
sıfırlanır. Sağlayıcı ya da PostgREST sürümü değişirse önce bunu ölçün.

`task-repository.ts`: `fetchRemoteTimeLogs` (mutlaka `fetchAllRows` üzerinden —
sayfalama ve `MAX_ROWS` tavanı), `pushRemoteTimeLogs`, `deleteRemoteTimeLogs`;
üçü de mevcut kategori fonksiyonlarının deseninde.

- [ ] **Step 6: `runSync` sırasını genişlet ve testini yaz**

`src/lib/sync.test.ts` içine:

```ts
it('yazma sirasi: clients -> projects -> categories -> tasks -> timeLogs', async () => {
    // Mevcut sira testindeki cagri kaydediciyi kullanin.
    expect(pushOrder).toEqual(['clients', 'projects', 'categories', 'tasks', 'timeLogs']);
});

it('silme sirasi: timeLogs -> tasks -> projects -> clients -> categories', async () => {
    expect(deleteOrder).toEqual(['timeLogs', 'tasks', 'projects', 'clients', 'categories']);
});

it('butun yazmalar butun silmelerden once biter', async () => {
    expect(Math.max(...pushIndexes)).toBeLessThan(Math.min(...deleteIndexes));
});

it('bayrak kapaliyken time_logs HIC sorgulanmaz', async () => {
    // NICHE_MODULE=false ile: modulu silmis kurulumda tablo yok ve tek bir
    // "relation does not exist" GOREV senkronunu da dusururdu.
    expect(fetchRemoteTimeLogs).not.toHaveBeenCalled();
});
```

`sync.ts`'te: `fetchRemoteTimeLogs` `Promise.all` içine bayrak kapılı olarak,
`mergeTimeLogs` çağrısı görevlerden **sonra**, `pushRemoteTimeLogs` en son
yazma, `deleteRemoteTimeLogs` **ilk** silme, ve `applySyncResult`'a üç alan.
`pushed`/`deleted`/`discarded` sayaçlarına `timeLogPlan` katkıları eklenir.

- [ ] **Step 7: `pendingCount`'u genişlet**

`SyncProvider.tsx`:

```ts
const dirtyTimeLogIds = useTaskStore((state) => state.dirtyTimeLogIds);
const timeLogTombstones = useTaskStore((state) => state.timeLogTombstones);

const pendingCount =
    dirtyIds.length + tombstones.length
    + dirtyCategoryIds.length + categoryTombstones.length
    + dirtyClientIds.length + clientTombstones.length
    + dirtyProjectIds.length + projectTombstones.length
    + dirtyTimeLogIds.length + timeLogTombstones.length;
```

⚠️ Bu satır atlanırsa **yalnızca zaman kaydı değişince senkron hiç
tetiklenmez** ve değişiklik bir sonraki yoklamaya (dakikada bir) kadar bekler.
Kategorilerde bir kez gerçekten yaşandı ve sessizce başarısız oldu.

- [ ] **Step 8: Tüm birim testlerini koştur**

Run: `npm test && npx tsc --noEmit && npm run lint`
Beklenen: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/niche-mapping.ts src/lib/sync-merge-niche.ts \
        src/lib/task-repository.ts src/lib/sync.ts \
        src/components/SyncProvider.tsx src/lib/*.test.ts
git commit -m "Senkron: time_logs dorduncu varlik, mergeTasks kalibiyla"
```

---

### Task 5: Sayaç arayüzü — görev satırı butonu ve aktif sayaç çubuğu

**Files:**
- Create: `src/features/time/ActiveTimerBar.tsx`
- Create: `src/features/time/useElapsed.ts`
- Modify: `src/components/TaskItem.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/i18n/locales/tr.niche.json`, `src/i18n/locales/en.niche.json`
- Test: `e2e/zaman.spec.ts` (Task 9'da tamamlanır; burada ilk iki test)

**Interfaces:**
- Consumes: `startTimer`, `stopTimer`, `activeTimer` (Task 3),
  `elapsedMinutes` (Task 2), `NICHE_MODULE`
- Produces: `<ActiveTimerBar />`, `useElapsed(startedAt): number` (saniye)

- [ ] **Step 1: `useElapsed` kancasını yaz**

```ts
/**
 * Çalışan sayacın geçen saniyesi.
 *
 * `setInterval` bir sayaç DEĞİL, yalnızca yeniden render tetikleyicisidir;
 * değer her seferinde `startedAt` damgasından yeniden hesaplanır. Sekme
 * uykuya dalıp interval'lar kısılsa bile süre doğru kalır.
 */
export function useElapsed(startedAt: string | null): number {
    const [, tick] = useState(0);

    useEffect(() => {
        if (!startedAt) return;
        const id = setInterval(() => tick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [startedAt]);

    if (!startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}
```

- [ ] **Step 2: `TaskItem`'a başlat/durdur butonunu ekle**

Bayrak koşulu **modül gövdesinde**, render içinde değil:

```tsx
{NICHE_MODULE && (
    <button
        type="button"
        onClick={() => isRunning ? stopTimer() : startTimer({
            taskId: task.id, clientId: task.clientId!, projectId: task.projectId,
        })}
        disabled={!task.clientId}
        // Sayaç müşterisiz başlatılamaz: time_logs.client_id ZORUNLU.
        // Sebep söylenmezse buton "bozuk" görünür.
        title={task.clientId ? undefined : t('time.needsClient')}
        aria-label={t(isRunning ? 'time.stopFor' : 'time.startFor', { title: task.title })}
    >
        {isRunning ? <Square size={16} /> : <Play size={16} />}
    </button>
)}
```

Çalışan görev satırı görsel olarak işaretlenir (mevcut token'larla; sabit renk
kullanmayın).

- [ ] **Step 3: `ActiveTimerBar`'ı yaz ve kabuğa tak**

Çubuk yalnızca sayaç çalışırken render edilir; görev adı (ya da
`time.noTask`), akan süre (`s:dd:ss`), durdur butonu. `AppLayout` içinde
gezinmenin üstünde, `NICHE_MODULE &&` ile.

Gerekçe yorumu dosya başına: *"Unutulmuş açık sayaç" bu ürün kategorisinin
klasik veri hatasıdır ve tek gerçek savunması görünürlüktür.*

- [ ] **Step 4: Çeviri anahtarlarını ekle**

`tr.niche.json` → `time.startFor`, `time.stopFor`, `time.needsClient`,
`time.noTask`, `time.running`; `en.niche.json`'a aynı şekil.

- [ ] **Step 5: İlk E2E testlerini yaz**

`e2e/zaman.spec.ts`:

```ts
test('sayac sayfa yenilemesinden sag cikar', async ({ page }) => {
    // ... musteri olustur, gorevi ona bagla, sayaci baslat ...
    await expect(page.getByRole('status', { name: /sayaç/i })).toBeVisible();
    await page.reload();
    // TIME-01: sayac LocalStorage'da yasar (partialize'da activeTimer var).
    await expect(page.getByRole('status', { name: /sayaç/i })).toBeVisible();
});

test('ikinci sayaci baslatmak birincisini kaydeder', async ({ page }) => {
    // ... iki gorevde sirayla baslat, /app/time'da tek kayit gorunmeli ...
});
```

- [ ] **Step 6: Testleri koştur**

Run: `npx playwright test e2e/zaman.spec.ts`
Beklenen: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/time src/components/TaskItem.tsx \
        src/components/AppLayout.tsx src/i18n/locales/*.niche.json e2e/zaman.spec.ts
git commit -m "Sayac arayuzu: gorev satirinda baslat/durdur, kabukta aktif sayac cubugu"
```

---

### Task 6: `/app/time` — kayıt listesi, elle giriş, toplamlar

**Files:**
- Create: `src/pages/TimePage.tsx`
- Create: `src/features/time/TimeView.tsx`
- Create: `src/features/time/TimeLogForm.tsx`
- Create: `src/features/time/totals.ts`
- Test: `src/features/time/totals.test.ts`
- Modify: `src/router.tsx`, `src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: `timeLogs`, `addTimeLog`, `updateTimeLog`, `deleteTimeLog`
  (Task 3), `effectiveRate`, `amountFor` (Task 2)
- Produces: `groupTotals(logs, clients, projects): ClientTotal[]` ve
  `filterLogs(logs, { clientId, projectId, from, to })` — Task 8 (CSV) ikisini
  de kullanır, **aynı** filtre sonucu dışa aktarılır.

- [ ] **Step 1: `totals.ts` için failing test yaz**

```ts
describe('groupTotals', () => {
    it('musteri -> proje kiriliminda sure ve tutar toplar', () => { /* ... */ });

    it('projesiz kayitlari musterinin altinda ayri bir grupta toplar', () => { /* ... */ });

    // Kur donusumu YOK: farkli para birimleri asla tek toplama girmez.
    it('farkli para birimlerini ayri toplar, birbirine eklemez', () => { /* ... */ });

    it('projenin 0 ucreti mirasi ezer, tutar 0 cikar', () => { /* ... */ });
});

describe('filterLogs', () => {
    it('tarih araligi her iki ucu da KAPSAR', () => { /* ... */ });
    it('proje filtresi secildiyse musteri filtresi de zorunlu degildir', () => { /* ... */ });
});
```

- [ ] **Step 2: Koştur, düştüğünü doğrula**

Run: `npx vitest run src/features/time/totals.test.ts`
Beklenen: FAIL

- [ ] **Step 3: `totals.ts`'i yaz**

Saf fonksiyonlar; `src/features/delivery/grouping.ts` deseni izlenir.

- [ ] **Step 4: Koştur, geçtiğini doğrula**

Run: `npx vitest run src/features/time/totals.test.ts` → PASS

- [ ] **Step 5: Ekranı yaz**

`TimeView`: filtre çubuğu, kayıt listesi (`startedAt` azalan), satır içi
düzeltme ve silme, altta müşteri → proje toplamları.

`TimeLogForm`: elle giriş — tarih/saat, süre, müşteri, (opsiyonel) proje,
(opsiyonel) görev, not. **Müşteri değişince proje seçimi sıfırlanır**
(`TaskForm`'daki aynı kural; şemadaki üçlü FK bunu zorunlu tutar).
Arşivli kayıt seçicide görünmez — **tek istisna kaydın mevcut bağı**
(`TaskForm`'daki `selectable()` aynen kullanılır; istisna olmasaydı arşivli
müşteriye bağlı kaydı düzenlemeye açmak bağı sessizce koparırdı).

Elle giriş ve sayaç **aynı** `addTimeLog` eylemine düşer; iki kod yolu olmaz.

- [ ] **Step 6: Rotayı ve gezinmeyi ekle**

`router.tsx` → `nicheRoutes` dizisine
`{ path: 'time', element: <TimePage />, errorElement: <RouteErrorBoundary /> }`.

`AppLayout` → `NAV_ITEMS`'ın niş bloğuna beşinci öğe. `NAV_SPLIT` mobilde
3/2'ye bölünecek, merkez buton bir öğe genişliği kadar kayacak — bu **kabul
edilmiş** bedeldir (spec §4.3), "düzeltmeyin".

- [ ] **Step 7: Testleri koştur**

Run: `npm test && npx playwright test e2e/gezinme.spec.ts`
Beklenen: PASS. Gezinme testi öğe sayısına bağlıysa **testi güncelleyin**,
beşinci öğeyi kaldırmayın.

- [ ] **Step 8: Commit**

```bash
git add src/pages/TimePage.tsx src/features/time src/router.tsx \
        src/components/AppLayout.tsx src/i18n/locales/*.niche.json
git commit -m "/app/time: kayit listesi, elle giris, musteri-proje toplamlari"
```

---

### Task 7: Ücret alanları ve silme diyaloğu

**Files:**
- Modify: `src/components/ClientCard.tsx`, `src/components/ProjectRow.tsx`
- Modify: `src/i18n/locales/tr.niche.json`, `en.niche.json`
- Test: `e2e/musteriler.spec.ts` (mevcut dosyaya eklenir)

**Interfaces:**
- Consumes: `updateClient`, `updateProject` (mevcut), `effectiveRate` (Task 2)
- Produces: yok (yalnızca arayüz)

- [ ] **Step 1: Ücret alanlarını ekle**

Müşteri kartında `hourly_rate` + para birimi; proje satırında opsiyonel
override. `InlineName` deseni izlenir: alan **her zaman gerçek bir `input`**,
kenarlık hover/odakta belirir. Override boşken yer tutucu mirası gösterir:
`t('time.inheritedRate', { rate: formatted })`.

- [ ] **Step 2: Silme diyaloğu metnini genişlet**

Müşteri silme diyaloğu artık **üç** sonucu sayıyla söyler:

> "3 projesi silinecek, 5 görevin bağı kopacak (görevler silinmez),
> 41 saat 20 dakikalık 12 zaman kaydı silinecek."

Çoğul biçimler i18n'in çoğul kurallarıyla (`_one`/`_other`), koda gömülü
değil. ⚠️ Bu metin şemanın ve `sync-merge-niche.ts`'in taklit ettiği kuralların
kullanıcıya görünen yüzüdür — **üçü birlikte değişir**.

- [ ] **Step 3: E2E testini yaz**

```ts
test('musteri silme diyalogu zaman kaydi sayisini da soyler', async ({ page }) => {
    // ... musteri + gorev + 2 zaman kaydi kur ...
    await page.getByRole('button', { name: /Acme.*sil/i }).click();
    await expect(page.getByRole('alertdialog')).toContainText('2 zaman kaydı');
});
```

- [ ] **Step 4: Koştur**

Run: `npx playwright test e2e/musteriler.spec.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ClientCard.tsx src/components/ProjectRow.tsx \
        src/i18n/locales/*.niche.json e2e/musteriler.spec.ts
git commit -m "Ucret alanlari ve zaman kaydini da sayan silme diyalogu"
```

---

### Task 8: CSV dışa aktarım

**Files:**
- Create: `src/features/time/time-csv.ts`
- Test: `src/features/time/time-csv.test.ts`
- Modify: `src/features/time/TimeView.tsx` (indirme butonu)
- Modify: `package.json` (`papaparse` + `@types/papaparse`)

**Interfaces:**
- Consumes: `filterLogs`, `groupTotals` (Task 6), `amountFor` (Task 2)
- Produces: `buildTimeCsv(logs, clients, projects, t): string` (BOM dâhil),
  `csvFileName(filter, clients): string`

- [ ] **Step 1: `papaparse`'ı kur**

```bash
npm install papaparse && npm install -D @types/papaparse
```

- [ ] **Step 2: Failing test yaz**

```ts
describe('buildTimeCsv', () => {
    it('UTF-8 BOM ile baslar', () => {
        // BOM olmadan Excel'in Turkce kurulumu dosyayi ANSI sanar ve
        // karakterler bozulur.
        expect(buildTimeCsv([], [], [], t).startsWith('﻿')).toBe(true);
    });

    it('ayrac noktali virguldur', () => {
        // Excel TR'de liste ayraci ";" — virgul kullanilsa her satir tek
        // hucreye sikisir.
        expect(buildTimeCsv(logs, clients, projects, t)).toContain('Tarih;Müşteri;');
    });

    it('sure ondalik saat ve ondalik ayraci virguldur', () => {
        // 90 dakika -> "1,5" (ayni Excel yerelligi)
        expect(buildTimeCsv([log90], clients, projects, t)).toContain(';1,5;');
    });

    it('sonda proje ve musteri ozet satirlari bulunur', () => { /* ... */ });

    it('bos sonuc icin yalnizca baslik satiri uretir', () => { /* ... */ });

    it('icinde noktali virgul gecen not alani tirnaklanir', () => {
        // Ayrac ";" oldugu icin kacis kurali papaparse'a birakilir; bu test
        // ayracin degistirilmesi halinde kacisin da degistigini sabitler.
        expect(buildTimeCsv([logWithSemicolonNote], ...)).toContain('"a; b"');
    });
});
```

- [ ] **Step 3: Koştur, düştüğünü doğrula**

Run: `npx vitest run src/features/time/time-csv.test.ts` → FAIL

- [ ] **Step 4: `time-csv.ts`'i yaz**

Saf fonksiyon; `Papa.unparse(rows, { delimiter: ';' })` ve başına `'﻿'`.
Başlıklar çeviri anahtarlarından gelir (`t` parametre olarak geçer — saf
katman metin üretmez, çağıran verir).

- [ ] **Step 5: İndirme butonunu bağla**

`TimeView` içinde `Blob` + `URL.createObjectURL` + geçici `<a download>`.
İndirme ekrandaki filtreyi **birebir** izler: aynı `filterLogs` sonucu.

- [ ] **Step 6: Testleri koştur**

Run: `npx vitest run src/features/time/time-csv.test.ts` → PASS

- [ ] **Step 7: E2E indirme testi**

```ts
test('CSV indirilir ve baslik satiri dogrudur', async ({ page }) => {
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /CSV/i }).click(),
    ]);
    const content = await readAll(await download.createReadStream());
    expect(content.startsWith('﻿')).toBe(true);
    expect(content).toContain('Tarih;Müşteri;');
});
```

Run: `npx playwright test e2e/zaman.spec.ts` → PASS

- [ ] **Step 8: Commit**

```bash
git add src/features/time/time-csv.ts src/features/time/time-csv.test.ts \
        src/features/time/TimeView.tsx package.json package-lock.json e2e/zaman.spec.ts
git commit -m "CSV disa aktarim: kayit satirlari + ozet, UTF-8 BOM, ; ayraci"
```

---

### Task 9: Bayrak izleri, kalan E2E ve doküman senkronu

**Files:**
- Modify: `scripts/verify-niche-stripping.mjs`
- Modify: `e2e/zaman.spec.ts` (kalan testler)
- Modify: `CLAUDE.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`,
  `.planning/REQUIREMENTS.md`

**Interfaces:**
- Consumes: her şey
- Produces: yok

- [ ] **Step 1: `MARKERS` listesine üç iz ekle**

```js
{ pattern: /app\/time/, what: 'zaman rotası' },
{ pattern: /TimeTracker|ActiveTimerBar/, what: 'sayaç bileşeni' },
{ pattern: /papaparse|unparse/, what: 'CSV kütüphanesi' },
```

`papaparse` izi en somut ölçüttür: kod elenip bağımlılık pakette kalsaydı
bayrak sözünü tutmazdı.

- [ ] **Step 2: Bayrağı iki yönlü ölç**

```bash
npm run build && npm run verify:niche
```

Beklenen: PASS — kapalıyken üç iz de yok, **açıkken üçü de var**. Kapalı
derlemenin boyutu açık olandan **belirgin biçimde küçük** olmalı; aynıysa
bayrak koşulu çalışma zamanına kalmış demektir (Faz 2'de tam olarak bu oldu:
nesne özelliği derleme zamanında katlanmıyordu).

- [ ] **Step 3: Kalan E2E testlerini yaz**

`e2e/zaman.spec.ts`: elle kayıt ekle/düzelt/sil; müşteri ve proje toplamları
doğru; müşterisiz görevde sayaç butonu devre dışı.

- [ ] **Step 4: Tüm paketi koştur**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run test:rls && npm run test:e2e
```

Beklenen: hepsi PASS. E2E'de auth'a dayanan testler "Çok fazla deneme yapıldı"
ile düşerse **kod regresyonu değil**: `.env.local` bulut projesini gösteriyor
demektir. Teşhis: `docker logs supabase_kong_yapilacaklar-listesi` içinde
tarayıcıdan gelen isteği arayın; hiç yoksa istekler başka yere gidiyor.

- [ ] **Step 5: Dokümanları senkronla**

- `CLAUDE.md`: şema bloğuna `time_logs` ve ücret sütunları; **"niş modül (tek
  migration dosyası)" ifadesi "iki migration dosyası + `tasks_id_user_id_key`
  kısıtı" olarak düzeltilir**; bayrağın okunduğu yerlere `sync.ts`'in yeni
  adımı eklenir; test sayısı güncellenir.
- `.planning/REQUIREMENTS.md`: TIME-01…06 `[x]`, Traceability tablosu "Done".
- `.planning/ROADMAP.md`: Phase 3 `[x]`, altı kriter kanıtlarıyla işaretlenir,
  Progress tablosu güncellenir.
- `.planning/STATE.md`: Current Position, teslim edilenler tablosu, kalan
  blokerlar.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-niche-stripping.mjs e2e/zaman.spec.ts \
        CLAUDE.md .planning/
git commit -m "Faz 3 kapanis: bayrak izleri, kalan E2E, dokuman senkronu"
```

---

## Öz değerlendirme

**Spec kapsamı — her bölüm bir göreve eşleniyor:**

| Spec | Görev |
|---|---|
| §1 Şema (ücret sütunları, `time_logs`, FK'lar, RLS) | 1 |
| §2 İstemci tipleri ve saf yardımcılar | 2 |
| §3.1 Sayaç senkronlanmaz · §3.2 Store ve göç | 3, 5 |
| §3.3 Birleştirme · §3.4 Sıra · §3.5 `pendingCount` | 4 |
| §4.1 Görev satırı · §4.2 Sayaç çubuğu | 5 |
| §4.3 `/app/time` | 6 |
| §4.4 Ücret alanları ve silme diyaloğu | 7 |
| §4.5 Bayrak | 4 (senkron kapısı), 5–6 (render), 9 (izler) |
| §5 CSV | 8 |
| §6 i18n | 5, 6, 7, 8 (her görev kendi anahtarlarını ekler) |
| §7 Test | her görevin içinde + 9 |

**Gereksinim eşlemesi:** TIME-01 → Görev 3+5; TIME-02 → Görev 6;
TIME-03 → Görev 6; TIME-04 → Görev 4 (Step 1'deki ilk test doğrudan bu);
TIME-05 → Görev 8; TIME-06 → Görev 9.

**Planın en kırılgan üç yeri:**

1. **Görev 2, Step 3 — `Project extends Client` kırılıyor.** `hourlyRate`
   daraltması TypeScript'te yasak; `Omit` ile çözülüyor ve bu, `clients.ts`
   içindeki ortak karşılaştırıcıların imzalarını da etkiliyor. Görevin
   Step 6'sı bu yüzden var: mevcut testleri koşmadan kapanmıyor.
2. **Görev 4, Step 7 — `pendingCount`.** Atlanırsa hiçbir test düşmez ama
   senkron sessizce gecikir. Kategorilerde bir kez yaşandı.
3. **Görev 4, Step 5 — `numeric` string gelebilir.** Doğrudan atanırsa ücret
   `"1500"` olur ve `amountFor` `NaN` üretir; ekranda "NaN ₺" görünene kadar
   hiçbir test yakalamaz. Bu yüzden kendi testi var.
