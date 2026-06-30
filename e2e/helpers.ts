import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

/** Where reviewed screenshots are written. */
export const SCREENSHOT_DIR = path.resolve('e2e/screenshots')

/**
 * Capture a full-page screenshot into `e2e/screenshots/<name>.png` and return its path.
 * Use this in UI verification specs so the agent (or you) can open and review the render.
 */
export async function screenshot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const file = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}
