import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Bật API giả trước khi dựng giao diện để các lời gọi đầu tiên không bị lọt ra ngoài.
 * Chỉ tắt khi khai báo rõ false, vì .env không được commit nên máy mới clone về vẫn cần chạy được mock.
 */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK === 'false') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

enableMocking().catch(console.error).finally(render)
