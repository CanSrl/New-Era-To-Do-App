import { test, expect } from '@playwright/test'

/**
 * Giriş akışı yalnızca Supabase yapılandırılmışsa çalışır. Yapılandırma yoksa
 * hesap arayüzü hiç render edilmez (local-first davranış) ve testler atlanır.
 *
 * Yerelde çalıştırmak için: npx supabase start + .env.local
 */
test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const signInVisible = await page
        .getByRole('button', { name: 'Giriş Yap', exact: true })
        .isVisible()
        .catch(() => false)

    test.skip(!signInVisible, 'Supabase yapılandırılmamış; giriş arayüzü kapalı.')
})

test('giriş diyaloğu açılır ve kayıt moduna geçer', async ({ page }) => {
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Giriş Yap' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Hesap oluştur' }).click()
    await expect(dialog.getByRole('heading', { name: 'Hesap Oluştur' })).toBeVisible()
})

test('kısa parola istemci tarafında reddedilir', async ({ page }) => {
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByLabel('E-posta').fill('deneme@example.com')
    await dialog.getByLabel('Parola').fill('123')
    await dialog.getByRole('button', { name: 'Giriş Yap', exact: true }).click()

    await expect(dialog.getByRole('alert')).toContainText('en az 6 karakter')
})

test('hatalı bilgiyle giriş anlaşılır bir hata gösterir', async ({ page }) => {
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByLabel('E-posta').fill('olmayan-kullanici@example.com')
    await dialog.getByLabel('Parola').fill('yanlisparola')
    await dialog.getByRole('button', { name: 'Giriş Yap', exact: true }).click()

    await expect(dialog.getByRole('alert')).toContainText('E-posta veya parola hatalı')
})

test('kayıt olur, oturum yenilemede korunur ve çıkış yapılır', async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`

    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByRole('button', { name: 'Hesap oluştur' }).click()
    await dialog.getByLabel('E-posta').fill(email)
    await dialog.getByLabel('Parola').fill('parola12345')
    await dialog.getByRole('button', { name: 'Hesap Oluştur', exact: true }).click()

    // Yerel Supabase'de e-posta doğrulaması kapalıdır: oturum hemen açılır.
    await expect(page.getByText(email)).toBeVisible()

    await page.reload()
    await expect(page.getByText(email)).toBeVisible()

    await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Giriş Yap', exact: true })).toBeVisible()
})

test('giriş yapmadan da görev eklenebilir', async ({ page }) => {
    await page.getByRole('button', { name: 'İlk Görevini Ekle' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Başlık').fill('Misafir görevi')
    await dialog.getByRole('button', { name: 'Görev Ekle', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Misafir görevi' })).toBeVisible()
})
