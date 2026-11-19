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

/** Phiên khớp lệnh định kỳ: chỉ có giá dự kiến, khớp một lần lúc hết phiên. */
export function isAuctionSession(session: SessionCode): boolean {
  return session === 'ATO' || session === 'ATC'
}

/** Đã hết khớp lệnh trong ngày: thỏa thuận sau giờ hoặc đóng cửa. */
export function isMatchingOver(session: SessionCode): boolean {
  return session === 'PUT_THROUGH' || session === 'CLOSED'
}

/** Giờ kết thúc của phiên đang chạy lúc `secondsOfDay`, để bộ giả lập không tua vượt giờ khớp định kỳ. */
export function sessionEndAt(secondsOfDay: number, rules: RulePack): number | null {
  return sessionSpans(rules).find((item) => secondsOfDay >= item.start && secondsOfDay < item.end)?.end ?? null
}

/** Loại lệnh nhận trong phiên theo lô; cờ MOK_MAK tắt thì bỏ MOK, MAK. */
export function allowedOrderTypes(rules: RulePack, session: SessionCode, lot: LotKind): OrderType[] {
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
