import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROLE_LABELS } from '@/config/permissions'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/auth.store'

export default function Login() {
  const setUser = useAuthStore((state) => state.setUser)
  const users = useQuery({ queryKey: ['demo-users'], queryFn: authService.getDemoUsers })
  const login = useMutation({ mutationFn: authService.login, onSuccess: setUser })
  const errorMessage = users.error?.message ?? login.error?.message

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Đăng nhập OMS</CardTitle>
          <CardDescription>Chọn một tài khoản demo. Không cần mật khẩu.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {users.isPending && <p className="text-muted-foreground text-sm">Đang tải...</p>}
          {users.data?.map((user) => (
            <Button
              key={user.username}
              variant="outline"
              className="h-auto justify-between py-3"
              disabled={login.isPending}
              onClick={() => login.mutate(user.username)}
            >
              <span className="text-left">
                <span className="block font-medium">{user.username}</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  {user.display_name}
                </span>
              </span>
              <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            </Button>
          ))}
          {errorMessage && (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
