import { describe, expect, it } from 'vitest'
import { copyStyles, mirrorDocument, syncRootAttributes, type AttributeHost, type MirrorDocuments } from './windowMirror'

/** <html> giả: đủ attributes / get / set / remove / style.colorScheme. */
function fakeRoot(initial: Record<string, string> = {}, colorScheme = ''): AttributeHost & Node {
  const map = new Map(Object.entries(initial))
  return {
    get attributes() {
      return [...map].map(([name, value]) => ({ name, value }))
    },
    getAttribute: (name: string) => map.get(name) ?? null,
    setAttribute: (name: string, value: string) => void map.set(name, value),
    removeAttribute: (name: string) => void map.delete(name),
    style: { colorScheme },
  } as unknown as AttributeHost & Node
}

/** Node style giả: <style>, <link rel=stylesheet>, hoặc phần tử khác. */
function styleNode(tag: string, attrs: Record<string, string> = {}, text = '') {
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    text,
    getAttribute: (name: string) => attrs[name] ?? null,
    cloneNode() {
      return styleNode(tag, attrs, text)
    },
  } as unknown as Node
}

function fakeHead(initial: Node[] = []) {
  const children: Node[] = [...initial]
  return {
    childNodes: children,
    appendChild: (node: Node) => (children.push(node), node),
  }
}

/** MutationObserver giả: ghi lại mục tiêu, phát bản ghi bằng tay. */
function fakeObserverClass() {
  const instances: Array<{ target: unknown; options: MutationObserverInit; callback: MutationCallback; connected: boolean }> = []
  class FakeObserver {
    private entry
    constructor(callback: MutationCallback) {
      this.entry = { target: null as unknown, options: {} as MutationObserverInit, callback, connected: false }
      instances.push(this.entry)
    }
    observe(target: unknown, options: MutationObserverInit) {
      this.entry.target = target
      this.entry.options = options
      this.entry.connected = true
    }
    disconnect() {
      this.entry.connected = false
    }
  }
  const fire = (target: unknown, record: Partial<MutationRecord> = {}) => {
    for (const instance of instances) {
      if (instance.connected && instance.target === target) instance.callback([record as MutationRecord], {} as MutationObserver)
    }
  }
  return { FakeObserver, fire, instances }
}

describe('phản chiếu thuộc tính theme của <html>', () => {
  it('chép mọi data-*, lang, color-scheme; gỡ data-* nguồn đã bỏ; không đụng thuộc tính khác', () => {
    const from = fakeRoot({ 'data-theme': 'light', 'data-palette': 'cvd', 'data-font-scale': '110', lang: 'vi', class: 'x' }, 'light')
    const to = fakeRoot({ 'data-theme': 'dark', 'data-density': 'compact', id: 'giu-nguyen' }, 'dark')
    syncRootAttributes(from, to)
    expect(to.getAttribute('data-theme')).toBe('light')
    expect(to.getAttribute('data-palette')).toBe('cvd')
    expect(to.getAttribute('data-font-scale')).toBe('110')
    expect(to.getAttribute('lang')).toBe('vi')
    expect(to.getAttribute('data-density')).toBeNull()
    expect(to.getAttribute('class')).toBeNull()
    expect(to.getAttribute('id')).toBe('giu-nguyen')
    expect(to.style.colorScheme).toBe('light')
  })
})

describe('mirrorDocument', () => {
  function setup() {
    const { FakeObserver, fire, instances } = fakeObserverClass()
    const source: MirrorDocuments = { documentElement: fakeRoot({ 'data-theme': 'dark' }, 'dark'), head: fakeHead() as never }
    const target: MirrorDocuments = { documentElement: fakeRoot(), head: fakeHead() as never }
    const stop = mirrorDocument(source, target, { MutationObserver: FakeObserver })
    return { source, target, stop, fire, instances }
  }

  it('chép ngay khi mở và mỗi khi cửa sổ chính đổi theme', () => {
    const { source, target, fire } = setup()
    expect(target.documentElement.getAttribute('data-theme')).toBe('dark')
    source.documentElement.setAttribute('data-theme', 'hc-light')
    source.documentElement.style.colorScheme = 'light'
    fire(source.documentElement, { type: 'attributes' })
    expect(target.documentElement.getAttribute('data-theme')).toBe('hc-light')
    expect(target.documentElement.style.colorScheme).toBe('light')
  })

  it('chép <style> / <link rel=stylesheet> mới thêm ở cửa sổ chính, bỏ qua phần tử khác', () => {
    const { source, target, fire } = setup()
    const style = styleNode('style', {}, '.a{}')
    const link = styleNode('link', { rel: 'stylesheet', href: '/x.css' })
    const script = styleNode('script')
    fire(source.head, { type: 'childList', addedNodes: [style, link, script] as unknown as NodeList })
    const added = (target.head as unknown as { childNodes: Array<{ tagName: string }> }).childNodes.map((node) => node.tagName)
    expect(added).toEqual(['STYLE', 'LINK'])
  })

  it('dừng phản chiếu: không chép nữa', () => {
    const { source, target, stop, fire, instances } = setup()
    stop()
    expect(instances.every((instance) => !instance.connected)).toBe(true)
    source.documentElement.setAttribute('data-theme', 'light')
    fire(source.documentElement, { type: 'attributes' })
    expect(target.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

describe('copyStyles (cửa sổ phiếu mini)', () => {
  it('chép mọi style hiện có', () => {
    const source = { head: fakeHead([styleNode('style', {}, '.a{}'), styleNode('meta'), styleNode('link', { rel: 'stylesheet' })]) }
    const target = { head: fakeHead() }
    copyStyles(source as never, target as never)
    expect(target.head.childNodes.map((node) => (node as unknown as { tagName: string }).tagName)).toEqual(['STYLE', 'LINK'])
  })
})
