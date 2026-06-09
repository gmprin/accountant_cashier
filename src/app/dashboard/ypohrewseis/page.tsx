import { createServerSupabaseClient } from '@/lib/supabase'
import PageHeader from '@/components/layout/PageHeader'
import ObligationsView from './ObligationsView'

export default async function YpohrewseisPage() {
  const supabase = await createServerSupabaseClient()

  const { data: obligations } = await supabase
    .from('obligations')
    .select('*')
    .eq('is_active', true)
    .order('name')

  // Πληρωμές ανά υποχρέωση
  const obligationsWithBalance = await Promise.all(
    (obligations || []).map(async (obl) => {
      const { data: payments } = await supabase
        .from('obligation_payments')
        .select('amount')
        .eq('obligation_id', obl.id)
      const totalPaid = (payments || []).reduce((s: number, p: any) => s + p.amount, 0)
      return { ...obl, total_paid: totalPaid }
    })
  )

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  return (
    <div>
      <PageHeader title="Υποχρεώσεις" subtitle="Σταθερές, περιοδικές και μισθοδοσία" />
      <ObligationsView
        obligations={obligationsWithBalance}
        userRole={userProfile?.role || 'viewer'}
      />
    </div>
  )
}
