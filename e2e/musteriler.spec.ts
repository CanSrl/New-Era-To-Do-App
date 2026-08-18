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

/** Elle zaman kaydı ekler; sayaç etkileşimi `zaman.spec.ts` içinde. */
async function addTimeLog(
    page: Page,
    input: { client: string; project?: string; date: string; minutes: number }
) {
    await page.goto('/app/time')
    await page.getByRole('button', { name: 'Kayıt ekle' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Tarih').fill(input.date)
    await dialog.getByLabel('Süre (dakika)').fill(String(input.minutes))
    await dialog.getByLabel('Müşteri').selectOption({ label: input.client })
    if (input.project) await dialog.getByLabel('Proje').selectOption({ label: input.project })

    await dialog.getByRole('button', { name: 'Ekle', exact: true }).click()
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

test('müşteri silme diyaloğu zaman kaydı sayısını ve süresini de söyler', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')

    await addTimeLog(page, { client: 'Acme', date: '2026-08-17', minutes: 60 })
    await addTimeLog(page, { client: 'Acme', date: '2026-08-18', minutes: 20 })

    await page.goto(clients)
    await page.getByRole('button', { name: '"Acme" müşterisini sil' }).click()

    /*
     * Metin sunucunun `on delete cascade` davranışını söyler: müşteri
     * silinince zaman kayıtları da gider — görevlerin aksine, çünkü
     * `time_logs.client_id` `not null`.
     */
    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText('2 zaman kaydı')
    await expect(confirmation).toContainText('1 sa 20 dk')

    await confirmation.getByRole('button', { name: 'Sil' }).click()

    // Kayıtlar gerçekten gitti; diyalogdaki söz tutuldu.
    await page.goto('/app/time')
    await expect(page.getByText('Henüz zaman kaydı yok')).toBeVisible()
})

test('proje silme diyaloğu zaman kayıtlarının silinmeyeceğini söyler', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')

    await addTimeLog(page, { client: 'Acme', project: 'Websitesi', date: '2026-08-17', minutes: 45 })

    await page.goto(clients)
    await page.getByRole('button', { name: '"Acme" projelerini göster' }).click()
    await page.getByRole('button', { name: '"Websitesi" projesini sil' }).click()

    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText('1 zaman kaydı silinmez')
    await confirmation.getByRole('button', { name: 'Sil' }).click()

    // Kayıt duruyor, yalnızca proje bağı boşaldı (`on delete set null`).
    await page.goto('/app/time')
    await expect(page.getByText('45 dk', { exact: true })).toBeVisible()
})

test('müşteri ücreti ve para birimi kaydedilir, proje onu ezebilir', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')

    const rate = page.getByRole('spinbutton', { name: 'Acme müşterisinin saatlik ücreti' })
    await rate.fill('1500')
    await rate.press('Enter')
    await expect(page.getByText('Saatlik ücret güncellendi.')).toBeVisible()

    const currency = page.getByRole('textbox', { name: 'Acme müşterisinin para birimi' })
    await currency.fill('usd')
    await currency.press('Enter')
    // Kod büyük harfe normalize edilir; aksi halde toplamlar aynı birimi
    // iki ayrı satıra bölerdi.
    await expect(currency).toHaveValue('USD')

    // Proje ücreti boşken yer tutucu müşteriden mirası gösterir.
    const projectRate = page.getByRole('spinbutton', { name: 'Websitesi projesinin saatlik ücreti' })
    await expect(projectRate).toHaveValue('')
    await expect(projectRate).toHaveAttribute('placeholder', /müşteriden/)

    await projectRate.fill('2000')
    await projectRate.press('Enter')

    // Yenilemeden sonra da yerinde: ücretler store'da yaşıyor.
    await page.reload()
    await page.getByRole('button', { name: '"Acme" projelerini göster' }).click()
    await expect(page.getByRole('spinbutton', { name: 'Acme müşterisinin saatlik ücreti' }))
        .toHaveValue('1500')
    await expect(page.getByRole('spinbutton', { name: 'Websitesi projesinin saatlik ücreti' }))
        .toHaveValue('2000')
})

test('negatif ücret reddedilir ve alan eski değerine döner', async ({ page }) => {
    await page.goto(clients)
    await addClient(page, 'Acme')
    await page.getByRole('button', { name: '"Acme" projelerini göster' }).click()

    const rate = page.getByRole('spinbutton', { name: 'Acme müşterisinin saatlik ücreti' })
    await rate.fill('1500')
    await rate.press('Enter')

    await rate.fill('-5')
    await rate.press('Enter')

    // Şemadaki `check (hourly_rate >= 0)` ihlal eden satır push kuyruğuna
    // hiç girmemeli; store reddediyor, alan geri alınıyor.
    await expect(page.getByText('Saatlik ücret 0 veya daha büyük olmalı.')).toBeVisible()
    await expect(rate).toHaveValue('1500')
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
