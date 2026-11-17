import { BookOpen, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GLOSSARY } from '@/config/glossary'
import { normalizeVi } from '@/utils/text'

/** Trang tra cứu thuật ngữ: ô lọc không dấu, mỗi mục có nghĩa ngắn, giải thích và công thức. */
export default function Glossary() {
  // Mở từ hộp tìm nhanh: ?q=<thuật ngữ> điền sẵn ô lọc.
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const entries = useMemo(() => {
    const needle = normalizeVi(query)
    const sorted = GLOSSARY.toSorted((a, b) => a.term.localeCompare(b.term, 'vi'))
    if (needle === '') return sorted
    return sorted.filter((entry) => normalizeVi(`${entry.term} ${entry.id} ${entry.short} ${entry.detail}`).includes(needle))
  }, [query])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Thuật ngữ</h1>
        <p className="text-muted-foreground text-sm">
          Tra nghĩa các thuật ngữ dùng trong OMS. Ở các màn khác, chữ có gạch chân chấm cũng mở được giải thích này khi rê chuột hoặc
          bấm Tab.
        </p>
      </div>
      <div className="relative max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Lọc thuật ngữ, ví dụ: gia tran, vwap"
          aria-label="Lọc thuật ngữ"
          className="pl-8"
        />
      </div>
      <p className="text-muted-foreground text-xs" role="status">
        {entries.length}/{GLOSSARY.length} thuật ngữ
      </p>
      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Không có thuật ngữ nào khớp"
          description="Thử từ khóa ngắn hơn, gõ không dấu cũng được (ví dụ: gia tran)."
          action={
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>
              Xóa từ khóa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <Card key={entry.id} id={`thuat-ngu-${entry.id}`} data-demo-id={`glossary-${entry.id}`}>
              <CardHeader>
                <CardTitle>
                  <h2>{entry.term}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="font-medium">{entry.short}</p>
                <p className="text-muted-foreground">{entry.detail}</p>
                {entry.formula && (
                  <p className="bg-muted rounded-md px-2 py-1 font-mono text-xs">
                    <span className="sr-only">Công thức: </span>
                    {entry.formula}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
