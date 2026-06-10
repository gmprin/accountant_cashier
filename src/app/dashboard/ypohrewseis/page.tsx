'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const OBL_TYPES = [
  { value: 'fixed', label: 'Σταθερή (τελευταία εργάσιμη μήνα)' },
  { value: 'periodic', label: 'Περιοδική (ορισμένη ημερομηνία)' },
  { value: 'employee', label: 'Μισθοδοσία υπαλλήλου' },
]

const emptyForm = { name: '', obligation_type: 'fixed', amount: '', employee_name: '', recurrence: 'monthly', next_due_date: '' }

export default function YpohrewseisPage() {
  const supabase = createClient()
  const [obligations, setObligations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingObl, setEditingObl] = useState<any>(null)
  const [form, setForm] = useState<any>({...emptyForm})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('obligations').select('*').eq('is_active', true).order('name')
    const withPaid = await Promise.all((data||[]).map(async o => {
      const { data: p } = await supabase.from('obligation_payments').select('amount').eq('obligation_id', o.id)
      return { ...o, total_paid: (p||[]).reduce((s:number,x:any)=>s+x.amount,0) }
    }))
    setObligations(withPaid); setLoading(false)
  }

  function typeLabel(t: string) { return { fixed: 'Σταθερή', periodic: 'Περιοδική', employee: 'Μισθοδοσία' }[t]||t }
  function typeBadge(t: string) { return { fixed: 'badge-blue', periodic: 'badge-purple', employee: 'badge-amber' }[t]||'badge-gray' }
  function recLabel(r: string) { return { monthly: 'Μηνιαία', quarterly: 'Τριμην.', yearly: 'Ετήσια', once: 'Εφάπαξ' }[r]||r }

  function openNew() { setEditingObl(null); setForm({...emptyForm}); setShowForm(true) }
  function openEdit(o: any) {
    setEditingObl(o)
    setForm({ name: o.name, obligation_type: o.obligation_type, amount: o.amount?.toString()||'', employee_name: o.employee_name||'', recurrence: o.recurrence||'monthly', next_due_date: o.next_due_date||'' })
    setShowForm(true)
  }

  async function handleSave() {
    const nm = form.obligation_type==='employee' ? form.employee_name : form.name
    if (!nm) { toast.error('Συμπλήρωσε όνομα'); return }
    const payload: any = {
      name: nm, obligation_type: form.obligation_type,
      amount: parseFloat(form.amount)||0, recurrence: form.recurrence,
      employee_name: form.obligation_type==='employee' ? form.employee_name : null,
      next_due_date: form.next_due_date||null,
    }
    let error
    if (editingObl) {
      ({ error } = await supabase.from('obligations').update(payload).eq('id', editingObl.id))
    } else {
      ({ error } = await supabase.from('obligations').insert(payload))
    }
    if (error) { toast.error(error.message); return }
    toast.success(editingObl ? 'Ενημερώθηκε' : 'Η υποχρέωση προστέθηκε')
    setShowForm(false); setEditingObl(null); loadData()
  }

  async function handleDelete(id: number) {
    if (!confirm('Αρχειοθέτηση υποχρέωσης;')) return
    await supabase.from('obligations').update({ is_active: false }).eq('id', id)
    toast.success('Αρχειοθετήθηκε'); loadData()
  }

  const filtered = filter ? obligations.filter(o=>o.obligation_type===filter) : obligations

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div><h1 className="page-title">Υποχρεώσεις</h1><p className="text-xs text-gray-400 mt-0.5">Σταθερές, περιοδικές και μισθοδοσία</p></div>
        <button className="btn-primary btn-sm" onClick={openNew}>+ Νέα υποχρέωση</button>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          {['','fixed','periodic','employee'].map(f=>(
            <button key={f} className={clsx('btn btn-sm',filter===f?'btn-primary':'btn-secondary')} onClick={()=>setFilter(f)}>
              {f===''?'Όλες':typeLabel(f)}
            </button>
          ))}
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr>
                <th className="table-header">Υποχρέωση</th>
                <th className="table-header w-28">Τύπος</th>
                <th className="table-header w-24">Επανάληψη</th>
                <th className="table-header w-28 text-right">Ποσό</th>
                <th className="table-header w-28 text-right">Πληρωθέν</th>
                <th className="table-header w-28">Επόμ. λήξη</th>
                <th className="table-header w-20"></th>
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={7} className="table-cell text-center text-gray-400 py-10">Φόρτωση...</td></tr>
                :filtered.map(o=>(
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{o.employee_name||o.name}</td>
                    <td className="table-cell"><span className={`badge ${typeBadge(o.obligation_type)}`}>{typeLabel(o.obligation_type)}</span></td>
                    <td className="table-cell text-xs text-gray-500">{recLabel(o.recurrence)}</td>
                    <td className="table-cell text-right">{o.amount>0?formatMoney(o.amount):'—'}</td>
                    <td className="table-cell text-right text-green-600 font-medium">{formatMoney(o.total_paid||0)}</td>
                    <td className="table-cell text-xs">{o.next_due_date?<span className={new Date(o.next_due_date)<new Date()?'text-red-600 font-medium':'text-gray-500'}>{formatDate(o.next_due_date)}</span>:'—'}</td>
                    <td className="table-cell">
                      <button className="text-xs text-blue-500 hover:text-blue-700 mr-2" onClick={()=>openEdit(o)}>✎</button>
                      <button className="text-gray-300 hover:text-red-500 text-lg leading-none" onClick={()=>handleDelete(o.id)}>×</button>
                    </td>
                  </tr>
                ))}
                {!loading&&filtered.length===0&&<tr><td colSpan={7} className="table-cell text-center text-gray-400 py-10">Δεν υπάρχουν υποχρεώσεις</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <Modal title={editingObl?`Επεξεργασία: ${editingObl.employee_name||editingObl.name}`:'Νέα υποχρέωση'} onClose={()=>{setShowForm(false);setEditingObl(null)}}>
          <div className="space-y-4">
            <div><label className="label">Τύπος</label>
              <select className="select" value={form.obligation_type} onChange={e=>setForm((f:any)=>({...f,obligation_type:e.target.value}))}>
                {OBL_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="label">{form.obligation_type==='employee'?'Ονοματεπώνυμο υπαλλήλου':'Όνομα υποχρέωσης'}</label>
              <input className="input" value={form.obligation_type==='employee'?form.employee_name:form.name}
                onChange={e=>setForm((f:any)=>form.obligation_type==='employee'?{...f,employee_name:e.target.value,name:e.target.value}:{...f,name:e.target.value})} placeholder="..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Ποσό (€) — 0 = κατά πληρωμή</label><input type="number" className="input" value={form.amount} onChange={e=>setForm((f:any)=>({...f,amount:e.target.value}))} placeholder="0.00" step="0.01" /></div>
              <div><label className="label">Επανάληψη</label>
                <select className="select" value={form.recurrence} onChange={e=>setForm((f:any)=>({...f,recurrence:e.target.value}))}>
                  <option value="monthly">Μηνιαία</option><option value="quarterly">Τριμηνιαία</option><option value="yearly">Ετήσια</option><option value="once">Εφάπαξ</option>
                </select>
              </div>
            </div>
            {form.obligation_type==='periodic'&&(
              <div><label className="label">Επόμενη ημ. λήξης</label><input type="date" className="input" value={form.next_due_date} onChange={e=>setForm((f:any)=>({...f,next_due_date:e.target.value}))} /></div>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn-primary btn-sm" onClick={handleSave}>{editingObl?'Αποθήκευση αλλαγών':'Αποθήκευση'}</button>
              <button className="btn-secondary btn-sm" onClick={()=>{setShowForm(false);setEditingObl(null)}}>Ακύρωση</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
