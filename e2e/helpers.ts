import type { Page } from '@playwright/test'

/** Görev formu bir Radix Dialog'dur; seçiciler onun içine daraltılır. */
export const taskDialog = (page: Page) => page.getByRole('dialog')

/** Boş durumdaki buton ile sağ alttaki yüzen buton arasından uygun olanı kullanır. */
export async function openTaskForm(page: Page) {
    const emptyStateButton = page.getByRole('button', { name: 'İlk Görevini Ekle' })
    if (await emptyStateButton.isVisible()) {
        await emptyStateButton.click()
    } else {
        await page.getByTitle('Görev Ekle').click()
    }
    await taskDialog(page).waitFor()
}

/** Formu açar, doldurur ve gönderir. */
export async function addTask(
    page: Page,
    title: string,
    options: { description?: string; dueDate?: string; priority?: 'Düşük' | 'Orta' | 'Yüksek' } = {}
) {
    await openTaskForm(page)
    const dialog = taskDialog(page)

    await dialog.getByLabel('Başlık').fill(title)

    if (options.description) {
        await dialog.getByLabel('Açıklama').fill(options.description)
    }
    if (options.dueDate) {
        await dialog.getByLabel('Son Tarih').fill(options.dueDate)
    }
    if (options.priority) {
        await dialog.getByRole('button', { name: options.priority, exact: true }).click()
    }

    await dialog.getByRole('button', { name: 'Görev Ekle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
}

export const taskHeading = (page: Page, title: string) =>
    page.getByRole('heading', { name: title, exact: true })

export const toggleButton = (page: Page, title: string) =>
    page.getByRole('button', { name: new RegExp(`^"${escapeRegExp(title)}" görevini tamamlan`) })

export const editButton = (page: Page, title: string) =>
    page.getByRole('button', { name: `"${title}" görevini düzenle` })

export const deleteButton = (page: Page, title: string) =>
    page.getByRole('button', { name: `"${title}" görevini sil` })

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
