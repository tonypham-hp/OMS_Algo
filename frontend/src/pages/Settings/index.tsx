import { RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAppearanceStore } from '@/store/appearance.store'
import { useAuthStore } from '@/store/auth.store'
import {
  DEFAULT_APPEARANCE,
  resolveAppearance,
  type AppearanceSettings,
  type Density,
  type FontScale,
  type PaletteName,
  type ThemeMode,
} from '@/theme/appearance'
import { AppearancePreview } from './AppearancePreview'

interface Choice<T> {
  value: T
  label: string
  hint?: string
}

/**
 * Một nhóm lựa chọn: radio thật (đi bằng phím mũi tên, đọc được bằng trình đọc màn hình), mỗi lựa chọn kèm xem trước.
 * `preview(value)` trả về khung xem trước của lựa chọn đó.
 */
function ChoiceGroup<T extends string | number | boolean | null>({
  name,
  legend,
  value,
  choices,
  onChange,
  preview,
}: {
  name: string
  legend: string
  value: T
  choices: Choice<T>[]
  onChange: (value: T) => void
  preview: (value: T) => ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      <div className={cn('grid gap-3', choices.length > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
        {choices.map((choice) => {
          const id = `${name}-${String(choice.value)}`
          const checked = choice.value === value
          return (
            <label
              key={id}
              htmlFor={id}
              data-testid={id}
              className={cn(
                'hover:bg-surface-hover flex cursor-pointer flex-col gap-2 rounded-lg border p-3',
                checked && 'border-primary ring-primary ring-1',
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  id={id}
                  type="radio"
                  name={name}
                  checked={checked}
                  onChange={() => onChange(choice.value)}
                  aria-labelledby={`${id}-label`}
                  aria-describedby={choice.hint ? `${id}-hint` : undefined}
                  className="accent-primary size-4"
                />
                <span id={`${id}-label`} className="text-sm font-medium">
                  {choice.label}
                </span>
              </span>
              {choice.hint && (
                <span id={`${id}-hint`} className="text-muted-foreground text-xs">
                  {choice.hint}
                </span>
              )}
              {preview(choice.value)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(state) => onChange(state === true)}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <Label id={`${id}-label`} htmlFor={id}>
          {label}
        </Label>
        <span id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </span>
      </div>
    </div>
  )
}

/** Ô giá mẫu nháy lại mỗi lần bấm "Thử", để thấy hiệu ứng (hoặc thấy nó đã tắt). */
function FlashDemo() {
  const [count, setCount] = useState(0)
  return (
    <div className="flex items-center gap-3">
      <span
        key={count}
        data-testid="flash-demo"
        className={cn('text-price-up inline-block rounded px-1 font-semibold tabular-nums', count > 0 && 'flash-up')}
      >
        {count > 0 && (
          <span aria-hidden className="flash-tick mr-0.5 text-[0.8em]">
            ↑
          </span>
        )}
        {formatNumber(101_500 + count * 100)}
      </span>
      <Button size="sm" variant="outline" onClick={() => setCount((value) => value + 1)}>
        Thử nhấp nháy
      </Button>
    </div>
  )
}

const MODE_CHOICES: Choice<ThemeMode>[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo hệ thống', hint: 'Theo cài đặt sáng/tối của hệ điều hành, tự đổi khi hệ điều hành đổi.' },
]

const CONTRAST_CHOICES: Choice<boolean | null>[] = [
  { value: null, label: 'Theo hệ thống', hint: 'Bật khi hệ điều hành yêu cầu tăng tương phản.' },
  { value: true, label: 'Bật', hint: 'Chữ và màu giá đạt tương phản ≥ 7:1, viền rõ hơn.' },
  { value: false, label: 'Tắt' },
]

const PALETTE_CHOICES: Choice<PaletteName>[] = [
  { value: 'default', label: 'Mặc định Việt Nam', hint: 'Tăng xanh lá, giảm đỏ, trần tím, sàn xanh lam, tham chiếu vàng.' },
  { value: 'cvd', label: 'Mù màu xanh–cam', hint: 'Cho người khó phân biệt đỏ – xanh lá: tăng xanh lam, giảm cam; áp cả nút Mua/Bán.' },
]

const DENSITY_CHOICES: Choice<Density>[] = [
  { value: 'comfortable', label: 'Thoáng' },
  { value: 'compact', label: 'Gọn', hint: 'Hàng bảng thấp hơn, chữ bảng nhỏ hơn: xem được nhiều dòng hơn.' },
]

const FONT_CHOICES: Choice<FontScale>[] = [
  { value: 90, label: '90%' },
  { value: 100, label: '100%' },
  { value: 110, label: '110%' },
]

/** Trang Cài đặt giao diện: mọi vai trò dùng được, lưu riêng cho từng tài khoản demo trên trình duyệt này. */
export default function Settings() {
  const user = useAuthStore((state) => state.user)
  const settings = useAppearanceStore((state) => state.settings)
  const env = useAppearanceStore((state) => state.env)
  const update = useAppearanceStore((state) => state.update)
  const themeFor = (patch: Partial<AppearanceSettings>) => resolveAppearance({ ...settings, ...patch }, env).theme

  return (
    <div className="flex flex-col gap-4" data-testid="settings-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Cài đặt giao diện</h1>
          <p className="text-muted-foreground text-sm">
            Áp dụng ngay, lưu riêng cho tài khoản {user ? <span className="font-medium">{user.username}</span> : 'này'} trên trình duyệt này.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => update(DEFAULT_APPEARANCE)}>
          <RotateCcw aria-hidden />
          Khôi phục mặc định
        </Button>
      </div>

      <Section title="Giao diện" description="Nền sáng hoặc tối. Mặc định: Tối.">
        <ChoiceGroup
          name="mode"
          legend="Giao diện"
          value={settings.mode}
          choices={MODE_CHOICES}
          onChange={(mode) => update({ mode })}
          preview={(mode) => <AppearancePreview theme={themeFor({ mode })} palette={settings.palette} />}
        />
      </Section>

      <Section title="Tương phản cao" description="Dành cho màn hình ngoài trời, máy chiếu, hoặc người cần chữ rõ hơn.">
        <ChoiceGroup
          name="contrast"
          legend="Tương phản cao"
          value={settings.highContrast}
          choices={CONTRAST_CHOICES}
          onChange={(highContrast) => update({ highContrast })}
          preview={(highContrast) => <AppearancePreview theme={themeFor({ highContrast })} palette={settings.palette} />}
        />
      </Section>

      <Section
        title="Bảng màu giá"
        description="Quy ước màu bảng giá Việt Nam là thông lệ thị trường, không phải quy định của Sở. Giá luôn kèm ký hiệu ▲ ▼ T S, không chỉ dựa vào màu."
      >
        <ChoiceGroup
          name="palette"
          legend="Bảng màu giá"
          value={settings.palette}
          choices={PALETTE_CHOICES}
          onChange={(palette) => update({ palette })}
          preview={(palette) => <AppearancePreview theme={themeFor({})} palette={palette} />}
        />
      </Section>

      <Section title="Mật độ hiển thị" description="Khoảng cách các hàng trong bảng (sổ lệnh, báo cáo, lịch sử…).">
        <ChoiceGroup
          name="density"
          legend="Mật độ hiển thị"
          value={settings.density}
          choices={DENSITY_CHOICES}
          onChange={(density) => update({ density })}
          preview={(density) => <AppearancePreview density={density} />}
        />
      </Section>

      <Section title="Cỡ chữ" description="Đổi cỡ toàn bộ chữ và khoảng cách theo tỷ lệ.">
        <ChoiceGroup
          name="font"
          legend="Cỡ chữ"
          value={settings.fontScale}
          choices={FONT_CHOICES}
          onChange={(fontScale) => update({ fontScale })}
          preview={(fontScale) => <AppearancePreview zoom={fontScale / settings.fontScale} />}
        />
      </Section>

      <Section title="Hiển thị số liệu" description="Nhấp nháy giá và che số khi trình chiếu.">
        <div className="flex flex-col gap-4">
          <Toggle
            id="flash"
            label="Nhấp nháy giá khi giá đổi"
            hint="Nền nhạt và mũi tên ↑/↓ trong 600ms. Hệ điều hành bật giảm chuyển động thì luôn tắt."
            checked={settings.flash}
            onChange={(flash) => update({ flash })}
          />
          <FlashDemo />
          <Toggle
            id="hide-sensitive"
            label="Ẩn số tiền và bps khi trình chiếu"
            hint="Che giá trị tiền, bps/slippage so với arrival hoặc VWAP, và số tài khoản (058C•••456). Chỉ đổi phần hiển thị."
            checked={settings.hideSensitive}
            onChange={(hideSensitive) => update({ hideSensitive })}
          />
          <AppearancePreview showSensitive />
        </div>
      </Section>
    </div>
  )
}
