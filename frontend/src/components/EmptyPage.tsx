/** Trang chưa làm: chỉ có tiêu đề. */
export function EmptyPage({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">Màn hình này sẽ được làm ở đợt sau.</p>
    </section>
  )
}
