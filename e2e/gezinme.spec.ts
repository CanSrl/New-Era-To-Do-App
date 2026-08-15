import { test, expect } from '@playwright/test'
import { addTask, gotoApp, taskHeading } from './helpers'

test('kök adres uygulamaya yönlendirir', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/app$/)
})

test('ayarlar sayfasına gidip geri dönülebilir', async ({ page }) => {
    await gotoApp(page)

    await page.getByRole('link', { name: 'Ayarlar' }).click()
    await expect(page).toHaveURL(/\/app\/settings$/)
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible()

    await page.getByRole('link', { name: 'Görevlerim' }).click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { name: 'Merhaba! 👋' })).toBeVisible()
})

test('müşteriler sayfasına gezinmeden gidilebilir', async ({ page }) => {
    await gotoApp(page)

    await page.getByRole('link', { name: 'Müşteriler' }).click()
    await expect(page).toHaveURL(/\/app\/clients$/)
    await expect(page.getByRole('heading', { name: 'Müşteriler' })).toBeVisible()

    await page.getByRole('link', { name: 'Görevlerim' }).click()
    await expect(page).toHaveURL(/\/app$/)
})

test('ayarlar sayfası doğrudan adresle açılabilir', async ({ page }) => {
    // Derin bağlantı: sunucuda böyle bir dosya yok, index.html'e düşmeli.
    await gotoApp(page, '/app/settings')
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible()
})

test('bilinmeyen adres için bulunamadı sayfası gösterilir', async ({ page }) => {
    await page.goto('/boyle-bir-sayfa-yok')

    await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible()
    await page.getByRole('link', { name: 'Görevlere dön' }).click()
    await expect(page).toHaveURL(/\/app$/)
})

test('görev formu ayarlar sayfasından da açılabilir', async ({ page }) => {
    // Yüzen ekleme butonu kabukta durur, sayfaya bağlı değildir.
    await gotoApp(page, '/app/settings')
    await page.getByTitle('Görev Ekle').click()

    await expect(page.getByRole('dialog')).toBeVisible()
})

test('görevler ayarlar sayfasına gidip gelince korunur', async ({ page }) => {
    await gotoApp(page)
    await addTask(page, 'Gezinme testi')

    await page.getByRole('link', { name: 'Ayarlar' }).click()
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible()
    await page.getByRole('link', { name: 'Görevlerim' }).click()

    await expect(taskHeading(page, 'Gezinme testi')).toBeVisible()
})

test('dışa aktarma ayarlar sayfasında', async ({ page }) => {
    await gotoApp(page, '/app/settings')

    await expect(page.getByRole('button', { name: 'Dışa Aktar' })).toBeVisible()
    await expect(page.getByText('İçe Aktar')).toBeVisible()
})

test('geçersiz parola sıfırlama bağlantısı anlaşılır mesaj gösterir', async ({ page }) => {
    await page.goto('/reset-password')

    // Oturum kurulmadığı için bağlantı geçersiz sayılır.
    await expect(
        page.getByText(/Bağlantı geçersiz|hesap özellikleri yapılandırılmamış/)
    ).toBeVisible({ timeout: 10_000 })
})
