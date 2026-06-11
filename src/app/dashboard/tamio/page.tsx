'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, getWeekStartStr, formatWeekRange, getWeekNumber, calcMonthlyAmount, entryTypeLabel } from '@/lib/utils'
import { format, addDays, subDays, getISOWeek } from 'date-fns'
import Autocomplete, { AutocompleteOption } from '@/components/ui/Autocomplete'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const ENTRY_TYPES = [
  { value: 'receipt', label: 'Είσπραξη από πελάτη', income: true },
  { value: 'expense_adhoc', label: 'Έκτακτη πληρωμή', income: false },
  { value: 'expense_fixed', label: 'Σταθερή υποχρέωση', income: false },
  { value: 'expense_periodic', label: 'Περιοδική υποχρέωση', income: false },
  { value: 'salary', label: 'Μισθοδοσία', income: false },
  { value: 'distribution', label: 'Διανομή κερδών', income: false },
]

export default function TamioPage() {
  const supabase = createClient()
  const [weekStart, setWeekStart] = useState(getWeekStartStr())
  const [entries, setEntries] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [balance, setBalance] = useState(0)
  const [clients, setClients] = useState<any[]>([])
  const [obligations, setObligations] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form
  const [entryType, setEntryType] = useState('receipt')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [selectedObligation, setSelectedObligation] = useState<any>(null)
  const [selectedPartner, setSelectedPartner] = useState<any>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd')
  const prevWeek = format(subDays(new Date(weekStart), 7), 'yyyy-MM-dd')
  const nextWeek = format(addDays(new Date(weekStart), 7), 'yyyy-MM-dd')
  const isCurrentWeek = weekStart === getWeekStartStr()

  useEffect(() => { loadAll() }, [weekStart])

  async function loadAll() {
    setLoading(true)
    const [
      { data: e },
      { data: s },
      { data: b },
      { data: c },
      { data: o },
      { data: p },
    ] = await Promise.all([
      supabase.from('cashflow_entries')
        .select('*, client:clients(id,name,afm), partner:partners(id,name), obligation:obligations(id,name)')
        .gte('entry_date', weekStart).lte('entry_date', weekEnd)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.rpc('get_weekly_summary', { p_week_start: weekStart }),
      supabase.rpc('get_cashflow_balance'),
      supabase.from('clients').select('id,name,afm,type,invoice_amount,inc_stamp,inc_vat,vat_period,fee').eq('is_active', true).order('name'),
      supabase.from('obligations').select('id,name,obligation_type,amount,employee_name').eq('is_active', true).order('name'),
      supabase.from('partners').select('id,name').eq('is_active', true).order('name'),
    ])
    setEntries(e || [])
    setSummary(s?.[0])
    setBalance(b || 0)
    setClients(c || [])
    setObligations(o || [])
    setPartners(p || [])
    setLoading(false)
  }

  function getOptions(): AutocompleteOption[] {
    if (entryType === 'receipt') return clients.map(c => ({ id: c.id, label: c.name, sublabel: c.afm ? `ΑΦΜ: ${c.afm}` : c.type === 'lian' ? 'Λιανική' : 'Χονδρική' }))
    if (entryType === 'distribution') return partners.map(p => ({ id: p.id, label: p.name }))
    if (['expense_fixed','expense_periodic','salary'].includes(entryType)) return obligations.map(o => ({ id: o.id, label: o.employee_name || o.name, sublabel: o.amount > 0 ? formatMoney(o.amount) : 'Ποσό κατά πληρωμή' }))
    return []
  }

  function handleSelect(opt: AutocompleteOption) {
    setSearchQuery(opt.label)
    if (entryType === 'receipt') {
      const c = clients.find(x => x.id === opt.id)
      setSelectedClient(c)
      if (c) checkSuggestion(c, parseFloat(amount) || 0)
    } else if (entryType === 'distribution') {
      setSelectedPartner(partners.find(x => x.id === opt.id))
    } else {
      const o = obligations.find(x => x.id === opt.id)
      setSelectedObligation(o)
      if (o && o.amount > 0) setAmount(o.amount.toString())
    }
  }

  function checkSuggestion(client: any, amt: number) {
    if (!client || amt <= 0) { setSuggestion(null); return }
    const unit = client.type === 'hond' ? calcMonthlyAmount(client.invoice_amount, client.inc_stamp, client.inc_vat, client.vat_period) : (client.fee || 0)
    if (!unit) { setSuggestion(null); return }
    const periods = Math.round(amt / unit)
    const rem = Math.abs(amt - periods * unit)
    if (periods >= 1 && rem < 0.5) {
      const mn = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']
      const now = new Date()
      const list = []
      for (let i = periods - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        list.push(`${mn[d.getMonth()]} ${d.getFullYear()}`)
      }
      setSuggestion(`${periods} περίοδος/οι (${list.join(', ')}) × ${formatMoney(unit)}`)
    } else { setSuggestion(null) }
  }

  function handleTypeChange(t: string) {
    setEntryType(t); setSearchQuery(''); setSelectedClient(null)
    setSelectedObligation(null); setSelectedPartner(null); setSuggestion(null); setAmount('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) { toast.error('Συμπλήρωσε ποσό'); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const entryDate = new Date(date)
      const wStart = getWeekStartStr(entryDate)
      const payload: any = {
        entry_date: date, week_start: wStart,
        year: entryDate.getFullYear(), month: entryDate.getMonth() + 1,
        week_number: getISOWeek(entryDate), entry_type: entryType,
        amount: parseFloat(amount), description: description || null,
        created_by: session?.user?.id,
        client_id: selectedClient?.id || null,
        obligation_id: selectedObligation?.id || null,
        partner_id: selectedPartner?.id || null,
      }
      const { data: cfEntry, error } = await supabase.from('cashflow_entries').insert(payload).select().single()
      if (error) throw error

      if (entryType === 'receipt' && selectedClient) {
        await supabase.from('client_receipts').insert({
          client_id: selectedClient.id, amount: parseFloat(amount),
          receipt_date: date, year: entryDate.getFullYear(),
          month: entryDate.getMonth() + 1, description: description || null,
          created_by: session?.user?.id,
        })
      }
      if (entryType === 'distribution' && selectedPartner) {
        await supabase.from('partner_distributions').insert({
          partner_id: selectedPartner.id, amount: parseFloat(amount),
          distribution_date: date, week_start: wStart,
          year: entryDate.getFullYear(), month: entryDate.getMonth() + 1,
          description: description || null, cashflow_entry_id: cfEntry.id,
          created_by: session?.user?.id,
        })
      }
      if (['expense_fixed','expense_periodic','salary'].includes(entryType) && selectedObligation) {
        await supabase.from('obligation_payments').insert({
          obligation_id: selectedObligation.id, amount: parseFloat(amount),
          payment_date: date, description: description || null,
          cashflow_entry_id: cfEntry.id, created_by: session?.user?.id,
        })
      }
      toast.success('Καταχωρήθηκε')
      setAmount(''); setDescription(''); setSearchQuery('')
      setSelectedClient(null); setSelectedObligation(null); setSelectedPartner(null); setSuggestion(null)
      loadAll()
    } catch (err: any) {
      toast.error(err.message || 'Σφάλμα')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Διαγραφή κίνησης;')) return
    await supabase.from('cashflow_entries').delete().eq('id', id)
    toast.success('Διαγράφηκε')
    loadAll()
  }

  const ws = summary
  const isIncome = ENTRY_TYPES.find(t => t.value === entryType)?.income

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div>
          <h1 className="page-title">Ταμείο</h1>
          <p className="text-xs text-gray-400 mt-0.5">{formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(balance)}</span>
          <span className="text-xs text-gray-400">υπόλοιπο</span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Πλοήγηση εβδομάδας */}
        <div className="flex items-center gap-3">
          <button className="btn-secondary btn-sm" onClick={() => setWeekStart(prevWeek)}>← Προηγ.</button>
          <span className="text-sm text-gray-600 font-medium">{formatWeekRange(weekStart)}</span>
          {!isCurrentWeek && <button className="btn-secondary btn-sm" onClick={() => setWeekStart(nextWeek)}>Επόμ. →</button>}
          {!isCurrentWeek && <button className="btn-secondary btn-sm text-blue-600" onClick={() => setWeekStart(getWeekStartStr())}>Τρέχουσα</button>}
        </div>

        {/* Σύνοψη */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Εισπράξεις</p><p className="text-base font-semibold text-green-600">{formatMoney(ws?.total_receipts || 0)}</p></div>
          <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Πληρωμές</p><p className="text-base font-semibold text-red-600">{formatMoney((ws?.total_expenses || 0) + (ws?.total_salaries || 0))}</p></div>
          <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Διανομές</p><p className="text-base font-semibold text-amber-600">{formatMoney(ws?.total_distributions || 0)}</p></div>
          <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Αποτέλεσμα</p><p className={`text-base font-semibold ${(ws?.net_result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(ws?.net_result || 0)}</p></div>
          <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Υπόλοιπο κλεισίματος</p><p className={`text-base font-semibold ${(ws?.closing_balance || 0) >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatMoney(ws?.closing_balance || 0)}</p></div>
        </div>

        {/* Φόρμα νέας κίνησης */}
        <div className="card">
          <p className="section-title">Νέα κίνηση</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="label">Ημερομηνία</label><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required /></div>
              <div><label className="label">Τύπος</label>
                <select className="select" value={entryType} onChange={e => handleTypeChange(e.target.value)}>
                  {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="label">Ποσό (€)</label>
                <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={amount}
                  onChange={e => { setAmount(e.target.value); if (selectedClient) checkSuggestion(selectedClient, parseFloat(e.target.value) || 0) }} required />
              </div>
              <div>
                <label className="label">{entryType === 'receipt' ? 'Πελάτης' : entryType === 'distribution' ? 'Συνεταίρος' : ['expense_fixed','expense_periodic','salary'].includes(entryType) ? 'Υποχρέωση' : 'Περιγραφή'}</label>
                {getOptions().length > 0
                  ? <Autocomplete options={getOptions()} value={searchQuery} onChange={setSearchQuery} onSelect={handleSelect} placeholder="Πληκτρολογήστε..." />
                  : <input type="text" className="input" placeholder="Περιγραφή..." value={description} onChange={e => setDescription(e.target.value)} />
                }
              </div>
            </div>
            {getOptions().length > 0 && (
              <div><label className="label">Σχόλιο (προαιρετικό)</label>
                <input type="text" className="input" placeholder="..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            )}
            {suggestion && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
                <span className="font-medium">Πρόταση:</span> {suggestion}
              </div>
            )}
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              {saving ? 'Αποθήκευση...' : `${isIncome ? '+ Είσπραξη' : '− Πληρωμή'}`}
            </button>
          </form>
        </div>

        {/* Λίστα κινήσεων */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><p className="section-title mb-0">Κινήσεις εβδομάδας</p></div>
          {loading ? <p className="text-center text-gray-400 py-8 text-sm">Φόρτωση...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50">
                  <th className="table-header w-24">Ημ/νία</th>
                  <th className="table-header w-36">Τύπος</th>
                  <th className="table-header">Περιγραφή</th>
                  <th className="table-header w-28 text-right">Ποσό</th>
                  <th className="table-header w-24">Χρήστης</th>
                  <th className="table-header w-12"></th>
                </tr></thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="table-cell text-gray-500 text-xs">{new Date(entry.entry_date).toLocaleDateString('el-GR')}</td>
                      <td className="table-cell"><span className={clsx('badge', entry.entry_type === 'receipt' ? 'badge-green' : entry.entry_type === 'distribution' ? 'badge-amber' : 'badge-red')}>{entryTypeLabel(entry.entry_type)}</span></td>
                      <td className="table-cell"><div className="font-medium">{entry.description || entry.client?.name || entry.partner?.name || entry.obligation?.name || '—'}</div>{entry.client && entry.description && <div className="text-xs text-gray-400">{entry.client.name}</div>}</td>
                      <td className={`table-cell text-right font-semibold ${entry.entry_type === 'receipt' ? 'text-green-600' : 'text-red-600'}`}>{entry.entry_type === 'receipt' ? '+' : '−'}{formatMoney(entry.amount)}</td>
                      <td className="table-cell text-xs text-gray-400">{entry.user?.full_name || '—'}</td>
                      <td className="table-cell"><button onClick={() => handleDelete(entry.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button></td>
                    </tr>
                  ))}
                  {entries.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-10">Δεν υπάρχουν κινήσεις αυτή την εβδομάδα</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
