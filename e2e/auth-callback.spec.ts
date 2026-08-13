import { test, expect } from '@playwright/test'

/**
 * `/auth/callback` sayfasının hata karşılama davranışı.
 *
 * Sağlayıcı bir isteği reddettiğinde kullanıcıyı yine bu adrese gönderir, hata
 * bilgisini adrese ekleyerek. Bu durum elle test edilemez (gerçek bir OAuth
 * reddi gerekir) ama adres taklit edilerek birebir aynı yol koşturulabilir.
 *
 * Ayrıca bir yarış durumunu korur: Supabase istemcisi açılışta adresi
 * temizleyebiliyor, dolayısıyla hata React render'ından önce kaybolabilir.
 * Testler yalnızca sayfanın hatayı gösterdiğini değil, göstermeye yetişebildiğini
 * de doğrular.
 *
 * Bu akış Supabase yapılandırmasından bağımsızdır: hata sayfası yerel modda da
 * gösterilir, o yüzden diğer giriş testlerinin aksine atlanmaz.
 */

test('sorgu dizesindeki OAuth hatası kullanıcıya Türkçe gösterilir', async ({ page }) => {
    await page.goto(
        '/auth/callback?error=access_denied&error_code=otp_expired' +
        '&error_description=Email+link+is+invalid+or+has+expired'
    )

    await expect(page.getByRole('heading', { name: 'Giriş tamamlanamadı' })).toBeVisible()
    await expect(page.getByText('Bağlantının süresi dolmuş')).toBeVisible()

    // Sağlayıcının İngilizce açıklaması kullanıcıya sızmamalı.
    await expect(page.getByText('Email link is invalid')).toHaveCount(0)
})

test('çapa parçasındaki OAuth hatası da yakalanır', async ({ page }) => {
    await page.goto('/auth/callback#error=access_denied&error_code=access_denied')

    await expect(page.getByRole('heading', { name: 'Giriş tamamlanamadı' })).toBeVisible()
})

test('hata sayfasından uygulamaya dönülebilir', async ({ page }) => {
    await page.goto('/auth/callback?error=server_error&error_code=unexpected_failure')

    await page.getByRole('link', { name: 'Görevlere dön' }).click()
    await expect(page).toHaveURL(/\/app$/)
    await page.getByTitle('Görev Ekle').waitFor()
})

test('tanınmayan hata kodunda genel mesaj gösterilir, sayfa boş kalmaz', async ({ page }) => {
    await page.goto('/auth/callback?error=server_error&error_code=bilinmeyen_kod')

    await expect(page.getByText('Giriş tamamlanamadı. Lütfen tekrar deneyin.')).toBeVisible()
})
