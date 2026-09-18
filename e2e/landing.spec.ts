import { test, expect } from '@playwright/test'

/**
 * Kök adresteki pazarlama sayfası.
 *
 * Uygulamanın kabuğundan tamamen ayrıdır: `AppLayout` sarmaz, yüzen görev
 * ekleme butonu yoktur. Testler bunu da doğruluyor — landing'in uygulama
 * kabuğunu sızdırması, iki rotanın yanlışlıkla iç içe geçtiğinin işareti olur.
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('kök adres pazarlama sayfasını açar', async ({ page }) => {
    await expect(
        page.getByRole('heading', { name: /Görevlerini müşteriye bağla/ })
    ).toBeVisible()
})

test('uygulama kabuğu landing sayfasına sızmaz', async ({ page }) => {
    // Yüzen "Görev Ekle" butonu AppLayout'ta yaşar; burada olmamalı.
    await expect(page.getByTitle('Görev Ekle')).toHaveCount(0)
})

test('CTA uygulamaya götürür', async ({ page }) => {
    await page.getByRole('link', { name: 'Uygulamayı aç' }).first().click()

    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { name: 'Merhaba! 👋' })).toBeVisible()
})

test('özellikler bölümü ve ona giden bağlantı vardır', async ({ page }) => {
    await page.getByRole('link', { name: 'Özellikler' }).click()

    await expect(page).toHaveURL(/#features$/)
    await expect(
        page.getByRole('heading', { name: /jenerik bir görev listesi değil/ })
    ).toBeVisible()
})

test('mobil menü açılır ve kapanır', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    const open = page.getByRole('button', { name: 'Menüyü aç' })
    await expect(open).toBeVisible()
    await open.click()

    const close = page.getByRole('button', { name: 'Menüyü kapat' })
    await expect(close).toHaveAttribute('aria-expanded', 'true')
    await close.click()
    await expect(page.getByRole('button', { name: 'Menüyü aç' })).toBeVisible()
})

test('sayfa uygulamanın yazı tipini bozmaz', async ({ page }) => {
    // Özgün şablon global bir `* { font-family: Poppins }` kuralı ve Google
    // Fonts import'u taşıyordu; mount olduğu anda bütün uygulamayı etkilerdi.
    const landingFont = await page.evaluate(
        () => getComputedStyle(document.body).fontFamily
    )

    await page.goto('/app')
    const appFont = await page.evaluate(
        () => getComputedStyle(document.body).fontFamily
    )

    expect(landingFont).toBe(appFont)
    expect(landingFont).not.toContain('Poppins')
})

test('dış kaynaktan görsel veya yazı tipi istenmez', async ({ browser }) => {
    // Uygulama çevrimdışı çalışan bir PWA; landing üçüncü taraf bir servise
    // bağlı olamaz. Şablonun özgün hâli i.postimg.cc ve fonts.googleapis.com
    // adreslerine gidiyordu.
    //
    // ⚠️ Test kendi bağlamını açar. `beforeEach` sayfayı zaten bir kez
    // gezdiriyor; aynı sayfada ikinci `goto` dış kaynakları ÖNBELLEKTEN
    // okuyor ve hiç istek görünmüyordu — yani bu test bir dönem
    // `index.html`'deki Google Fonts <link>'ini sessizce kaçırdı. Taze
    // bağlam boş önbellekle başlar, ölçüm gerçek olur.
    const context = await browser.newContext()
    const page = await context.newPage()

    const external: string[] = []
    page.on('request', (request) => {
        const url = request.url()
        if (!url.startsWith('http://localhost:5173') && !url.startsWith('data:')) {
            external.push(url)
        }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await context.close()

    expect(external).toEqual([])
})
