import { useParams } from 'react-router-dom'
import { OrderDetailView } from './OrderDetailView'

export default function OrderDetail() {
  const { id = '' } = useParams()
  return <OrderDetailView id={id} />
}
