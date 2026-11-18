export interface FilterOption {
  value: string
  label: string
}

/** Danh sách lựa chọn từ bảng nhãn { mã: nhãn }. */
export const toOptions = <T extends string>(labels: Record<T, string>): FilterOption[] =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
