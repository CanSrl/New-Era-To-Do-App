import { test, expect, type Page } from '@playwright/test'
import { addTask, editButton, gotoApp, openTaskForm, taskDialog } from './helpers'

/**
 * Niş modülün yönetim ekranı: müşteri/proje CRUD'u, arşivleme ve görev
 * bağlarının silme sonrası hâli.
 *
 * Bu testler istemcinin veritabanı davranışını doğru taklit ettiğini de
 * doğrular — müşteri silinince İKİ bağın birden boşalması sunucudaki
 * `clear_tasks_for_deleted_client` tetikleyicisinin karşılığıdır. İkisi
 * ayrışırsa görev bağları senkron turunda geri dirilir.
 *
 * Kategoriler gibi local-first çalışırlar; Supabase yapılandırılmasa da
 * tamamen işlevlidirler, bu yüzden atlanmazlar.
 */

const clients = '/app/clients'

async function addClient(page: Page, name: string) {
    await page.getByPlaceholder('Yeni müşteri').fill(name)
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByRole('textbox', { name: `${name} müşterisinin adı` })).toBeVisible()
}

async function addProject(page: Page, client: string, name: string) {
    await page.getByRole('button', { name: `"${client}" projelerini göster` }).click()

    const input = page.getByRole('textbox', { name: `"${client}" için yeni proje adı` })
    await input.fill(name)
    await page.getByRole('button', { name: `"${client}" müşterisine proje ekle` }).click()
    await expect(page.getByRole('textbox', { name: `${name} projesinin adı` })).toBeVisible()
}

/** Görevi düzenleme formundan müşteriye (ve varsa projeye) bağlar. */
async function linkTask(page: Page, title: string, client: string, project?: string) {
    await page.goto('/app')
    await editButton(page, title).click()

    const dialog = taskDialog(page)
    await dialog.getByLabel('Müşteri').selectOption({ label: client })
    if (project) {
        await dialog.getByLabel('Proje').selectOption({ label: project })
    }
    await dialog.getByRole('button', { name: 'Güncelle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
}

test.beforeEach(async ({ page }) => {
    await gotoApp(page)
})

test('müşteri eklenir ve görev formunda seçilebilir olur', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme Ajans')

    await openTaskForm(page)
    await expect(taskDialog(page).getByLabel('Müşteri')).toContainText('Acme Ajans')
})

test('aynı adlı müşteri ikinci kez eklenemez', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')

    // Büyük/küçük harf farkı aynı müşteri sayılır (Türkçe duyarlı karşılaştırma).
    await page.getByPlaceholder('Yeni müşteri').fill('acme')
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()

    await expect(page.getByText('zaten kullanılıyor')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /müşterisinin adı/ })).toHaveCount(1)
})

test('proje seçicisi müşteri seçilene kadar kapalıdır', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')

    await openTaskForm(page)
    const dialog = taskDialog(page)

    // Müşterisiz projeyi şema da kabul etmiyor (tasks_project_requires_client).
    await expect(dialog.getByLabel('Proje')).toBeDisabled()

    await dialog.getByLabel('Müşteri').selectOption({ label: 'Acme' })
    await expect(dialog.getByLabel('Proje')).toBeEnabled()
    await expect(dialog.getByLabel('Proje')).toContainText('Websitesi')
})

test('aynı müşteride aynı adlı proje ikinci kez eklenemez', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')

    await page.getByRole('textbox', { name: '"Acme" için yeni proje adı' }).fill('websitesi')
    await page.getByRole('button', { name: '"Acme" müşterisine proje ekle' }).click()

    await expect(page.getByText('zaten kullanılıyor')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /projesinin adı/ })).toHaveCount(1)
})

test('görev müşteri ve projeye bağlanır, kartta rozet görünür', async ({ page }) => {
    await addTask(page, 'Anasayfa taslağı')

    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')

    await linkTask(page, 'Anasayfa taslağı', 'Acme', 'Websitesi')

    await expect(page.getByText('Acme · Websitesi')).toBeVisible()
})

test('müşteri değişince seçili proje sıfırlanır', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')
    await addClient(page, 'Beta')

    await openTaskForm(page)
    const dialog = taskDialog(page)

    await dialog.getByLabel('Müşteri').selectOption({ label: 'Acme' })
    await dialog.getByLabel('Proje').selectOption({ label: 'Websitesi' })

    // Beta'nın "Websitesi" projesi yok; eski seçim kalsaydı gönderim şemadaki
    // (project_id, client_id) üçlüsüne takılırdı.
    await dialog.getByLabel('Müşteri').selectOption({ label: 'Beta' })
    await expect(dialog.getByLabel('Proje')).toHaveValue('')
})

test('müşteri yeniden adlandırılır ve görev kartına yansır', async ({ page }) => {
    await addTask(page, 'Rapor')

    await page.goto(clients)
    await addClient(page, 'Acme')
    await linkTask(page, 'Rapor', 'Acme')
    await expect(page.getByText('Acme', { exact: true })).toBeVisible()

    await page.goto(clients)
    const nameInput = page.getByRole('textbox', { name: 'Acme müşterisinin adı' })
    await nameInput.fill('Acme Ajans')
    await nameInput.press('Enter')

    // Ad kayıtta tutulur; görevi tek tek güncellemek gerekmez.
    await page.goto('/app')
    await expect(page.getByText('Acme Ajans', { exact: true })).toBeVisible()
})

test('arşivlenen müşteri seçiciden düşer ama mevcut bağ korunur', async ({ page }) => {
    await addTask(page, 'Eski iş')

    await page.goto(clients)
    await addClient(page, 'Acme')
    await linkTask(page, 'Eski iş', 'Acme')

    await page.goto(clients)
    await page.getByRole('button', { name: '"Acme" müşterisini arşivle' }).click()
    // `exact`: toast metni ("Acme" arşivlendi.) de aynı kökü taşıyor.
    await expect(page.getByText('Arşivlendi', { exact: true })).toBeVisible()

    // Yeni görevde seçenek listesinde yok...
    await openTaskForm(page)
    await expect(taskDialog(page).getByLabel('Müşteri')).not.toContainText('Acme')
    await page.keyboard.press('Escape')

    // ...ama zaten bağlı görevin bağı yerinde durur. Gizlenseydi form açılınca
    // select eşleşen seçeneği bulamaz ve bağ sessizce kopardı.
    await page.goto('/app')
    await editButton(page, 'Eski iş').click()
    await expect(taskDialog(page).getByLabel('Müşteri')).toHaveValue(/.+/)
    await expect(taskDialog(page).getByLabel('Müşteri')).toContainText('Acme')
})

test('proje silinince görev silinmez, yalnızca proje bağı boşalır', async ({ page }) => {
    await addTask(page, 'Tasarım')

    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')
    await linkTask(page, 'Tasarım', 'Acme', 'Websitesi')

    await page.goto(clients)
    await page.getByRole('button', { name: '"Acme" projelerini göster' }).click()
    await page.getByRole('button', { name: '"Websitesi" projesini sil' }).click()

    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText('müşteri bağı kalır')
    await confirmation.getByRole('button', { name: 'Sil' }).click()

    // Sunucuda `on delete set null (project_id)`: müşteri bağı dokunulmaz.
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Tasarım' })).toBeVisible()
    await expect(page.getByText('Acme', { exact: true })).toBeVisible()
    await expect(page.getByText('Acme · Websitesi')).toHaveCount(0)
})

test('müşteri silinince projeleri de gider ve görevin iki bağı da boşalır', async ({ page }) => {
    await addTask(page, 'Teslim')

    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')
    await linkTask(page, 'Teslim', 'Acme', 'Websitesi')

    await page.goto(clients)
    await page.getByRole('button', { name: '"Acme" müşterisini sil' }).click()

    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText('1 projesi de silinir')
    await expect(confirmation).toContainText('1 görev silinmez')
    await confirmation.getByRole('button', { name: 'Sil' }).click()

    await expect(page.getByText('Henüz müşteri yok')).toBeVisible()

    // Yalnızca clientId boşalsaydı tasks_project_requires_client check'i patlardı.
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Teslim' })).toBeVisible()
    await expect(page.getByText('Acme')).toHaveCount(0)
    await expect(page.getByText('Websitesi')).toHaveCount(0)
})

test('müşteri sayaçları bağlı proje ve görev sayısını gösterir', async ({ page }) => {
    await addTask(page, 'Sayılan')

    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')
    await linkTask(page, 'Sayılan', 'Acme', 'Websitesi')

    await page.goto(clients)
    // Satır metniyle değil, içindeki alanın erişilebilir adıyla bulunur:
    // müşteri adı bir input'un değerinde durur, metin içeriğinde değil.
    const card = page.getByRole('listitem').filter({
        has: page.getByRole('textbox', { name: 'Acme müşterisinin adı' }),
    })
    await expect(card).toContainText('1 proje')
    await expect(card).toContainText('1 görev')
})
