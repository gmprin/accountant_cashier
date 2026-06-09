import { createServerSupabaseClient } from '@/lib/supabase'
import PageHeader from '@/components/layout/PageHeader'
import EkkathView from './EkkathView'

export default async function EkkathPage() {
  const supabase = await createServerSupabaseClient()
  return (
    <div>
      <PageHeader title="Εκκαθάριση" subtitle="Συγκεντρωτικές αναφορές ταμείου" />
      <EkkathView />
    </div>
  )
}
