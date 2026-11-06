export type Role = 'CUSTOMER' | 'DEALER' | 'OPS'

export interface DemoUser {
  username: string
  display_name: string
  role: Role
  /** Khách hàng có một tài khoản; dealer có nhiều tài khoản. */
  accounts: string[]
}
