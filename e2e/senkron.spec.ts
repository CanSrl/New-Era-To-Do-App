import { test, expect, type Browser, type Page } from '@playwright/test'
import { addTask, deleteButton, gotoApp, isAuthEnabled, taskHeading, toggleButton } from './helpers'

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
    await gotoApp(page)
    supabaseReady = await isAuthEnabled(page)
    await context.close()
})

test.beforeEach(() => {
    test.skip(!supabaseReady, 'Supabase yapılandırılmamış; senkron kapalı.')
})

/** Yeni bir izole "cihaz" açar. */
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
            (state.tombstones?.length ?? 0) === 0 &&
            (state.dirtyCategoryIds?.length ?? 0) === 0 &&
            (state.categoryTombstones?.length ?? 0) === 0
        )
    }, undefined, { timeout: 20_000 })
}

/** Cihazdaki kategori adlarını sıralı olarak okur. */
async function categoryNames(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const raw = localStorage.getItem('yapilacaklar-storage')
        const categories = JSON.parse(raw as string).state.categories as { name: string }[]
        return categories.map((c) => c.name).sort()
    })
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
    await deviceB.getByTitle('Görev Ekle').waitFor()
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
    await deviceB.getByTitle('Görev Ekle').waitFor()
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
    await deviceB.getByTitle('Görev Ekle').waitFor()
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

/**
 * Kategoriler görevlerden farklı bir sorun taşır: her cihaz ilk açılışta
 * kendi varsayılanlarını kendi id'leriyle oluşturur. İki cihaz aynı hesaba
 * bağlandığında bunlar tekilleştirilmezse kullanıcı listede "İş"i iki kez
 * görür. Aşağıdaki test bu senaryonun tam olarak kendisidir.
 */
test('iki cihazın varsayılan kategorileri tekilleştirilir', async ({ browser }) => {
    const email = `kategori-tekil-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await waitForSynced(deviceA)

    // B kendi varsayılanlarını farklı id'lerle oluşturmuş durumda.
    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)

    expect(await categoryNames(deviceB)).toEqual(['Alışveriş', 'Kişisel', 'Okul', 'İş'])

    // A yeniden yüklendiğinde de çoğalma olmamalı: yakınsama iki yönlü.
    await deviceA.reload()
    await deviceA.getByTitle('Görev Ekle').waitFor()
    await waitForSynced(deviceA)

    expect(await categoryNames(deviceA)).toEqual(['Alışveriş', 'Kişisel', 'Okul', 'İş'])
})

test('bir cihazda eklenen kategori diğerine yayılır ve görev bağı korunur', async ({ browser }) => {
    const email = `kategori-yayilim-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)

    await deviceA.goto('/app/settings')
    await deviceA.getByPlaceholder('Yeni kategori').fill('Tatil')
    await deviceA.getByRole('button', { name: 'Ekle', exact: true }).click()

    await deviceA.goto('/app')
    await addTask(deviceA, 'Bilet al')
    await deviceA.getByRole('button', { name: '"Bilet al" görevini düzenle' }).click()
    await deviceA.getByRole('dialog').getByLabel('Kategori').selectOption({ label: 'Tatil' })
    await deviceA.getByRole('dialog').getByRole('button', { name: 'Güncelle', exact: true }).click()
    await waitForSynced(deviceA)

    await deviceB.reload()
    await deviceB.getByTitle('Görev Ekle').waitFor()
    await expect(taskHeading(deviceB, 'Bilet al')).toBeVisible({ timeout: 15_000 })

    // Rozetin görünmesi, category_id bağının yabancı anahtarı ihlal etmeden
    // karşı cihaza ulaştığı anlamına gelir.
    await expect(deviceB.getByText('Tatil', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('bir cihazdaki kategori silme diğerine yayılır, görevler kalır', async ({ browser }) => {
    const email = `kategori-silme-${Date.now()}@example.com`

    const deviceA = await openDevice(browser)
    await signUp(deviceA, email)
    await addTask(deviceA, 'Ödev bitir')
    await deviceA.getByRole('button', { name: '"Ödev bitir" görevini düzenle' }).click()
    await deviceA.getByRole('dialog').getByLabel('Kategori').selectOption({ label: 'Okul' })
    await deviceA.getByRole('dialog').getByRole('button', { name: 'Güncelle', exact: true }).click()
    await waitForSynced(deviceA)

    const deviceB = await openDevice(browser)
    await signIn(deviceB, email)
    await waitForSynced(deviceB)
    await expect(taskHeading(deviceB, 'Ödev bitir')).toBeVisible({ timeout: 15_000 })

    await deviceA.goto('/app/settings')
    await deviceA.getByRole('button', { name: '"Okul" kategorisini sil' }).click()
    await deviceA.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()
    await waitForSynced(deviceA)

    await deviceB.reload()
    await deviceB.getByTitle('Görev Ekle').waitFor()
    await waitForSynced(deviceB)

    // Görev silinmemeli, yalnızca kategorisiz kalmalı.
    await expect(taskHeading(deviceB, 'Ödev bitir')).toBeVisible()
    expect(await categoryNames(deviceB)).toEqual(['Alışveriş', 'Kişisel', 'İş'])
})
