import type { StrategyFieldName } from '@/config/strategies'
import type { Role, Side, StrategyType } from '@/types'

/**
 * Giá trị tham số của mẫu. Giá không ghi cứng mà tính theo thị trường lúc chọn mẫu, để luôn đúng bước giá và trong biên độ:
 * - số hoặc chuỗi: dùng nguyên giá trị;
 * - { price, ticks }: lấy giá `price` (khớp gần nhất, mua 1, bán 1) dịch `ticks` bước giá;
 * - { money: ticks }: khoảng tiền bằng `ticks` bước giá của giá tham chiếu (khoảng trượt Trailing Stop);
 * - { time: 'now', addMinutes } hoặc { time: 'HH:mm' }: giờ tính từ đồng hồ giả lập hoặc giờ cố định.
 */
export type TemplateValue =
  | number
  | string
  | { price: 'last' | 'bid' | 'ask'; ticks: number }
  | { money: number }
  | { time: 'now'; addMinutes: number }

export interface StrategyTemplate {
  id: string
  name: string
  /** Một câu, nói rõ mẫu dùng để làm gì. */
  description: string
  strategy_type: StrategyType
  side?: Side
  /** KL gợi ý (bội số 100). */
  total_qty?: number
  /** Tham số mặc định, theo tên ô của loại lệnh trong config/strategies.ts. */
  params: Partial<Record<StrategyFieldName, TemplateValue>>
  /** Phù hợp khi… (hiện trên trang Mẫu chiến lược). */
  suitableWhen: string
  /** Vai trò được thấy mẫu. Không khai báo là mọi vai trò. */
  roles?: Role[]
  /** Lưu ý khi dùng. */
  hint?: string
}

const PROFESSIONAL: Role[] = ['DEALER', 'OPS']

// Mẫu là dữ liệu: thêm, sửa mẫu chỉ cần sửa bảng này. Form vẫn kiểm tra đủ luật HOSE sau khi điền.
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'iceberg-quiet',
    name: 'Mua âm thầm',
    description: 'Mua khối lượng lớn nhưng mỗi lần chỉ hiện 2.000 CP trên sổ lệnh, để không làm giá chạy.',
    strategy_type: 'ICEBERG',
    side: 'BUY',
    total_qty: 20_000,
    params: { slice_qty: 2_000, limit_price: { price: 'last', ticks: 0 } },
    suitableWhen: 'Cần gom hàng ở một mức giá, không muốn thị trường thấy hết khối lượng.',
    hint: 'Giá giới hạn mặc định bằng giá khớp gần nhất; nâng giá nếu muốn khớp nhanh hơn.',
  },
  {
    id: 'twap-2h',
    name: 'Bán êm trong 2 giờ',
    description: 'Chia đều lệnh bán trong 2 giờ tới, mỗi 10 phút một phần, để không đè giá.',
    strategy_type: 'TWAP',
    side: 'SELL',
    total_qty: 30_000,
    params: {
      start_time: { time: 'now', addMinutes: 1 },
      end_time: { time: 'now', addMinutes: 121 },
      interval_min: 10,
      limit_price: { price: 'last', ticks: -2 },
    },
    suitableWhen: 'Cần bán một lượng lớn trong buổi, không vội, ưu tiên giá ổn định.',
    hint: 'Giờ tự kẹp trong giờ giao dịch; giá giới hạn là giá thấp nhất chấp nhận bán.',
  },
  {
    id: 'pov-10',
    name: 'Theo nhịp thị trường',
    description: 'Mua theo 10% khối lượng khớp của thị trường, nhanh khi thị trường sôi động, chậm khi trầm lắng.',
    strategy_type: 'POV',
    side: 'BUY',
    total_qty: 20_000,
    params: { participation_pct: 10, max_pct: 15, limit_price: { price: 'last', ticks: 2 } },
    suitableWhen: 'Muốn khớp hòa vào thanh khoản, không để lệnh của mình chiếm phần lớn giao dịch.',
    roles: PROFESSIONAL,
    hint: 'Tỷ lệ không được vượt trần POV của hệ thống.',
  },
  {
    id: 'vwap-day',
    name: 'Bám VWAP cả phiên',
    description: 'Chia lệnh mua theo phân bố thanh khoản trong ngày để giá bình quân sát VWAP của phiên.',
    strategy_type: 'VWAP',
    side: 'BUY',
    total_qty: 50_000,
    params: { start_time: '09:15', end_time: '14:30', limit_price: { price: 'last', ticks: 3 } },
    suitableWhen: 'Lệnh lớn cần đánh giá theo VWAP của phiên (báo cáo hiệu quả thực hiện).',
    roles: PROFESSIONAL,
  },
  {
    id: 'hunt-liquidity',
    name: 'Mua nhanh khi có thanh khoản',
    description: 'Khi giá về mức săn, quét tối đa 3 mức giá bán không vượt giá tối đa; phần còn lại đặt chờ.',
    strategy_type: 'HUNT',
    side: 'BUY',
    total_qty: 10_000,
    params: {
      hunt_price: { price: 'last', ticks: 0 },
      max_wait_min: 30,
      limit_price: { price: 'ask', ticks: 2 },
      max_levels: 3,
      remainder_passive: 1,
    },
    suitableWhen: 'Có sẵn giá mục tiêu và muốn lấy ngay thanh khoản đang chờ bán khi giá về.',
    roles: PROFESSIONAL,
    hint: 'Giá tối đa chặn mọi mức quét; mức nào vượt giá tối đa sẽ không bị quét.',
  },
  {
    id: 'stop-loss-trailing',
    name: 'Cắt lỗ tự động',
    description: 'Bán khi giá giảm 3 bước giá từ đỉnh gần nhất, tự bám theo khi giá tăng (Trailing Stop).',
    strategy_type: 'TRAILING_STOP',
    side: 'SELL',
    total_qty: 10_000,
    params: { trailing_value: { money: 3 } },
    suitableWhen: 'Đang nắm giữ cổ phiếu và muốn giữ lãi, tự cắt khi giá đảo chiều.',
    hint: 'Kích hoạt sẽ gửi lệnh thị trường (MTL), chỉ khớp trong phiên liên tục.',
  },
]

export function getTemplate(id: string | null | undefined): StrategyTemplate | undefined {
  return id ? STRATEGY_TEMPLATES.find((template) => template.id === id) : undefined
}
