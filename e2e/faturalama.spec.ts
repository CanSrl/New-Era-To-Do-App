import { test, expect, type Page } from '@playwright/test'
import { gotoApp, isAuthEnabled } from './helpers'

test('oturumsuz ziyaretçi /app ve /app/settings kullanabilir', async ({ page }) => {
    await gotoApp(page)
    await expect(page.getByRole('heading', { name: 'Merhaba!' })).toBeVisible()

    await page.goto('/app/settings')
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible()
})

test('bayrak kapalıyken /app/billing bulunamadıya düşer', async ({ page }) => {
    await page.goto('/app/billing')
    await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible()
})

test('ücretsiz girişli kullanıcı ikinci müşteride nedeni görür', async ({ page }) => {
    await gotoApp(page)
    test.skip(!(await isAuthEnabled(page)), 'Supabase yapılandırılmamış')

    const email = `faturalama-${Date.now()}@example.com`
    await signUp(page, email)

    await page.goto('/app/clients')
    await page.getByPlaceholder('Yeni müşteri').fill('Acme')
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Acme müşterisinin adı' })).toBeVisible()

    await page.getByPlaceholder('Yeni müşteri').fill('Globex')
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByText(/en fazla 1 müşteri/i)).toBeVisible()
})

async function signUp(page: Page, email: string) {
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Hesap oluştur' }).click()
    await dialog.getByLabel('E-posta').fill(email)
    await dialog.getByLabel('Parola').fill('parola12345')
    await dialog.getByRole('button', { name: 'Hesap Oluştur', exact: true }).click()
    await expect(page.getByText(email)).toBeVisible()
}
