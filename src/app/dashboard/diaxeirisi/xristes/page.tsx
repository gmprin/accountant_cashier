import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import UsersView from './UsersView'

export default async function XristesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user?.id || '')
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('full_name')

  return (
    <div>
      <PageHeader title="Διαχείριση χρηστών" subtitle="Μόνο admin" />
      <UsersView users={users || []} currentUserId={user?.id || ''} />
    </div>
  )
}
