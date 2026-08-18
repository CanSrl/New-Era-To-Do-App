import { readFile } from 'node:fs/promises'
import { test, expect, type Browser, type Page } from '@playwright/test'
import { gotoApp, isAuthEnabled } from './helpers'

/**
 * Görev 4'ün kapama testi: zaman kaydı senkronu, uçtan uca.
 *
 * Birim testleri repository katmanını taklit ediyor — yani "runSync doğru
 * düzende çağırıyor mu" sorusunu yanıtlıyorlar, "satır gerçekten gidiyor mu"
 * sorusunu değil. Buradaki testler gerçek Supabase'e, gerçek RLS'e ve gerçek
 * iki tarayıcı bağlamına karşı çalışır; sıra, eşleme, bağ onarımı ve şema
 * kısıtları birlikte sınanır.
 *
 * Görev 4'ün testleri kayıtları store'un kalıcı deposuna yazıp sayfayı
 * yenileyerek üretir (`seedTimeLog`): sınadıkları şey senkronun kendisi,
 * kaydın nasıl girildiği değil — persist rehydrate ediyor, `pendingCount`
 * değişiyor ve tur tetikleniyor.
 *
 * Dosyanın sonundaki Görev 7-8 kapama testleri ise **baştan sona gerçek
 * etkileşim** kullanır: ücret alanları ve CSV indirmesi, ancak arayüzden
 * girilen değerin gerçek veritabanı turundan sağ çıktığı görülürse kapanmış
 * sayılır.
 */

const STORAGE_KEY = 'yapilacaklar-storage'

let supabaseReady = false

test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await gotoApp(page)
    supabaseReady = await isAuthEnabled(page)
    await context.close()
})

test.beforeEach(() => {
    test.skip(!supabaseReady, 'Supabase yapılandırılmamış; senkron kapalı.')
})

async function openDevice(browser: Browser): Promise<Page> {
    const context = await browser.newContext()
    const page = await context.newPage()
    await gotoApp(page)
    return page
}

async function signUp(page: Page, email: string) {
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Hesap oluştur' }).click()
    await dialog.getByLabel('E-posta').fill(email)
    await dialog.getByLabel('Parola').fill('parola12345')
    await dialog.getByRole('button', { name: 'Hesap Oluştur', exact: true }).click()
    await expect(page.getByText(email)).toBeVisible()
}

async function signIn(page: Page, email: string) {
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-posta').fill(email)
    await dialog.getByLabel('Parola').fill('parola12345')
    await dialog.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await expect(page.getByText(email)).toBeVisible()
}

/**
 * Bekleyen HİÇBİR değişiklik kalmayana kadar bekler — zaman kaydı sayaçları
 * dâhil. `senkron.spec.ts`'teki eşdeğerinden farkı bu: sayaçlar burada
 * sayılmazsa test, kayıt hiç gitmemişken de geçerdi.
 */
async function waitForSynced(page: Page) {
    await page.waitForFunction((key) => {
        const raw = localStorage.getItem(key)
        if (!raw) return false
        const state = JSON.parse(raw).state
        return (
            state.lastSyncedAt !== null &&
            (state.dirtyIds?.length ?? 0) === 0 &&
            (state.tombstones?.length ?? 0) === 0 &&
            (state.dirtyCategoryIds?.length ?? 0) === 0 &&
            (state.categoryTombstones?.length ?? 0) === 0 &&
            (state.dirtyClientIds?.length ?? 0) === 0 &&
            (state.clientTombstones?.length ?? 0) === 0 &&
            (state.dirtyProjectIds?.length ?? 0) === 0 &&
            (state.projectTombstones?.length ?? 0) === 0 &&
            (state.dirtyTimeLogIds?.length ?? 0) === 0 &&
            (state.timeLogTombstones?.length ?? 0) === 0
        )
    }, STORAGE_KEY, { timeout: 30_000 })
}

type StoredTimeLog = {
    id: string
    taskId: string | null
    clientId: string
    projectId: string | null
    durationMinutes: number
    note: string | null
}

/**
 * Kayıtları depodan okur.
 *
 * ⚠️ Sonucu **her zaman `expect.poll` ile** sınayın, tek seferlik
 * `expect(await readTimeLogs(...))` ile değil. `waitForSynced` yalnızca
 * "yerelde bekleyen değişiklik yok ve en az bir tur koştu" der; sayfa
 * yenilendikten sonra `lastSyncedAt` zaten dolu ve dirty listeleri boş
 * olduğu için **anında** döner — karşı cihazın verisini çeken tur ise hâlâ
 * uçuyor olabilir. Tek seferlik okuma o yarışı kaybettiğinde test, gerçek bir
 * senkron hatası varmış gibi düşer (üç test bu yüzden kararsızdı).
 */
async function readTimeLogs(page: Page): Promise<StoredTimeLog[]> {
    return page.evaluate((key) => {
        const raw = localStorage.getItem(key)
        const logs = JSON.parse(raw as string).state.timeLogs ?? []
        return logs as StoredTimeLog[]
    }, STORAGE_KEY)
}

async function addClientUI(page: Page, name: string) {
    await page.goto('/app/clients')
    await page.getByPlaceholder('Yeni müşteri').fill(name)
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByRole('textbox', { name: `${name} müşterisinin adı` })).toBeVisible()
}

async function addProjectUI(page: Page, client: string, name: string) {
    await page.getByRole('button', { name: `"${client}" projelerini göster` }).click()
    await page.getByRole('textbox', { name: `"${client}" için yeni proje adı` }).fill(name)
    await page.getByRole('button', { name: `"${client}" müşterisine proje ekle` }).click()
    await expect(page.getByRole('textbox', { name: `${name} projesinin adı` })).toBeVisible()
}

/**
 * Cihaza gönderilmeyi bekleyen bir zaman kaydı yazar.
 *
 * Depoya yazıp sayfayı yeniler: store rehydrate olduğunda kayıt dirty
 * listesinde görünür, `pendingCount` değişir ve senkron tetiklenir.
 */
async function seedTimeLog(
    page: Page,
    input: { clientName: string; projectName?: string; durationMinutes: number; note: string }
) {
    await page.evaluate(
        ({ key, input }) => {
            const raw = localStorage.getItem(key)
            const parsed = JSON.parse(raw as string)
            const state = parsed.state

            const client = state.clients.find(
                (c: { name: string }) => c.name === input.clientName
            )
            const project = input.projectName
                ? state.projects.find((p: { name: string }) => p.name === input.projectName)
                : null

            const id = crypto.randomUUID()
            const now = new Date().toISOString()

            state.timeLogs = [
                ...(state.timeLogs ?? []),
                {
                    id,
                    taskId: null,
                    clientId: client.id,
                    projectId: project ? project.id : null,
                    startedAt: now,
                    durationMinutes: input.durationMinutes,
                    note: input.note,
                    createdAt: now,
                    updatedAt: now,
                },
            ]
            state.dirtyTimeLogIds = [...(state.dirtyTimeLogIds ?? []), id]

            localStorage.setItem(key, JSON.stringify(parsed))
        },
        { key: STORAGE_KEY, input }
    )

    await page.reload()
    await page.getByTitle('Görev Ekle').waitFor()
}

test('bir cihazda girilen zaman kaydı diğerine müşteri ve proje bağıyla yayılır', async ({
    browser,
}) => {
    const email = `zaman-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addClientUI(deviceA, 'Acme Ajans')
    await addProjectUI(deviceA, 'Acme Ajans', 'Websitesi')
    await waitForSynced(deviceA)

    await seedTimeLog(deviceA, {
        clientName: 'Acme Ajans',
        projectName: 'Websitesi',
        durationMinutes: 90,
        note: 'Tasarım görüşmesi',
    })
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)

    const [logA] = await readTimeLogs(deviceA)

    await expect.poll(() => readTimeLogs(deviceB), { timeout: 30_000 }).toHaveLength(1)
    const logsB = await readTimeLogs(deviceB)

    expect(logsB[0].id).toBe(logA.id)
    expect(logsB[0].durationMinutes).toBe(90)
    expect(logsB[0].note).toBe('Tasarım görüşmesi')
    // Bağlar aynı id'lere işaret etmeli: proje/müşteri bağı senkron turunda
    // kopsaydı kayıt faturalanabilir olmaktan çıkardı.
    expect(logsB[0].clientId).toBe(logA.clientId)
    expect(logsB[0].projectId).toBe(logA.projectId)
})

test('iki cihazda ayrı ayrı girilen kayıtlar toplanır, biri diğerini ezmez', async ({
    browser,
}) => {
    // TIME-04. Zaman `(görev, gün) -> toplam süre` biçiminde tek bir
    // değiştirilebilir satır olsaydı son-yazan-kazanır kuralı burada veri
    // yerdi; gereksinim koda değil MODELE bağlı.
    const email = `zaman-toplam-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addClientUI(deviceA, 'Acme Ajans')
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)

    await seedTimeLog(deviceA, {
        clientName: 'Acme Ajans',
        durationMinutes: 30,
        note: 'A cihazı',
    })
    await waitForSynced(deviceA)

    await seedTimeLog(deviceB, {
        clientName: 'Acme Ajans',
        durationMinutes: 45,
        note: 'B cihazı',
    })
    await waitForSynced(deviceB)

    // A'nın yeni turu B'nin kaydını da indirmeli.
    await deviceA.reload()
    await deviceA.getByTitle('Görev Ekle').waitFor()
    await waitForSynced(deviceA)

    const notes = async (page: Page) =>
        (await readTimeLogs(page)).map((l) => l.note).sort()

    await expect.poll(() => notes(deviceA), { timeout: 30_000 })
        .toEqual(['A cihazı', 'B cihazı'])
    await expect.poll(() => notes(deviceB), { timeout: 30_000 })
        .toEqual(['A cihazı', 'B cihazı'])
})

test('müşteri silinince bağlı zaman kaydı iki cihazdan da gider', async ({ browser }) => {
    // Sunucuda `on delete cascade`, istemcide `remapTimeLogLinks`'in kaydı
    // düşürmesi. İkisi ayrışsaydı kayıt A cihazında dirilir ve her turda var
    // olmayan bir müşteriye gönderilmeye çalışılırdı.
    const email = `zaman-cascade-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addClientUI(deviceA, 'Acme Ajans')
    await waitForSynced(deviceA)

    await seedTimeLog(deviceA, {
        clientName: 'Acme Ajans',
        durationMinutes: 60,
        note: 'Silinecek müşterinin kaydı',
    })
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)
    await expect.poll(() => readTimeLogs(deviceB), { timeout: 30_000 }).toHaveLength(1)

    await deviceB.goto('/app/clients')
    await deviceB.getByRole('button', { name: '"Acme Ajans" müşterisini sil' }).click()
    await deviceB.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()
    await waitForSynced(deviceB)

    await deviceA.reload()
    await deviceA.getByTitle('Görev Ekle').waitFor()
    await waitForSynced(deviceA)

    await expect.poll(() => readTimeLogs(deviceB), { timeout: 30_000 }).toEqual([])
    await expect.poll(() => readTimeLogs(deviceA), { timeout: 30_000 }).toEqual([])
})

/**
 * Görev 7-8'in kapama testleri.
 *
 * Buradaki soru birim testlerinin ulaşamadığı yerde: ücret alanları
 * `numeric(10,2)` sütunlara yazılıyor ve PostgREST'ten **sayı** olarak
 * dönmesi bekleniyor (ölçülmüştü: `{"hourly_rate":1500.00}`). Bu beklenti
 * bozulursa `normalizeClient`/`normalizeProject` sayı olmayan değeri sessizce
 * varsayılana düşürür — hata gürültü çıkarmaz, kullanıcının ücret verisi
 * sıfırlanır. Tek gerçek savunma, değeri gerçek bir turdan geçirip diğer
 * cihazda okumak.
 */
async function expandClient(page: Page, name: string) {
    await page.getByRole('button', { name: `"${name}" projelerini göster` }).click()
}

/** Kart zaten açıkken proje ekler; `addProjectUI` paneli her çağrıda açıp kapatırdı. */
async function addProjectInPanel(page: Page, client: string, name: string) {
    await page.getByRole('textbox', { name: `"${client}" için yeni proje adı` }).fill(name)
    await page.getByRole('button', { name: `"${client}" müşterisine proje ekle` }).click()
    await expect(page.getByRole('textbox', { name: `${name} projesinin adı` })).toBeVisible()
}

function clientRateField(page: Page, client: string) {
    return page.getByRole('spinbutton', { name: `${client} müşterisinin saatlik ücreti` })
}

function projectRateField(page: Page, project: string) {
    return page.getByRole('spinbutton', { name: `${project} projesinin saatlik ücreti` })
}

async function commit(field: ReturnType<typeof clientRateField>, value: string) {
    await field.fill(value)
    await field.press('Enter')

    /*
     * Toast değil alanın kendisi doğrulanır. Bildirim birkaç saniyede
     * kayboluyor ve yavaş bir turda yakalanamayabilir; dahası asıl mesele
     * değerin kayda işlenmesi. `InlineRate` reddedilen değeri eskisine geri
     * aldığı için bu kontrol reddi de yakalar — üstelik daha keskin.
     */
    await expect(field).toHaveValue(value)
}

/** Elle zaman kaydı ekler — Görev 6'nın formu üzerinden, gerçek etkileşimle. */
async function addTimeLogUI(
    page: Page,
    input: { client: string; date: string; minutes: number; note: string }
) {
    await page.goto('/app/time')
    await page.getByRole('button', { name: 'Kayıt ekle' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Tarih').fill(input.date)
    await dialog.getByLabel('Süre (dakika)').fill(String(input.minutes))
    await dialog.getByLabel('Müşteri').selectOption({ label: input.client })
    await dialog.getByLabel('Not').fill(input.note)

    await dialog.getByRole('button', { name: 'Ekle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
}

test('ücret, para birimi ve proje override\'ı gerçek senkron turundan sağ çıkar', async ({
    browser,
}) => {
    const email = `ucret-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addClientUI(deviceA, 'Acme Ajans')

    await expandClient(deviceA, 'Acme Ajans')
    await addProjectInPanel(deviceA, 'Acme Ajans', 'Websitesi')
    await addProjectInPanel(deviceA, 'Acme Ajans', 'Bakım')
    await addProjectInPanel(deviceA, 'Acme Ajans', 'Miras')

    // Ondalıklı ücret bilinçli: sütun `numeric(10,2)` ve kuruş kaybı ancak
    // gerçek bir turdan sonra görülür.
    await commit(clientRateField(deviceA, 'Acme Ajans'), '1500.5')

    const currency = deviceA.getByRole('textbox', { name: 'Acme Ajans müşterisinin para birimi' })
    await currency.fill('usd')
    await currency.press('Enter')
    await expect(currency).toHaveValue('USD')

    await commit(projectRateField(deviceA, 'Websitesi'), '2000')
    // 0 = "bu proje ücretsiz"; `Miras` boş bırakılıyor = müşteriden miras.
    await commit(projectRateField(deviceA, 'Bakım'), '0')

    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)

    await deviceB.goto('/app/clients')
    await expandClient(deviceB, 'Acme Ajans')

    await expect(clientRateField(deviceB, 'Acme Ajans')).toHaveValue('1500.5')
    await expect(deviceB.getByRole('textbox', { name: 'Acme Ajans müşterisinin para birimi' }))
        .toHaveValue('USD')
    await expect(projectRateField(deviceB, 'Websitesi')).toHaveValue('2000')

    /*
     * Kapama testinin asıl maddesi: 0 ile null veritabanı turundan sonra da
     * AYRI kalmalı. `0` mirasa düşerse ücretsiz proje sessizce faturalanır
     * (`??` yerine `||` yazmanın sonucu), `null` 0'a düşerse miras kaybolur.
     */
    await expect(projectRateField(deviceB, 'Bakım')).toHaveValue('0')
    await expect(projectRateField(deviceB, 'Miras')).toHaveValue('')
    await expect(projectRateField(deviceB, 'Miras')).toHaveAttribute('placeholder', /müşteriden/)
})

test('CSV, buluttan gelen ücretle hesaplanmış tutarı taşır', async ({ browser }) => {
    const email = `csv-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addClientUI(deviceA, 'Acme Ajans')

    await expandClient(deviceA, 'Acme Ajans')
    await commit(clientRateField(deviceA, 'Acme Ajans'), '1000')

    await addTimeLogUI(deviceA, {
        client: 'Acme Ajans',
        date: '2026-08-17',
        minutes: 90,
        note: 'Tasarım görüşmesi',
    })
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)

    await deviceB.goto('/app/time')
    await expect(deviceB.getByText('Tasarım görüşmesi')).toBeVisible()

    const [download] = await Promise.all([
        deviceB.waitForEvent('download'),
        deviceB.getByRole('button', { name: 'CSV indir' }).click(),
    ])

    const content = await readFile((await download.path())!, 'utf8')

    /*
     * Zincirin tamamı tek satırda kanıtlanıyor: ücret A'da girildi, numeric
     * sütuna yazıldı, B'de sayı olarak okundu, `amountFor` ile çarpıldı ve
     * dosyaya yerel ondalık ayraçla düştü. Ara halkalardan biri koparsa bu
     * satır tutmaz.
     */
    expect(content).toContain(';1,5;1000,00;1500,00;TRY')
    expect(content).toContain('Tasarım görüşmesi')
    expect(content).toContain('Genel toplam')
})
