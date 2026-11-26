/* eslint-disable react-refresh/only-export-components -- registry: bảng tra loại panel → component, không phải module component */
import type { DockviewPanelApi, IDockviewPanelProps } from 'dockview-react'
import { MousePointerClick } from 'lucide-react'
import { Lock } from 'lucide-react'
import { useCallback, useMemo, useState, type FunctionComponent, type ReactNode } from 'react'
import { NotificationList } from '@/components/layout/NotificationList'
import { OrderBook3 } from '@/components/OrderBook3'
import { EmptyState } from '@/components/states'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { OrderBlotter } from '@/pages/OrderBook/OrderBlotter'
import { OrderDetailView } from '@/pages/OrderDetail/OrderDetailView'
import { OrderTicket } from '@/pages/PlaceOrder/OrderTicket'
import { PriceBoardTable } from '@/pages/PlaceOrder/PriceBoard'
import { DraftDialog } from '@/pages/Workspace/DraftDialog'
import { PanelFrame } from '@/pages/Workspace/PanelFrame'
import { useMarketStore } from '@/store/market.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { PANEL_KIND_ORDER, type LinkGroup, type PanelKind, type PanelParams } from './panelTypes'
import { SymbolScopeContext, useSymbolScope, type SymbolScope } from './symbolScope'
import { resolveTicketSymbolChange } from './ticketSymbol'
import { useWorkspaceActions } from './workspaceContext'

const FALLBACK_SYMBOL = 'FPT'

/**
 * Mã đang chọn của một panel:
 * - thuộc nhóm 1–4: dùng chung trong store bàn làm việc (selector hẹp theo nhóm);
 * - "Không nhóm": mã riêng lưu trong params của panel (đi theo bố cục khi lưu).
 */
function PanelScope({ panelApi, params, children }: { panelApi: DockviewPanelApi; params: PanelParams; children: ReactNode }) {
  const group: LinkGroup = params.group ?? '1'
  const linked = group !== 'none'
  const groupSymbol = useWorkspaceStore((state) => (linked ? state.groups[group].symbol : null))
  const groupOrder = useWorkspaceStore((state) => (linked ? state.groups[group].orderId : null))
  const groupPicked = useWorkspaceStore((state) => (linked ? state.groups[group].pickedPrice : null))
  const setGroupSymbol = useWorkspaceStore((state) => state.setGroupSymbol)
  const pickGroupPrice = useWorkspaceStore((state) => state.pickGroupPrice)
  const [ownPicked, setOwnPicked] = useState<SymbolScope['pickedPrice']>(null)
  const actions = useWorkspaceActions()

  const scope = useMemo<SymbolScope>(() => {
    const openOrder = actions ? (orderId: string) => actions.openOrder(group, orderId, panelApi.id) : undefined
    if (linked) {
      return {
        symbol: groupSymbol ?? FALLBACK_SYMBOL,
        setSymbol: (symbol) => setGroupSymbol(group, symbol),
        pickedPrice: groupPicked,
        pickPrice: (price) => pickGroupPrice(group, price),
        orderId: groupOrder,
        openOrder,
      }
    }
    return {
      symbol: params.symbol ?? FALLBACK_SYMBOL,
      setSymbol: (symbol) => panelApi.updateParameters({ ...params, symbol }),
      pickedPrice: ownPicked,
      pickPrice: (price) => setOwnPicked((previous) => ({ price, nonce: (previous?.nonce ?? 0) + 1 })),
      orderId: params.orderId ?? null,
      openOrder,
    }
  }, [actions, group, linked, groupSymbol, groupOrder, groupPicked, setGroupSymbol, pickGroupPrice, params, panelApi, ownPicked])

  return <SymbolScopeContext.Provider value={scope}>{children}</SymbolScopeContext.Provider>
}

/**
 * Phiếu lệnh trong Bàn làm việc: mã đi theo nhóm liên kết, nhưng KHÔNG xóa trắng bản nháp.
 * - Phiếu trống: đổi mã theo nhóm ngay.
 * - Đang nhập dở: hỏi "Giữ bản nháp cho mã cũ / Chuyển sang mã mới" (panel đang ẩn sau tab khác thì tự giữ bản nháp).
 * - "Khóa mã": bỏ qua thay đổi của nhóm.
 * Đổi mã ngay trên phiếu thì cả nhóm đổi theo (trừ khi đang khóa mã).
 */
function TicketBody({ panelApi, params }: { panelApi: DockviewPanelApi; params: PanelParams }) {
  const outer = useSymbolScope()
  const locked = params.locked === true
  const [ticketSymbol, setTicketSymbol] = useState(outer.symbol)
  const [hasDraft, setHasDraft] = useState(false)
  /** Đổi key để dựng lại phiếu trống (bỏ bản nháp). */
  const [epoch, setEpoch] = useState(0)
  /** Mã nhóm đang chờ người dùng trả lời hộp hỏi. */
  const [asking, setAsking] = useState<string | null>(null)
  /** Mã nhóm hiện tại khi phiếu đang giữ bản nháp cho mã cũ. */
  const [held, setHeld] = useState<string | null>(null)

  // Xét lại mỗi khi mã của nhóm đổi hoặc bật/tắt khóa (điều chỉnh state ngay lúc vẽ, theo cách React khuyên,
  // thay vì effect). Bản nháp đổi trạng thái không tự kéo phiếu sang mã khác.
  const groupSymbol = outer.symbol
  const [seen, setSeen] = useState({ groupSymbol, locked })
  if (seen.groupSymbol !== groupSymbol || seen.locked !== locked) {
    setSeen({ groupSymbol, locked })
    const decision = resolveTicketSymbolChange({ current: ticketSymbol, next: groupSymbol, dirty: hasDraft, locked })
    if (decision === 'follow') {
      setTicketSymbol(groupSymbol)
      setHeld(null)
    } else if (decision === 'ask') {
      if (panelApi.isVisible) setAsking(groupSymbol)
      else setHeld(groupSymbol)
    } else if (decision === 'none') {
      setHeld(null)
    }
  }
  // Gửi lệnh xong (phiếu trống lại) mà nhóm đã sang mã khác: theo nhóm.
  if (!hasDraft && held && !locked) {
    setTicketSymbol(held)
    setHeld(null)
  }

  const { setSymbol: setGroupSymbol } = outer
  const scope = useMemo<SymbolScope>(
    () => ({
      ...outer,
      symbol: ticketSymbol,
      setSymbol: (symbol) => {
        setTicketSymbol(symbol)
        if (!locked) setGroupSymbol(symbol)
      },
    }),
    [outer, ticketSymbol, locked, setGroupSymbol],
  )
  const onDraftChange = useCallback((draft: boolean) => setHasDraft(draft), [])
  // Phím B/S (và Demo) nhắm vào đúng panel phiếu này.
  const ticketRequest = useWorkspaceStore((state) => (state.ticketRequest?.panelId === panelApi.id ? state.ticketRequest : null))
  const fillRequest = useWorkspaceStore((state) => (state.ticketFill?.panelId === panelApi.id ? state.ticketFill : null))
  const resetNonce = useWorkspaceStore((state) => (state.ticketReset?.panelId === panelApi.id ? state.ticketReset.nonce : 0))
  const [seenReset, setSeenReset] = useState(resetNonce)
  if (seenReset !== resetNonce) {
    setSeenReset(resetNonce)
    setEpoch((value) => value + 1)
    setHasDraft(false)
    setHeld(null)
  }
  const lockId = `lock-${panelApi.id}`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox
            id={lockId}
            checked={locked}
            onCheckedChange={(state) => panelApi.updateParameters({ ...params, locked: state === true })}
            aria-labelledby={`${lockId}-label`}
          />
          <Label id={`${lockId}-label`} htmlFor={lockId} className="flex items-center gap-1">
            <Lock className="size-3.5" aria-hidden /> Khóa mã {ticketSymbol}
          </Label>
        </div>
        {held && (
          <p role="status" className="bg-status-warning-bg text-status-warning flex items-center gap-2 rounded px-2 py-0.5 text-xs" data-testid="draft-held">
            Bản nháp {ticketSymbol} · nhóm đang ở {held}
            <button type="button" className="underline" onClick={() => setAsking(held)}>
              Chuyển sang {held}
            </button>
          </p>
        )}
      </div>
      <SymbolScopeContext.Provider value={scope}>
        <OrderTicket key={epoch} embedded onDraftChange={onDraftChange} sideRequest={ticketRequest} fillRequest={fillRequest} />
      </SymbolScopeContext.Provider>
      <DraftDialog
        from={ticketSymbol}
        to={asking}
        onKeep={() => {
          setHeld(asking)
          setAsking(null)
        }}
        onSwitch={() => {
          if (asking) setTicketSymbol(asking)
          setEpoch((value) => value + 1)
          setHasDraft(false)
          setHeld(null)
          setAsking(null)
        }}
      />
    </div>
  )
}

/** Sổ lệnh 3 mức của mã đang chọn trong nhóm; bấm một mức thì phiếu lệnh cùng nhóm điền giá đó. */
function DepthBody() {
  const { symbol, pickPrice } = useSymbolScope()
  const quote = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol))
  const session = useMarketStore((state) => state.session)
  const loading = useMarketStore((state) => state.received_at === 0)
  return <OrderBook3 quote={quote} session={session} loading={loading} onPickPrice={pickPrice} />
}

/** Sổ lệnh: mặc định lọc theo mã của nhóm (đổi mã ở ô lọc là đổi mã của cả nhóm), bỏ chọn để xem mọi mã. */
function BlotterBody({ panelId }: { panelId: string }) {
  const { symbol, setSymbol, openOrder, orderId } = useSymbolScope()
  const [follow, setFollow] = useState(true)
  const id = `follow-${panelId}`
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Checkbox id={id} checked={follow} onCheckedChange={(state) => setFollow(state === true)} aria-labelledby={`${id}-label`} />
        <Label id={`${id}-label`} htmlFor={id}>
          Chỉ lệnh của mã {symbol} (theo nhóm)
        </Label>
      </div>
      <OrderBlotter
        followSymbol={follow ? symbol : null}
        onFollowSymbolChange={(next) => (next ? setSymbol(next) : setFollow(false))}
        onOpenOrder={openOrder}
        selectedOrderId={orderId}
      />
    </div>
  )
}

function AlgosBody() {
  const { openOrder, orderId } = useSymbolScope()
  return <OrderBlotter runningOnly onOpenOrder={openOrder} selectedOrderId={orderId} />
}

function OrderDetailBody() {
  const { orderId } = useSymbolScope()
  if (!orderId) {
    return (
      <EmptyState
        icon={MousePointerClick}
        title="Chưa chọn lệnh"
        description="Bấm mã lệnh ở panel Sổ lệnh, Thuật toán đang chạy hoặc Thông báo cùng nhóm để xem chi tiết ở đây."
      />
    )
  }
  return <OrderDetailView key={orderId} id={orderId} embedded />
}

function NotificationsBody() {
  const { openOrder } = useSymbolScope()
  return <NotificationList onOpen={(orderId) => openOrder?.(orderId)} />
}

/** Nội dung từng loại panel: component có sẵn của các màn, không viết lại. */
function PanelBody({ kind, panelApi, params }: { kind: PanelKind; panelApi: DockviewPanelApi; params: PanelParams }) {
  const panelId = panelApi.id
  switch (kind) {
    case 'watchlist':
      return <PriceBoardTable />
    case 'ticket':
      return <TicketBody panelApi={panelApi} params={params} />
    case 'depth':
      return <DepthBody />
    case 'blotter':
      return <BlotterBody panelId={panelId} />
    case 'order-detail':
      return <OrderDetailBody />
    case 'algos':
      return <AlgosBody />
    case 'notifications':
      return <NotificationsBody />
  }
}

function makePanel(kind: PanelKind): FunctionComponent<IDockviewPanelProps<PanelParams>> {
  function WorkspacePanel({ api, params }: IDockviewPanelProps<PanelParams>) {
    return (
      <PanelFrame kind={kind} panelId={api.id}>
        <PanelScope panelApi={api} params={params}>
          <PanelBody kind={kind} panelApi={api} params={params} />
        </PanelScope>
      </PanelFrame>
    )
  }
  WorkspacePanel.displayName = `WorkspacePanel(${kind})`
  return WorkspacePanel
}

/** Bảng `components` cho DockviewReact: khóa là loại panel (lưu trong bố cục JSON). */
export const PANEL_COMPONENTS: Record<PanelKind, FunctionComponent<IDockviewPanelProps<PanelParams>>> = Object.fromEntries(
  PANEL_KIND_ORDER.map((kind) => [kind, makePanel(kind)]),
) as Record<PanelKind, FunctionComponent<IDockviewPanelProps<PanelParams>>>
