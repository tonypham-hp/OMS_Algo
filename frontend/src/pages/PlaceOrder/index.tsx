import { OrderTicket } from './OrderTicket'
import { PriceBoard } from './PriceBoard'

export default function PlaceOrder() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <PriceBoard />
      <OrderTicket />
    </div>
  )
}
