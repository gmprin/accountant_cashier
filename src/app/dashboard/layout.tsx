import Sidebar from '@/components/layout/Sidebar'

const defaultUser = {
  id: '',
  full_name: 'Χρήστης',
  role: 'admin' as const,
  is_active: true,
  created_at: '',
  updated_at: ''
}

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar user={defaultUser} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
