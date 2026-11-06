import { Link } from 'react-router-dom'

export default function Forbidden() {
  return (
    <section>
      <h1 className="text-xl font-semibold">403: Không có quyền truy cập</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Tài khoản của bạn không được phép xem màn hình này.
      </p>
      <Link to="/dat-lenh" className="mt-4 inline-block text-sm underline">
        Về trang đặt lệnh
      </Link>
    </section>
  )
}
