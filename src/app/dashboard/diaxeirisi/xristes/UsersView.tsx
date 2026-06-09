'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatDateTime, roleLabel } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { UserProfile } from '@/types'
import clsx from 'clsx'

interface Props { users: UserProfile[]; currentUserId: string }

export default function UsersView({ users, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'user', password: '' })
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!form.email || !form.full_name || !form.password) { toast.error('Συμπλήρωσε όλα τα πεδία'); return }
    setLoading(true)
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error || 'Σφάλμα'); return }
    toast.success('Ο χρήστης δημιουργήθηκε')
    setShowForm(false)
    setForm({ email: '', full_name: '', role: 'user', password: '' })
    router.refresh()
  }

  async function handleToggleActive(user: UserProfile) {
    if (user.id === currentUserId) { toast.error('Δεν μπορείς να απενεργοποιήσεις τον εαυτό σου'); return }
    await supabase.from('user_profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    toast.success(user.is_active ? 'Ανενεργός' : 'Ενεργός')
    router.refresh()
  }

  async function handleChangeRole(id: string, role: string) {
    if (id === currentUserId) { toast.error('Δεν μπορείς να αλλάξεις τον ρόλο σου'); return }
    await supabase.from('user_profiles').update({ role }).eq('id', id)
    toast.success('Ο ρόλος ενημερώθηκε')
    router.refresh()
  }

  function roleBadge(role: string) {
    return { admin: 'badge-red', user: 'badge-blue', viewer: 'badge-gray' }[role] || 'badge-gray'
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-end">
        <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Νέος χρήστης</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header">Χρήστης</th>
              <th className="table-header w-44">Email</th>
              <th className="table-header w-28">Ρόλος</th>
              <th className="table-header w-24">Κατάσταση</th>
              <th className="table-header w-20"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={clsx('hover:bg-gray-50', !u.is_active && 'opacity-50')}>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                      {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{u.full_name}</div>
                      {u.id === currentUserId && <div className="text-xs text-blue-500">Εσύ</div>}
                    </div>
                  </div>
                </td>
                <td className="table-cell text-xs text-gray-500">—</td>
                <td className="table-cell">
                  <select
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                    value={u.role}
                    onChange={e => handleChangeRole(u.id, e.target.value)}
                    disabled={u.id === currentUserId}
                  >
                    <option value="admin">Admin</option>
                    <option value="user">Χρήστης</option>
                    <option value="viewer">Θεατής</option>
                  </select>
                </td>
                <td className="table-cell">
                  <span className={clsx('badge', u.is_active ? 'badge-green' : 'badge-gray')}>
                    {u.is_active ? 'Ενεργός' : 'Ανενεργός'}
                  </span>
                </td>
                <td className="table-cell">
                  <button
                    className="text-xs text-gray-400 hover:text-gray-700"
                    onClick={() => handleToggleActive(u)}
                    disabled={u.id === currentUserId}
                  >
                    {u.is_active ? 'Απενεργ.' : 'Ενεργ.'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Νέος χρήστης" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Ονοματεπώνυμο</label>
              <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="..." />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@logistiko.gr" />
            </div>
            <div>
              <label className="label">Κωδικός</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <div>
              <label className="label">Ρόλος</label>
              <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="admin">Admin</option>
                <option value="user">Χρήστης</option>
                <option value="viewer">Θεατής</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-primary btn-sm" onClick={handleCreate} disabled={loading}>
                {loading ? 'Δημιουργία...' : 'Δημιουργία χρήστη'}
              </button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Ακύρωση</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
