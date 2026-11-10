import { Link } from 'react-router-dom'
import type { ActivityItem } from '@/utils/dashboard'

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <li key={item.event_id} className="border-border flex gap-3 border-b py-2 text-sm last:border-b-0">
          <span className="text-muted-foreground shrink-0 tabular-nums">{item.time}</span>
          <Link to={`/so-lenh/${item.parent_order_id}`} className="hover:text-primary min-w-0 break-words">
            {item.description}
          </Link>
        </li>
      ))}
    </ol>
  )
}
