'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, formatDate, getYearRange } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function DianomiPage() {
  const supabase = createClient()
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('partners').select('*').eq('is_active', true).order('name')
    const withDists = await Promise.all((data||[]).map(async p => {
      const { data: d } = await supabase.from('partner_distributions').select('amount,distribution_date,description').eq('partner_id', p.id).order('distribution_date', {ascending:false})
      const total = (d||[]).reduce((s:number,x:any)=>s+x.amount, 0)
      return { ...p, total_received: total, distributions: d||[] }
    }))
    setPartners(withDists); setLoading(false)
  }

  async function handleSave() {
    if (!name) { toast.error('Συμπλήρωσε όνομα'); return }
    const { error } = await supabase.from('partners').insert({ name })
    if (error) { toast.error(error.message); return }
    toast.success('Το πρόσωπο προστέθηκε')
    setShowForm(false); setName(''); loadData()
  }

  async function handleDelete(id: number) {
    if (!confirm('Αρχειοθέτηση προσώπου;')) return
    await supabase.from('partners').update({ is_active: false }).eq('id', id)
    toast.success('Αρχειοθετήθηκε'); loadData()
  }

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div><h1 className="page-title">Διανομή κερδών</h1><p className="text-xs text-gray-400 mt-0.5">Ιστορικό διανομών ανά πρόσωπο</p></div>
        <button className="btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Νέο πρόσωπο</button>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <label className="text-xs text-gray-500">Φίλτρο έτους:</label>
          <select className="select w-24 py-1 text-sm" value={filterYear} onChange={e=>setFilterYear(parseInt(e.target.value))}>
            {getYearRange(2020).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {loading ? <p className="text-center text-gray-400 py-12">Φόρτωση...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map(p => {
              const yearDists = p.distributions.filter((d:any) => new Date(d.distribution_date).getFullYear()===filterYear)
              const yearTotal = yearDists.reduce((s:number,d:any)=>s+d.amount, 0)
              const initials = p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()
              return (
                <div key={p.id} className="card space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{initials}</div>
                      <div>
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">Συνολικές διανομές: {formatMoney(p.total_received)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{filterYear}</p>
                      <p className="text-base font-bold text-amber-600">{formatMoney(yearTotal)}</p>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {yearDists.length===0
                      ? <p className="text-xs text-gray-400 text-center py-4">Δεν υπάρχουν διανομές για το {filterYear}</p>
                      : yearDists.map((d:any,i:number)=>(
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-sm">
                          <div>
                            <span className="text-gray-600">{formatDate(d.distribution_date)}</span>
                            {d.description&&<span className="text-xs text-gray-400 ml-2">{d.description}</span>}
                          </div>
                          <span className="font-medium text-amber-600">{formatMoney(d.amount)}</span>
                        </div>
                      ))
                    }
                  </div>

                  <div className="flex justify-end pt-1">
                    <button onClick={()=>handleDelete(p.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Αρχειοθέτηση</button>
                  </div>
                </div>
              )
            })}
            {partners.length===0&&<div className="col-span-2 text-center py-12 text-gray-400">Δεν υπάρχουν πρόσωπα. Προσθέστε από το κουμπί επάνω.</div>}
          </div>
        )}
      </div>

      {showForm && (
        <Modal title="Νέο πρόσωπο" onClose={()=>setShowForm(false)}>
          <div className="space-y-4">
            <div><label className="label">Ονοματεπώνυμο</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="..." autoFocus /></div>
            <div className="flex gap-2">
              <button className="btn-primary btn-sm" onClick={handleSave}>Αποθήκευση</button>
              <button className="btn-secondary btn-sm" onClick={()=>setShowForm(false)}>Ακύρωση</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
