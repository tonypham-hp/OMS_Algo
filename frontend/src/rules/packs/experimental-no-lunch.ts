import type { RulePack } from '../types'
import { STO_KRX_2025 } from './sto-krx-2025'

/**
 * Pack THỬ NGHIỆM, không phải luật thật: HOSE bỏ nghỉ trưa, khớp liên tục 09:15–14:30.
 * Chỉ dùng để chứng minh đổi lịch phiên chỉ cần nạp pack, không sửa code (trang /cau-hinh/luat).
 */
export const STO_EXPERIMENTAL_NO_LUNCH: RulePack = {
  ...STO_KRX_2025,
  id: 'sto-experimental-no-lunch',
  title: 'Thử nghiệm: HOSE bỏ nghỉ trưa',
  experimental: true,
  sessions: [
    { code: 'ATO', start: '09:00', end: '09:15' },
    { code: 'CONTINUOUS', start: '09:15', end: '14:30' },
    { code: 'ATC', start: '14:30', end: '14:45' },
    { code: 'PUT_THROUGH', start: '14:45', end: '15:00' },
  ],
  verified: false,
  sourceNote: 'Cấu hình thử nghiệm nội bộ của bản mô phỏng.',
}
