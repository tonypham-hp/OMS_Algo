// Cờ "đang chạy Demo". Khi bật, runtime không ghi trạng thái giả lập vào localStorage,
// nên dữ liệu của kịch bản Demo không bao giờ đè lên dữ liệu thật của người dùng.
let active = false

export function isDemoActive() {
  return active
}

export function setDemoActive(on: boolean) {
  active = on
}
