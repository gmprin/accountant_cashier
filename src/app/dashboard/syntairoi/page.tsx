import { createServerSupabaseClient } from '@/lib/supabase'
import PageHeader from '@/components/layout/PageHeader'
import SyntairoiView from './SyntairoiView'

export default async function SyntairoiPage() {
  const supabase = await createServerSupabaseClient()

  const { data: partners } = await supabase
    .from('partners')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const partnersWithTotals = await Promise.all(
    (partners || []).map(async (p) => {
      const { data: dists } = await supabase
        .from('partner_distributions')
        .select('amount, distribution_date, week_start, description')
        .eq('partner_id', p.id)
        .order('distribution_date', { ascending: false })
      const total = (dists || []).reduce((s: number, d: any) => s + d.amount, 0)
      return { ...p, total_received: total, distributions: dists || [] }
    })
  )

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  return (
    <div>
      <PageHeader title="Συνεταίροι" subtitle="Ιστορικό διανομών" />
      <SyntairoiView partners={partnersWithTotals} userRole={userProfile?.role || 'viewer'} />
    </div>
  )
}
