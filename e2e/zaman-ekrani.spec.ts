import { test, expect, type Page } from '@playwright/test'
import { gotoApp } from './helpers'

/**
 * `/app/time`: kayıt listesi, elle giriş, filtre ve müşteri → proje
 * toplamları.
 *
 * Local-first çalışır, Supabase gerekmez. Sayaç etkileşimleri `zaman.spec.ts`
 * içinde; burada ekranın kendisi sınanıyor.
 *
 * Saatlik ücret müşteri kartından girilir (`/app/clients`); tutarın gerçek
 * bir ücretten hesaplandığını gösteren test o alanı kullanır.
 */

const STORAGE_KEY = 'yapilacaklar-storage'
const timePage = '/app/time'

async function addClient(page: Page, name: string) {
    await page.goto('/app/clients')
    await page.getByPlaceholder('Yeni müşteri').fill(name)
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByRole('textbox', { name: `${name} müşterisinin adı` })).toBeVisible()
}

async function addProject(page: Page, client: string, name: string) {
    await page.getByRole('button', { name: `"${client}" projelerini göster` }).click()
    await page.getByRole('textbox', { name: `"${client}" için yeni proje adı` }).fill(name)
    await page.getByRole('button', { name: `"${client}" müşterisine proje ekle` }).click()
    await expect(page.getByRole('textbox', { name: `${name} projesinin adı` })).toBeVisible()
}

/** Elle kayıt formunu doldurup gönderir. */
async function addEntry(
    page: Page,
    input: { client: string; project?: string; date: string; minutes: number; note?: string }
) {
    await page.getByRole('button', { name: 'Kayıt ekle' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Tarih').fill(input.date)
    await dialog.getByLabel('Süre (dakika)').fill(String(input.minutes))
    await dialog.getByLabel('Müşteri').selectOption({ label: input.client })
    if (input.project) await dialog.getByLabel('Proje').selectOption({ label: input.project })
    if (input.note) await dialog.getByLabel('Not').fill(input.note)

    await dialog.getByRole('button', { name: 'Ekle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
}

/** Müşterinin saatlik ücretini kart üzerindeki alandan girer. */
async function setHourlyRate(page: Page, clientName: string, rate: number) {
    await page.goto('/app/clients')
    // Ücret alanı kartın açılan panelinde yaşar.
    await page.getByRole('button', { name: `"${clientName}" projelerini göster` }).click()

    const field = page.getByRole('spinbutton', { name: `${clientName} müşterisinin saatlik ücreti` })
    await field.fill(String(rate))
    await field.press('Enter')
    await expect(page.getByText('Saatlik ücret güncellendi.')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
    await gotoApp(page)
})

test('gezinmeden zaman ekranına gidilir ve boş durum anlatılır', async ({ page }) => {
    await page.getByRole('link', { name: 'Zaman' }).first().click()

    await expect(page).toHaveURL(/\/app\/time$/)
    await expect(page.getByText('Henüz zaman kaydı yok')).toBeVisible()
})

test('elle eklenen kayıt listede ve toplamlarda görünür', async ({ page }) => {
    await addClient(page, 'Acme Ajans')
    await addProject(page, 'Acme Ajans', 'Websitesi')
    await page.goto(timePage)

    await addEntry(page, {
        client: 'Acme Ajans',
        project: 'Websitesi',
        date: '2026-08-17',
        minutes: 90,
        note: 'Tasarım görüşmesi',
    })

    await expect(page.getByText('Tasarım görüşmesi')).toBeVisible()
    // 90 dakika saat+dakika olarak okunur; ham "90 dk" değil.
    await expect(page.getByText('1 sa 30 dk').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Toplamlar' })).toBeVisible()
})

test('tutar müşterinin saatlik ücretinden hesaplanır', async ({ page }) => {
    await addClient(page, 'Acme Ajans')
    await setHourlyRate(page, 'Acme Ajans', 1500)
    await page.goto(timePage)

    await addEntry(page, { client: 'Acme Ajans', date: '2026-08-17', minutes: 120, note: 'İki saat' })

    // 2 saat x 1500 = 3000; tutar saklanmaz, her okumada hesaplanır.
    await expect(page.getByText(/3[.,]000/).first()).toBeVisible()
})

test('tarih aralığı filtresi kapsam dışındaki kaydı gizler', async ({ page }) => {
    await addClient(page, 'Acme Ajans')
    await page.goto(timePage)

    await addEntry(page, { client: 'Acme Ajans', date: '2026-08-10', minutes: 60, note: 'Eski iş' })
    await addEntry(page, { client: 'Acme Ajans', date: '2026-08-17', minutes: 30, note: 'Yeni iş' })

    await page.getByLabel('Başlangıç tarihi').fill('2026-08-15')

    await expect(page.getByText('Yeni iş')).toBeVisible()
    await expect(page.getByText('Eski iş')).toBeHidden()

    // Aralık her iki ucu da kapsar: 17'yi bitiş yapmak kaydı dışarıda bırakmaz.
    await page.getByLabel('Bitiş tarihi').fill('2026-08-17')
    await expect(page.getByText('Yeni iş')).toBeVisible()
})

test('kayıt düzenlenir ve silinir', async ({ page }) => {
    await addClient(page, 'Acme Ajans')
    await page.goto(timePage)
    await addEntry(page, { client: 'Acme Ajans', date: '2026-08-17', minutes: 30, note: 'Düzeltilecek' })

    await page.getByRole('button', { name: /kaydı düzenle$/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Süre (dakika)').fill('45')
    await dialog.getByRole('button', { name: 'Güncelle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })

    await expect(page.getByText('45 dk').first()).toBeVisible()

    await page.getByRole('button', { name: /kaydı sil$/ }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()

    await expect(page.getByText('Henüz zaman kaydı yok')).toBeVisible()
})

test('şema sınırını aşan süre kayıt üretmez', async ({ page }) => {
    // Aynı sınır veritabanında da var (`duration_minutes <= 1440`); geçersiz
    // satır push kuyruğuna girerse o turdaki bütün senkron düşerdi.
    //
    // Burada engel tarayıcının kendi doğrulaması (`min`/`max`) — gönderim hiç
    // olmadığı için uygulamanın toast'ı görünmez. Store'daki guard yine de
    // duruyor: elle giriş dışındaki yollar (sayaç, senkron) ona düşüyor ve
    // `index.test.ts` onu ayrıca sınıyor.
    await addClient(page, 'Acme Ajans')
    await page.goto(timePage)

    await page.getByRole('button', { name: 'Kayıt ekle' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Tarih').fill('2026-08-17')
    const duration = dialog.getByLabel('Süre (dakika)')
    await duration.fill('2000')
    await dialog.getByLabel('Müşteri').selectOption({ label: 'Acme Ajans' })
    await dialog.getByRole('button', { name: 'Ekle', exact: true }).click()

    // Alan geçersiz işaretli, form açık, kayıt oluşmadı.
    expect(await duration.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true)
    await expect(dialog).toBeVisible()

    const logs = await page.evaluate((key) => {
        const parsed = JSON.parse(localStorage.getItem(key) as string)
        return parsed.state.timeLogs ?? []
    }, STORAGE_KEY)
    expect(logs).toEqual([])
})
