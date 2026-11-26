import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/**
 * Dùng trình duyệt đã cài sẵn trên máy (không tải trình duyệt của Playwright): Chrome trước, Edge sau.
 * Không có cả hai thì dừng ngay với thông báo rõ, không tự tải.
 */
function pickChannel(): 'chrome' | 'msedge' {
  if (process.platform !== 'win32') return 'chrome'
  const roots = [
    process.env.ProgramFiles ?? 'C:/Program Files',
    process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)',
    process.env.LOCALAPPDATA ?? '',
  ].filter(Boolean)
  const has = (...parts: string[]) => roots.some((root) => existsSync(join(root, ...parts)))
  if (has('Google', 'Chrome', 'Application', 'chrome.exe')) return 'chrome'
  if (has('Microsoft', 'Edge', 'Application', 'msedge.exe')) return 'msedge'
  throw new Error('Không tìm thấy Chrome hoặc Edge ở đường dẫn mặc định. Cài một trong hai rồi chạy lại (không tự tải trình duyệt).')
}

const PORT = 5173
// PW_PREVIEW=1: chạy trên bản build production (vite preview, cổng 4173), dùng cho đo hiệu năng (npm run perf:workspace).
const preview = process.env.PW_PREVIEW === '1'
const baseURL = preview ? 'http://localhost:4173' : `http://localhost:${PORT}`
const channel = pickChannel()

export default defineConfig({
  testDir: './e2e',
  // Chạy tuần tự trong từng file, song song giữa các file. Số worker cố định để thời gian chạy ổn định.
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  // Ảnh chụp cho tài liệu chỉ chạy khi gọi riêng (npm run screenshots, screenshots:dot7, screenshots:dot8a, screenshots:dot8b), không nằm trong test:e2e.
  // Đo hiệu năng cũng chỉ chạy khi gọi riêng (npm run perf:workspace, đặt PW_PREVIEW=1).
  testIgnore: process.env.npm_lifecycle_event?.startsWith('screenshots') || preview
    ? ['**/_*.spec.ts']
    : ['**/screenshots*.spec.ts', '**/perf-*.spec.ts', '**/_*.spec.ts'],
  use: {
    baseURL,
    channel,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1440, height: 900 } } },
    { name: 'laptop-1366', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: preview ? 'npx vite preview --port 4173 --strictPort' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
