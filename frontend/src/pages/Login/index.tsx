import { useMutation, useQuery } from '@tanstack/react-query'
import { GitBranch, RefreshCcw, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getAccessibleLabels } from '@/config/navigation'
import { ROLE_LABELS } from '@/config/permissions'
import { cn } from '@/lib/utils'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/auth.store'
import type { DemoUser } from '@/types'

/** Ba tài khoản chính trên màn đăng nhập. Tài khoản còn lại (người duyệt thứ hai) hiện ở dòng nhỏ bên dưới. */
const PRIMARY_USERNAMES = ['khachhang', 'dealer', 'vanhanh']

const FEATURES: ReadonlyArray<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: GitBranch,
    title: 'Cây lệnh cha – con',
    description: 'Mỗi lệnh thuật toán tách thành lệnh con theo chiến lược; xem được từng lệnh con, từng lần khớp.',
  },
  {
    icon: RefreshCcw,
    title: 'Đối soát tự động',
    description: 'Mất phản hồi từ Core thì lệnh con giữ trạng thái chưa rõ rồi tự đối soát; báo khớp trùng bị bỏ qua.',
  },
  {
    icon: ShieldCheck,
    title: 'Đúng luật HOSE',
    description: 'Biên độ ±7%, bước giá, lô 100, phiên ATO/ATC được kiểm ngay khi nhập và trong engine.',
  },
]

function AccountCard({ user, selected, onSelect }: { user: DemoUser; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'bg-card flex w-full flex-col gap-1 rounded-lg border p-4 text-left transition-colors',
        selected ? 'border-primary ring-primary/40 ring-1' : 'border-border hover:border-border-strong',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium">{user.username}</span>
        <span className={cn('rounded px-2 py-0.5 text-xs', selected ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {ROLE_LABELS[user.role]}
        </span>
      </span>
      <span className="text-muted-foreground text-xs">{user.display_name}</span>
      <span className="text-muted-foreground text-xs">Xem được: {getAccessibleLabels(user.role).join(', ')}</span>
    </button>
  )
}

/** Trang "/" khi chưa đăng nhập, cũng là "/login": giới thiệu bên trái, chọn tài khoản demo bên phải. */
export default function Login() {
  const setUser = useAuthStore((state) => state.setUser)
  const users = useQuery({ queryKey: ['demo-users'], queryFn: authService.getDemoUsers })
  const login = useMutation({ mutationFn: authService.login, onSuccess: setUser })
  const [selected, setSelected] = useState('khachhang')
  const errorMessage = users.error?.message ?? login.error?.message

  const primary = users.data?.filter((user) => PRIMARY_USERNAMES.includes(user.username)) ?? []
  const secondary = users.data?.filter((user) => !PRIMARY_USERNAMES.includes(user.username)) ?? []
  const selectedUser = users.data?.find((user) => user.username === selected)

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.15fr_1fr]">
      <section className="bg-sidebar border-sidebar-border flex flex-col gap-10 border-b p-8 lg:border-r lg:border-b-0 lg:p-12">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md text-sm font-bold">
            A
          </span>
          <span className="text-lg font-semibold tracking-wide">ALGO OMS</span>
        </div>
        <div className="flex max-w-xl flex-col gap-4">
          <h1 className="text-3xl leading-tight font-semibold lg:text-4xl">
            Lệnh thuật toán trên HOSE, nhìn thấy từng bước.
          </h1>
          <p className="text-muted-foreground">
            Đặt Stop, OCO, Iceberg, TWAP, POV… rồi theo dõi lệnh con được sinh ra, gửi xuống Core và khớp dần, kèm cảnh
            báo khi có sự cố.
          </p>
        </div>
        <ul className="grid max-w-xl gap-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="bg-card border-border flex gap-3 rounded-lg border p-4">
              <Icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="text-muted-foreground text-sm">{description}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-auto text-xs">Bản demo · dữ liệu mô phỏng</p>
      </section>

      <section className="flex items-center justify-center p-8">
        <div className="flex w-full max-w-md flex-col gap-5">
          <div>
            <h2 className="text-2xl font-semibold">Đăng nhập</h2>
            <p className="text-muted-foreground text-sm">Chọn một tài khoản demo. Không cần mật khẩu.</p>
          </div>
          {users.isPending && <p className="text-muted-foreground text-sm">Đang tải...</p>}
          <div role="radiogroup" aria-label="Tài khoản demo" className="flex flex-col gap-3">
            {primary.map((user) => (
              <AccountCard
                key={user.username}
                user={user}
                selected={selected === user.username}
                onSelect={() => setSelected(user.username)}
              />
            ))}
          </div>
          {errorMessage && (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage}
            </p>
          )}
          <Button
            size="lg"
            className="h-11"
            disabled={!selectedUser || login.isPending}
            onClick={() => selectedUser && login.mutate(selectedUser.username)}
          >
            {login.isPending
              ? 'Đang vào...'
              : `Vào hệ thống với vai trò ${selectedUser ? ROLE_LABELS[selectedUser.role] : '…'}`}
          </Button>
          {secondary.map((user) => (
            <p key={user.username} className="text-muted-foreground text-xs">
              Người duyệt thứ hai cho cấu hình (maker-checker):{' '}
              <button
                type="button"
                className={cn('underline underline-offset-2', selected === user.username && 'text-primary font-medium')}
                aria-pressed={selected === user.username}
                onClick={() => setSelected(user.username)}
              >
                {user.username}
              </button>
            </p>
          ))}
        </div>
      </section>
    </main>
  )
}
