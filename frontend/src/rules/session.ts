import type { SessionCode } from '@/types'
import type { LotKind, OrderType, RulePack } from './types'

/** "09:15" → 33300. Trả về null nếu sai định dạng. */
export function parseTimeToSeconds(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 3600 + minute * 60
}

const toSeconds = (value: string) => {
  const seconds = parseTimeToSeconds(value)
  if (seconds === null) throw new Error(`Giờ trong pack sai định dạng: ${value}`)
  return seconds
}

export interface SessionSpan {
  code: SessionCode
  start: number
  end: number
}

const spanCache = new WeakMap<RulePack, SessionSpan[]>()

/** Các phiên của pack, tính bằng giây trong ngày. */
export function sessionSpans(rules: RulePack): SessionSpan[] {
  let spans = spanCache.get(rules)
  if (!spans) {
    spans = rules.sessions.map((item) => ({ code: item.code, start: toSeconds(item.start), end: toSeconds(item.end) }))
    spanCache.set(rules, spans)
  }
  return spans
}

/** Giờ mở cửa: đầu phiên đầu tiên. */
export function marketOpenSeconds(rules: RulePack): number {
  return sessionSpans(rules)[0].start
}

/** Giờ hết khớp lệnh: lệnh trong ngày chưa khớp hết hiệu lực (14:45 với HOSE). */
export function expirySeconds(rules: RulePack): number {
  return toSeconds(rules.expiryTime)
}

/** Giờ đóng cửa hẳn: cuối phiên cuối (gồm thỏa thuận sau giờ). */
export function marketCloseSeconds(rules: RulePack): number {
  const spans = sessionSpans(rules)
  return spans[spans.length - 1].end
}

export function getSessionAt(secondsOfDay: number, rules: RulePack): SessionCode {
  const spans = sessionSpans(rules)
  if (secondsOfDay < spans[0].start) return 'PRE_OPEN'
  return spans.find((item) => secondsOfDay >= item.start && secondsOfDay < item.end)?.code ?? 'CLOSED'
}

/** Phiên khớp lệnh định kỳ: chỉ có giá dự kiến, khớp một lần lúc hết phiên (gồm lượt định kỳ của mã hạn chế). */
export function isAuctionSession(session: SessionCode): boolean {
  return session === 'ATO' || session === 'ATC' || session === 'PERIODIC' || session === 'PERIODIC_LOCK'
}

export interface RestrictedPhase {
  session: SessionCode
  /** Giây trong ngày lúc khớp lượt hiện tại; null khi không trong lượt nào (nghỉ trưa, ngoài giờ). */
  callEnd: number | null
  /** Mã của lượt: đổi là đã sang lượt mới (lượt trước vừa khớp). */
  callId: string | null
}

/**
 * Phiên của một mã bị hạn chế giao dịch lúc `secondsOfDay` (hàm thuần): ATO giữ nguyên; giờ khớp liên tục chia thành các
 * lượt định kỳ `callIntervalMinutes` phút tính từ đầu mỗi khung liên tục (lượt cuối kẹp ở cuối khung), `lockSecondsBeforeCall`
 * giây cuối mỗi lượt là PERIODIC_LOCK; ATC giữ nguyên. Pack không có `restricted` thì trả phiên thường.
 */
export function restrictedPhaseAt(secondsOfDay: number, rules: RulePack): RestrictedPhase {
  const base = getSessionAt(secondsOfDay, rules)
  const spec = rules.restricted
  const span = sessionSpans(rules).find((item) => secondsOfDay >= item.start && secondsOfDay < item.end)
  if (!spec || !span) return { session: base, callEnd: null, callId: null }
  if (base === 'ATO' || base === 'ATC') {
    return { session: base, callEnd: span.end, callId: `${base}-${span.end}` }
  }
  if (base !== 'CONTINUOUS') return { session: base, callEnd: null, callId: null }
  const interval = spec.callIntervalMinutes * 60
  const index = Math.floor((secondsOfDay - span.start) / interval)
  const callEnd = Math.min(span.start + (index + 1) * interval, span.end)
  const locked = secondsOfDay >= callEnd - spec.lockSecondsBeforeCall
  return { session: locked ? 'PERIODIC_LOCK' : 'PERIODIC', callEnd, callId: `P-${callEnd}` }
}

/** Đã hết khớp lệnh trong ngày: thỏa thuận sau giờ hoặc đóng cửa. */
export function isMatchingOver(session: SessionCode): boolean {
  return session === 'PUT_THROUGH' || session === 'CLOSED'
}

/** Giờ kết thúc của phiên đang chạy lúc `secondsOfDay`, để bộ giả lập không tua vượt giờ khớp định kỳ. */
export function sessionEndAt(secondsOfDay: number, rules: RulePack): number | null {
  return sessionSpans(rules).find((item) => secondsOfDay >= item.start && secondsOfDay < item.end)?.end ?? null
}

/**
 * Loại lệnh nhận trong phiên theo lô; cờ MOK_MAK tắt thì bỏ MOK, MAK.
 * Mã hạn chế giao dịch: theo `rules.restricted.orderTypes`, chỉ lô chẵn.
 */
export function allowedOrderTypes(rules: RulePack, session: SessionCode, lot: LotKind, restricted = false): OrderType[] {
  if (restricted && rules.restricted) return lot === 'ROUND' ? (rules.restricted.orderTypes[session] ?? []) : []
  const entry = rules.orderTypesBySession[session]
  if (!entry) return []
  const types = lot === 'ODD' ? entry.odd : entry.round
  return isFlagOff(rules, 'MOK_MAK') ? types.filter((type) => type !== 'MOK' && type !== 'MAK') : types
}

function isFlagOff(rules: RulePack, flag: keyof RulePack['flags']) {
  const state = rules.flags[flag]
  return state !== undefined && !state.enabled
}

export function isMtlAllowed(rules: RulePack, session: SessionCode): boolean {
  return allowedOrderTypes(rules, session, 'ROUND').includes('MTL')
}

export function isAmendAllowed(rules: RulePack, session: SessionCode): boolean {
  return !rules.amendPolicy.lockedSessions.includes(session)
}

export function isCancelAllowed(rules: RulePack, session: SessionCode): boolean {
  return !rules.cancelPolicy.lockedSessions.includes(session)
}
