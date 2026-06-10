import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar user={{ id: '1', full_name: 'Admin', role: 'admin', is_active: true, created_at: '', updated_at: '' }} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
