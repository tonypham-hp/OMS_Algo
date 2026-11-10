import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { routes } from './routeConfig'

const router = createBrowserRouter(routes)

export function AppRoutes() {
  return <RouterProvider router={router} />
}
