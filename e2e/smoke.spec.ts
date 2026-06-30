import { test, expect } from '@playwright/test'
import { screenshot } from './helpers'

/**
 * Baseline UI-render check: the app boots and mounts without a blank/error screen.
 * Doubles as the template for per-task UI verification — copy this, navigate to the
 * screen you changed, screenshot it, and review the image.
 */
test('app boots and renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // The React app mounts into #root — it must not be empty (blank screen / crash).
  await expect(page.locator('#root')).not.toBeEmpty()

  await screenshot(page, 'home')

  // Surface any uncaught runtime errors that would mean a broken render.
  expect(errors, `Uncaught errors:\n${errors.join('\n')}`).toEqual([])
})
