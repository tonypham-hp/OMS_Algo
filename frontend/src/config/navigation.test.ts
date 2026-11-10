import { describe, expect, it } from 'vitest'
import { getBreadcrumb } from '@/utils/breadcrumb'
import { getAccessibleLabels, getNavSections } from './navigation'

const titles = (role: Parameters<typeof getNavSections>[0]) => getNavSections(role).map((section) => section.title)

describe('getNavSections', () => {
  it('khách hàng và dealer không thấy khu Vận hành', () => {
    expect(titles('CUSTOMER')).toEqual([null, 'Giao dịch', 'Báo cáo'])
    expect(titles('DEALER')).toEqual([null, 'Giao dịch', 'Báo cáo'])
  })

  it('vận hành thấy khu Vận hành với Giám sát hệ thống và Cấu hình chiến lược', () => {
    const ops = getNavSections('OPS').find((section) => section.title === 'Vận hành')
    expect(ops?.items.map((item) => [item.label, item.path])).toEqual([
      ['Giám sát hệ thống', '/van-hanh'],
      ['Cấu hình chiến lược', '/cau-hinh'],
    ])
  })

  it('mục Sắp có không có đường dẫn', () => {
    const comingSoon = getNavSections('OPS').flatMap((section) => section.items.filter((item) => item.comingSoon))
    expect(comingSoon.map((item) => item.label)).toEqual(['Mẫu chiến lược', 'Hiệu quả thực hiện', 'Lịch sử và đối soát'])
    expect(comingSoon.every((item) => item.path === undefined)).toBe(true)
  })

  it('thẻ đăng nhập ghi các màn mở được, không tính mục Sắp có', () => {
    expect(getAccessibleLabels('CUSTOMER')).toEqual(['Trung tâm lệnh', 'Đặt lệnh', 'Sổ lệnh'])
    expect(getAccessibleLabels('OPS')).toContain('Cấu hình chiến lược')
  })
})

describe('getBreadcrumb', () => {
  it('nhóm › màn hình › mã lệnh', () => {
    expect(getBreadcrumb('/so-lenh/PO-0001')).toEqual([
      { label: 'Giao dịch', path: null },
      { label: 'Sổ lệnh', path: '/so-lenh' },
      { label: 'PO-0001', path: null },
    ])
    expect(getBreadcrumb('/trung-tam')).toEqual([{ label: 'Trung tâm lệnh', path: null }])
    expect(getBreadcrumb('/khong-co')).toEqual([{ label: 'Không tìm thấy trang', path: null }])
  })
})
