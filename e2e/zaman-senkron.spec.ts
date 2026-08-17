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
 * ⚠️ Zaman kaydının **arayüzü henüz yok** (Görev 5-6). Kayıtlar bu yüzden
 * store'un kalıcı deposuna doğrudan yazılıp sayfa yenilenerek üretiliyor;
 * persist middleware onları rehydrate ediyor ve `pendingCount` senkronu
 * tetikliyor. Arayüz gelince bu yardımcı gerçek etkileşimle değiştirilmeli.
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
    const logsB = await readTimeLogs(deviceB)

    expect(logsB).toHaveLength(1)
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

    const notesA = (await readTimeLogs(deviceA)).map((l) => l.note).sort()
    const notesB = (await readTimeLogs(deviceB)).map((l) => l.note).sort()

    expect(notesA).toEqual(['A cihazı', 'B cihazı'])
    expect(notesB).toEqual(['A cihazı', 'B cihazı'])
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
    expect(await readTimeLogs(deviceB)).toHaveLength(1)

    await deviceB.goto('/app/clients')
    await deviceB.getByRole('button', { name: '"Acme Ajans" müşterisini sil' }).click()
    await deviceB.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()
    await waitForSynced(deviceB)

    await deviceA.reload()
    await deviceA.getByTitle('Görev Ekle').waitFor()
    await waitForSynced(deviceA)

    expect(await readTimeLogs(deviceB)).toEqual([])
    expect(await readTimeLogs(deviceA)).toEqual([])
})
