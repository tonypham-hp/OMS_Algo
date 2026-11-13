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
    expect(comingSoon.map((item) => item.label)).toEqual(['Lịch sử và đối soát'])
    expect(comingSoon.every((item) => item.path === undefined)).toBe(true)
  })

  it('Mẫu chiến lược đã mở: có đường dẫn /mau-chien-luoc, cần quyền đặt lệnh', () => {
    const item = getNavSections('CUSTOMER').flatMap((section) => section.items).find((entry) => entry.label === 'Mẫu chiến lược')
    expect(item?.path).toBe('/mau-chien-luoc')
    expect(item?.permission).toBe('place_order')
    expect(item?.comingSoon).toBeUndefined()
  })

  it('thẻ đăng nhập ghi các màn mở được, không tính mục Sắp có', () => {
    expect(getAccessibleLabels('CUSTOMER')).toEqual(['Trung tâm lệnh', 'Đặt lệnh', 'Sổ lệnh', 'Mẫu chiến lược', 'Hiệu quả thực hiện'])
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

  it('đường dẫn hai cấp của báo cáo', () => {
    expect(getBreadcrumb('/bao-cao/hieu-qua')).toEqual([
      { label: 'Báo cáo', path: null },
      { label: 'Hiệu quả thực hiện', path: null },
    ])
    expect(getBreadcrumb('/403')).toEqual([{ label: 'Không có quyền', path: null }])
  })
})

describe('mục Hiệu quả thực hiện', () => {
  it('đã mở cho mọi vai trò, trỏ tới /bao-cao/hieu-qua', () => {
    for (const role of ['CUSTOMER', 'DEALER', 'OPS'] as const) {
      const item = getNavSections(role)
        .flatMap((section) => section.items)
        .find((entry) => entry.label === 'Hiệu quả thực hiện')
      expect(item).toMatchObject({ path: '/bao-cao/hieu-qua' })
      expect(item?.comingSoon).toBeFalsy()
    }
  })
})
