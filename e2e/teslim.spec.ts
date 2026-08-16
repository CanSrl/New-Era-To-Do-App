import { test, expect, type Page } from '@playwright/test'
import { addTask, editButton, gotoApp, taskDialog } from './helpers'

/**
 * Teslim odaklı görünüm: görevlerin müşteri → proje kırılımında okunması.
 *
 * Gruplama ve sıralama kuralları `src/features/delivery/grouping.test.ts`
 * içinde saf fonksiyon olarak kapsanıyor. Buradaki testler başka bir şeyi
 * doğruluyor: kuralların ekrana **doğru bağlandığını** — grup başlıkları,
 * gezinme, ve arama/filtre çubuğunun bu sayfada da çalıştığını.
 *
 * Kategoriler gibi local-first çalışır; Supabase yapılandırılmasa da tamamen
 * işlevlidir, bu yüzden atlanmaz.
 */

const delivery = '/app/delivery'

async function addClient(page: Page, name: string) {
    await page.goto('/app/clients')
    await page.getByPlaceholder('Yeni müşteri').fill(name)
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByRole('textbox', { name: `${name} müşterisinin adı` })).toBeVisible()
}

async function addProject(page: Page, client: string, name: string) {
    await page.goto('/app/clients')
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

/** Müşteri adıyla adlandırılmış grup bölgesi. */
const group = (page: Page, client: string) => page.getByRole('region', { name: client })

test.beforeEach(async ({ page }) => {
    await gotoApp(page)
})

test('görevleri müşteri ve projeye göre gruplar', async ({ page }) => {
    await addClient(page, 'Acme')
    await addProject(page, 'Acme', 'Websitesi')
    await addTask(page, 'Logo taslağı')
    await linkTask(page, 'Logo taslağı', 'Acme', 'Websitesi')

    await page.goto(delivery)

    const acme = group(page, 'Acme')
    await expect(acme).toContainText('Websitesi')
    await expect(acme).toContainText('Logo taslağı')
})

test('projesiz görev "Projesiz" başlığı altında görünür', async ({ page }) => {
    await addClient(page, 'Acme')
    await addTask(page, 'Telefon görüşmesi')
    await linkTask(page, 'Telefon görüşmesi', 'Acme')

    await page.goto(delivery)

    const acme = group(page, 'Acme')
    await expect(acme).toContainText('Projesiz')
    await expect(acme).toContainText('Telefon görüşmesi')
})

test('müşterisiz görevler ayrı ve en sondaki grupta toplanır', async ({ page }) => {
    await addClient(page, 'Acme')
    await addTask(page, 'Bağlı iş')
    await linkTask(page, 'Bağlı iş', 'Acme')
    await addTask(page, 'Serbest iş')

    await page.goto(delivery)

    await expect(group(page, 'Müşterisiz')).toContainText('Serbest iş')

    // Sıra da kuralın parçası: müşterisiz grup en sonda durmalı.
    //
    // Sorgu `main` ile sınırlı: sonner'ın bildirim konteyneri de bir
    // `region` ve body seviyesinde duruyor, kapsam daraltılmazsa "son bölge"
    // her zaman o çıkar.
    const groups = await page.getByRole('main').getByRole('region').all()
    await expect(groups[groups.length - 1]).toContainText('Müşterisiz')
})

test('görevler grup içinde teslim tarihine göre sıralanır', async ({ page }) => {
    await addClient(page, 'Acme')
    await addTask(page, 'Geç teslim', { dueDate: '2026-12-31' })
    await addTask(page, 'Erken teslim', { dueDate: '2026-01-15' })
    await linkTask(page, 'Geç teslim', 'Acme')
    await linkTask(page, 'Erken teslim', 'Acme')

    await page.goto(delivery)

    const titles = await group(page, 'Acme').getByRole('heading', { level: 4 }).allTextContents()
    const erken = titles.findIndex((text) => text.includes('Erken teslim'))
    const gec = titles.findIndex((text) => text.includes('Geç teslim'))

    expect(erken).toBeGreaterThanOrEqual(0)
    expect(erken).toBeLessThan(gec)
})

test('arama müşteri adında da eşleşir', async ({ page }) => {
    // Görev listesindeki aramadan farkı bu: başlığında "Acme" geçmeyen bir
    // görev, müşterisi Acme olduğu için eşleşmeli.
    await addClient(page, 'Acme')
    await addTask(page, 'Fatura kes')
    await linkTask(page, 'Fatura kes', 'Acme')
    await addTask(page, 'Alakasız iş')

    await page.goto(delivery)
    await page.getByPlaceholder('Görev ara...').fill('Acme')

    await expect(page.getByText('Fatura kes')).toBeVisible()
    await expect(page.getByText('Alakasız iş')).toHaveCount(0)
})

test('gezinmeden teslim görünümüne ulaşılır', async ({ page }) => {
    await page.getByRole('link', { name: 'Teslim' }).first().click()

    await expect(page).toHaveURL(/\/app\/delivery$/)
    await expect(page.getByRole('heading', { name: 'Teslim', level: 1 })).toBeVisible()
})

test('hiç görev yokken yönlendirici bir boş durum gösterir', async ({ page }) => {
    await page.goto(delivery)

    await expect(page.getByText('Gösterilecek iş yok')).toBeVisible()
})
