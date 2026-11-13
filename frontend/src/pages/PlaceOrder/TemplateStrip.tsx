import { LayoutTemplate, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { STRATEGIES } from '@/config/strategies'
import type { StrategyTemplate } from '@/config/strategyTemplates'
import { cn } from '@/lib/utils'

interface TemplateStripProps {
  templates: StrategyTemplate[]
  activeId: string | null
  onSelect: (template: StrategyTemplate) => void
  onClear: () => void
}

/** Dải thẻ mẫu phía trên form: bấm một thẻ để điền sẵn loại lệnh và tham số. Không tự đặt lệnh. */
export function TemplateStrip({ templates, activeId, onSelect, onClear }: TemplateStripProps) {
  if (templates.length === 0) return null
  return (
    <section aria-label="Mẫu chiến lược" data-demo-id="template-strip" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <LayoutTemplate className="size-3.5" aria-hidden />
          Mẫu một chạm
        </h3>
        {activeId ? (
          <Button type="button" size="xs" variant="ghost" onClick={onClear}>
            <X aria-hidden />
            Bỏ chọn mẫu
          </Button>
        ) : (
          <Link to="/mau-chien-luoc" className="text-muted-foreground text-xs underline-offset-2 hover:underline">
            Xem tất cả
          </Link>
        )}
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="list">
        {templates.map((template) => {
          const active = template.id === activeId
          return (
            <button
              key={template.id}
              type="button"
              role="listitem"
              data-demo-id={`template-${template.id}`}
              aria-pressed={active}
              title={template.description}
              onClick={() => onSelect(template)}
              className={cn(
                'bg-muted/40 hover:bg-accent focus-visible:ring-ring flex w-36 shrink-0 flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left outline-none focus-visible:ring-2',
                active && 'border-primary bg-primary/10 ring-primary ring-1',
              )}
            >
              <span className="line-clamp-1 text-xs font-medium">{template.name}</span>
              <span className="text-muted-foreground text-[11px]">
                {STRATEGIES[template.strategy_type].label}
                {template.side ? ` · ${template.side === 'BUY' ? 'Mua' : 'Bán'}` : ''}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
