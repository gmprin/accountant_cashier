import { createServerSupabaseClient } from '@/lib/supabase'
import PageHeader from '@/components/layout/PageHeader'
import ClientsView from './ClientsView'

export default async function PelatesPage({
  searchParams
}: {
  searchParams: { tab?: string; search?: string; year?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const tab = searchParams.tab || 'hond'
  const year = parseInt(searchParams.year || new Date().getFullYear().toString())

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role, id')
    .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  // Υπολογισμός υπολοίπων
  const clientsWithBalance = await Promise.all(
    (clients || []).map(async (client) => {
      const { data: bal } = await supabase.rpc('get_client_balance', {
        p_client_id: client.id,
        p_year: null
      })
      return { ...client, current_balance: bal || 0 }
    })
  )

  return (
    <div>
      <PageHeader title="Πελάτες" subtitle={`${clients?.length || 0} συνολικά`} />
      <ClientsView
        clients={clientsWithBalance}
        tab={tab}
        year={year}
        userRole={userProfile?.role || 'viewer'}
        userId={userProfile?.id || ''}
      />
    </div>
  )
}
