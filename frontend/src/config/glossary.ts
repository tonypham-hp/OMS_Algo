import { formatBps, formatNumber } from '@/lib/format'
import type { StrategyType } from '@/types'
import type { ReportSortKey } from '@/utils/execQuality'
import { getCeilingPrice, getFloorPrice, getTickSize } from '@/utils/hose'
import { describeTickTable } from '@/rules/describe'
import { defaultRules } from '@/rules/registry'
import { MAX_ORDER_QTY, PRICE_BAND_PCT, QTY_LOT_SIZE } from './hose'
import type { StrategyFieldName } from './strategies'

/** Số của lệnh đang xem, để ví dụ trong tooltip dùng đúng số thật. Trường nào không có thì ví dụ bị bỏ. */
export interface GlossaryContext {
  symbol?: string
  side?: 'BUY' | 'SELL'
  ref_price?: number | null
  limit_price?: number | null
  total_qty?: number
  executed_qty?: number
  avg_price?: number | null
  arrival_price?: number | null
  vwap?: number | null
  arrival_bps?: number | null
  market_volume?: number | null
}

export interface GlossaryEntry {
  id: string
  term: string
  /** Một câu. */
  short: string
  detail: string
  formula?: string
  /** Ví dụ bằng số của lệnh đang xem; null khi thiếu số. */
  example?: (ctx: GlossaryContext) => string | null
}

const n = formatNumber
const has = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'arrival',
    term: 'Giá arrival',
    short: 'Giá khớp gần nhất của mã ngay lúc lệnh được đặt, dùng làm mốc so hiệu quả.',
    detail: 'OMS chụp lại giá khớp, giá mua và bán tốt nhất ở thời điểm nhận lệnh. Mọi so sánh "tốt hơn, kém hơn arrival" đều dùng giá này.',
    formula: 'Chênh lệch so arrival = (Giá bình quân − Giá arrival) / Giá arrival',
    example: (ctx) => (has(ctx.arrival_price) && ctx.symbol ? `Lệnh này: arrival ${ctx.symbol} là ${n(ctx.arrival_price)}.` : null),
  },
  {
    id: 'vwap',
    term: 'VWAP',
    short: 'Giá bình quân gia quyền theo khối lượng: trung bình giá khớp, mã nào khớp nhiều thì nặng hơn.',
    detail: 'Có hai nghĩa: chiến lược VWAP chia lệnh theo phân bổ khối lượng trong khung giờ; chỉ số VWAP thị trường dùng để so hiệu quả với cả thị trường trong cùng khoảng thời gian.',
    formula: 'VWAP = Σ(giá × KL) / Σ KL',
    example: (ctx) => (has(ctx.vwap) && ctx.symbol ? `VWAP thị trường của ${ctx.symbol} trong khoảng lệnh chạy: ${n(ctx.vwap)}.` : null),
  },
  {
    id: 'twap',
    term: 'TWAP',
    short: 'Chia lệnh đều theo thời gian trong một khung giờ.',
    detail: 'Mỗi chu kỳ (ví dụ mỗi 5 phút) đặt một phần bằng nhau, làm tròn theo lô. Phần lẻ dồn cho chu kỳ cuối.',
    formula: 'KL mỗi chu kỳ ≈ KL tổng / số chu kỳ, làm tròn theo lô',
  },
  {
    id: 'pov',
    term: 'POV',
    short: 'Tham gia theo tỷ lệ khối lượng của thị trường.',
    detail: 'Sau mỗi nhịp, lệnh đặt thêm đúng phần % mục tiêu của KL thị trường vừa khớp, không vượt % tối đa để tránh đẩy giá.',
    formula: 'KL đặt = min(KL thị trường mới × % mục tiêu, KL thị trường mới × % tối đa, KL còn lại)',
  },
  {
    id: 'iceberg',
    term: 'Iceberg',
    short: 'Chỉ hiện một phần nhỏ của lệnh lớn trên sổ lệnh.',
    detail: 'Lệnh lớn được chia thành từng phần (slice). Phần trước khớp xong mới đặt phần sau, nên thị trường chỉ thấy phần đang treo.',
  },
  {
    id: 'hunt',
    term: 'HUNT',
    short: 'Chờ giá về mức săn rồi quét các mức tốt trên sổ lệnh.',
    detail: 'Khi giá chạm giá săn, lệnh quét lần lượt tối đa vài mức phía đối ứng, chỉ những mức không vượt giá giới hạn. Phần còn lại chờ ở giá tốt nhất hoặc hủy, theo cài đặt.',
  },
  {
    id: 'stop',
    term: 'Stop',
    short: 'Giá chạm mức kích hoạt thì gửi lệnh thị trường (MTL).',
    detail: 'Lệnh bán Stop kích hoạt khi giá giảm tới mức kích hoạt; lệnh mua Stop kích hoạt khi giá tăng tới mức kích hoạt. Chỉ xét trong phiên khớp lệnh liên tục.',
  },
  {
    id: 'stop-limit',
    term: 'Stop Limit',
    short: 'Giống Stop nhưng gửi lệnh giới hạn (LO) thay vì lệnh thị trường.',
    detail: 'Kiểm soát được giá tệ nhất chấp nhận, đổi lại có thể không khớp nếu giá chạy qua giá giới hạn.',
  },
  {
    id: 'take-profit',
    term: 'Take Profit',
    short: 'Giá đạt mức chốt lời thì gửi lệnh giới hạn.',
    detail: 'Lệnh bán chốt lời kích hoạt khi giá tăng tới mức chốt lời; lệnh mua kích hoạt khi giá giảm tới mức đó.',
  },
  {
    id: 'trailing-stop',
    term: 'Trailing Stop',
    short: 'Giá kích hoạt bám theo thị trường với một khoảng cách cố định.',
    detail: 'Với lệnh bán, giá kích hoạt = đỉnh cao nhất từ lúc đặt − khoảng trượt; đỉnh tăng thì giá kích hoạt tăng theo, giá giảm thì giữ nguyên.',
    formula: 'Bán: kích hoạt = đỉnh − khoảng trượt. Mua: kích hoạt = đáy + khoảng trượt',
  },
  {
    id: 'oco',
    term: 'OCO',
    short: 'Một lệnh kích hoạt thì lệnh kia tự hủy (One Cancels the Other).',
    detail: 'Cặp chốt lời và cắt lỗ cho cùng một vị thế. Bên nào chạm giá trước sẽ chạy, bên còn lại bị hủy.',
  },
  {
    id: 'bracket',
    term: 'Bracket',
    short: 'Lệnh vào kèm sẵn cặp chốt lời và cắt lỗ.',
    detail: 'Lệnh vào khớp đủ thì OMS theo dõi cặp TP/SL theo chiều ngược lại, như một lệnh OCO.',
  },
  {
    id: 'slippage',
    term: 'Slippage (trượt giá)',
    short: 'Chênh lệch giữa giá khớp thực tế và giá mốc (thường là arrival).',
    detail: 'Mua cao hơn hoặc bán thấp hơn giá mốc là trượt giá bất lợi. OMS hiển thị trượt giá theo bps, đã đổi dấu để số dương luôn là tốt.',
    formula: 'Slippage (bps) = (Giá bình quân − Giá mốc) / Giá mốc × 10.000, đổi dấu với lệnh mua',
    example: (ctx) => (has(ctx.arrival_bps) ? `Lệnh này so arrival: ${formatBps(ctx.arrival_bps)}.` : null),
  },
  {
    id: 'participation',
    term: 'Tỷ lệ tham gia',
    short: 'Phần KL lệnh của mình chiếm trong KL khớp toàn thị trường cùng thời gian.',
    detail: 'Tỷ lệ cao nghĩa là lệnh chiếm nhiều thanh khoản, dễ tác động giá. POV giữ tỷ lệ này quanh mức mục tiêu.',
    formula: 'Tỷ lệ tham gia = KL khớp của lệnh / KL khớp toàn thị trường',
    example: (ctx) =>
      has(ctx.executed_qty) && has(ctx.market_volume) && ctx.market_volume > 0
        ? `Lệnh này: ${n(ctx.executed_qty)} / ${n(ctx.market_volume)} CP.`
        : null,
  },
  {
    id: 'bps',
    term: 'bps (điểm cơ bản)',
    short: 'Một phần vạn: 1 bps = 0,01%.',
    detail: 'Đơn vị nhỏ để so chênh lệch giá. Ví dụ chênh 0,25% là 25 bps.',
    formula: 'bps = tỷ lệ × 10.000',
  },
  {
    id: 'parent-order',
    term: 'Lệnh cha',
    short: 'Lệnh thuật toán người dùng đặt, có tổng KL và chiến lược.',
    detail: 'OMS giữ lệnh cha và tự sinh các lệnh con gửi ra sàn. KL khớp của lệnh cha là tổng KL khớp của các lệnh con.',
    example: (ctx) => (has(ctx.total_qty) && has(ctx.executed_qty) ? `Lệnh này đã khớp ${n(ctx.executed_qty)}/${n(ctx.total_qty)} CP.` : null),
  },
  {
    id: 'child-order',
    term: 'Lệnh con',
    short: 'Lệnh thật gửi ra sàn, do lệnh cha sinh ra theo chiến lược.',
    detail: 'Mỗi lệnh con có chu kỳ, loại (LO, MTL, ATO, ATC), giá và KL riêng. OMS không cho tổng KL lệnh con vượt phần còn lại của lệnh cha.',
  },
  {
    id: 'unknown',
    term: 'UNKNOWN',
    short: 'Lệnh con đã gửi nhưng mất xác nhận từ Core, chưa biết Core có giữ lệnh hay không.',
    detail: 'OMS vẫn tính phần này là đang chờ khớp và không gửi lại, để không đặt trùng. Sau khi đối soát, lệnh con về trạng thái thật.',
  },
  {
    id: 'reconciliation',
    term: 'Đối soát',
    short: 'So sổ lệnh của OMS với sổ phía Core theo từng lệnh con: trạng thái, KL khớp; tra lại Core khi lệnh con UNKNOWN.',
    detail:
      'Với lệnh con UNKNOWN: Core đã nhận thì giữ nguyên lệnh con; Core chưa nhận thì hủy để giải phóng KL và sinh lại. Màn Lịch sử và đối soát liệt kê mọi chỗ OMS và Core ghi khác nhau, mỗi dòng một loại chênh lệch.',
  },
  {
    id: 'status-mismatch',
    term: 'STATUS_MISMATCH',
    short: 'Trạng thái lệnh con ở OMS khác trạng thái Core ghi nhận.',
    detail: 'Ví dụ OMS ghi hết hạn nhưng Core ghi đã hủy, hoặc OMS đang chờ khớp mà Core không có lệnh. Cần kiểm tra với Core rồi đánh dấu đã xử lý.',
  },
  {
    id: 'qty-mismatch',
    term: 'QTY_MISMATCH',
    short: 'KL khớp của lệnh con ở OMS khác KL khớp Core ghi nhận.',
    detail: 'Thường do một báo khớp chưa về OMS. Đối chiếu từng lần khớp (exchange_match_id) với Core.',
    formula: 'Chênh lệch = filled_qty (Core) − filled_qty (OMS)',
  },
  {
    id: 'dup-fill-ignored',
    term: 'DUP_FILL_IGNORED',
    short: 'Sàn gửi lại một báo khớp đã nhận (trùng exchange_match_id); OMS bỏ qua, KL không đổi.',
    detail: 'OMS nhận mỗi mã khớp đúng một lần, nên báo khớp trùng không làm tăng KL. Dòng này chỉ để kiểm toán, hệ thống đã tự xử lý.',
  },
  {
    id: 'parent-sum-mismatch',
    term: 'PARENT_SUM_MISMATCH',
    short: 'KL đã khớp ghi trên lệnh cha khác tổng các lần khớp (Execution) của lệnh đó.',
    detail: 'Lệnh cha phải luôn bằng tổng Execution của lệnh vào. Lệch nghĩa là thiếu hoặc thừa một bản ghi khớp.',
    formula: 'executed_qty = Σ qty của Execution (lệnh vào)',
  },
  {
    id: 'overfill',
    term: 'OVERFILL',
    short: 'Tổng KL khớp vượt KL đặt của lệnh cha. Lỗi nghiêm trọng, phải luôn bằng 0.',
    detail: 'OMS chặn trần mọi lệnh con và cắt KL khớp vượt phần còn lại, nên OVERFILL chỉ xuất hiện khi có lỗi hệ thống. Có dòng này phải báo ngay.',
    formula: 'Σ KL khớp ≤ total_qty',
  },
  {
    id: 'audit-log',
    term: 'Nhật ký kiểm toán',
    short: 'Danh sách mọi sự kiện của lệnh (OrderEvent): ai làm gì, lúc nào, giá trị cũ và mới, lý do.',
    detail: 'Chỉ đọc. Mỗi lần đổi trạng thái lệnh cha, lệnh con, mỗi lần khớp và mỗi quyết định của hệ thống đều có một dòng. Khách hàng chỉ thấy lệnh của mình.',
  },
  {
    id: 'ato',
    term: 'ATO',
    short: 'Phiên khớp lệnh định kỳ mở cửa.',
    detail: 'Lệnh được gom lại và khớp một lần lúc hết phiên ở một mức giá. Trong ATO không được sửa, hủy lệnh và không dùng lệnh MTL.',
  },
  {
    id: 'atc',
    term: 'ATC',
    short: 'Phiên khớp lệnh định kỳ đóng cửa.',
    detail: 'Giống ATO nhưng ở cuối ngày. Lệnh MTL còn treo bị hủy khi vào ATC; không được sửa, hủy lệnh trong phiên.',
  },
  {
    id: 'mtl',
    term: 'MTL',
    short: 'Lệnh thị trường chuyển thành lệnh giới hạn: khớp ngay ở giá tốt nhất, phần còn lại thành LO.',
    detail: 'Chỉ dùng được trong phiên khớp lệnh liên tục. Stop và nhánh cắt lỗ dùng MTL để thoát nhanh.',
  },
  {
    id: 'lo',
    term: 'LO',
    short: 'Lệnh giới hạn: chỉ khớp ở giá đặt hoặc tốt hơn.',
    detail: 'Mua không cao hơn giá đặt, bán không thấp hơn giá đặt. Phần chưa khớp nằm chờ trên sổ lệnh.',
  },
  {
    id: 'ceiling',
    term: 'Giá trần',
    short: `Giá cao nhất được đặt trong ngày: tham chiếu +${PRICE_BAND_PCT}%, làm tròn xuống theo bước giá.`,
    detail: 'Lệnh có giá vượt trần bị từ chối. Lệnh nhiều phiên có giá vượt trần mới của ngày sau sẽ bị hệ thống tạm dừng để sửa giá.',
    formula: `Trần = làm tròn xuống(Tham chiếu × (100 + ${PRICE_BAND_PCT})%, bước giá)`,
    example: (ctx) =>
      has(ctx.ref_price) && ctx.symbol ? `${ctx.symbol} hôm nay: tham chiếu ${n(ctx.ref_price)} → trần ${n(getCeilingPrice(ctx.ref_price))}.` : null,
  },
  {
    id: 'floor',
    term: 'Giá sàn',
    short: `Giá thấp nhất được đặt trong ngày: tham chiếu −${PRICE_BAND_PCT}%, làm tròn lên theo bước giá.`,
    detail: 'Lệnh có giá dưới sàn bị từ chối.',
    formula: `Sàn = làm tròn lên(Tham chiếu × (100 − ${PRICE_BAND_PCT})%, bước giá)`,
    example: (ctx) =>
      has(ctx.ref_price) && ctx.symbol ? `${ctx.symbol} hôm nay: tham chiếu ${n(ctx.ref_price)} → sàn ${n(getFloorPrice(ctx.ref_price))}.` : null,
  },
  {
    id: 'ref-price',
    term: 'Giá tham chiếu',
    short: 'Giá làm mốc tính trần, sàn của ngày, thường là giá đóng cửa phiên trước.',
    detail: 'Hiển thị màu vàng trên bảng giá. Đổi theo từng ngày giao dịch.',
    example: (ctx) => (has(ctx.ref_price) && ctx.symbol ? `${ctx.symbol} hôm nay: ${n(ctx.ref_price)}.` : null),
  },
  {
    id: 'tick-size',
    term: 'Bước giá',
    short: 'Đơn vị nhỏ nhất giá được thay đổi, tùy mức giá.',
    detail: `Cổ phiếu HOSE: ${describeTickTable(defaultRules().tickTable.STOCK)}. ETF, chứng quyền: ${describeTickTable(defaultRules().tickTable.ETF)}. HNX, UPCoM: bước 100 đ.`,
    formula: 'Giá hợp lệ khi giá chia hết cho bước giá của mức đó',
    example: (ctx) => (has(ctx.limit_price) ? `Giá ${n(ctx.limit_price)} có bước giá ${n(getTickSize(ctx.limit_price))} đ.` : null),
  },
  {
    id: 'lot',
    term: 'Lô',
    short: `Khối lượng đặt phải là bội số của ${QTY_LOT_SIZE} cổ phiếu.`,
    detail: `Mỗi lệnh tối đa ${n(MAX_ORDER_QTY)} cổ phiếu. Lệnh con do OMS sinh ra cũng luôn tròn lô.`,
    formula: `KL hợp lệ khi KL chia hết cho ${QTY_LOT_SIZE} và không vượt ${n(MAX_ORDER_QTY)}`,
  },
  {
    id: 'paused-system',
    term: 'PAUSED_SYSTEM',
    short: 'Hệ thống tự tạm dừng lệnh vì một rủi ro, không phải do người dùng.',
    detail: 'Các lý do: giá ngoài biên độ, Core từ chối liên tiếp, giá thị trường trễ, kill switch. Tùy lý do, lệnh tự chạy lại, cần sửa giá hoặc cần vận hành mở lại.',
  },
  {
    id: 'persistence-mode',
    term: 'Hiệu lực (persistence_mode)',
    short: 'Lệnh còn hiệu lực tới khi nào: trong ngày, tới ngày chọn, hay nhiều phiên.',
    detail: 'DAY hết hạn khi đóng cửa. GTD và nhiều phiên mang phần còn lại sang phiên sau tới ngày hết hiệu lực; đầu mỗi ngày giá được kiểm lại theo trần, sàn mới.',
  },
]

/** Thuật ngữ của từng loại lệnh, cho nhãn loại lệnh ở thẻ mẫu và ticket. */
export const STRATEGY_TERMS: Record<StrategyType, string> = {
  STOP: 'stop',
  STOP_LIMIT: 'stop-limit',
  TAKE_PROFIT: 'take-profit',
  TRAILING_STOP: 'trailing-stop',
  OCO: 'oco',
  BRACKET: 'bracket',
  ICEBERG: 'iceberg',
  TWAP: 'twap',
  VWAP: 'vwap',
  POV: 'pov',
  HUNT: 'hunt',
  LIMIT: 'lo',
}

/** Thuật ngữ của các ô tham số trên ticket Đặt lệnh. Ô không có ở đây hiện nhãn thường. */
export const FIELD_TERMS: Partial<Record<StrategyFieldName, string>> = {
  limit_price: 'lo',
  trigger_price: 'stop',
  tp_price: 'take-profit',
  sl_price: 'stop',
  trailing_value: 'trailing-stop',
  slice_qty: 'iceberg',
  participation_pct: 'participation',
  max_pct: 'participation',
  hunt_price: 'hunt',
}

/** Thuật ngữ của các cột báo cáo hiệu quả (Đợt 2). */
export const REPORT_COLUMN_TERMS: Partial<Record<ReportSortKey, string>> = {
  arrivalPrice: 'arrival',
  vwap: 'vwap',
  vsArrivalPct: 'slippage',
  vsVwapPct: 'vwap',
  participation: 'participation',
}

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]))

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id)
}
