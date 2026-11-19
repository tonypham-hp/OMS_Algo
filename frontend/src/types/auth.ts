export type Role = 'CUSTOMER' | 'DEALER' | 'OPS'

export interface DemoUser {
  username: string
  display_name: string
  role: Role
  /** Khách hàng có một tài khoản; dealer có nhiều tài khoản. */
  accounts: string[]
  /** Ngoài ERD (Đợt 8A): các tài khoản là nhà đầu tư nước ngoài (lệnh mua bị trừ room ngoại). */
  foreign_accounts?: string[]
}
