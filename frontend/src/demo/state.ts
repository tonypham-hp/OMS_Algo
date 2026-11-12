import type { ChildOrder } from '@/types'
import type { ChildRef, DemoContext, DemoEnv, DemoState } from './types'

/** Ảnh dữ liệu hiện tại của engine cho check. Mảng đọc thẳng từ engine: check chỉ đọc, không sửa. */
export function readState(env: DemoEnv, ctx: DemoContext): DemoState {
  return {
    env,
    ctx,
    orders: env.engine.listOrders(),
    children: env.engine.listChildren(),
    executions: env.engine.listExecutions(),
    events: env.engine.listEvents(),
    conditions: env.engine.listOrders().flatMap((order) => env.engine.getConditions(order.parent_order_id)),
    simSeconds: env.simulator.getState().sim_seconds,
  }
}

/** Mã lệnh cha theo tên đã lưu. Chưa có thì báo lỗi rõ ràng (kịch bản viết sai thứ tự bước). */
export function requireOrderId(ctx: DemoContext, ref: string): string {
  const id = ctx.refs[ref]
  if (!id) throw new Error(`Kịch bản chưa có lệnh "${ref}"`)
  return id
}

/** Lệnh con của một lệnh cha, theo thứ tự sinh ra. */
export function childrenOfRef(state: Pick<DemoState, 'children' | 'ctx'>, ref: string): ChildOrder[] {
  const id = state.ctx.refs[ref]
  return state.children.filter((child) => child.parent_order_id === id).sort((a, b) => a.cycle_no - b.cycle_no)
}

const OPEN_STATUSES = new Set(['ACKNOWLEDGED', 'PARTIAL_FILLED'])

export function findChild(state: Pick<DemoState, 'children' | 'ctx'>, ref: ChildRef): ChildOrder | undefined {
  const list = childrenOfRef(state, ref.order)
  if (ref.child === 'last') return list.at(-1)
  if (ref.child === 'open') return list.find((child) => OPEN_STATUSES.has(child.status))
  return list[ref.child - 1]
}

export function requireChild(state: Pick<DemoState, 'children' | 'ctx'>, ref: ChildRef): ChildOrder {
  const child = findChild(state, ref)
  if (!child) throw new Error(`Không tìm thấy lệnh con ${String(ref.child)} của lệnh "${ref.order}"`)
  return child
}

/**
 * Thay {order} bằng mã lệnh, {child:order:2} bằng mã lệnh con thứ 2 của lệnh "order" (hoặc :last, :open).
 * Trả về null nếu còn chỗ chưa thay được (lệnh, lệnh con chưa tồn tại).
 */
export function resolveTemplate(template: string, state: Pick<DemoState, 'children' | 'ctx'>): string | null {
  let missing = false
  const text = template.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const [kind, ref, which] = token.split(':')
    if (kind === 'child') {
      const index = which === 'last' || which === 'open' ? which : Number(which)
      const child = findChild(state, { order: ref, child: index })
      if (!child) missing = true
      return child?.child_order_id ?? ''
    }
    const id = state.ctx.refs[kind]
    if (!id) missing = true
    return id ?? ''
  })
  return missing ? null : text
}
