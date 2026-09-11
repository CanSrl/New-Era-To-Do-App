import { chromium } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const out = path.resolve('docs/images')
fs.mkdirSync(out, { recursive: true })

const origin = process.argv[2] ?? 'http://localhost:5173'
const nicheOffOrigin = process.argv[3] ?? null

const browser = await chromium.launch()
const context = await browser.newContext({
  locale: 'en-US',
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
})
const page = await context.newPage()

async function shot(name, url) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(out, name), fullPage: false })
}

await shot('landing.png', `${origin}/`)

// Demo rows in the device store so screenshots are not empty-state.
await page.addInitScript(() => {
  const now = new Date().toISOString()
  const state = {
    tasks: [
      {
        id: 't1',
        title: 'Deliver homepage draft',
        description: 'First pass of the marketing homepage.',
        dueDate: '2026-09-15',
        priority: 'high',
        completed: false,
        categoryId: null,
        clientId: 'c1',
        projectId: 'p1',
        createdAt: now,
        updatedAt: now,
        position: 0,
      },
      {
        id: 't2',
        title: 'Review brand guide',
        priority: 'medium',
        completed: false,
        categoryId: null,
        clientId: 'c1',
        projectId: 'p2',
        createdAt: now,
        updatedAt: now,
        position: 1,
      },
      {
        id: 't3',
        title: 'Send invoice',
        priority: 'high',
        completed: true,
        completedAt: now,
        categoryId: null,
        clientId: 'c1',
        projectId: 'p1',
        createdAt: now,
        updatedAt: now,
        position: 2,
      },
    ],
    categories: [],
    clients: [
      {
        id: 'c1',
        name: 'Acme Agency',
        archived: false,
        position: 0,
        hourlyRate: 1500,
        currency: 'TRY',
        createdAt: now,
        updatedAt: now,
      },
    ],
    projects: [
      {
        id: 'p1',
        name: 'Website',
        clientId: 'c1',
        archived: false,
        position: 0,
        hourlyRate: null,
        currency: 'TRY',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'p2',
        name: 'Brand',
        clientId: 'c1',
        archived: false,
        position: 1,
        hourlyRate: 0,
        currency: 'TRY',
        createdAt: now,
        updatedAt: now,
      },
    ],
    timeLogs: [
      {
        id: 'l1',
        taskId: 't1',
        clientId: 'c1',
        projectId: 'p1',
        startedAt: '2026-09-10T09:00:00.000Z',
        durationMinutes: 90,
        note: 'Wireframes',
        createdAt: now,
        updatedAt: now,
      },
    ],
    activeTimer: null,
    filter: 'all',
    dirtyIds: [],
    tombstones: [],
    dirtyCategoryIds: [],
    categoryTombstones: [],
    dirtyClientIds: [],
    clientTombstones: [],
    dirtyProjectIds: [],
    projectTombstones: [],
    dirtyTimeLogIds: [],
    timeLogTombstones: [],
    lastSyncedAt: null,
    ownerId: null,
    subscription: null,
    blockedClientIds: [],
  }
  localStorage.setItem('yapilacaklar-storage', JSON.stringify({ state, version: 7 }))
  localStorage.setItem('yapilacaklar-language', 'en')
})

await shot('app-tasks.png', `${origin}/app`)
await shot('app-clients.png', `${origin}/app/clients`)

if (nicheOffOrigin) {
  const off = await context.newPage()
  await off.addInitScript(() => {
    localStorage.setItem('yapilacaklar-language', 'en')
  })
  // Same tasks as the on-build shots, without client fields mattering:
  // the off build still hydrates the store; nav is what must differ.
  await off.goto(`${nicheOffOrigin}/app`, { waitUntil: 'networkidle' })
  await off.waitForTimeout(500)
  await off.screenshot({ path: path.join(out, 'app-niche-off.png') })
  await off.close()
}

await browser.close()
