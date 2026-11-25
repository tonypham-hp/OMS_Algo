import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'
import { injectBootstrap } from './src/theme/bootstrap.ts'

// Script đặt data-theme trước lần vẽ đầu (tải lại không nháy sai theme), chèn nội tuyến vào <head> của index.html.
const themeBootstrap = (): Plugin => ({ name: 'theme-bootstrap', transformIndexHtml: (html) => injectBootstrap(html) })

// https://vite.dev/config/
export default defineConfig({
  plugins: [themeBootstrap(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // zod dùng chung cho form và engine giả lập: để chunk riêng, không bị gộp vào gói chính khi đổi cách chia chunk.
        advancedChunks: { groups: [{ name: 'zod', test: /node_modules[\\/]zod[\\/]/ }] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
