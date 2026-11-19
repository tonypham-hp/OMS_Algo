import { formatDate, formatNumber } from '@/lib/format'
import { LISTING_TRANSFERS } from '@/rules/symbols'
import type { RuleCode, RuleViolation } from '@/rules/types'
import type { ParentOrderStatus } from '@/types'
import type { ActionDef, ExplainCode, ExplainContext, RejectInfo } from './types'

/**
 * Danh mục mã lý do. Mỗi câu chỉ dùng số trong `ctx`, không có số viết cứng trong câu.
 * Thiếu dữ kiện thì câu nói rõ "chưa đủ dữ liệu", không đoán.
 */
export interface ReasonDef {
  code: ExplainCode
  appliesTo: ParentOrderStatus[]
  title: string
  template: (ctx: ExplainContext) => string
  actions: ActionDef[]
  sources: (ctx: ExplainContext) => string[]
}

export const NOT_ENOUGH_DATA = 'chưa đủ dữ liệu'
const TRANSFER_FIRST_DATE = LISTING_TRANSFERS[0].firstTradingDate

const n = formatNumber
const RUNNING: ParentOrderStatus[] = ['ACTIVE', 'PARTIALLY_EXECUTED']
const OPS_ONLY = ['OPS'] as ActionDef['roles']

const progress = (ctx: ExplainContext) => `Đã khớp ${n(ctx.executed_qty)}/${n(ctx.total_qty)} CP.`

const SCROLL_LOG: ActionDef = { kind: 'SCROLL_LOG', label: 'Xem nhật ký' }
const OPEN_OPS: ActionDef = { kind: 'OPEN_OPS', label: 'Mở Giám sát hệ thống', roles: OPS_ONLY }
const REOPEN: ActionDef = { kind: 'REOPEN', label: 'Mở lại', roles: OPS_ONLY }
/** Mở lại chỉ có nghĩa khi hệ thống đang tạm dừng lệnh. */
const REOPEN_WHEN_PAUSED: ActionDef = { ...REOPEN, enabled: (ctx) => (ctx.status === 'PAUSED_SYSTEM' ? true : 'Lệnh không ở trạng thái hệ thống tạm dừng') }

const sessionSource = (ctx: ExplainContext) => `Phiên hiện tại: ${ctx.session_label}`
const eventSource = (ctx: ExplainContext) => (ctx.related_event_id ? [`Nhật ký ${ctx.related_event_id}`] : [])

/** Câu lý do Core từ chối. Dùng chung cho lệnh cha và từng lệnh con. */
export function describeReject(
  reject: Pick<RejectInfo, 'quantity' | 'price' | 'tick' | 'reject_code'> | null,
  rules: { lot_size: number; max_order_qty: number; band_pct: number },
): string {
  if (!reject) return `Core không nêu lý do (${NOT_ENOUGH_DATA})`
  switch (reject.reject_code) {
    case 'LOT_SIZE':
      return `khối lượng ${n(reject.quantity)} CP không phải bội số của lô ${n(rules.lot_size)}`
    case 'TICK_SIZE':
      return reject.price === null || reject.tick === null
        ? 'giá không đúng bước giá'
        : `giá ${n(reject.price)} không đúng bước giá ${n(reject.tick)} đ`
    case 'MAX_QTY':
      return `khối lượng ${n(reject.quantity)} CP vượt mức tối đa ${n(rules.max_order_qty)} CP/lệnh`
    case 'PRICE_BAND':
      return reject.price === null
        ? `giá ngoài biên độ ±${n(rules.band_pct)}%`
        : `giá ${n(reject.price)} ngoài biên độ ±${n(rules.band_pct)}%`
    case 'OTHER':
      return 'Core không nêu lý do cụ thể'
    default:
      return `Core không gửi mã lý do (${NOT_ENOUGH_DATA})`
  }
}

function conditionSentence(ctx: ExplainContext): string {
  if (ctx.conditions.length === 0) {
    if (ctx.trailing_value !== null) {
      return `Giá kích hoạt của Trailing Stop bám theo thị trường, cách đỉnh (hoặc đáy) ${n(ctx.trailing_value)} đ; ${NOT_ENOUGH_DATA} để biết giá kích hoạt hiện tại.`
    }
    return `Lệnh đang chờ điều kiện kích hoạt, nhưng ${NOT_ENOUGH_DATA} về giá kích hoạt.`
  }
  const parts = ctx.conditions.map((condition) => {
    const move = condition.direction === 'UP' ? 'tăng lên' : 'giảm xuống'
    if (condition.gap === null) return `${condition.label} ${n(condition.price)} (giá ${move} tới mức này thì kích hoạt; ${NOT_ENOUGH_DATA} giá hiện tại)`
    return `${condition.label} ${n(condition.price)}: giá cần ${move} thêm ${n(condition.gap)} đ (${n(condition.gap_ticks ?? 0)} bước giá)`
  })
  const lastText = ctx.last_price === null ? '' : ` Giá khớp gần nhất của ${ctx.symbol} là ${n(ctx.last_price)}.`
  return `Lệnh ${ctx.strategy_label} chưa kích hoạt vì giá chưa chạm ${parts.join('; ')}.${lastText}`
}

function expireSentence(ctx: ExplainContext): string {
  switch (ctx.expire_code) {
    case 'DAY_END':
      return `Lệnh ${ctx.persistence_label} chỉ có hiệu lực trong ngày, nên hết hạn khi đóng cửa${ctx.expire_at ? ` (${ctx.expire_at})` : ''}.`
    case 'VALID_TO_REACHED':
      return `Lệnh ${ctx.persistence_label} đã tới ngày hết hiệu lực ${formatDate(ctx.valid_to)}.`
    case 'WINDOW_END':
      return ctx.window_start && ctx.window_end
        ? `Đã hết khung giờ ${ctx.window_start}–${ctx.window_end} của lệnh ${ctx.strategy_label} trong ngày (lệnh ${ctx.persistence_label}).`
        : `Đã hết khung giờ chạy của lệnh ${ctx.strategy_label} trong ngày.`
    case 'HUNT_MAX_WAIT':
      return ctx.hunt?.max_wait_min && ctx.hunt_price !== null
        ? `Hết thời gian chờ ${n(ctx.hunt.max_wait_min)} phút mà giá chưa về giá săn ${n(ctx.hunt_price)}.`
        : 'Hết thời gian chờ săn mà giá chưa về giá săn.'
    default:
      return `Lệnh đã hết hiệu lực; ${NOT_ENOUGH_DATA} để biết nguyên nhân cụ thể.`
  }
}

export const REASONS: Record<ExplainCode, ReasonDef> = {
  PRICE_OUT_OF_BAND: {
    code: 'PRICE_OUT_OF_BAND',
    appliesTo: ['PAUSED_SYSTEM'],
    title: 'Vì sao lệnh này đang dừng?',
    template: (ctx) => {
      const out = ctx.out_of_band
      if (!out || ctx.ref_price === null || ctx.ceiling_price === null || ctx.floor_price === null) {
        return `Lệnh đang dừng vì có giá nằm ngoài biên độ ngày, nhưng ${NOT_ENOUGH_DATA} giá tham chiếu để tính giá trần, giá sàn.`
      }
      const where = out.side === 'ABOVE' ? `vượt giá trần ${n(ctx.ceiling_price)}` : `thấp hơn giá sàn ${n(ctx.floor_price)}`
      const hint = out.side === 'ABOVE' ? 'hoặc thấp hơn' : 'hoặc cao hơn'
      return (
        `Lệnh đang dừng vì ${out.label} ${n(out.value)} ${where}. ` +
        `Giá tham chiếu ${ctx.symbol} là ${n(ctx.ref_price)}, biên độ ±${n(ctx.band_pct)}% nên giá trần ${n(ctx.ceiling_price)}, giá sàn ${n(ctx.floor_price)} ` +
        `(đã làm tròn theo bước giá ${n(out.tick)} đ). Sửa ${out.label} về ${n(out.suggested)} ${hint} để lệnh tự chạy lại.`
      )
    },
    actions: [
      {
        kind: 'REPRICE',
        label: 'Sửa giá',
        enabled: (ctx) => (ctx.can_modify ? true : `Không được sửa lệnh trong ${ctx.session_label}`),
      },
      SCROLL_LOG,
    ],
    sources: (ctx) => [
      'Giá tham chiếu (bảng giá)',
      `Biên độ ±${n(ctx.band_pct)}% và bước giá (luật HOSE)`,
      'Giá của lệnh',
      ...eventSource(ctx),
    ],
  },

  SESSION_LOCKED: {
    code: 'SESSION_LOCKED',
    appliesTo: RUNNING,
    title: 'Vì sao chưa sửa, hủy được lệnh này?',
    template: (ctx) =>
      `Đang trong ${ctx.session_label}: luật HOSE không cho sửa, hủy lệnh trong phiên ATO và ATC, nên các nút Sửa, Hủy tạm khóa. ` +
      `Lệnh vẫn chạy bình thường. ${progress(ctx)}`,
    actions: [SCROLL_LOG],
    sources: (ctx) => [sessionSource(ctx), 'Luật HOSE về sửa, hủy lệnh'],
  },

  STALE_MARKET_DATA: {
    code: 'STALE_MARKET_DATA',
    appliesTo: ['PAUSED_SYSTEM'],
    title: 'Vì sao lệnh này đang dừng?',
    template: (ctx) => {
      const threshold = ctx.max_delay_seconds === null ? 'ngưỡng do vận hành cấu hình' : `ngưỡng ${n(ctx.max_delay_seconds)} giây`
      const age =
        ctx.quote_age_seconds === null
          ? `${NOT_ENOUGH_DATA} về độ trễ hiện tại`
          : ctx.quote_age_seconds > 0
            ? `giá đã trễ ${n(ctx.quote_age_seconds)} giây`
            : 'giá vừa có lại, lệnh sẽ chạy lại ở nhịp kế tiếp'
      return (
        `Lệnh đang dừng vì dữ liệu giá thị trường bị trễ quá ${threshold} (${age}). ` +
        `Hệ thống không ra quyết định theo giá cũ; khi có giá mới, lệnh tự chạy lại. ${progress(ctx)}`
      )
    },
    actions: [SCROLL_LOG, OPEN_OPS],
    sources: (ctx) => [
      'Thời điểm nhận giá gần nhất',
      ctx.max_delay_seconds === null ? 'Ngưỡng giá trễ (cấu hình hệ thống)' : `Ngưỡng giá trễ ${n(ctx.max_delay_seconds)} giây (cấu hình hệ thống)`,
      ...eventSource(ctx),
    ],
  },

  KILL_SWITCH: {
    code: 'KILL_SWITCH',
    appliesTo: ['PAUSED_SYSTEM'],
    title: 'Vì sao lệnh này đang dừng?',
    template: (ctx) => {
      const scope =
        ctx.kill_switch_scope === null
          ? ''
          : ctx.kill_switch_scope === 'ALL'
            ? ' cho toàn hệ thống'
            : ` cho tài khoản ${ctx.kill_switch_scope.replace('ACCOUNT:', '')}`
      const at = ctx.kill_switch_at ? ` lúc ${ctx.kill_switch_at}` : ''
      return (
        `Vận hành đã kích hoạt kill switch${scope}${at}. Lệnh con chưa khớp đã bị hủy. ` +
        `Tắt kill switch không làm lệnh tự chạy lại: vận hành phải mở lại từng lệnh. ${progress(ctx)}`
      )
    },
    actions: [SCROLL_LOG, OPEN_OPS],
    sources: (ctx) => ['Trạng thái kill switch', ...eventSource(ctx)],
  },

  CHILD_REJECTED: {
    code: 'CHILD_REJECTED',
    appliesTo: ['PAUSED_SYSTEM', ...RUNNING],
    title: 'Vì sao lệnh con bị từ chối?',
    template: (ctx) => {
      const reject = ctx.last_reject
      const where = reject ? `lệnh con chu kỳ ${n(reject.cycle_no)}` : 'lệnh con gần nhất'
      if (ctx.status === 'PAUSED_SYSTEM') {
        const limit = ctx.max_rejects === null ? '' : ` (ngưỡng ${n(ctx.max_rejects)} lần)`
        return (
          `Core từ chối ${n(ctx.reject_streak)} lệnh con liên tiếp${limit}, lần gần nhất ở ${where}: ${describeReject(ctx.last_reject, ctx)}. ` +
          `Hệ thống dừng lệnh để không gửi tiếp lệnh sai. ${progress(ctx)}`
        )
      }
      const limit = ctx.max_rejects === null ? 'nhiều lần liên tiếp' : `${n(ctx.max_rejects)} lần liên tiếp`
      return (
        `Core vừa từ chối ${where}: ${describeReject(ctx.last_reject, ctx)}. ` +
        `Lệnh sẽ sinh lại lệnh con ở nhịp sau; nếu bị từ chối ${limit} thì hệ thống tạm dừng lệnh.`
      )
    },
    actions: [SCROLL_LOG, REOPEN_WHEN_PAUSED],
    sources: (ctx) => ['Phản hồi từ chối của Core', 'Luật lô, bước giá, KL tối đa (HOSE)', ...eventSource(ctx)],
  },

  CHILD_UNKNOWN: {
    code: 'CHILD_UNKNOWN',
    appliesTo: ['PAUSED_SYSTEM', ...RUNNING],
    title: 'Vì sao lệnh con chưa rõ trạng thái?',
    template: (ctx) => {
      const child = ctx.unknown_child
      if (!child) return `Có lệnh con chưa rõ trạng thái nhưng ${NOT_ENOUGH_DATA} để biết là lệnh nào.`
      return (
        `Lệnh con chu kỳ ${n(child.cycle_no)} (${n(child.open_qty)} CP) đã gửi nhưng mất xác nhận (ACK) từ Core, nên chưa biết Core có giữ lệnh hay không. ` +
        `Hệ thống đang đối soát và chưa gửi lại phần này để không đặt trùng; ${n(child.open_qty)} CP vẫn tính là đang chờ khớp. ${progress(ctx)}`
      )
    },
    actions: [SCROLL_LOG, { kind: 'RECONCILE', label: 'Đối soát ngay', roles: OPS_ONLY }, REOPEN_WHEN_PAUSED],
    sources: (ctx) => ['Trạng thái lệnh con', 'Thời gian chờ ACK (cấu hình hệ thống)', ...eventSource(ctx)],
  },

  CONDITION_WAITING: {
    code: 'CONDITION_WAITING',
    appliesTo: RUNNING,
    title: 'Vì sao lệnh này chưa đặt lệnh con?',
    template: conditionSentence,
    actions: [SCROLL_LOG],
    sources: () => ['Tham số kích hoạt của lệnh', 'Giá khớp gần nhất (bảng giá)', 'Bước giá (luật HOSE)'],
  },

  POV_THROTTLED: {
    code: 'POV_THROTTLED',
    appliesTo: RUNNING,
    title: 'Vì sao lệnh POV đặt ít hơn mục tiêu?',
    template: (ctx) => {
      const pov = ctx.pov
      if (!pov || pov.max_pct === null || pov.cap === null || pov.market_qty === null) {
        return `Lệnh POV đang bị giới hạn bởi tỷ lệ tham gia tối đa, nhưng ${NOT_ENOUGH_DATA} về KL thị trường lúc đó.`
      }
      const target = pov.participation_pct === null ? '' : ` (mục tiêu ${n(pov.participation_pct)}%)`
      return (
        `Lệnh POV đã chạm tỷ lệ tham gia tối đa ${n(pov.max_pct)}%: KL khớp toàn thị trường nhịp đó là ${n(pov.market_qty)} CP ` +
        `nên chỉ được đặt tối đa ${n(pov.cap)} CP${target}. Lệnh đặt tiếp khi thị trường có thêm thanh khoản. ${progress(ctx)}`
      )
    },
    actions: [SCROLL_LOG],
    sources: (ctx) => ['Tham số % tham gia của lệnh', 'KL khớp toàn thị trường', ...eventSource(ctx)],
  },

  HUNT_NO_LEVEL: {
    code: 'HUNT_NO_LEVEL',
    appliesTo: ['EXPIRED', ...RUNNING],
    title: 'Vì sao lệnh HUNT không lấy thêm được?',
    template: (ctx) => {
      const limit = ctx.hunt?.limit_price ?? null
      if (ctx.status === 'EXPIRED') {
        const limitText = limit === null ? '' : ` ${n(limit)}`
        return (
          `Lệnh đã quét hết các mức trong giới hạn giá${limitText}, lấy được ${n(ctx.executed_qty)}/${n(ctx.total_qty)} CP. ` +
          `Phần còn lại ${n(ctx.remaining_qty)} CP bị hủy theo cài đặt "Hủy phần còn lại".`
        )
      }
      const best = ctx.hunt?.best_price ?? null
      const bestText = best === null ? `${NOT_ENOUGH_DATA} về giá tốt nhất phía đối ứng` : `giá tốt nhất phía đối ứng đang là ${n(best)}`
      const limitText = limit === null ? 'giới hạn giá' : `giới hạn giá ${n(limit)}`
      const wait = ctx.hunt?.max_wait_min ? ` hoặc hết thời gian chờ ${n(ctx.hunt.max_wait_min)} phút` : ''
      return `Giá đã về mức săn nhưng sổ lệnh chưa có mức nào trong ${limitText}: ${bestText}. Lệnh chờ tới khi có mức hợp lệ${wait}.`
    },
    actions: [SCROLL_LOG],
    sources: (ctx) => ['Kế hoạch quét sổ lệnh', 'Giá giới hạn của lệnh', ...eventSource(ctx)],
  },

  PAUSED_USER: {
    code: 'PAUSED_USER',
    appliesTo: ['PAUSED_USER'],
    title: 'Vì sao lệnh này đang dừng?',
    template: (ctx) => {
      const who = ctx.last_action ? ` của ${ctx.last_action.user} lúc ${ctx.last_action.at}` : ''
      return `Lệnh đang tạm dừng theo yêu cầu${who}. Lệnh con chưa khớp đã hủy, lệnh không sinh lệnh con mới cho tới khi bấm Tiếp tục. ${progress(ctx)}`
    },
    actions: [
      { kind: 'RESUME', label: 'Tiếp tục' },
      SCROLL_LOG,
    ],
    sources: (ctx) => ['Thao tác tạm dừng', ...eventSource(ctx)],
  },

  EXPIRED: {
    code: 'EXPIRED',
    appliesTo: ['EXPIRED'],
    title: 'Vì sao lệnh này hết hạn?',
    template: (ctx) => `${expireSentence(ctx)} ${progress(ctx)} Phần còn lại ${n(ctx.remaining_qty)} CP không còn được đặt.`,
    actions: [SCROLL_LOG],
    sources: (ctx) => [`Hiệu lực: ${ctx.persistence_label}`, ...eventSource(ctx)],
  },

  COMPLETED: {
    code: 'COMPLETED',
    appliesTo: ['COMPLETED'],
    title: 'Kết quả lệnh',
    template: (ctx) => {
      const avg = ctx.avg_price === null ? '' : ` với giá bình quân ${n(ctx.avg_price)}`
      if (ctx.arrival_price === null || ctx.arrival_bps_text === null) {
        return `Lệnh đã khớp đủ ${n(ctx.total_qty)} CP${avg}. ${capitalize(NOT_ENOUGH_DATA)} để so với giá arrival.`
      }
      const verdict = ctx.arrival_favorable === null ? 'bằng' : ctx.arrival_favorable ? 'tốt hơn' : 'kém hơn'
      return `Lệnh đã khớp đủ ${n(ctx.total_qty)} CP${avg}. So với giá arrival ${n(ctx.arrival_price)}, kết quả ${verdict} (${ctx.arrival_bps_text}).`
    },
    actions: [SCROLL_LOG],
    sources: () => ['Các lần khớp của lệnh', 'Giá arrival lúc đặt lệnh', 'Công thức hiệu quả thực hiện'],
  },

  CANCELLED: {
    code: 'CANCELLED',
    appliesTo: ['CANCELLED', 'CANCEL_PENDING'],
    title: 'Vì sao lệnh này bị hủy?',
    template: (ctx) => {
      const who = ctx.last_action ? ` của ${ctx.last_action.user} lúc ${ctx.last_action.at}` : ''
      if (ctx.status === 'CANCEL_PENDING') {
        return `Lệnh đang được hủy theo yêu cầu${who}: chờ Core xác nhận hủy ${n(ctx.working_children)} lệnh con còn mở. ${progress(ctx)}`
      }
      return `Lệnh đã hủy theo yêu cầu${who}. ${progress(ctx)} Phần còn lại ${n(ctx.remaining_qty)} CP không được đặt nữa.`
    },
    actions: [SCROLL_LOG],
    sources: (ctx) => ['Thao tác hủy', ...eventSource(ctx)],
  },

  RUNNING: {
    code: 'RUNNING',
    appliesTo: RUNNING,
    title: 'Lệnh đang làm gì?',
    template: (ctx) =>
      `Lệnh ${ctx.strategy_label} đang chạy. ${progress(ctx)} Hiện có ${n(ctx.working_children)} lệnh con đang chờ khớp (${n(ctx.working_qty)} CP).`,
    actions: [SCROLL_LOG],
    sources: () => ['Trạng thái lệnh cha và lệnh con'],
  },

  NOT_ENOUGH_DATA: {
    code: 'NOT_ENOUGH_DATA',
    appliesTo: [],
    title: 'Trạng thái lệnh',
    template: (ctx) => `${capitalize(NOT_ENOUGH_DATA)} để giải thích trạng thái hiện tại của lệnh ${ctx.order_id}.`,
    actions: [SCROLL_LOG, REOPEN_WHEN_PAUSED],
    sources: () => ['Trạng thái lệnh'],
  },
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// ===== Lỗi kiểm tra lệnh theo gói luật (src/rules/validate.ts) =====

const SESSION_NAMES: Record<string, string> = {
  PRE_OPEN: 'giờ chưa mở cửa',
  ATO: 'phiên ATO',
  CONTINUOUS: 'phiên khớp lệnh liên tục',
  LUNCH: 'giờ nghỉ trưa',
  ATC: 'phiên ATC',
  PUT_THROUGH: 'phiên thỏa thuận sau giờ',
  CLOSED: 'giờ đóng cửa',
}
const BOARD_NAMES: Record<string, string> = { STO: 'HOSE', STX: 'HNX', UPX: 'UPCoM' }
const SEC_TYPE_NAMES: Record<string, string> = { STOCK: 'cổ phiếu', CLOSED_FUND: 'chứng chỉ quỹ đóng', ETF: 'ETF', CW: 'chứng quyền' }
type RuleParams = RuleViolation['params']
const num = (value: RuleParams[string]) => (typeof value === 'number' ? n(value) : String(value))
const session = (p: RuleParams) => SESSION_NAMES[String(p.session)] ?? String(p.session)
const board = (p: RuleParams) => BOARD_NAMES[String(p.board)] ?? String(p.board)
const band = (p: RuleParams) =>
  p.secType === 'CW' ? 'theo biên độ của mã cơ sở' : `tham chiếu ${num(p.ref)}, biên ±${num(p.band)}%`

/**
 * Câu tiếng Việt cho từng mã lỗi kiểm tra lệnh, có số cụ thể của lệnh. Phần đầu câu giữ đúng chữ cũ
 * ("Giá không được vượt giá trần …", "Khối lượng phải là bội số của …") để người dùng quen mắt.
 */
export const RULE_REASONS: Record<RuleCode, (p: RuleParams) => string> = {
  SYMBOL_TRANSFER_HALT: (p) =>
    `Mã ${p.symbol} ngừng giao dịch hôm nay để chuyển từ HNX sang HOSE (giao dịch lại trên HOSE từ ${formatDate(TRANSFER_FIRST_DATE)}).`,
  BOARD_CLOSED: (p) => `Bảng ${board(p)} không nhận lệnh trong ${session(p)}.`,
  ORDER_TYPE_NOT_IN_SESSION: (p) =>
    `Lệnh ${p.orderType} không đặt được trong ${session(p)} của bảng ${board(p)} (nhận: ${p.allowed || 'không có'}).`,
  ORDER_TYPE_DISABLED: (p) => `Lệnh ${p.orderType} đang tắt trên bảng ${board(p)} (${String(p.label).toLowerCase()} với KRX).`,
  MTL_CONTINUOUS_ONLY: (p) => `Lệnh MTL chỉ đặt được trong phiên khớp lệnh liên tục, hiện là ${session(p)}.`,
  PRICE_REQUIRED: (p) => `Lệnh ${p.orderType} phải có giá.`,
  PRICE_NOT_ALLOWED: (p) => `Lệnh ${p.orderType} là lệnh thị trường, không nhập giá.`,
  PRICE_INVALID: () => 'Giá phải là số nguyên đồng lớn hơn 0',
  PRICE_OUT_OF_BAND: (p) =>
    p.limit === 'ceiling'
      ? `Giá không được vượt giá trần ${num(p.ceiling)} (${band(p)}).`
      : `Giá không được thấp hơn giá sàn ${num(p.floor)} (${band(p)}).`,
  PRICE_TICK: (p) =>
    `Giá phải theo bước ${num(p.tick)}đ ở mức giá này (${SEC_TYPE_NAMES[String(p.secType)] ?? p.secType}: ${num(p.price)} không chia hết cho ${num(p.tick)}).`,
  PRICE_BELOW_MIN: (p) => `Giá đặt tối thiểu ${num(p.min)}đ (giá sàn hiển thị ${num(p.floor)}đ).`,
  QTY_INVALID: () => 'Khối lượng phải là số nguyên lớn hơn 0',
  LOT_ROUND_MULTIPLE: (p) => `Khối lượng phải là bội số của ${num(p.lot)}`,
  LOT_ODD_RANGE: (p) => `Lô lẻ: khối lượng từ ${num(p.min)} đến ${num(p.max)} CP (đang nhập ${num(p.qty)} CP).`,
  ODD_LOT_LO_ONLY: (p) => `Lô lẻ chỉ đặt lệnh LO, không đặt được lệnh ${p.orderType}.`,
  MAX_QTY: (p) => `Khối lượng tối đa ${num(p.max)} cổ phiếu/lệnh (đang nhập ${num(p.qty)}).`,
  FOREIGN_ROOM_EXCEEDED: (p) =>
    `Room ngoại của ${p.symbol} chỉ còn ${num(p.room)} CP, không mua được ${num(p.qty)} CP (tài khoản nhà đầu tư nước ngoài).`,
  AMEND_ONE_FIELD: () => 'Mỗi lần sửa chỉ được đổi giá hoặc khối lượng, không đổi cả hai cùng lúc.',
  AMEND_NO_CHANGE: () => 'Chưa đổi giá hay khối lượng.',
  AMEND_LOCKED_SESSION: (p) => `Không được sửa lệnh trong ${session(p)}.`,
  CANCEL_LOCKED_SESSION: (p) => `Không được hủy lệnh trong ${session(p)}.`,
}

export function ruleMessage(violation: Pick<RuleViolation, 'code' | 'params'>): string {
  return RULE_REASONS[violation.code](violation.params)
}
