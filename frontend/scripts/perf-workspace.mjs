// Đo hiệu năng Bàn làm việc trên bản build production (Đợt 10A): build rồi chạy e2e/perf-workspace.spec.ts với
// PW_PREVIEW=1 (Playwright tự bật `vite preview` ở cổng 4173). Kết quả: test-results/.../perf-workspace.json.
import { spawnSync } from 'node:child_process'

const run = (command, env = {}) => {
  const result = spawnSync(command, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npm run build')
run('npx playwright test e2e/perf-workspace.spec.ts --project=desktop-1440', { PW_PREVIEW: '1' })
