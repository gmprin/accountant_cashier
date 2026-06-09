import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { runAutoCharges } from '@/lib/autoCharges'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/auth/login')

  // Τρέξε αυτόματες χρεώσεις (μόνο αν user/admin)
  if (profile.role !== 'viewer') {
    await runAutoCharges(supabase)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar user={profile} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
