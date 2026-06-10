'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      })
      
      if (authError) {
        setError(`Σφάλμα: ${authError.message}`)
        setLoading(false)
        return
      }

      if (!data.user) {
        setError('Δεν βρέθηκε χρήστης')
        setLoading(false)
        return
      }

      // Έλεγχος profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        setError(`Σφάλμα profile: ${profileError.message}`)
        setLoading(false)
        return
      }

      if (!profile) {
        setError('Δεν βρέθηκε προφίλ χρήστη')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(`Απροσδόκητο σφάλμα: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Ταμείο Γραφείου</h1>
          <p className="text-sm text-gray-500 mt-1">Συνδεθείτε για να συνεχίσετε</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="user@logistiko.gr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Κωδικός</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={loading}
            >
              {loading ? 'Σύνδεση...' : 'Σύνδεση'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
