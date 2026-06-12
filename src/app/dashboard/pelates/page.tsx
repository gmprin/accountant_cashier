'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, periodLabel, calcClientAmounts, getYearRange } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import clsx from 'clsx'

const REASONS = [
  { value: 'E1', label: 'Ε1 — Φορολογική δήλωση' },
  { value: 'E2', label: 'Ε2 — Μισθώματα' },
  { value: 'E9', label: 'Ε9 — Ακίνητα' },
  { value: 'misthotirio', label: 'Υποβολή μισθωτηρίου' },
  { value: 'ENFIA', label: 'ΕΝΦΙΑ' },
  { value: 'ekkatharisi', label: 'Εκκαθάριση ΦΠΑ' },
  { value: 'misthodosia', label: 'Μισθοδοσία' },
  { value: 'other', label: 'Άλλο' },
]

const MONTHS_SHORT = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']

const emptyForm = {
  type: 'hond', name: '', afm: '',
  period: 'monthly', invoice_amount: '', fee_amount: '', inc_stamp: true, inc_vat: true,
  vat_period: 'monthly', extra_fee: '',
  reason: 'E1', reason_other: '', fee: '', opening_balance: '',
}

export default function PelatesPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<any[]>([])
  const [clientMonthly, setClientMonthly] = useState<Record<number, any[]>>({})
  const [clientReceipts, setClientReceipts] = useState<Record<number, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('hond')
  const [search, setSearch] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [vatDisplay, setVatDisplay] = useState<'with'|'without'>('with')
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [showImport, setShowImport] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [importRows, setImportRows] = useState<any[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [archivedClients, setArchivedClients] = useState<any[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [form, setForm] = useState<any>({...emptyForm})

  useEffect(() => { loadClients() }, [])
  useEffect(() => { if (clients.length > 0) loadMonthlyData() }, [clients, selectedYear])

  async function loadClients() {
    setLoading(true)
    const [{ data }, { data: archived }] = await Promise.all([
      supabase.from('clients').select('*').eq('is_active', true).order('name'),
      supabase.from('clients').select('*').eq('is_active', false).order('name'),
    ])
    const withBal = await Promise.all((data||[]).map(async c => {
      const { data: bal } = await supabase.rpc('get_client_balance', { p_client_id: c.id, p_year: null })
      return { ...c, current_balance: bal || 0 }
    }))
    setClients(withBal)
    setArchivedClients(archived || [])
    setLoading(false)
  }

  async function loadMonthlyData() {
    const ids = clients.map(c => c.id)
    if (!ids.length) return

    const [{ data: charges }, { data: receipts }] = await Promise.all([
      supabase.from('client_charges').select('client_id, month, amount, charge_type').eq('year', selectedYear).in('client_id', ids),
      supabase.from('client_receipts').select('client_id, month, amount').eq('year', selectedYear).in('client_id', ids),
    ])

    const chargesMap: Record<number, any[]> = {}
    const receiptsMap: Record<number, any[]> = {}
    ;(charges||[]).forEach((c:any) => {
      if (!chargesMap[c.client_id]) chargesMap[c.client_id] = []
      chargesMap[c.client_id].push(c)
    })
    ;(receipts||[]).forEach((r:any) => {
      if (!receiptsMap[r.client_id]) receiptsMap[r.client_id] = []
      receiptsMap[r.client_id].push(r)
    })
    setClientMonthly(chargesMap)
    setClientReceipts(receiptsMap)
  }

  function getMonthStatus(clientId: number, month: number) {
    const charges = (clientMonthly[clientId]||[]).filter(c => c.month === month && c.charge_type !== 'stamp' && c.charge_type !== 'vat_yearly')
    const receipts = (clientReceipts[clientId]||[]).filter(r => r.month === month)
    const totalCharge = charges.reduce((s:number,c:any)=>s+c.amount, 0)
    const totalReceipt = receipts.reduce((s:number,r:any)=>s+r.amount, 0)
    if (totalCharge === 0) return { status: 'none', charge: 0, receipt: 0 }
    if (totalReceipt >= totalCharge) return { status: 'paid', charge: totalCharge, receipt: totalReceipt }
    if (totalReceipt > 0) return { status: 'partial', charge: totalCharge, receipt: totalReceipt }
    return { status: 'unpaid', charge: totalCharge, receipt: 0 }
  }

  const filtered = clients.filter(c => c.type === activeTab && (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.afm||'').includes(search)))

  function calcDisplay(c: any) {
    const feeBase = c.fee_amount > 0 ? c.fee_amount : c.invoice_amount
    if (vatDisplay === 'without') return feeBase
    const { total } = calcClientAmounts(c.invoice_amount, c.inc_stamp, c.inc_vat)
    return c.fee_amount > 0 ? c.fee_amount : total
  }

  function openNewForm() {
    setEditingClient(null)
    setForm({...emptyForm, type: activeTab})
    setShowForm(true)
  }

  function openEditForm(c: any) {
    setEditingClient(c)
    setForm({
      type: c.type, name: c.name, afm: c.afm||'',
      period: c.period||'monthly',
      invoice_amount: c.invoice_amount?.toString()||'',
      fee_amount: c.fee_amount?.toString()||'',
      inc_stamp: c.inc_stamp, inc_vat: c.inc_vat,
      vat_period: c.vat_period||'monthly',
      extra_fee: c.extra_fee?.toString()||'',
      reason: c.reason||'E1', reason_other: '',
      fee: c.fee?.toString()||'',
      opening_balance: c.opening_balance?.toString()||'',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name) { toast.error('Συμπλήρωσε επωνυμία'); return }
    const payload: any = {
      type: form.type, name: form.name, afm: form.afm||null,
      opening_balance: parseFloat(form.opening_balance)||0,
    }
    if (form.type === 'hond') {
      Object.assign(payload, {
        period: form.period,
        invoice_amount: parseFloat(form.invoice_amount)||0,
        fee_amount: parseFloat(form.fee_amount)||0,
        inc_stamp: form.inc_stamp, inc_vat: form.inc_vat,
        vat_period: form.vat_period,
        extra_fee: parseFloat(form.extra_fee)||0,
      })
    } else {
      const rl = form.reason==='other' ? form.reason_other : REASONS.find(r=>r.value===form.reason)?.label||form.reason
      Object.assign(payload, { reason: form.reason, reason_label: rl, fee: parseFloat(form.fee)||0 })
    }
    let error
    if (editingClient) {
      ({ error } = await supabase.from('clients').update(payload).eq('id', editingClient.id))
    } else {
      ({ error } = await supabase.from('clients').insert(payload))
    }
    if (error) { toast.error(error.message); return }
    toast.success(editingClient ? 'Ο πελάτης ενημερώθηκε' : 'Ο πελάτης προστέθηκε')
    setShowForm(false); setEditingClient(null)
    loadClients()
  }

  async function handleDelete(id: number) {
    if (!confirm('Αρχειοθέτηση πελάτη;')) return
    await supabase.from('clients').update({ is_active: false }).eq('id', id)
    toast.success('Αρχειοθετήθηκε'); loadClients()
  }

  async function handleRestore(id: number) {
    await supabase.from('clients').update({ is_active: true }).eq('id', id)
    toast.success('Ο πελάτης επαναφέρθηκε'); loadClients()
  }

  function handleExcelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws) as any[]
      setImportRows(rows.map((r,i) => ({
        _idx: i, name: r['Επωνυμία']||r['name']||'',
        afm: String(r['ΑΦΜ']||r['afm']||''),
        type: (r['Κατηγορία']||'hond').toLowerCase().includes('λιαν')?'lian':'hond',
        period: (r['Περιοδικότητα']||'monthly').toLowerCase().includes('τριμ')?'quarterly':(r['Περιοδικότητα']||'').toLowerCase().includes('ετ')?'yearly':'monthly',
        invoice_amount: parseFloat(r['Αμοιβή']||0), fee: parseFloat(r['Χρέωση']||0),
        _valid: !!(r['Επωνυμία']||r['name']),
        _error: !(r['Επωνυμία']||r['name'])?'Λείπει επωνυμία':'',
      })))
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    const valid = importRows.filter(r=>r._valid)
    if (!valid.length) { toast.error('Δεν υπάρχουν έγκυρες γραμμές'); return }
    setImportLoading(true)
    const { error } = await supabase.from('clients').insert(valid.map(r=>({
      type: r.type, name: r.name, afm: r.afm||null, period: r.period,
      invoice_amount: r.invoice_amount||0, fee: r.fee||0,
      inc_stamp: true, inc_vat: true, vat_period: 'monthly'
    })))
    setImportLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${valid.length} πελάτες εισήχθησαν`)
    setShowImport(false); setImportRows([]); loadClients()
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([['Επωνυμία','ΑΦΜ','Κατηγορία','Αμοιβή','Περιοδικότητα'],['ΑΛΦΑ ΕΠΕ','094123456','Χονδρική',150,'Μηνιαία'],['Παπαδόπουλος Ι.','041987654','Λιανική',50,'Μηνιαία']])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Πελάτες'); XLSX.writeFile(wb,'υπόδειγμα_πελατών.xlsx')
  }

  const inv = parseFloat(form.invoice_amount)||0
  const stamp = form.inc_stamp ? inv*0.20 : 0
  const vat = form.inc_vat ? (inv+stamp)*0.24 : 0
  const feeAmt = parseFloat(form.fee_amount)||0

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div><h1 className="page-title">Πελάτες</h1><p className="text-xs text-gray-400 mt-0.5">{clients.length} συνολικά</p></div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm" onClick={()=>setShowImport(true)}>↑ Excel</button>
          <button className="btn-primary btn-sm" onClick={openNewForm}>+ Νέος πελάτης</button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button className={clsx('btn btn-sm',activeTab==='hond'?'btn-primary':'btn-secondary')} onClick={()=>{setActiveTab('hond');setShowArchived(false)}}>Χονδρική ({clients.filter(c=>c.type==='hond').length})</button>
          <button className={clsx('btn btn-sm',activeTab==='lian'?'btn-primary':'btn-secondary')} onClick={()=>{setActiveTab('lian');setShowArchived(false)}}>Λιανική ({clients.filter(c=>c.type==='lian').length})</button>
          <button className={clsx('btn btn-sm',showArchived?'btn-primary':'btn-secondary')} onClick={()=>setShowArchived(!showArchived)}>Αρχειοθετημένοι ({archivedClients.length})</button>
          <select className="select w-24 py-1 text-sm" value={selectedYear} onChange={e=>setSelectedYear(parseInt(e.target.value))}>
            {getYearRange(2020).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex items-center gap-3 ml-auto">
            <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer"><input type="radio" name="vd" value="with" checked={vatDisplay==='with'} onChange={()=>setVatDisplay('with')} /> Με επιβαρύνσεις</label>
            <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer"><input type="radio" name="vd" value="without" checked={vatDisplay==='without'} onChange={()=>setVatDisplay('without')} /> Χωρίς</label>
          </div>
        </div>

        <input type="text" className="input max-w-xs" placeholder="Αναζήτηση ονόματος / ΑΦΜ..." value={search} onChange={e=>setSearch(e.target.value)} />

        {/* Λίστα πελατών με μηνιαία grid */}
        {loading ? <p className="text-center text-gray-400 py-10">Φόρτωση...</p> : (
          <div className="space-y-3">
            {filtered.map(c => {
              const dispAmt = calcDisplay(c)
              const bal = c.current_balance
              return (
                <div key={c.id} className="card cursor-pointer hover:shadow-sm transition-shadow" onClick={()=>setSelectedClient(c)}>
                  {/* Header πελάτη */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{c.name}</span>
                        <span className={clsx('badge',c.type==='hond'?'badge-blue':'badge-purple')}>{c.type==='hond'?'Χονδρική':'Λιανική'}</span>
                        {c.type==='hond' && <span className="badge badge-gray">{periodLabel(c.period||'monthly')}</span>}
                      </div>
                      {c.afm && <p className="text-xs text-gray-400">ΑΦΜ: {c.afm}</p>}
                      {c.type==='lian' && <p className="text-xs text-gray-500">{c.reason_label}</p>}
                      {c.type==='hond' && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Αμοιβή: <span className="font-medium text-blue-700">{formatMoney(c.fee_amount > 0 ? c.fee_amount : c.invoice_amount)}</span>
                          {c.fee_amount > 0 && <span className="text-gray-400"> | Τιμολόγιο: {formatMoney(c.invoice_amount)}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Υπόλοιπο</p>
                        <p className={`text-base font-bold ${bal>0?'text-red-600':bal<0?'text-green-600':'text-gray-400'}`}>{bal>0?'+':''}{formatMoney(bal)}</p>
                      </div>
                      <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                        <button className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded border border-blue-200" onClick={()=>openEditForm(c)}>✎</button>
                        <button className="text-gray-300 hover:text-red-500 text-lg leading-none px-1" onClick={()=>handleDelete(c.id)}>×</button>
                      </div>
                    </div>
                  </div>

                  {/* Μηνιαία grid */}
                  <div className="grid grid-cols-6 md:grid-cols-12 gap-1" onClick={e=>e.stopPropagation()}>
                    {MONTHS_SHORT.map((mn,i) => {
                      const ms = getMonthStatus(c.id, i+1)
                      return (
                        <div key={i} className={clsx(
                          'rounded px-1 py-1.5 text-center text-xs border',
                          ms.status==='none' ? 'bg-gray-50 border-gray-100 text-gray-300' :
                          ms.status==='paid' ? 'bg-green-50 border-green-200 text-green-700' :
                          ms.status==='partial' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                          'bg-red-50 border-red-200 text-red-700'
                        )}>
                          <div className="font-medium">{mn}</div>
                          {ms.status !== 'none' && (
                            <div className="text-xs mt-0.5 leading-tight">
                              {ms.status==='paid'
                                ? <span>✓</span>
                                : ms.status==='partial'
                                  ? <span>{formatMoney(ms.receipt)}</span>
                                  : <span>{formatMoney(ms.charge)}</span>
                              }
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-200 inline-block"></span>Εξοφλημένη</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-200 inline-block"></span>Μερική</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-200 inline-block"></span>Ανεξόφλητη</span>
                  </div>
                </div>
              )
            })}
            {filtered.length===0 && <p className="text-center text-gray-400 py-10">Δεν βρέθηκαν πελάτες</p>}
          </div>
        )}
      </div>

      {/* Αρχειοθετημένοι */}
      {showArchived && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="section-title mb-0">Αρχειοθετημένοι πελάτες ({archivedClients.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr>
                <th className="table-header">Επωνυμία</th>
                <th className="table-header w-24">ΑΦΜ</th>
                <th className="table-header w-24">Τύπος</th>
                <th className="table-header w-28 text-right">Αμοιβή</th>
                <th className="table-header w-24"></th>
              </tr></thead>
              <tbody>
                {archivedClients.length === 0 && (
                  <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">Δεν υπάρχουν αρχειοθετημένοι πελάτες</td></tr>
                )}
                {archivedClients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 opacity-60">
                    <td className="table-cell font-medium">{c.name}</td>
                    <td className="table-cell text-gray-500 text-xs">{c.afm || '—'}</td>
                    <td className="table-cell">
                      <span className={clsx('badge', c.type==='hond'?'badge-blue':'badge-purple')}>
                        {c.type==='hond'?'Χονδρική':'Λιανική'}
                      </span>
                    </td>
                    <td className="table-cell text-right text-gray-500">
                      {c.type==='hond' ? formatMoney(c.fee_amount > 0 ? c.fee_amount : c.invoice_amount) : formatMoney(c.fee||0)}
                    </td>
                    <td className="table-cell">
                      <button
                        className="text-xs text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-1"
                        onClick={() => handleRestore(c.id)}
                      >↺ Επαναφορά</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Φόρμα νέου/επεξεργασίας */}
      {showForm && (
        <Modal title={editingClient ? `Επεξεργασία: ${editingClient.name}` : 'Νέος πελάτης'} onClose={()=>{setShowForm(false);setEditingClient(null)}} wide>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button className={clsx('btn btn-sm',form.type==='hond'?'btn-primary':'btn-secondary')} onClick={()=>setForm((f:any)=>({...f,type:'hond'}))}>Χονδρική</button>
              <button className={clsx('btn btn-sm',form.type==='lian'?'btn-primary':'btn-secondary')} onClick={()=>setForm((f:any)=>({...f,type:'lian'}))}>Λιανική</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Επωνυμία / Ονοματεπώνυμο *</label><input className="input" value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} placeholder="..." /></div>
              <div><label className="label">ΑΦΜ</label><input className="input" value={form.afm} onChange={e=>setForm((f:any)=>({...f,afm:e.target.value}))} placeholder="123456789" /></div>
              <div><label className="label">Προηγούμενο υπόλοιπο (€)</label><input type="number" className="input" value={form.opening_balance} onChange={e=>setForm((f:any)=>({...f,opening_balance:e.target.value}))} placeholder="0.00" step="0.01" /></div>
            </div>
            {form.type==='hond' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Περιοδικότητα</label>
                    <select className="select" value={form.period} onChange={e=>setForm((f:any)=>({...f,period:e.target.value}))}>
                      <option value="monthly">Μηνιαία</option><option value="quarterly">Τριμηνιαία</option><option value="yearly">Ετήσια</option>
                    </select>
                  </div>
                  <div><label className="label">Ποσό τιμολογίου (€)</label><input type="number" className="input" value={form.invoice_amount} onChange={e=>setForm((f:any)=>({...f,invoice_amount:e.target.value}))} placeholder="0.00" step="0.01" /></div>
                  <div>
                    <label className="label">Αμοιβή χρέωσης (€) <span className="text-gray-400 font-normal text-xs">βάση υπολοίπου</span></label>
                    <input type="number" className="input" value={form.fee_amount} onChange={e=>setForm((f:any)=>({...f,fee_amount:e.target.value}))} placeholder="0.00 (αν διαφέρει από τιμολόγιο)" step="0.01" />
                  </div>
                  <div><label className="label">ΦΠΑ περιοδικότητα</label>
                    <select className="select" value={form.vat_period} onChange={e=>setForm((f:any)=>({...f,vat_period:e.target.value}))}>
                      <option value="monthly">Μηνιαίο</option><option value="yearly">Ετήσιο (Δεκέμβριο)</option>
                    </select>
                  </div>
                  <div><label className="label">Έκτακτη αμοιβή (€)</label><input type="number" className="input" value={form.extra_fee} onChange={e=>setForm((f:any)=>({...f,extra_fee:e.target.value}))} placeholder="0.00" step="0.01" /></div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.inc_stamp} onChange={e=>setForm((f:any)=>({...f,inc_stamp:e.target.checked}))} /> Χαρτόσημο 20% (ετήσιο)</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.inc_vat} onChange={e=>setForm((f:any)=>({...f,inc_vat:e.target.checked}))} /> ΦΠΑ 24%</label>
                </div>
                {inv > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                    <div className="text-gray-600">Τιμολόγιο: {formatMoney(inv)}{form.inc_stamp&&` + Χαρτόσημο: ${formatMoney(stamp)}`}{form.inc_vat&&` + ΦΠΑ: ${formatMoney(vat)}`} = <strong>{formatMoney(inv+stamp+vat)}</strong></div>
                    {feeAmt > 0 && <div className="text-blue-700 font-medium">Αμοιβή χρέωσης: {formatMoney(feeAmt)}</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Αιτιολογία χρέωσης</label>
                  <select className="select" value={form.reason} onChange={e=>setForm((f:any)=>({...f,reason:e.target.value}))}>
                    {REASONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {form.reason==='other'&&<div><label className="label">Περιγραφή</label><input className="input" value={form.reason_other} onChange={e=>setForm((f:any)=>({...f,reason_other:e.target.value}))} placeholder="..." /></div>}
                <div><label className="label">Χρέωση (€)</label><input type="number" className="input" value={form.fee} onChange={e=>setForm((f:any)=>({...f,fee:e.target.value}))} placeholder="0.00" step="0.01" /></div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn-primary btn-sm" onClick={handleSave}>{editingClient?'Αποθήκευση αλλαγών':'Αποθήκευση'}</button>
              <button className="btn-secondary btn-sm" onClick={()=>{setShowForm(false);setEditingClient(null)}}>Ακύρωση</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Excel */}
      {showImport && (
        <Modal title="Εισαγωγή πελατών από Excel" onClose={()=>{setShowImport(false);setImportRows([])}} wide>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-500 mb-3">Επίλεξε αρχείο .xlsx ή .csv</p>
              <input type="file" accept=".xlsx,.csv,.xls" onChange={handleExcelFile} className="text-sm" />
            </div>
            <button className="btn-secondary btn-sm" onClick={downloadTemplate}>↓ Λήψη υποδείγματος Excel</button>
            {importRows.length>0&&(
              <>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50"><tr><th className="table-header">Επωνυμία</th><th className="table-header">ΑΦΜ</th><th className="table-header">Κατηγορία</th><th className="table-header text-right">Ποσό</th><th className="table-header">Κατάσταση</th></tr></thead>
                    <tbody>{importRows.map(r=>(
                      <tr key={r._idx} className={r._valid?'':'bg-red-50'}>
                        <td className="table-cell">{r.name||'—'}</td><td className="table-cell">{r.afm||'—'}</td>
                        <td className="table-cell">{r.type==='hond'?'Χονδρική':'Λιανική'}</td>
                        <td className="table-cell text-right">{formatMoney(r.invoice_amount||r.fee||0)}</td>
                        <td className="table-cell">{r._valid?<span className="badge badge-green">OK</span>:<span className="badge badge-red">{r._error}</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={handleImport} disabled={importLoading}>{importLoading?'Εισαγωγή...':`Εισαγωγή ${importRows.filter(r=>r._valid).length} εγκεκριμένων`}</button>
                  <button className="btn-secondary btn-sm" onClick={()=>setImportRows([])}>Καθαρισμός</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Λεπτομέρειες πελάτη */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          year={selectedYear}
          onClose={()=>setSelectedClient(null)}
          onRefresh={loadClients}
        />
      )}
    </div>
  )
}

// ============================================================
// CLIENT DETAIL MODAL
// ============================================================
function ClientDetailModal({ client, year, onClose, onRefresh }: { client: any; year: number; onClose: ()=>void; onRefresh: ()=>void }) {
  const supabase = createClient()
  const [selectedYear, setSelectedYear] = useState(year)
  const [charges, setCharges] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editAmount, setEditAmount] = useState<{id:number;amount:string}|null>(null)
  const [allClients, setAllClients] = useState<any[]>([])
  const [transferTo, setTransferTo] = useState('')
  const [transferAmt, setTransferAmt] = useState('')

  useEffect(() => { loadData() }, [selectedYear])
  useEffect(() => {
    supabase.from('clients').select('id,name').eq('is_active',true).neq('id',client.id).order('name').then(({data})=>setAllClients(data||[]))
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('client_charges').select('*').eq('client_id',client.id).eq('year',selectedYear).order('month'),
      supabase.from('client_receipts').select('*').eq('client_id',client.id).eq('year',selectedYear).order('receipt_date',{ascending:false}),
    ])
    setCharges(c||[]); setReceipts(r||[]); setLoading(false)
  }

  const totalCharges = charges.reduce((s,c)=>s+c.amount,0)
  const totalReceipts = receipts.reduce((s,r)=>s+r.amount,0)
  const yearBalance = (client.opening_balance||0) + totalCharges - totalReceipts

  const monthlyData = Array.from({length:12},(_,i)=>{
    const m = i+1
    const mCharges = charges.filter(c=>c.month===m && c.charge_type!=='stamp' && c.charge_type!=='vat_yearly').reduce((s:number,c:any)=>s+c.amount,0)
    const mReceipts = receipts.filter(r=>r.month===m).reduce((s:number,r:any)=>s+r.amount,0)
    const isPaid = mCharges > 0 && mReceipts >= mCharges
    return { month: m, charges: mCharges, receipts: mReceipts, isPaid, hasCharge: mCharges > 0 }
  })

  async function handleEditCharge(id: number, amount: number) {
    await supabase.from('client_charges').update({ amount, is_auto: false, charge_type: 'manual' }).eq('id',id)
    toast.success('Ενημερώθηκε'); setEditAmount(null); loadData(); onRefresh()
  }

  async function handleTransfer() {
    const amt = parseFloat(transferAmt)
    if (!amt||!transferTo) { toast.error('Συμπλήρωσε ποσό και πελάτη'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const date = new Date().toISOString().split('T')[0]
    await supabase.from('cashflow_entries').insert({
      entry_date: date, week_start: date, year: new Date().getFullYear(),
      month: new Date().getMonth()+1, week_number: 1,
      entry_type: 'transfer', amount: amt,
      description: `Μεταφορά από ${client.name}`,
      client_id: parseInt(transferTo), created_by: session?.user?.id,
    })
    toast.success('Μεταφορά καταχωρήθηκε')
    setTransferAmt(''); setTransferTo('')
  }

  return (
    <Modal title={client.name} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('badge',client.type==='hond'?'badge-blue':'badge-purple')}>{client.type==='hond'?'Χονδρική':'Λιανική'}</span>
              {client.type==='hond'&&<span className="badge badge-gray">{periodLabel(client.period||'monthly')}</span>}
            </div>
            {client.afm&&<p className="text-xs text-gray-400">ΑΦΜ: {client.afm}</p>}
            {client.type==='hond'&&client.fee_amount>0&&<p className="text-xs text-blue-600">Αμοιβή: {formatMoney(client.fee_amount)} | Τιμολόγιο: {formatMoney(client.invoice_amount)}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">Τρέχον υπόλοιπο</p>
            <p className={`text-xl font-bold ${client.current_balance>0?'text-red-600':client.current_balance<0?'text-green-600':'text-gray-400'}`}>{formatMoney(client.current_balance)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Έτος:</label>
          <select className="select w-24 py-1 text-xs" value={selectedYear} onChange={e=>setSelectedYear(parseInt(e.target.value))}>
            {getYearRange(2020).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-3 text-sm flex-wrap">
            <span className="text-gray-500">Χρεώσεις: <strong>{formatMoney(totalCharges)}</strong></span>
            <span className="text-gray-500">Εισπράξεις: <strong className="text-green-600">{formatMoney(totalReceipts)}</strong></span>
            <span className={`font-semibold ${yearBalance>0?'text-red-600':'text-green-600'}`}>Υπόλοιπο {selectedYear}: {formatMoney(yearBalance)}</span>
          </div>
        </div>

        {loading ? <p className="text-center text-gray-400 py-8">Φόρτωση...</p> : (
          <>
            <div>
              <p className="section-title">Μηνιαία κατάσταση {selectedYear}</p>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {monthlyData.map(m=>(
                  <div key={m.month} className={clsx(
                    'rounded-lg p-2 border text-center text-xs',
                    !m.hasCharge ? 'bg-gray-50 border-gray-100 opacity-50' :
                    m.isPaid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  )}>
                    <div className="font-medium text-gray-700">{MONTHS_SHORT[m.month-1]}</div>
                    {m.hasCharge ? (
                      <>
                        <div className={`font-semibold mt-0.5 ${m.isPaid?'text-green-700':'text-red-700'}`}>{formatMoney(m.charges)}</div>
                        <div className={`text-xs mt-0.5 ${m.isPaid?'text-green-600':'text-red-500'}`}>{m.isPaid?'✓ Εξοφλ.':m.receipts>0?`${formatMoney(m.receipts)}`:'Ανεξόφλ.'}</div>
                      </>
                    ) : <div className="text-gray-300 mt-1">—</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="section-title">Αναλυτικές χρεώσεις</p>
                {charges.map(c=>(
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="text-gray-600">{MONTHS_SHORT[c.month-1]}{c.charge_type==='stamp'?' (Χαρτόσημο)':c.charge_type==='vat_yearly'?' (ΦΠΑ ετήσιο)':''}{!c.is_auto?' ✎':''}</span>
                    {editAmount?.id===c.id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" className="input w-20 py-1 text-xs" value={editAmount?.amount??''} onChange={e=>setEditAmount({id:c.id,amount:e.target.value})} step="0.01" />
                        <button className="btn-primary btn-sm py-0.5 text-xs" onClick={()=>handleEditCharge(c.id,parseFloat(editAmount?.amount||'0'))}>✓</button>
                        <button className="btn-secondary btn-sm py-0.5 text-xs" onClick={()=>setEditAmount(null)}>✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{formatMoney(c.amount)}</span>
                        <button className="text-gray-300 hover:text-gray-600 text-xs ml-1" onClick={()=>setEditAmount({id:c.id,amount:c.amount.toString()})}>✎</button>
                      </div>
                    )}
                  </div>
                ))}
                {charges.length===0&&<p className="text-xs text-gray-400 py-4 text-center">Δεν υπάρχουν χρεώσεις</p>}
              </div>
              <div>
                <p className="section-title">Εισπράξεις</p>
                {receipts.map(r=>(
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="text-gray-600">{new Date(r.receipt_date).toLocaleDateString('el-GR')}</span>
                    <span className="font-medium text-green-600">+{formatMoney(r.amount)}</span>
                  </div>
                ))}
                {receipts.length===0&&<p className="text-xs text-gray-400 py-4 text-center">Δεν υπάρχουν εισπράξεις</p>}
              </div>
            </div>
          </>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="section-title">Μεταφορά υπολοίπου</p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Ποσό (€)</label><input type="number" className="input" value={transferAmt} onChange={e=>setTransferAmt(e.target.value)} placeholder="0.00" step="0.01" /></div>
            <div><label className="label">Προς πελάτη</label>
              <select className="select" value={transferTo} onChange={e=>setTransferTo(e.target.value)}>
                <option value="">— Επιλογή —</option>
                {allClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-end"><button className="btn-secondary btn-sm" onClick={handleTransfer}>Μεταφορά</button></div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
