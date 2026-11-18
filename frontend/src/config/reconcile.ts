import type { ReconRowStatus, ReconType } from '@/types'

/**
 * Lệnh con UNKNOWN quá từng này giây (theo đồng hồ giả lập) mà chưa đối soát thì thành chênh lệch đang mở.
 * Engine tự tra Core sau khoảng 5 nhịp; ngưỡng thấp hơn để vận hành thấy được lệnh con đang chờ đối soát.
 */
export const UNKNOWN_OPEN_AFTER_SECONDS = 2

/** Thứ tự hiển thị: lỗi nặng trước, chênh lệch đã tự xử lý sau. */
export const RECON_TYPES: ReadonlyArray<ReconType> = [
  'OVERFILL',
  'PARENT_SUM_MISMATCH',
  'STATUS_MISMATCH',
  'QTY_MISMATCH',
  'UNKNOWN_OPEN',
  'UNKNOWN_RESOLVED',
  'DUP_FILL_IGNORED',
]

export const RECON_TYPE_LABELS: Record<ReconType, string> = {
  STATUS_MISMATCH: 'Lệch trạng thái',
  QTY_MISMATCH: 'Lệch KL khớp',
  UNKNOWN_OPEN: 'UNKNOWN chưa đối soát',
  UNKNOWN_RESOLVED: 'UNKNOWN đã đối soát',
  DUP_FILL_IGNORED: 'Bỏ qua khớp trùng',
  PARENT_SUM_MISMATCH: 'Lệch tổng lệnh cha',
  OVERFILL: 'Khớp vượt KL đặt',
}

/** Mục thuật ngữ giải thích từng loại (src/config/glossary.ts). */
export const RECON_TYPE_TERMS: Record<ReconType, string> = {
  STATUS_MISMATCH: 'status-mismatch',
  QTY_MISMATCH: 'qty-mismatch',
  UNKNOWN_OPEN: 'unknown',
  UNKNOWN_RESOLVED: 'reconciliation',
  DUP_FILL_IGNORED: 'dup-fill-ignored',
  PARENT_SUM_MISMATCH: 'parent-sum-mismatch',
  OVERFILL: 'overfill',
}

/** Các loại hệ thống đã tự xử lý xong: chỉ để xem, không cần ai đánh dấu. */
export const AUTO_RESOLVED_TYPES: ReadonlySet<ReconType> = new Set(['UNKNOWN_RESOLVED', 'DUP_FILL_IGNORED'])

export const RECON_STATUS_LABELS: Record<ReconRowStatus, string> = {
  OPEN: 'Mở',
  PENDING_APPROVAL: 'Chờ duyệt',
  RESOLVED: 'Đã xử lý',
}

export const OVERFILL_LABEL = 'Lỗi nghiêm trọng'
