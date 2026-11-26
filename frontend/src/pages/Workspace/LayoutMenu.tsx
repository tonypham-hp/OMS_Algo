import { Check, ChevronDown, Download, LayoutTemplate, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PRESET_LABELS, type PresetId } from '@/workspace/presets'
import type { LayoutMenuState } from '@/workspace/useWorkspaceLayouts'

interface LayoutMenuProps {
  menu: LayoutMenuState
  suggestedName: string
  onSwitch: (name: string) => void
  onSaveAs: (name: string) => void
  onRemove: (name: string) => void
  onTemplate: (preset: PresetId | 'default') => void
  onExport: () => string
  onImport: (text: string) => { ok: boolean; message: string }
  onMessage: (message: string) => void
  filename: string
}

/** Menu Bố cục: đổi nhanh giữa các bố cục đã lưu, lưu thành bố cục mới, mẫu có sẵn, về mặc định, xuất / nhập JSON. */
export function LayoutMenu({ menu, suggestedName, onSwitch, onSaveAs, onRemove, onTemplate, onExport, onImport, onMessage, filename }: LayoutMenuProps) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function openNaming() {
    setName(suggestedName)
    setError(null)
    setNaming(true)
  }

  function submitName(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Vui lòng nhập tên bố cục')
    if (menu.names.includes(trimmed)) return setError('Đã có bố cục trùng tên')
    onSaveAs(trimmed)
    setNaming(false)
  }

  function download() {
    const blob = new Blob([onExport()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    onMessage(onImport(await file.text()).message)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="ws-layout-menu">
            <LayoutTemplate aria-hidden />
            Bố cục: <span className="max-w-40 truncate font-semibold">{menu.active}</span>
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Bố cục đã lưu</DropdownMenuLabel>
          {menu.names.map((layoutName) => (
            <DropdownMenuItem key={layoutName} onSelect={() => onSwitch(layoutName)} aria-current={layoutName === menu.active ? 'true' : undefined}>
              <Check aria-hidden className={layoutName === menu.active ? 'opacity-100' : 'opacity-0'} />
              <span className="truncate">{layoutName}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={openNaming}>
            <Save aria-hidden /> Lưu thành bố cục mới…
          </DropdownMenuItem>
          {menu.names.length > 1 && (
            <DropdownMenuItem onSelect={() => onRemove(menu.active)}>
              <Trash2 aria-hidden /> Xóa bố cục "{menu.active}"
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Mẫu (áp vào bố cục đang mở)</DropdownMenuLabel>
          {(Object.keys(PRESET_LABELS) as PresetId[]).map((preset) => (
            <DropdownMenuItem key={preset} onSelect={() => onTemplate(preset)}>
              <LayoutTemplate aria-hidden /> {PRESET_LABELS[preset]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => onTemplate('default')}>
            <RotateCcw aria-hidden /> Về mặc định
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={download}>
            <Download aria-hidden /> Xuất file JSON
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <Upload aria-hidden /> Nhập file JSON…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Chọn file bố cục JSON"
        data-testid="ws-import-input"
        onChange={(event) => void importFile(event.target.files?.[0])}
      />

      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent>
          <form onSubmit={submitName} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Lưu thành bố cục mới</DialogTitle>
              <DialogDescription>Ví dụ: "Phiên sáng", "Theo dõi HUNT". Bố cục lưu riêng cho tài khoản này.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-layout-name">Tên bố cục</Label>
              <Input
                id="ws-layout-name"
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={error !== null}
                aria-describedby={error ? 'ws-layout-name-error' : undefined}
                autoFocus
              />
              {error && (
                <p id="ws-layout-name-error" className="text-status-danger text-xs" role="alert">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNaming(false)}>
                Hủy
              </Button>
              <Button type="submit">Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
