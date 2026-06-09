import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import AuditView from './AuditView'

export default async function AuditPage({
  searchParams
}: {
  searchParams: { page?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user?.id || '').single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const page = parseInt(searchParams.page || '1')
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: logs, count } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Ιστορικό ενεργειών — ορατό μόνο σε admin" />
      <AuditView logs={logs || []} total={count || 0} page={page} pageSize={pageSize} />
    </div>
  )
}
