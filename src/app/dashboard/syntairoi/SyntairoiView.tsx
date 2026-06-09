'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatMoney, formatDate, getYearRange } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

interface Props { partners: any[]; userRole: string }

export default function SyntairoiView({ partners, userRole }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = userRole === 'admin'
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [selectedPartner, setSelectedPartner] = useState<any>(null)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())

  async function handleSave() {
    if (!name) { toast.error('Συμπλήρωσε όνομα'); return }
    const { error } = await supabase.from('partners').insert({ name })
    if (error) { toast.error(error.message); return }
    toast.success('Ο συνεταίρος προστέθηκε')
    setShowForm(false)
    setName('')
    router.refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('Αρχειοθέτηση συνεταίρου;')) return
    await supabase.from('partners').update({ is_active: false }).eq('id', id)
    toast.success('Αρχειοθετήθηκε')
    router.refresh()
  }

  return (
    <div className="p-6 space-y-5">
      {isAdmin && (
        <div className="flex justify-end">
          <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Νέος συνεταίρος</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partners.map(p => {
          const yearDists = p.distributions.filter((d: any) =>
            new Date(d.distribution_date).getFullYear() === filterYear
          )
          const yearTotal = yearDists.reduce((s: number, d: any) => s + d.amount, 0)

          return (
            <div key={p.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                      {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Συνολικές διανομές</p>
                  <p className="text-base font-bold text-amber-600">{formatMoney(p.total_received)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Έτος:</label>
                <select
                  className="select w-20 py-1 text-xs"
                  value={filterYear}
                  onChange={e => setFilterYear(parseInt(e.target.value))}
                >
                  {getYearRange(2020).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="ml-auto text-sm font-semibold text-amber-600">{formatMoney(yearTotal)}</span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1">
                {yearDists.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Δεν υπάρχουν διανομές για το {filterYear}</p>
                ) : yearDists.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-sm">
                    <div>
                      <span className="text-gray-600">{formatDate(d.distribution_date)}</span>
                      {d.description && <span className="text-xs text-gray-400 ml-2">{d.description}</span>}
                    </div>
                    <span className="font-medium text-amber-600">{formatMoney(d.amount)}</span>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >Αρχειοθέτηση</button>
                </div>
              )}
            </div>
          )
        })}
        {partners.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400">Δεν υπάρχουν συνεταίροι. Προσθέστε από το κουμπί επάνω.</div>
        )}
      </div>

      {showForm && (
        <Modal title="Νέος συνεταίρος" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Ονοματεπώνυμο</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="..." autoFocus />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary btn-sm" onClick={handleSave}>Αποθήκευση</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Ακύρωση</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
