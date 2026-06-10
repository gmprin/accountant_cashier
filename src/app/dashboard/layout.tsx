import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Sidebar from '@/components/layout/Sidebar'
import { runAutoCharges } from '@/lib/autoCharges'

async function getServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || !profile.is_active) {
    redirect('/auth/login')
  }

  if (profile.role !== 'viewer') {
    try {
      await runAutoCharges(supabase)
    } catch(e) {}
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar user={profile} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
