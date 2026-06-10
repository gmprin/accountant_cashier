'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  formatMoney, periodLabel, calcClientAmounts, calcMonthlyAmount,
  getYearRange, getMonthOptions, formatMonthShort
} from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import * as XLSX from 'xlsx'
import clsx from 'clsx'
import { Client } from '@/types'

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

interface Props {
  clients: (Client & { current_balance: number })[]
  tab: string
  year: number
  userRole: string
  userId: string
}

export default function ClientsView({ clients, tab, year, userRole, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole !== 'viewer'

  const [activeTab, setActiveTab] = useState(tab)
  const [search, setSearch] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [showClientDetail, setShowClientDetail] = useState(false)
  const [vatDisplay, setVatDisplay] = useState<'with' | 'without'>('with')

  // New client form
  const [form, setForm] = useState({
    type: 'hond',
    name: '', afm: '',
    period: 'monthly', invoice_amount: '', inc_stamp: true, inc_vat: true,
    vat_period: 'monthly', extra_fee: '',
    reason: 'E1', reason_other: '', fee: '',
    opening_balance: '',
  })

  const filtered = clients
    .filter(c => c.type === activeTab)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.afm || '').includes(search))

  function calcDisplay(c: Client) {
    if (vatDisplay === 'without') return c.type === 'hond' ? c.invoice_amount : c.fee
    if (c.type === 'hond') {
      const { total } = calcAmounts(c)
      return total
    }
    return c.fee
  }

  function calcAmounts(c: Client) {
    return calcClientAmounts(c.invoice_amount, c.inc_stamp, c.inc_vat)
  }

  function handleFormChange(k: string, v: any) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSaveClient() {
    if (!form.name) { toast.error('Συμπλήρωσε επωνυμία'); return }
    const isHond = form.type === 'hond'
    const payload: any = {
      type: form.type,
      name: form.name,
      afm: form.afm || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
    }
    if (isHond) {
      Object.assign(payload, {
        period: form.period,
        invoice_amount: parseFloat(form.invoice_amount) || 0,
        inc_stamp: form.inc_stamp,
        inc_vat: form.inc_vat,
        vat_period: form.vat_period,
        extra_fee: parseFloat(form.extra_fee) || 0,
      })
    } else {
      const reasonLabel = form.reason === 'other'
        ? form.reason_other
        : REASONS.find(r => r.value === form.reason)?.label || form.reason
      Object.assign(payload, {
        reason: form.reason,
        reason_label: reasonLabel,
        fee: parseFloat(form.fee) || 0,
      })
    }
    const { error } = await supabase.from('clients').insert(payload)
    if (error) { toast.error(error.message); return }
    toast.success('Ο πελάτης προστέθηκε')
    setShowNewForm(false)
    setForm({ type: 'hond', name: '', afm: '', period: 'monthly', invoice_amount: '', inc_stamp: true, inc_vat: true, vat_period: 'monthly', extra_fee: '', reason: 'E1', reason_other: '', fee: '', opening_balance: '' })
    router.refresh()
  }

  async function handleDeleteClient(id: number) {
    if (!confirm('Διαγραφή πελάτη; Τα δεδομένα θα διατηρηθούν.')) return
    await supabase.from('clients').update({ is_active: false }).eq('id', id)
    toast.success('Ο πελάτης αρχειοθετήθηκε')
    router.refresh()
  }

  // Excel import
  const [importRows, setImportRows] = useState<any[]>([])
  const [importLoading, setImportLoading] = useState(false)

  function handleExcelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)
      const mapped = (rows as any[]).map((r, i) => ({
        _idx: i,
        name: r['Επωνυμία'] || r['name'] || '',
        afm: String(r['ΑΦΜ'] || r['afm'] || ''),
        type: (r['Κατηγορία'] || r['type'] || 'hond').toLowerCase().includes('λιαν') ? 'lian' : 'hond',
        period: (r['Περιοδικότητα'] || r['period'] || 'monthly').toLowerCase().includes('τριμ') ? 'quarterly' : (r['Περιοδικότητα'] || '').toLowerCase().includes('ετ') ? 'yearly' : 'monthly',
        invoice_amount: parseFloat(r['Αμοιβή'] || r['invoice_amount'] || 0),
        fee: parseFloat(r['Χρέωση'] || r['fee'] || 0),
        _valid: !!(r['Επωνυμία'] || r['name']),
        _error: !(r['Επωνυμία'] || r['name']) ? 'Λείπει επωνυμία' : '',
      }))
      setImportRows(mapped)
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    const valid = importRows.filter(r => r._valid)
    if (!valid.length) { toast.error('Δεν υπάρχουν έγκυρες γραμμές'); return }
    setImportLoading(true)
    const payload = valid.map(r => ({
      type: r.type,
      name: r.name,
      afm: r.afm || null,
      period: r.period,
      invoice_amount: r.invoice_amount || 0,
      fee: r.fee || 0,
      inc_stamp: true,
      inc_vat: true,
      vat_period: 'monthly',
    }))
    const { error } = await supabase.from('clients').insert(payload)
    setImportLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${valid.length} πελάτες εισήχθησαν`)
    setShowImport(false)
    setImportRows([])
    router.refresh()
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Επωνυμία', 'ΑΦΜ', 'Κατηγορία', 'Αμοιβή', 'Περιοδικότητα'],
      ['ΑΛΦΑ ΕΠΕ', '094123456', 'Χονδρική', 150, 'Μηνιαία'],
      ['Παπαδόπουλος Ι.', '041987654', 'Λιανική', 50, 'Μηνιαία'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Πελάτες')
    XLSX.writeFile(wb, 'υπόδειγμα_πελατών.xlsx')
  }

  const hondCount = clients.filter(c => c.type === 'hond').length
  const lianCount = clients.filter(c => c.type === 'lian').length

  return (
    <div className="p-6 space-y-5">
      {/* Tabs + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className={clsx('btn btn-sm', activeTab === 'hond' ? 'btn-primary' : 'btn-secondary')}
          onClick={() => setActiveTab('hond')}
        >Χονδρική ({hondCount})</button>
        <button
          className={clsx('btn btn-sm', activeTab === 'lian' ? 'btn-primary' : 'btn-secondary')}
          onClick={() => setActiveTab('lian')}
        >Λιανική ({lianCount})</button>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="vatdisp" value="with" checked={vatDisplay === 'with'} onChange={() => setVatDisplay('with')} />
            Με χαρτόσημο & ΦΠΑ
          </label>
          <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="vatdisp" value="without" checked={vatDisplay === 'without'} onChange={() => setVatDisplay('without')} />
            Χωρίς
          </label>
        </div>

        {canEdit && (
          <>
            <button className="btn-secondary btn-sm" onClick={() => setShowImport(true)}>
              ↑ Εισαγωγή Excel
            </button>
            <button className="btn-primary btn-sm" onClick={() => { setForm(f => ({...f, type: activeTab})); setShowNewForm(true) }}>
              + Νέος πελάτης
            </button>
          </>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        className="input max-w-xs"
        placeholder="Αναζήτηση ονόματος / ΑΦΜ..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Επωνυμία / Ονοματεπώνυμο</th>
                <th className="table-header w-24">ΑΦΜ</th>
                {activeTab === 'hond' ? (
                  <>
                    <th className="table-header w-24">Περίοδος</th>
                    <th className="table-header w-28 text-right">Ποσό ({vatDisplay === 'with' ? 'με επιβαρ.' : 'χωρίς'})</th>
                  </>
                ) : (
                  <th className="table-header">Αιτιολογία</th>
                )}
                <th className="table-header w-28 text-right">Τρέχον υπόλοιπο</th>
                {canEdit && <th className="table-header w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => {
                const bal = client.current_balance
                const dispAmt = calcDisplay(client)
                return (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => { setSelectedClient(client); setShowClientDetail(true) }}
                  >
                    <td className="table-cell font-medium">{client.name}</td>
                    <td className="table-cell text-gray-500 text-xs">{client.afm || '—'}</td>
                    {activeTab === 'hond' ? (
                      <>
                        <td className="table-cell">
                          <span className="badge badge-blue">{periodLabel(client.period || 'monthly')}</span>
                        </td>
                        <td className="table-cell text-right font-medium">{formatMoney(dispAmt || 0)}</td>
                      </>
                    ) : (
                      <td className="table-cell text-sm text-gray-500">{client.reason_label || '—'}</td>
                    )}
                    <td className={`table-cell text-right font-semibold ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {bal > 0 ? '+' : ''}{formatMoney(bal)}
                    </td>
                    {canEdit && (
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        <button
                          className="text-gray-300 hover:text-red-500 text-lg leading-none"
                          onClick={() => handleDeleteClient(client.id)}
                          title="Αρχειοθέτηση"
                        >×</button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-10">Δεν βρέθηκαν πελάτες</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          {filtered.length} από {clients.filter(c => c.type === activeTab).length} πελάτες
        </div>
      </div>

      {/* New client modal */}
      {showNewForm && (
        <Modal title={form.type === 'hond' ? 'Νέος πελάτης χονδρικής' : 'Νέος πελάτης λιανικής'} onClose={() => setShowNewForm(false)} wide>
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              <button className={clsx('btn btn-sm', form.type === 'hond' ? 'btn-primary' : 'btn-secondary')} onClick={() => handleFormChange('type', 'hond')}>Χονδρική</button>
              <button className={clsx('btn btn-sm', form.type === 'lian' ? 'btn-primary' : 'btn-secondary')} onClick={() => handleFormChange('type', 'lian')}>Λιανική</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Επωνυμία / Ονοματεπώνυμο *</label>
                <input className="input" value={form.name} onChange={e => handleFormChange('name', e.target.value)} placeholder="..." />
              </div>
              <div>
                <label className="label">ΑΦΜ</label>
                <input className="input" value={form.afm} onChange={e => handleFormChange('afm', e.target.value)} placeholder="123456789" />
              </div>
              <div>
                <label className="label">Προηγούμενο υπόλοιπο (€)</label>
                <input type="number" className="input" value={form.opening_balance} onChange={e => handleFormChange('opening_balance', e.target.value)} placeholder="0.00" step="0.01" />
              </div>
            </div>

            {form.type === 'hond' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Περιοδικότητα</label>
                    <select className="select" value={form.period} onChange={e => handleFormChange('period', e.target.value)}>
                      <option value="monthly">Μηνιαία</option>
                      <option value="quarterly">Τριμηνιαία</option>
                      <option value="yearly">Ετήσια</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Ποσό τιμολογίου (€)</label>
                    <input type="number" className="input" value={form.invoice_amount} onChange={e => handleFormChange('invoice_amount', e.target.value)} placeholder="0.00" step="0.01" />
                  </div>
                  <div>
                    <label className="label">ΦΠΑ περιοδικότητα</label>
                    <select className="select" value={form.vat_period} onChange={e => handleFormChange('vat_period', e.target.value)}>
                      <option value="monthly">Μηνιαίο</option>
                      <option value="yearly">Ετήσιο (Δεκέμβριο)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Έκτακτη αμοιβή (€)</label>
                    <input type="number" className="input" value={form.extra_fee} onChange={e => handleFormChange('extra_fee', e.target.value)} placeholder="0.00" step="0.01" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.inc_stamp} onChange={e => handleFormChange('inc_stamp', e.target.checked)} />
                    Χαρτόσημο 20% (ετήσιο)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.inc_vat} onChange={e => handleFormChange('inc_vat', e.target.checked)} />
                    ΦΠΑ 24%
                  </label>
                </div>
                {form.invoice_amount && (
                  <div className="bg-gray-50 rounded-xl p-3 text-sm">
                    {(() => {
                      const inv = parseFloat(form.invoice_amount) || 0
                      const stamp = form.inc_stamp ? inv * 0.20 : 0
                      const vat = form.inc_vat ? (inv + stamp) * 0.24 : 0
                      return (
                        <span className="text-gray-600">
                          Αμοιβή: {formatMoney(inv)}
                          {form.inc_stamp && ` + Χαρτόσημο: ${formatMoney(stamp)}`}
                          {form.inc_vat && ` + ΦΠΑ: ${formatMoney(vat)}`}
                          <strong> = {formatMoney(inv + stamp + vat)}</strong>
                        </span>
                      )
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Αιτιολογία χρέωσης</label>
                  <select className="select" value={form.reason} onChange={e => handleFormChange('reason', e.target.value)}>
                    {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {form.reason === 'other' && (
                  <div>
                    <label className="label">Περιγραφή αιτιολογίας</label>
                    <input className="input" value={form.reason_other} onChange={e => handleFormChange('reason_other', e.target.value)} placeholder="..." />
                  </div>
                )}
                <div>
                  <label className="label">Χρέωση (€)</label>
                  <input type="number" className="input" value={form.fee} onChange={e => handleFormChange('fee', e.target.value)} placeholder="0.00" step="0.01" />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button className="btn-primary btn-sm" onClick={handleSaveClient}>Αποθήκευση</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowNewForm(false)}>Ακύρωση</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {showImport && (
        <Modal title="Εισαγωγή πελατών από Excel" onClose={() => { setShowImport(false); setImportRows([]) }} wide>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-500 mb-3">Επίλεξε αρχείο .xlsx ή .csv</p>
              <input type="file" accept=".xlsx,.csv,.xls" onChange={handleExcelFile} className="text-sm" />
            </div>
            <button className="btn-secondary btn-sm" onClick={downloadTemplate}>↓ Λήψη υποδείγματος Excel</button>

            {importRows.length > 0 && (
              <>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="table-header">Επωνυμία</th>
                        <th className="table-header">ΑΦΜ</th>
                        <th className="table-header">Κατηγορία</th>
                        <th className="table-header text-right">Ποσό</th>
                        <th className="table-header">Κατάσταση</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map(r => (
                        <tr key={r._idx} className={r._valid ? '' : 'bg-red-50'}>
                          <td className="table-cell">{r.name || '—'}</td>
                          <td className="table-cell">{r.afm || '—'}</td>
                          <td className="table-cell">{r.type === 'hond' ? 'Χονδρική' : 'Λιανική'}</td>
                          <td className="table-cell text-right">{formatMoney(r.invoice_amount || r.fee || 0)}</td>
                          <td className="table-cell">{r._valid ? <span className="badge badge-green">OK</span> : <span className="badge badge-red">{r._error}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary btn-sm"
                    onClick={handleImport}
                    disabled={importLoading}
                  >
                    {importLoading ? 'Εισαγωγή...' : `Εισαγωγή ${importRows.filter(r => r._valid).length} εγκεκριμένων`}
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setImportRows([])}>Καθαρισμός</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Client detail modal */}
      {showClientDetail && selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => { setShowClientDetail(false); setSelectedClient(null) }}
          canEdit={canEdit}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  )
}

// ============================================================
// CLIENT DETAIL MODAL
// ============================================================

function ClientDetailModal({ client, onClose, canEdit, onRefresh }: {
  client: Client & { current_balance: number }
  onClose: () => void
  canEdit: boolean
  onRefresh: () => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [year, setYear] = useState(new Date().getFullYear())
  const [charges, setCharges] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Edit state
  const [editAmount, setEditAmount] = useState<{ id: number; amount: string } | null>(null)

  async function loadData() {
    setLoading(true)
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('client_charges').select('*').eq('client_id', client.id).eq('year', year).order('month'),
      supabase.from('client_receipts').select('*, user:user_profiles(full_name)').eq('client_id', client.id).eq('year', year).order('receipt_date', { ascending: false }),
    ])
    setCharges(c || [])
    setReceipts(r || [])
    setLoading(false)
  }

  useState(() => { loadData() })

  const totalCharges = charges.reduce((s, c) => s + c.amount, 0)
  const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0)
  const yearBalance = client.opening_balance + totalCharges - totalReceipts

  const monthNames = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']

  async function handleEditCharge(id: number, amount: number) {
    await supabase.from('client_charges').update({ amount, is_auto: false, charge_type: 'manual' }).eq('id', id)
    toast.success('Η χρέωση ενημερώθηκε')
    setEditAmount(null)
    loadData()
    onRefresh()
  }

  return (
    <Modal title={client.name} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Header info */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('badge', client.type === 'hond' ? 'badge-blue' : 'badge-purple')}>
                {client.type === 'hond' ? 'Χονδρική' : 'Λιανική'}
              </span>
              {client.type === 'hond' && (
                <span className="badge badge-gray">{periodLabel(client.period || 'monthly')}</span>
              )}
            </div>
            {client.afm && <p className="text-xs text-gray-400">ΑΦΜ: {client.afm}</p>}
            {client.type === 'lian' && <p className="text-xs text-gray-400">{client.reason_label}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">Τρέχον υπόλοιπο</p>
            <p className={`text-xl font-bold ${client.current_balance > 0 ? 'text-red-600' : client.current_balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {formatMoney(client.current_balance)}
            </p>
          </div>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <label className="label mb-0 text-xs">Έτος:</label>
          <select className="select w-24 py-1 text-xs" value={year} onChange={e => { setYear(parseInt(e.target.value)); loadData() }}>
            {getYearRange(2020).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-gray-500">Χρεώσεις: <strong>{formatMoney(totalCharges)}</strong></span>
            <span className="text-gray-500">Εισπράξεις: <strong className="text-green-600">{formatMoney(totalReceipts)}</strong></span>
            <span className={`font-semibold ${yearBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Υπόλοιπο {year}: {formatMoney(yearBalance)}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-8">Φόρτωση...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Χρεώσεις */}
            <div>
              <p className="section-title">Χρεώσεις {year}</p>
              <div className="space-y-1">
                {charges.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="text-gray-600">
                      {monthNames[c.month - 1]}
                      {c.charge_type === 'stamp' && ' (Χαρτόσημο)'}
                      {c.charge_type === 'vat_yearly' && ' (ΦΠΑ ετήσιο)'}
                      {c.charge_type === 'extra' && ' (Έκτακτη)'}
                      {!c.is_auto && ' ✎'}
                    </span>
                    {editAmount?.id === c.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="input w-24 py-1 text-xs"
                          value={editAmount?.amount}
                          onChange={e => setEditAmount({ id: c.id, amount: e.target.value })}
                          step="0.01"
                        />
                        <button className="btn-primary btn-sm py-1 text-xs" onClick={() => handleEditCharge(c.id, parseFloat(editAmount?.amount || '0'))}>✓</button>
                        <button className="btn-secondary btn-sm py-1 text-xs" onClick={() => setEditAmount(null)}>✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatMoney(c.amount)}</span>
                        {canEdit && (
                          <button
                            className="text-gray-300 hover:text-gray-600 text-xs"
                            onClick={() => setEditAmount({ id: c.id, amount: c.amount.toString() })}
                          >✎</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {charges.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Δεν υπάρχουν χρεώσεις</p>}
              </div>
            </div>

            {/* Εισπράξεις */}
            <div>
              <p className="section-title">Εισπράξεις {year}</p>
              <div className="space-y-1">
                {receipts.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <div>
                      <div className="text-gray-600">{new Date(r.receipt_date).toLocaleDateString('el-GR')}</div>
                      {r.description && <div className="text-xs text-gray-400">{r.description}</div>}
                    </div>
                    <span className="font-medium text-green-600">+{formatMoney(r.amount)}</span>
                  </div>
                ))}
                {receipts.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Δεν υπάρχουν εισπράξεις</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
