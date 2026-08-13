import { test, expect, type Browser, type Page } from '@playwright/test'
import { addTask, deleteButton, taskHeading, toggleButton } from './helpers'

/**
 * Gerçek çift cihaz senaryoları.
 *
 * Playwright'ın her tarayıcı bağlamı ayrı bir LocalStorage ve oturum taşır;
 * bu yüzden iki bağlam gerçekten iki ayrı cihaz gibi davranır.
 *
 * Yalnızca Supabase yapılandırılmışsa çalışır.
 */

let supabaseReady = false

test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/')
    supabaseReady = await page
        .getByRole('button', { name: 'Giriş Yap', exact: true })
        .isVisible()
        .catch(() => false)
    await context.close()
})

test.beforeEach(() => {
    test.skip(!supabaseReady, 'Supabase yapılandırılmamış; senkron kapalı.')
})

/** Yeni bir izole "cihaz" açar. */
async function openDevice(browser: Browser): Promise<Page> {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/')
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
 * Bekleyen değişiklik kalmayana ve en az bir senkron turu tamamlanana kadar
 * bekler.
 *
 * Gösterge metnine bakmak güvenilir değil: bir değişiklikten hemen sonra
 * ekranda bir an önceki turun "Eşitlendi" yazısı durabiliyor ve bekleme
 * erkenden geçiyor.
 */
async function waitForSynced(page: Page) {
    await page.waitForFunction(() => {
        const raw = localStorage.getItem('yapilacaklar-storage')
        if (!raw) return false
        const state = JSON.parse(raw).state
        return (
            state.lastSyncedAt !== null &&
            (state.dirtyIds?.length ?? 0) === 0 &&
            (state.tombstones?.length ?? 0) === 0
        )
    }, undefined, { timeout: 20_000 })
}

test('misafirken eklenen görev giriş yapınca hesaba aktarılır', async ({ browser }) => {
    const email = `adopt-${Date.now()}@example.com`
    const device = await openDevice(browser)

    await addTask(device, 'Misafir görevi')
    await signUp(device, email)
    await waitForSynced(device)

    // Aynı hesapla temiz bir cihaz açıldığında görev buluttan inmeli.
    const fresh = await openDevice(browser)
    await signIn(fresh, email)

    await expect(taskHeading(fresh, 'Misafir görevi')).toBeVisible({ timeout: 15_000 })
})

test('bir cihazda eklenen görev diğerinde görünür', async ({ browser }) => {
    const email = `iki-cihaz-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)

    await addTask(deviceA, 'A cihazından')
    await waitForSynced(deviceA)

    // B yeniden yüklendiğinde uzaktaki değişikliği çeker.
    await deviceB.reload()
    await expect(taskHeading(deviceB, 'A cihazından')).toBeVisible({ timeout: 15_000 })
})

test('bir cihazdaki silme diğerine yayılır', async ({ browser }) => {
    const email = `silme-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addTask(deviceA, 'Silinecek görev')
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await expect(taskHeading(deviceB, 'Silinecek görev')).toBeVisible({ timeout: 15_000 })

    await deleteButton(deviceA, 'Silinecek görev').click()
    await deviceA.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()
    // Önce silmenin yerelde uygulandığından emin ol, sonra buluta gitmesini bekle.
    await expect(taskHeading(deviceA, 'Silinecek görev')).toBeHidden()
    await waitForSynced(deviceA)

    await deviceB.reload()
    await expect(taskHeading(deviceB, 'Silinecek görev')).toBeHidden({ timeout: 15_000 })
})

test('tamamlama durumu cihazlar arasında taşınır', async ({ browser }) => {
    const email = `tamamla-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addTask(deviceA, 'Ortak görev')
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await expect(taskHeading(deviceB, 'Ortak görev')).toBeVisible({ timeout: 15_000 })

    await toggleButton(deviceA, 'Ortak görev').click()
    await waitForSynced(deviceA)

    await deviceB.reload()
    await expect(toggleButton(deviceB, 'Ortak görev')).toHaveAttribute('aria-pressed', 'true', {
        timeout: 15_000,
    })
})

test('çevrimdışı yapılan değişiklik bağlantı gelince gönderilir', async ({ browser }) => {
    const email = `cevrimdisi-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await waitForSynced(deviceA)

    // Bağlantıyı kes: uygulama local-first olduğu için yazma çalışmaya devam etmeli.
    await deviceA.context().setOffline(true)
    await addTask(deviceA, 'Çevrimdışı eklendi')
    await expect(taskHeading(deviceA, 'Çevrimdışı eklendi')).toBeVisible()

    await deviceA.context().setOffline(false)
    await deviceA.evaluate(() => window.dispatchEvent(new Event('online')))
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await expect(taskHeading(deviceB, 'Çevrimdışı eklendi')).toBeVisible({ timeout: 15_000 })
})

test('çıkış yapınca görevler cihazda kalır', async ({ browser }) => {
    const email = `cikis-${Date.now()}@example.com`

    const device = await openDevice(browser)
    await signUp(device, email)
    await addTask(device, 'Kalıcı görev')
    await waitForSynced(device)

    await device.getByRole('button', { name: 'Çıkış yap', exact: true }).click()

    await expect(taskHeading(device, 'Kalıcı görev')).toBeVisible()
    await expect(device.getByRole('button', { name: 'Giriş Yap', exact: true })).toBeVisible()
})
