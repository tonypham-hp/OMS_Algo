import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section>
      <h1 className="text-xl font-semibold">404: Không tìm thấy trang</h1>
      <Link to="/trung-tam" className="mt-4 inline-block text-sm underline">
        Về Trung tâm lệnh
      </Link>
    </section>
  )
}
