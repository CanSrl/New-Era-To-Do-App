import { test, expect } from '@playwright/test'
import { gotoApp, taskDialog } from './helpers'

/**
 * Dil değiştirme.
 *
 * Playwright yereli `tr-TR` olarak sabitlenmiştir (bkz. playwright.config.ts),
 * dolayısıyla uygulama Türkçe açılır. Buradaki testler algılamanın ve elle
 * seçimin ikisini de kapsar.
 */

const settings = '/app/settings'

test('varsayılan olarak tarayıcı dilinde açılır', async ({ page }) => {
    await gotoApp(page)

    await expect(page.getByRole('heading', { name: 'Merhaba! 👋' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
})

test('İngilizce tarayıcıda İngilizce açılır', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()

    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Hello! 👋' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await context.close()
})

test('ayarlardan dil değiştirilir ve arayüz anında güncellenir', async ({ page }) => {
    await gotoApp(page)
    await page.goto(settings)

    await page.getByRole('radio', { name: 'İngilizce' }).click()

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('dil tercihi yenilemeden sonra korunur', async ({ page }) => {
    await gotoApp(page)
    await page.goto(settings)
    await page.getByRole('radio', { name: 'İngilizce' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await page.reload()

    // Tarayıcı dili hâlâ tr-TR; açık seçim onu yenmeli.
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})

test('görev arayüzü de çevrilir', async ({ page }) => {
    await gotoApp(page)
    await page.goto(settings)
    await page.getByRole('radio', { name: 'İngilizce' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await page.goto('/app')
    // Yardımcı `openTaskForm` Türkçe seçici kullanıyor; burada arayüz
    // İngilizce olduğu için buton doğrudan çevrilmiş adıyla bulunur.
    await page.getByRole('button', { name: 'Add your first task' }).click()
    const dialog = taskDialog(page)

    await expect(dialog.getByRole('heading', { name: 'New task' })).toBeVisible()
    await expect(dialog.getByLabel('Title')).toBeVisible()
    // Öncelik artık dile bağımsız bir anahtar; etiket çeviriden geliyor.
    await expect(dialog.getByRole('button', { name: 'High', exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Category')).toContainText('Uncategorized')
})

test('dil değişince mevcut kategori adları olduğu gibi kalır', async ({ page }) => {
    await gotoApp(page)
    await page.goto(settings)

    // Kategoriler kullanıcı verisidir: tohumlanırken çevrilirler ama sonradan
    // dil değişince yeniden adlandırılmazlar, aksi halde kullanıcının kendi
    // düzenlemeleri ezilirdi.
    await expect(page.getByRole('textbox', { name: 'İş kategorisinin adı' })).toBeVisible()

    await page.getByRole('radio', { name: 'İngilizce' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await expect(page.getByRole('textbox', { name: 'Name of category İş' })).toBeVisible()
})

test('İngilizce açılan cihazda kategoriler İngilizce tohumlanır', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()

    await page.goto('/app/settings')

    for (const name of ['Work', 'Personal', 'Shopping', 'School']) {
        await expect(page.getByRole('textbox', { name: `Name of category ${name}` })).toBeVisible()
    }

    await context.close()
})
