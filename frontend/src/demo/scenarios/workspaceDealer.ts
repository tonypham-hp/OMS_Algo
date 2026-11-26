import { useWorkspaceStore } from '@/store/workspace.store'
import type { Scenario } from '../types'
import { childrenOf, openMarketAt, orderOf, SYMBOL } from './common'

// Scenario 13 (Đợt 10A): dealer dùng Bàn làm việc. Chọn mã ở Danh mục thì các panel cùng nhóm đổi theo;
// phím B chỉ mở phiếu Mua, lệnh chỉ được gửi sau bước Xác nhận.

const WORKSPACE_ROUTE = '/ban-lam-viec'
const group1 = () => useWorkspaceStore.getState().groups['1']
const LIMIT_PRICE = 118_000
const QTY = 1_000

export const workspaceDealer: Scenario = {
  id: 'workspace-dealer',
  number: 13,
  title: 'Dealer dùng bàn làm việc',
  summary: 'Bố cục Chuyên nghiệp, chọn FPT ở Danh mục cho cả nhóm, bấm B mở phiếu Mua, điền và xác nhận lệnh LO, xem lệnh ở Sổ lệnh và Chi tiết.',
  tcRefs: ['WS-LINK-01', 'WS-HOTKEY-01', 'WS-CONFIRM-01'],
  seed: 113,
  setup: (env) => openMarketAt(env, 118_500),
  steps: [
    {
      id: 'layout',
      caption:
        'Bố cục Chuyên nghiệp: Danh mục, Sổ lệnh 3 mức, Phiếu lệnh ở trên; Sổ lệnh, Chi tiết, Thông báo ở dưới. Mọi panel cùng Nhóm 1 (chấm màu và nhãn trên tab), nhóm đang xem HPG.',
      action: { type: 'workspace', params: { op: 'preset', preset: 'pro', symbol: 'HPG' } },
      route: WORKSPACE_ROUTE,
      highlight: 'ws-watchlist',
      settle: 0,
      checks: [
        { label: 'Nhóm 1 đang xem HPG', fn: () => group1().symbol === 'HPG' },
        { label: 'Chưa có lệnh nào', fn: (s) => s.orders.length === 0 },
      ],
    },
    {
      id: 'link',
      caption:
        'Chọn FPT ở Danh mục: Phiếu lệnh, Sổ lệnh 3 mức và Sổ lệnh cùng Nhóm 1 đổi sang FPT. Panel ở nhóm khác hoặc "Không nhóm" giữ nguyên mã của mình.',
      action: { type: 'workspace', params: { op: 'selectSymbol', symbol: SYMBOL } },
      route: WORKSPACE_ROUTE,
      highlight: 'ws-depth',
      settle: 0,
      checks: [{ label: 'Nhóm 1 chuyển sang FPT', fn: () => group1().symbol === SYMBOL }],
    },
    {
      id: 'hotkey-b',
      caption:
        'Bấm B: mở phiếu Mua cho FPT (mã của nhóm) và đưa con trỏ vào ô Khối lượng. Phím tắt chỉ MỞ phiếu, không gửi gì; gõ "B" trong một ô nhập thì không có tác dụng.',
      action: { type: 'workspace', params: { op: 'openTicket', side: 'BUY' } },
      route: WORKSPACE_ROUTE,
      highlight: 'ws-ticket',
      settle: 0,
      checks: [
        { label: 'Phiếu nhận chiều Mua', fn: () => useWorkspaceStore.getState().ticketRequest?.side === 'BUY' },
        { label: 'Bấm phím không tạo lệnh nào', fn: (s) => s.orders.length === 0 },
      ],
    },
    {
      id: 'fill',
      caption: 'Điền lệnh LO 1.000 CP giá 118.000 (thấp hơn giá khớp 118.500 nên sẽ nằm chờ). Phiếu đang là bản nháp: đổi mã ở Danh mục lúc này sẽ được hỏi trước, không xóa trắng.',
      action: { type: 'workspace', params: { op: 'fillTicket', strategy_type: 'LIMIT', total_qty: QTY, limit_price: LIMIT_PRICE } },
      route: WORKSPACE_ROUTE,
      highlight: 'ws-ticket',
      settle: 0,
      checks: [{ label: 'Vẫn chưa gửi lệnh (chưa xác nhận)', fn: (s) => s.orders.length === 0 }],
    },
    {
      id: 'confirm',
      caption: 'Bấm Đặt lệnh, kiểm tra hộp Xác nhận rồi bấm Xác nhận: lệnh mới gửi đi. Sổ lệnh của nhóm (đang lọc FPT) hiện lệnh vừa đặt.',
      action: {
        type: 'workspace',
        params: {
          op: 'submitTicket',
          order: { ref: 'order', symbol: SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: QTY, limit_price: LIMIT_PRICE, parameters: {} },
        },
      },
      route: WORKSPACE_ROUTE,
      highlight: 'ws-blotter',
      checks: [
        { label: 'Đúng một lệnh: FPT, Mua, LO 1.000 CP giá 118.000', fn: (s) => s.orders.length === 1 && orderOf(s).symbol === SYMBOL && orderOf(s).side === 'BUY' && orderOf(s).total_qty === QTY && orderOf(s).limit_price === LIMIT_PRICE },
        { label: 'Lệnh con LO đã lên sàn (ACKNOWLEDGED)', fn: (s) => childrenOf(s).length === 1 && childrenOf(s)[0].status === 'ACKNOWLEDGED' },
      ],
    },
    {
      id: 'detail',
      caption: 'Bấm mã lệnh ở Sổ lệnh: panel Chi tiết lệnh cùng Nhóm 1 mở lệnh đó, không rời bàn làm việc.',
      action: { type: 'workspace', params: { op: 'openOrder', order: 'order' } },
      route: WORKSPACE_ROUTE,
      highlight: 'ws-order-detail',
      settle: 0,
      checks: [{ label: 'Chi tiết lệnh của nhóm mở đúng lệnh vừa đặt', fn: (s) => group1().orderId === orderOf(s).parent_order_id }],
    },
  ],
}
