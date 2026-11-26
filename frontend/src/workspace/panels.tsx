/* eslint-disable react-refresh/only-export-components -- registry: bảng tra loại panel → component, không phải module component */
import type { DockviewPanelApi, IDockviewPanelProps } from 'dockview-react'
import { MousePointerClick } from 'lucide-react'
import { useMemo, useState, type FunctionComponent, type ReactNode } from 'react'
import { NotificationList } from '@/components/layout/NotificationList'
import { OrderBook3 } from '@/components/OrderBook3'
import { EmptyState } from '@/components/states'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { OrderBlotter } from '@/pages/OrderBook/OrderBlotter'
import { OrderDetailView } from '@/pages/OrderDetail/OrderDetailView'
import { OrderTicket } from '@/pages/PlaceOrder/OrderTicket'
import { PriceBoardTable } from '@/pages/PlaceOrder/PriceBoard'
import { PanelFrame } from '@/pages/Workspace/PanelFrame'
import { useMarketStore } from '@/store/market.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { PANEL_KIND_ORDER, type LinkGroup, type PanelKind, type PanelParams } from './panelTypes'
import { SymbolScopeContext, useSymbolScope, type SymbolScope } from './symbolScope'
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
function PanelBody({ kind, panelId }: { kind: PanelKind; panelId: string }) {
  switch (kind) {
    case 'watchlist':
      return <PriceBoardTable />
    case 'ticket':
      return <OrderTicket embedded />
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
          <PanelBody kind={kind} panelId={api.id} />
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
