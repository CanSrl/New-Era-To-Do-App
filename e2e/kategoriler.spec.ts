import { test, expect } from '@playwright/test'
import { addTask, gotoApp, openTaskForm, taskDialog } from './helpers'

/**
 * Kategori yönetimi ayarlar sayfasında yaşar; görev formu ve görev kartı da
 * kategorileri okur. Bu testler üçünün birlikte tutarlı kaldığını doğrular.
 *
 * Kategoriler local-first: Supabase yapılandırılmasa da tamamen çalışırlar,
 * bu yüzden giriş testlerinin aksine atlanmazlar.
 */

const settings = '/app/settings'

test.beforeEach(async ({ page }) => {
    await gotoApp(page)
})

test('yeni cihaz varsayılan kategorilerle gelir', async ({ page }) => {
    await page.goto(settings)

    for (const name of ['İş', 'Kişisel', 'Alışveriş', 'Okul']) {
        await expect(page.getByRole('textbox', { name: `${name} kategorisinin adı` })).toBeVisible()
    }
})

test('kategori eklenir ve görev formunda seçilebilir olur', async ({ page }) => {
    await page.goto(settings)

    await page.getByPlaceholder('Yeni kategori').fill('Tatil')
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()

    await expect(page.getByRole('textbox', { name: 'Tatil kategorisinin adı' })).toBeVisible()

    // Görev formu store-dan okur; yeni kategori oraya da düşmeli.
    await openTaskForm(page)
    await expect(taskDialog(page).getByLabel('Kategori')).toContainText('Tatil')
})

test('aynı adlı kategori ikinci kez eklenemez', async ({ page }) => {
    await page.goto(settings)

    // Büyük/küçük harf farkı aynı kategori sayılır.
    await page.getByPlaceholder('Yeni kategori').fill('iş')
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()

    await expect(page.getByText('zaten kullanılıyor')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /kategorisinin adı/ })).toHaveCount(4)
})

test('kategori yeniden adlandırılır ve görev kartına yansır', async ({ page }) => {
    await addTask(page, 'Rapor yaz')

    // Görevi "İş" kategorisine bağla.
    await page.getByRole('button', { name: '"Rapor yaz" görevini düzenle' }).click()
    await taskDialog(page).getByLabel('Kategori').selectOption({ label: 'İş' })
    await taskDialog(page).getByRole('button', { name: 'Güncelle', exact: true }).click()
    await expect(page.getByText('İş', { exact: true })).toBeVisible()

    await page.goto(settings)
    const nameInput = page.getByRole('textbox', { name: 'İş kategorisinin adı' })
    await nameInput.fill('Mesai')
    await nameInput.press('Enter')

    // Ad kayıtta tutulduğu için görev kartı yeni adı gösterir; görevi tek tek
    // güncellemek gerekmez.
    await page.goto('/app')
    await expect(page.getByText('Mesai', { exact: true })).toBeVisible()
})

test('kategori silinince görev silinmez, kategorisiz kalır', async ({ page }) => {
    await addTask(page, 'Sunum hazırla')

    await page.getByRole('button', { name: '"Sunum hazırla" görevini düzenle' }).click()
    await taskDialog(page).getByLabel('Kategori').selectOption({ label: 'Okul' })
    await taskDialog(page).getByRole('button', { name: 'Güncelle', exact: true }).click()
    await expect(page.getByText('Okul', { exact: true })).toBeVisible()

    await page.goto(settings)
    await page.getByRole('button', { name: '"Okul" kategorisini sil' }).click()

    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText('1 görev silinmez')
    await confirmation.getByRole('button', { name: 'Sil' }).click()

    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Sunum hazırla' })).toBeVisible()
    await expect(page.getByText('Okul', { exact: true })).toHaveCount(0)
})

test('kategori sayacı bağlı görev sayısını gösterir', async ({ page }) => {
    await addTask(page, 'Birinci')
    await page.getByRole('button', { name: '"Birinci" görevini düzenle' }).click()
    await taskDialog(page).getByLabel('Kategori').selectOption({ label: 'İş' })
    await taskDialog(page).getByRole('button', { name: 'Güncelle', exact: true }).click()

    await page.goto(settings)
    // Satır metniyle değil, içindeki alanın erişilebilir adıyla bulunur:
    // kategori adı bir input'un değerinde durur, metin içeriğinde değil.
    const row = page.getByRole('listitem').filter({
        has: page.getByRole('textbox', { name: 'İş kategorisinin adı' }),
    })
    await expect(row).toContainText('1 görev')
})

test('kategorisiz görev eklenebilir ve rozet göstermez', async ({ page }) => {
    await openTaskForm(page)
    const dialog = taskDialog(page)

    await dialog.getByLabel('Başlık').fill('Serbest görev')
    // Varsayılan seçim "Kategorisiz".
    await expect(dialog.getByLabel('Kategori')).toHaveValue('')
    await dialog.getByRole('button', { name: 'Görev Ekle', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Serbest görev' })).toBeVisible()
    await expect(page.getByText('Kategorisiz', { exact: true })).toHaveCount(0)
})
