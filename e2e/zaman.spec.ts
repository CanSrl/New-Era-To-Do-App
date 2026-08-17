import { test, expect, type Page } from '@playwright/test'
import { addTask, editButton, gotoApp, taskDialog } from './helpers'

/**
 * Sayaç arayüzü: görev satırındaki başlat/durdur butonu ve kabuktaki aktif
 * sayaç çubuğu.
 *
 * Local-first çalışır; Supabase yapılandırılmasa da işlevseldir, bu yüzden
 * atlanmaz. Senkron tarafı `zaman-senkron.spec.ts`'te.
 *
 * ⚠️ Süre gerçek saatten türetiliyor ve 1 dakikadan kısa sayaç bilinçli
 * olarak kaydedilmiyor (yanlışlıkla başlatılıp hemen durdurulan sayaç veri
 * değil gürültüdür). Testin bir dakika beklemesi anlamsız olurdu; bunun
 * yerine çalışan sayacın başlangıç damgası geriye alınıyor — kullanıcının
 * iki dakika önce başlattığı sayacın birebir aynısı.
 */

const STORAGE_KEY = 'yapilacaklar-storage'

const timerButton = (page: Page, title: string, running = false) =>
    page.getByRole('button', {
        name: `"${title}" için sayacı ${running ? 'durdur' : 'başlat'}`,
    })

const timerBar = (page: Page) => page.getByRole('status', { name: /çalışan sayaç/i })

type StoredState = {
    timeLogs: { id: string; taskId: string | null; durationMinutes: number; note: string | null }[]
    dirtyTimeLogIds: string[]
    activeTimer: { taskId: string | null; startedAt: string } | null
}

async function readState(page: Page): Promise<StoredState> {
    return page.evaluate((key) => {
        const raw = localStorage.getItem(key)
        const state = JSON.parse(raw as string).state
        return {
            timeLogs: state.timeLogs ?? [],
            dirtyTimeLogIds: state.dirtyTimeLogIds ?? [],
            activeTimer: state.activeTimer ?? null,
        }
    }, STORAGE_KEY)
}

/** Çalışan sayacı geçmişe alır: "kullanıcı bunu N dakika önce başlatmıştı". */
async function backdateTimer(page: Page, minutes: number) {
    await page.evaluate(
        ({ key, minutes }) => {
            const raw = localStorage.getItem(key)
            const parsed = JSON.parse(raw as string)
            parsed.state.activeTimer.startedAt = new Date(Date.now() - minutes * 60_000).toISOString()
            localStorage.setItem(key, JSON.stringify(parsed))
        },
        { key: STORAGE_KEY, minutes }
    )

    await page.reload()
    await page.getByTitle('Görev Ekle').waitFor()
}

async function addClient(page: Page, name: string) {
    await page.goto('/app/clients')
    await page.getByPlaceholder('Yeni müşteri').fill(name)
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByRole('textbox', { name: `${name} müşterisinin adı` })).toBeVisible()
}

/** Görevi düzenleme formundan müşteriye bağlar. */
async function linkTask(page: Page, title: string, client: string) {
    await page.goto('/app')
    await editButton(page, title).click()

    const dialog = taskDialog(page)
    await dialog.getByLabel('Müşteri').selectOption({ label: client })
    await dialog.getByRole('button', { name: 'Güncelle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
}

test.beforeEach(async ({ page }) => {
    await gotoApp(page)
})

test('müşterisiz görevde sayaç başlatılamaz ve sebebi söylenir', async ({ page }) => {
    // `time_logs.client_id` zorunlu: müşterisiz sayaç, durdurulduğunda şemanın
    // kabul etmeyeceği bir kayıt üretirdi.
    await addTask(page, 'Bağsız görev')

    const button = timerButton(page, 'Bağsız görev')
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('title', /müşteriye bağlayın/i)
})

test('sayaç başlatılınca çubuk görünür ve sayfa yenilemesinden sağ çıkar', async ({ page }) => {
    await addTask(page, 'Rapor yaz')
    await addClient(page, 'Acme Ajans')
    await linkTask(page, 'Rapor yaz', 'Acme Ajans')

    await timerButton(page, 'Rapor yaz').click()

    const bar = timerBar(page)
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('Rapor yaz')
    await expect(bar).toContainText('Acme Ajans')

    await page.reload()
    await page.getByTitle('Görev Ekle').waitFor()

    // TIME-01: sayaç LocalStorage'da yaşar (`partialize`'da `activeTimer` var).
    // Yaşamasaydı sekmeyi yenileyen kullanıcı süresini sessizce kaybederdi.
    await expect(timerBar(page)).toBeVisible()
    await expect(timerButton(page, 'Rapor yaz', true)).toBeVisible()
})

test('sayacı durdurmak kaydı üretir ve göndermeyi bekleyenlere alır', async ({ page }) => {
    await addTask(page, 'Rapor yaz')
    await addClient(page, 'Acme Ajans')
    await linkTask(page, 'Rapor yaz', 'Acme Ajans')

    await timerButton(page, 'Rapor yaz').click()
    await backdateTimer(page, 2)

    // Süre `startedAt` damgasından türetilir: yenilemeden sonra bile geçen
    // gerçek süreyi gösterir, sıfırdan saymaya başlamaz.
    const bar = timerBar(page)
    await expect(bar).toContainText(/0:02:\d\d/)

    // Ve gerçekten akıyor: interval yalnızca yeniden okuma tetikleyicisi.
    const firstReading = await bar.innerText()
    await page.waitForTimeout(1500)
    expect(await bar.innerText()).not.toBe(firstReading)

    await timerButton(page, 'Rapor yaz', true).click()

    await expect(timerBar(page)).toBeHidden()

    const state = await readState(page)
    expect(state.timeLogs).toHaveLength(1)
    expect(state.timeLogs[0].durationMinutes).toBe(2)
    expect(state.activeTimer).toBeNull()
    // Kayıt gönderilmeyi beklemeli; beklemezse senkron hiç tetiklenmez.
    expect(state.dirtyTimeLogIds).toEqual([state.timeLogs[0].id])
})

test('bir dakikadan kısa sayaç kayıt üretmez', async ({ page }) => {
    // Yanlışlıkla başlatılıp hemen durdurulan sayaç veri değil gürültüdür;
    // veritabanı kısıtı da (`duration_minutes > 0`) sıfır dakikayı reddeder.
    await addTask(page, 'Rapor yaz')
    await addClient(page, 'Acme Ajans')
    await linkTask(page, 'Rapor yaz', 'Acme Ajans')

    await timerButton(page, 'Rapor yaz').click()
    await timerButton(page, 'Rapor yaz', true).click()

    const state = await readState(page)
    expect(state.timeLogs).toEqual([])
    expect(state.activeTimer).toBeNull()
})

test('ikinci sayacı başlatmak birincisini durdurup kaydeder', async ({ page }) => {
    // Tek sayaç kuralı store'da uygulanır, arayüzde değil: iki sayacın aynı
    // anda dönmesi, aynı saati iki müşteriye birden faturalamak demekti.
    await addTask(page, 'Rapor yaz')
    await addTask(page, 'Sunum hazırla')
    await addClient(page, 'Acme Ajans')
    await linkTask(page, 'Rapor yaz', 'Acme Ajans')
    await linkTask(page, 'Sunum hazırla', 'Acme Ajans')

    await timerButton(page, 'Rapor yaz').click()
    await backdateTimer(page, 3)

    await timerButton(page, 'Sunum hazırla').click()

    const state = await readState(page)
    expect(state.timeLogs).toHaveLength(1)
    expect(state.timeLogs[0].durationMinutes).toBe(3)

    // Çubuk artık ikinci görevi gösterir; birincisinin butonu "başlat"a döner.
    await expect(timerBar(page)).toContainText('Sunum hazırla')
    await expect(timerButton(page, 'Sunum hazırla', true)).toBeVisible()
    await expect(timerButton(page, 'Rapor yaz')).toBeVisible()
})

test('atma butonu sayacı kayıt üretmeden kapatır', async ({ page }) => {
    await addTask(page, 'Rapor yaz')
    await addClient(page, 'Acme Ajans')
    await linkTask(page, 'Rapor yaz', 'Acme Ajans')

    await timerButton(page, 'Rapor yaz').click()
    await backdateTimer(page, 5)

    // Durdurmak 5 dakikayı kaydederdi; atmak kaydetmez. İkisi geri alınamaz
    // biçimde farklı olduğu için ayrı butonlar.
    await page.getByRole('button', { name: 'Sayacı kaydetmeden at' }).click()

    await expect(timerBar(page)).toBeHidden()

    const state = await readState(page)
    expect(state.timeLogs).toEqual([])
    expect(state.activeTimer).toBeNull()
})
