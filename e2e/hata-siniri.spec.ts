import { test, expect } from '@playwright/test'
import { addTask, gotoApp, taskHeading } from './helpers'

/**
 * Hata sınırı.
 *
 * Bir sınırın çalıştığı ancak gerçek bir çökmeyle doğrulanabilir; bunun için
 * yalnızca geliştirmede kayıtlı olan `/app/__crash` rotası kullanılıyor
 * (üretim derlemesinde bu rota paketten eleniyor).
 *
 * React, sınır tarafından yakalanan hatayı yine de konsola yazar; bu yüzden
 * testler konsol temizliğine değil kullanıcının gördüğüne bakar.
 */

test('çöken rota beyaz sayfa yerine hata ekranı gösterir', async ({ page }) => {
    await page.goto('/app/__crash')

    const alert = page.getByRole('alert')
    await expect(alert.getByRole('heading', { name: 'Bir şeyler ters gitti' })).toBeVisible()
    await expect(alert).toContainText('Görevleriniz bu cihazda güvende')
})

test('teknik ayrıntı katlanmış durur ve açılabilir', async ({ page }) => {
    await page.goto('/app/__crash')

    // Kullanıcıyı yığın iziyle karşılamamalı ama destek için erişilebilir olmalı.
    const detail = page.getByText('Kasıtlı çökme testi')
    await expect(detail).toBeHidden()

    await page.getByText('Teknik ayrıntı').click()
    await expect(detail).toBeVisible()
})

test('izleme kapalıyken bunu açıkça söyler', async ({ page }) => {
    // Varsayılan kurulumda VITE_SENTRY_DSN yok; kullanıcı hatanın kimseye
    // ulaşmadığını bilmeli.
    await page.goto('/app/__crash')

    await expect(page.getByRole('alert')).toContainText('hata raporlama kapalı')
})

test('yenile butonu uygulamayı geri getirir', async ({ page }) => {
    await gotoApp(page)
    await addTask(page, 'Çökme öncesi görev')

    await page.goto('/app/__crash')
    await expect(page.getByRole('heading', { name: 'Bir şeyler ters gitti' })).toBeVisible()

    // Yenileme çöken rotayı yeniden yükler; kullanıcı oradan uygulamaya döner.
    await page.getByRole('button', { name: 'Sayfayı yenile' }).click()
    await expect(page.getByRole('heading', { name: 'Bir şeyler ters gitti' })).toBeVisible()

    await page.goto('/app')
    await expect(taskHeading(page, 'Çökme öncesi görev')).toBeVisible()
})

test('çökme kullanıcının verisini bozmaz', async ({ page }) => {
    await gotoApp(page)
    await addTask(page, 'Kalıcı görev')

    await page.goto('/app/__crash')
    await expect(page.getByRole('heading', { name: 'Bir şeyler ters gitti' })).toBeVisible()
    await page.goto('/app')

    await expect(taskHeading(page, 'Kalıcı görev')).toBeVisible()
})

test('hata ekranı dile uyar', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()

    await page.goto('/app/__crash')

    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload the page' })).toBeVisible()

    await context.close()
})
