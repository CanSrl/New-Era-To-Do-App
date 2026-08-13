import { test, expect } from '@playwright/test'
import { addTask, deleteButton, editButton, gotoApp, openTaskForm, taskDialog, taskHeading, toggleButton } from './helpers'

// Playwright her teste izole bir tarayıcı bağlamı verir; LocalStorage
// testler arasında paylaşılmaz, ayrıca temizlik gerekmez.
test.beforeEach(async ({ page }) => {
    await gotoApp(page)
})

test('boş durum karşılama ekranını gösterir', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Henüz görev yok' })).toBeVisible()
})

test('görev ekler ve listede gösterir', async ({ page }) => {
    await addTask(page, 'Ekmek al')

    await expect(taskHeading(page, 'Ekmek al')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Henüz görev yok' })).toBeHidden()
})

test('başlıksız görev eklenemez', async ({ page }) => {
    await openTaskForm(page)
    await taskDialog(page).getByRole('button', { name: 'Görev Ekle', exact: true }).click()

    await expect(page.getByText('Görev başlığı zorunludur!')).toBeVisible()
    // Form açık kalmalı ki kullanıcı düzeltebilsin.
    await expect(taskDialog(page)).toBeVisible()
})

test('açıklama ve öncelik ile görev ekler', async ({ page }) => {
    await addTask(page, 'Rapor yaz', { description: 'Yıllık özet', priority: 'Yüksek' })

    await expect(taskHeading(page, 'Rapor yaz')).toBeVisible()
    await expect(page.getByText('Yıllık özet')).toBeVisible()
    await expect(page.getByText('Yüksek', { exact: true })).toBeVisible()
})

test('görevi tamamlandı olarak işaretler ve geri alır', async ({ page }) => {
    await addTask(page, 'Ekmek al')

    await toggleButton(page, 'Ekmek al').click()
    await expect(toggleButton(page, 'Ekmek al')).toHaveAttribute('aria-pressed', 'true')

    await toggleButton(page, 'Ekmek al').click()
    await expect(toggleButton(page, 'Ekmek al')).toHaveAttribute('aria-pressed', 'false')
})

test('görevi düzenler', async ({ page }) => {
    await addTask(page, 'Ekmek al')

    await editButton(page, 'Ekmek al').click()
    await taskDialog(page).getByLabel('Başlık').fill('Süt al')
    await taskDialog(page).getByRole('button', { name: 'Güncelle' }).click()

    await expect(taskHeading(page, 'Süt al')).toBeVisible()
    await expect(taskHeading(page, 'Ekmek al')).toBeHidden()
})

test.describe('silme onayı', () => {
    test('iptal edilince görev durur', async ({ page }) => {
        await addTask(page, 'Ekmek al')

        await deleteButton(page, 'Ekmek al').click()
        await expect(page.getByRole('alertdialog')).toBeVisible()
        await page.getByRole('button', { name: 'İptal' }).click()

        await expect(page.getByRole('alertdialog')).toBeHidden()
        await expect(taskHeading(page, 'Ekmek al')).toBeVisible()
    })

    test('onaylanınca görev silinir', async ({ page }) => {
        await addTask(page, 'Ekmek al')

        await deleteButton(page, 'Ekmek al').click()
        await page.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()

        await expect(taskHeading(page, 'Ekmek al')).toBeHidden()
    })

    test('Escape tuşu diyaloğu kapatır ve görevi korur', async ({ page }) => {
        await addTask(page, 'Ekmek al')

        await deleteButton(page, 'Ekmek al').click()
        await expect(page.getByRole('alertdialog')).toBeVisible()
        await page.keyboard.press('Escape')

        await expect(page.getByRole('alertdialog')).toBeHidden()
        await expect(taskHeading(page, 'Ekmek al')).toBeVisible()
    })
})

test.describe('arama ve filtreler', () => {
    test.beforeEach(async ({ page }) => {
        await addTask(page, 'Ekmek al')
        await addTask(page, 'Rapor yaz')
        await toggleButton(page, 'Rapor yaz').click()
    })

    test('başlığa göre arar', async ({ page }) => {
        await page.getByPlaceholder('Görev ara...').fill('ekmek')

        await expect(taskHeading(page, 'Ekmek al')).toBeVisible()
        await expect(taskHeading(page, 'Rapor yaz')).toBeHidden()
    })

    test('eşleşme yoksa bilgi verir', async ({ page }) => {
        await page.getByPlaceholder('Görev ara...').fill('bulunmayan')

        await expect(page.getByText('Görev bulunamadı')).toBeVisible()
    })

    test('yalnızca aktif görevleri gösterir', async ({ page }) => {
        await page.getByRole('button', { name: 'Aktif', exact: true }).click()

        await expect(taskHeading(page, 'Ekmek al')).toBeVisible()
        await expect(taskHeading(page, 'Rapor yaz')).toBeHidden()
    })

    test('yalnızca tamamlanan görevleri gösterir', async ({ page }) => {
        await page.getByRole('button', { name: 'Tamamlandı', exact: true }).click()

        await expect(taskHeading(page, 'Rapor yaz')).toBeVisible()
        await expect(taskHeading(page, 'Ekmek al')).toBeHidden()
    })

    test('tamamlananları temizler', async ({ page }) => {
        await page.getByRole('button', { name: 'Temizle' }).click()
        await page.getByRole('alertdialog').getByRole('button', { name: 'Temizle' }).click()

        await expect(taskHeading(page, 'Rapor yaz')).toBeHidden()
        await expect(taskHeading(page, 'Ekmek al')).toBeVisible()
    })
})

test('görevler sayfa yenilendikten sonra korunur', async ({ page }) => {
    await addTask(page, 'Kalıcı görev', { dueDate: '2030-08-15' })
    await expect(taskHeading(page, 'Kalıcı görev')).toBeVisible()

    await page.reload()
    await page.getByTitle('Görev Ekle').waitFor()

    await expect(taskHeading(page, 'Kalıcı görev')).toBeVisible()
    // Tarih yenilemeden sonra da doğru biçimde görünmeli: eskiden tarihler
    // rehydrate sırasında Date-e çevrilmediği için bu noktada bozuluyordu.
    await expect(page.getByText('15 Ağu 2030')).toBeVisible()
})

test('istatistikler görev durumuna göre güncellenir', async ({ page }) => {
    await addTask(page, 'Bir')
    await addTask(page, 'İki')

    const total = page.getByText('Toplam Görev').locator('..')
    await expect(total).toContainText('2')

    await toggleButton(page, 'Bir').click()
    await expect(page.getByText('%50')).toBeVisible()
})

test('klavye kısayolu ile form açılır ve Escape ile kapanır', async ({ page }) => {
    await page.keyboard.press('n')
    await expect(taskDialog(page)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(taskDialog(page)).toBeHidden()
})
