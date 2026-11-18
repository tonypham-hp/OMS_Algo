import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Role } from '@/types'
import { Sidebar } from './Sidebar'

function render(role: Role, collapsed = false, path = '/trung-tam') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar role={role} collapsed={collapsed} onToggle={() => {}} />
    </MemoryRouter>,
  )
}

/** Thẻ HTML bao quanh một nhãn menu (span đầu tiên chứa nhãn → thẻ cha gần nhất là a hoặc span). */
function itemTag(markup: string, label: string): string {
  const index = markup.indexOf(`>${label}<`)
  if (index < 0) throw new Error(`Không thấy mục ${label}`)
  const before = markup.slice(0, index)
  const open = Math.max(before.lastIndexOf('<a '), before.lastIndexOf('<span aria-disabled'))
  return markup.slice(open, markup.indexOf('>', open) + 1)
}

describe('Sidebar', () => {
  it('khách hàng không thấy khu Vận hành', () => {
    const markup = render('CUSTOMER')
    expect(markup).not.toContain('Vận hành')
    expect(markup).not.toContain('Giám sát hệ thống')
    expect(markup).not.toContain('href="/van-hanh"')
    expect(markup).toContain('href="/dat-lenh"')
  })

  it('vận hành thấy khu Vận hành và hai màn của nó', () => {
    const markup = render('OPS')
    expect(markup).toContain('Vận hành')
    expect(markup).toContain('href="/van-hanh"')
    expect(markup).toContain('href="/cau-hinh"')
  })

  it('Lịch sử và đối soát đã mở khóa ở cả 3 vai trò: là liên kết, không còn nhãn Sắp có', () => {
    for (const role of ['CUSTOMER', 'DEALER', 'OPS'] as const) {
      const markup = render(role)
      expect(markup).toContain('href="/bao-cao/lich-su"')
      expect(itemTag(markup, 'Lịch sử và đối soát')).not.toContain('aria-disabled')
      expect(markup).not.toContain('>Sắp có<')
    }
  })

  it('Mẫu chiến lược đã mở khóa: là liên kết tới /mau-chien-luoc', () => {
    const markup = render('CUSTOMER')
    expect(markup).toContain('href="/mau-chien-luoc"')
    expect(itemTag(markup, 'Mẫu chiến lược')).not.toContain('aria-disabled')
  })

  it('mục đang mở được đánh dấu aria-current', () => {
    expect(itemTag(render('OPS', false, '/so-lenh'), 'Sổ lệnh')).toContain('aria-current="page"')
  })

  it('thu gọn: chỉ còn icon, nhãn chuyển sang sr-only', () => {
    const markup = render('OPS', true)
    expect(markup).toContain('aria-label="Mở rộng thanh bên"')
    expect(markup).not.toContain('ALGO OMS')
    expect(markup).toContain('<span class="sr-only">Đặt lệnh</span>')
  })
})
