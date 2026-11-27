// Phản chiếu theme và style từ cửa sổ chính sang cửa sổ phụ (cửa sổ tách, phiếu mini) – Đợt 10B.
// dockview chỉ chép stylesheet MỘT lần lúc mở và không chép thuộc tính của <html>; mọi token màu (tokens.css) lại đọc
// từ data-theme / data-palette trên <html>, cỡ chữ từ data-font-scale, mật độ từ data-density. File này giữ cửa sổ phụ
// luôn khớp cửa sổ chính: đổi theme, bảng màu, mật độ, cỡ chữ ở cửa sổ chính thì cửa sổ phụ đổi ngay.
// Không đụng React: các hàm nhận đối tượng tối thiểu và MutationObserver truyền vào, nên test được bằng đối tượng giả.

/** Thuộc tính của <html> phải phản chiếu (ngoài mọi data-*). */
const EXTRA_ATTRIBUTES = ['lang']

export interface AttributeHost {
  readonly attributes: ArrayLike<{ name: string; value: string }>
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  readonly style: { colorScheme: string }
}

const mirrored = (name: string) => name.startsWith('data-') || EXTRA_ATTRIBUTES.includes(name)

/**
 * Chép thuộc tính theme của <html> nguồn sang <html> đích: mọi data-* (data-theme, data-palette, data-density,
 * data-font-scale, data-flash, data-forced-colors…), lang và color-scheme; gỡ ở đích những data-* nguồn đã bỏ.
 */
export function syncRootAttributes(from: AttributeHost, to: AttributeHost) {
  const wanted = new Map<string, string>()
  for (const attribute of Array.from(from.attributes)) if (mirrored(attribute.name)) wanted.set(attribute.name, attribute.value)
  for (const attribute of Array.from(to.attributes)) {
    if (mirrored(attribute.name) && !wanted.has(attribute.name)) to.removeAttribute(attribute.name)
  }
  for (const [name, value] of wanted) if (to.getAttribute(name) !== value) to.setAttribute(name, value)
  if (to.style.colorScheme !== from.style.colorScheme) to.style.colorScheme = from.style.colorScheme
}

/** Phần tử style trong <head> cần chép sang cửa sổ phụ: <style> và <link rel="stylesheet">. */
function isStyleNode(node: Node): node is HTMLStyleElement | HTMLLinkElement {
  const element = node as Element
  if (element.nodeType !== 1) return false
  const tag = element.tagName.toLowerCase()
  return tag === 'style' || (tag === 'link' && (element.getAttribute('rel') ?? '').toLowerCase() === 'stylesheet')
}

export interface MirrorDocuments {
  documentElement: AttributeHost & Node
  head: Node & { appendChild(node: Node): Node }
}

type ObserverClass = new (callback: MutationCallback) => Pick<MutationObserver, 'observe' | 'disconnect'>

/**
 * Bắt đầu phản chiếu `source` → `target`:
 * - thuộc tính theme của <html>: chép ngay và mỗi khi đổi;
 * - <style>/<link rel=stylesheet> thêm vào <head> nguồn sau khi mở (lazy chunk, Vite HMR): chép bản sao sang đích,
 *   style đã có lúc mở thì dockview (cửa sổ tách) hoặc nơi gọi (`copyStyles`) đã chép.
 * Trả hàm dừng phản chiếu.
 */
export function mirrorDocument(
  source: MirrorDocuments,
  target: MirrorDocuments,
  { MutationObserver: Observer = globalThis.MutationObserver as unknown as ObserverClass }: { MutationObserver?: ObserverClass } = {},
): () => void {
  syncRootAttributes(source.documentElement, target.documentElement)
  const attributes = new Observer(() => syncRootAttributes(source.documentElement, target.documentElement))
  attributes.observe(source.documentElement, { attributes: true })
  const styles = new Observer((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (isStyleNode(node)) target.head.appendChild(node.cloneNode(true))
      }
    }
  })
  styles.observe(source.head, { childList: true })
  return () => {
    attributes.disconnect()
    styles.disconnect()
  }
}

/** Chép mọi style hiện có của `source` sang `target` (cho cửa sổ phiếu mini: không có dockview chép giúp). */
export function copyStyles(source: Pick<Document, 'head'>, target: Pick<Document, 'head'>) {
  for (const node of Array.from(source.head.childNodes)) if (isStyleNode(node)) target.head.appendChild(node.cloneNode(true))
}
