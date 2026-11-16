import { describe, expect, it } from 'vitest'
import { TOUR_STEPS } from './tourSteps'
import { hasSeenTour, markTourDone, shouldStartTour, tourKey } from './tourState'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
}

const broken = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('tour lần đầu', () => {
  it('chạy một lần cho mỗi vai trò', () => {
    const storage = memoryStorage()
    expect(shouldStartTour('CUSTOMER', false, storage)).toBe(true)
    markTourDone('CUSTOMER', storage)
    expect(shouldStartTour('CUSTOMER', false, storage)).toBe(false)
    // Vai trò khác vẫn có tour riêng.
    expect(shouldStartTour('OPS', false, storage)).toBe(true)
    expect(shouldStartTour('DEALER', false, storage)).toBe(true)
  })

  it('bỏ qua (cũng ghi đã xem) thì không hiện lại', () => {
    const storage = memoryStorage()
    markTourDone('OPS', storage)
    expect(storage.getItem(tourKey('OPS'))).toBe('done')
    expect(hasSeenTour('OPS', storage)).toBe(true)
    expect(shouldStartTour('OPS', false, storage)).toBe(false)
  })

  it('không chạy khi đang Demo, kể cả lần đầu', () => {
    const storage = memoryStorage()
    expect(shouldStartTour('OPS', true, storage)).toBe(false)
    // Demo không ghi đã xem: thoát Demo lần sau vẫn có tour.
    expect(shouldStartTour('OPS', false, storage)).toBe(true)
  })

  it('chưa đăng nhập thì không chạy', () => {
    expect(shouldStartTour(undefined, false, memoryStorage())).toBe(false)
  })

  it('localStorage bị chặn: không ném lỗi, không tự hiện để khỏi lặp lại mỗi lần', () => {
    expect(() => markTourDone('OPS', broken)).not.toThrow()
    expect(shouldStartTour('OPS', false, broken)).toBe(false)
  })

  it('5 bước, mỗi bước có phần tử tô sáng và 1–2 câu', () => {
    expect(TOUR_STEPS).toHaveLength(5)
    for (const step of TOUR_STEPS) {
      expect(step.targets.length).toBeGreaterThan(0)
      const sentences = step.body.split(/\.\s|\.$/).filter((part) => part.trim() !== '')
      expect(sentences.length, step.title).toBeLessThanOrEqual(2)
    }
  })
})
