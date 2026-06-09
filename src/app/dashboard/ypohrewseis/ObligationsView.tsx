'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatMoney, formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import clsx from 'clsx'

const OBL_TYPES = [
  { value: 'fixed', label: 'Σταθερή (τελευταία εργάσιμη μήνα)' },
  { value: 'periodic', label: 'Περιοδική (ορισμένη ημερομηνία)' },
  { value: 'employee', label: 'Μισθοδοσία υπαλλήλου' },
]

const RECURRENCES = [
  { value: 'monthly', label: 'Μηνιαία' },
  { value: 'quarterly', label: 'Τριμηνιαία' },
  { value: 'yearly', label: 'Ετήσια' },
  { value: 'once', label: 'Εφάπαξ' },
]

interface Props {
  obligations: any[]
  userRole: string
}

export default function ObligationsView({ obligations, userRole }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole !== 'viewer'
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('')

  const [form, setForm] = useState({
    name: '', obligation_type: 'fixed', amount: '',
    employee_name: '', due_day: '', due_month: '',
    recurrence: 'monthly', next_due_date: '',
  })

  const filtered = filter
    ? obligations.filter(o => o.obligation_type === filter)
    : obligations

  function typeLabel(t: string) {
    return { fixed: 'Σταθερή', periodic: 'Περιοδική', employee: 'Μισθοδοσία' }[t] || t
  }
  function typeBadge(t: string) {
    return { fixed: 'badge-blue', periodic: 'badge-purple', employee: 'badge-amber' }[t] || 'badge-gray'
  }
  function recLabel(r: string) {
    return { monthly: 'Μηνιαία', quarterly: 'Τριμην.', yearly: 'Ετήσια', once: 'Εφάπαξ' }[r] || r
  }

  async function handleSave() {
    if (!form.name) { toast.error('Συμπλήρωσε όνομα'); return }
    const payload: any = {
      name: form.name,
      obligation_type: form.obligation_type,
      amount: parseFloat(form.amount) || 0,
      recurrence: form.recurrence,
      employee_name: form.obligation_type === 'employee' ? form.employee_name : null,
      due_day: form.due_day ? parseInt(form.due_day) : null,
      due_month: form.due_month ? parseInt(form.due_month) : null,
      next_due_date: form.next_due_date || null,
    }
    const { error } = await supabase.from('obligations').insert(payload)
    if (error) { toast.error(error.message); return }
    toast.success('Η υποχρέωση προστέθηκε')
    setShowForm(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('Αρχειοθέτηση υποχρέωσης;')) return
    await supabase.from('obligations').update({ is_active: false }).eq('id', id)
    toast.success('Αρχειοθετήθηκε')
    router.refresh()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {['', 'fixed', 'periodic', 'employee'].map(f => (
            <button
              key={f}
              className={clsx('btn btn-sm', filter === f ? 'btn-primary' : 'btn-secondary')}
              onClick={() => setFilter(f)}
            >
              {f === '' ? 'Όλες' : typeLabel(f)}
            </button>
          ))}
        </div>
        {canEdit && (
          <button className="btn-primary btn-sm ml-auto" onClick={() => setShowForm(true)}>
            + Νέα υποχρέωση
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Υποχρέωση</th>
                <th className="table-header w-28">Τύπος</th>
                <th className="table-header w-24">Επανάληψη</th>
                <th className="table-header w-28 text-right">Ποσό</th>
                <th className="table-header w-28 text-right">Πληρωθέν</th>
                <th className="table-header w-28">Επόμ. λήξη</th>
                {canEdit && <th className="table-header w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(obl => (
                <tr key={obl.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">
                    {obl.employee_name || obl.name}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${typeBadge(obl.obligation_type)}`}>{typeLabel(obl.obligation_type)}</span>
                  </td>
                  <td className="table-cell text-xs text-gray-500">{recLabel(obl.recurrence)}</td>
                  <td className="table-cell text-right">{obl.amount > 0 ? formatMoney(obl.amount) : '—'}</td>
                  <td className="table-cell text-right text-green-600 font-medium">{formatMoney(obl.total_paid || 0)}</td>
                  <td className="table-cell text-xs">
                    {obl.next_due_date
                      ? <span className={new Date(obl.next_due_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          {formatDate(obl.next_due_date)}
                        </span>
                      : '—'
                    }
                  </td>
                  {canEdit && (
                    <td className="table-cell">
                      <button
                        onClick={() => handleDelete(obl.id)}
                        className="text-gray-300 hover:text-red-500 text-lg leading-none"
                      >×</button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-10">Δεν υπάρχουν υποχρεώσεις</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title="Νέα υποχρέωση" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Τύπος</label>
              <select className="select" value={form.obligation_type} onChange={e => setForm(f => ({ ...f, obligation_type: e.target.value }))}>
                {OBL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{form.obligation_type === 'employee' ? 'Ονοματεπώνυμο υπαλλήλου' : 'Όνομα υποχρέωσης'}</label>
              <input className="input" value={form.obligation_type === 'employee' ? form.employee_name : form.name}
                onChange={e => setForm(f => form.obligation_type === 'employee' ? { ...f, employee_name: e.target.value, name: e.target.value } : { ...f, name: e.target.value })}
                placeholder="..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ποσό (€) — 0 = ορίζεται κατά πληρωμή</label>
                <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" step="0.01" />
              </div>
              <div>
                <label className="label">Επανάληψη</label>
                <select className="select" value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>
                  {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            {form.obligation_type === 'periodic' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Επόμενη ημ. λήξης</label>
                  <input type="date" className="input" value={form.next_due_date} onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn-primary btn-sm" onClick={handleSave}>Αποθήκευση</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Ακύρωση</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
