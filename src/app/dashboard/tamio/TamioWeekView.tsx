'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  formatMoney, formatDate, entryTypeLabel, getWeekStartStr,
  getWeekNumber, calcMonthlyAmount, getLastWorkingDayOfMonth
} from '@/lib/utils'
import Autocomplete, { AutocompleteOption } from '@/components/ui/Autocomplete'
import { format, getISOWeek } from 'date-fns'
import clsx from 'clsx'

interface Props {
  weekStart: string
  prevWeek: string
  nextWeek: string
  isCurrentWeek: boolean
  entries: any[]
  summary: any
  clients: any[]
  obligations: any[]
  partners: any[]
  balance: number
  userRole: string
}

const ENTRY_TYPES = [
  { value: 'receipt', label: 'Είσπραξη από πελάτη', income: true },
  { value: 'expense_adhoc', label: 'Έκτακτη πληρωμή', income: false },
  { value: 'expense_fixed', label: 'Σταθερή υποχρέωση', income: false },
  { value: 'expense_periodic', label: 'Περιοδική υποχρέωση', income: false },
  { value: 'salary', label: 'Μισθοδοσία', income: false },
  { value: 'distribution', label: 'Διανομή συνεταίρου', income: false },
]

export default function TamioWeekView({
  weekStart, prevWeek, nextWeek, isCurrentWeek,
  entries, summary, clients, obligations, partners, balance, userRole
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole !== 'viewer'

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [entryType, setEntryType] = useState('receipt')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setSaving] = useState(false)

  // Autocomplete
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [selectedObligation, setSelectedObligation] = useState<any>(null)
  const [selectedPartner, setSelectedPartner] = useState<any>(null)

  // Suggestion for receipts
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const clientOptions: AutocompleteOption[] = clients.map(c => ({
    id: c.id,
    label: c.name,
    sublabel: c.afm ? `ΑΦΜ: ${c.afm}` : c.type === 'lian' ? 'Λιανική' : 'Χονδρική',
    type: 'client',
  }))

  const obligationOptions: AutocompleteOption[] = obligations.map(o => ({
    id: o.id,
    label: o.employee_name || o.name,
    sublabel: o.amount > 0 ? formatMoney(o.amount) : 'Ποσό κατά πληρωμή',
    type: 'obligation',
  }))

  const partnerOptions: AutocompleteOption[] = partners.map(p => ({
    id: p.id,
    label: p.name,
    type: 'partner',
  }))

  function getActiveOptions(): AutocompleteOption[] {
    if (entryType === 'receipt') return clientOptions
    if (entryType === 'distribution') return partnerOptions
    if (['expense_fixed', 'expense_periodic', 'salary'].includes(entryType)) return obligationOptions
    return []
  }

  function handleSelectOption(opt: AutocompleteOption) {
    setSearchQuery(opt.label)
    if (entryType === 'receipt') {
      const client = clients.find(c => c.id === opt.id)
      setSelectedClient(client)
      if (client) checkSuggestion(client, parseFloat(amount) || 0)
    } else if (entryType === 'distribution') {
      setSelectedPartner(partners.find(p => p.id === opt.id))
    } else {
      const obl = obligations.find(o => o.id === opt.id)
      setSelectedObligation(obl)
      if (obl && obl.amount > 0) setAmount(obl.amount.toString())
    }
  }

  function checkSuggestion(client: any, amt: number) {
    if (!client || amt <= 0) { setSuggestion(null); return }
    const unitAmt = client.type === 'hond'
      ? calcMonthlyAmount(client.invoice_amount, client.inc_stamp, client.inc_vat, client.vat_period)
      : client.fee || 0
    if (!unitAmt) { setSuggestion(null); return }
    const periods = Math.round(amt / unitAmt)
    const rem = Math.abs(amt - periods * unitAmt)
    if (periods >= 1 && rem < 0.5) {
      const now = new Date()
      const monthNames = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']
      const perList = []
      for (let i = periods - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        perList.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`)
      }
      setSuggestion(`${periods} περίοδος/oi (${perList.join(', ')}) × ${formatMoney(unitAmt)}`)
    } else {
      setSuggestion(null)
    }
  }

  function handleAmountChange(v: string) {
    setAmount(v)
    if (selectedClient) checkSuggestion(selectedClient, parseFloat(v) || 0)
  }

  function handleTypeChange(t: string) {
    setEntryType(t)
    setSearchQuery('')
    setSelectedClient(null)
    setSelectedObligation(null)
    setSelectedPartner(null)
    setSuggestion(null)
    setAmount('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) { toast.error('Συμπλήρωσε ποσό'); return }
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const entryDate = new Date(date)
      const wStart = getWeekStartStr(entryDate)
      const wNum = getISOWeek(entryDate)

      const payload: any = {
        entry_date: date,
        week_start: wStart,
        year: entryDate.getFullYear(),
        month: entryDate.getMonth() + 1,
        week_number: wNum,
        entry_type: entryType,
        amount: parseFloat(amount),
        description: description || null,
        created_by: user?.id,
        client_id: selectedClient?.id || null,
        obligation_id: selectedObligation?.id || null,
        partner_id: selectedPartner?.id || null,
      }

      const { data: cfEntry, error } = await supabase
        .from('cashflow_entries')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      // Αν είναι είσπραξη, καταχώρισε και στο client_receipts
      if (entryType === 'receipt' && selectedClient) {
        await supabase.from('client_receipts').insert({
          client_id: selectedClient.id,
          amount: parseFloat(amount),
          receipt_date: date,
          year: entryDate.getFullYear(),
          month: entryDate.getMonth() + 1,
          description: description || null,
          created_by: user?.id,
        })
      }

      // Αν είναι διανομή, καταχώρισε στο partner_distributions
      if (entryType === 'distribution' && selectedPartner) {
        await supabase.from('partner_distributions').insert({
          partner_id: selectedPartner.id,
          amount: parseFloat(amount),
          distribution_date: date,
          week_start: wStart,
          year: entryDate.getFullYear(),
          month: entryDate.getMonth() + 1,
          description: description || null,
          cashflow_entry_id: cfEntry.id,
          created_by: user?.id,
        })
      }

      // Αν είναι πληρωμή υποχρέωσης
      if (['expense_fixed', 'expense_periodic', 'salary'].includes(entryType) && selectedObligation) {
        await supabase.from('obligation_payments').insert({
          obligation_id: selectedObligation.id,
          amount: parseFloat(amount),
          payment_date: date,
          description: description || null,
          cashflow_entry_id: cfEntry.id,
          created_by: user?.id,
        })
      }

      toast.success('Καταχωρήθηκε')
      setAmount('')
      setDescription('')
      setSearchQuery('')
      setSelectedClient(null)
      setSelectedObligation(null)
      setSelectedPartner(null)
      setSuggestion(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Σφάλμα καταχώρισης')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Διαγραφή κίνησης;')) return
    await supabase.from('cashflow_entries').delete().eq('id', id)
    toast.success('Διαγράφηκε')
    router.refresh()
  }

  const ws = summary
  const isIncome = ENTRY_TYPES.find(t => t.value === entryType)?.income

  return (
    <div className="p-6 space-y-5">
      {/* Εβδομαδιαία πλοήγηση */}
      <div className="flex items-center gap-3">
        <a href={`/dashboard/tamio?week=${prevWeek}`} className="btn-secondary btn-sm">← Προηγ.</a>
        <span className="text-sm text-gray-600 font-medium">
          {format(new Date(weekStart), 'dd/MM')} – {format(new Date(weekStart.replace(/-\d+$/, '')).setDate(new Date(weekStart).getDate() + 6), 'dd/MM/yyyy')}
        </span>
        {!isCurrentWeek && (
          <a href={`/dashboard/tamio?week=${nextWeek}`} className="btn-secondary btn-sm">Επόμ. →</a>
        )}
        {!isCurrentWeek && (
          <a href="/dashboard/tamio" className="btn-secondary btn-sm text-blue-600">Τρέχουσα</a>
        )}
      </div>

      {/* Σύνοψη εβδομάδας */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Εισπράξεις</p>
          <p className="text-base font-semibold text-green-600">{formatMoney(ws?.total_receipts || 0)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Πληρωμές</p>
          <p className="text-base font-semibold text-red-600">{formatMoney((ws?.total_expenses || 0) + (ws?.total_salaries || 0))}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Διανομές</p>
          <p className="text-base font-semibold text-amber-600">{formatMoney(ws?.total_distributions || 0)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Αποτέλεσμα</p>
          <p className={`text-base font-semibold ${(ws?.net_result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(ws?.net_result || 0)}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Υπόλοιπο κλεισίματος</p>
          <p className={`text-base font-semibold ${(ws?.closing_balance || 0) >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
            {formatMoney(ws?.closing_balance || 0)}
          </p>
        </div>
      </div>

      {/* Φόρμα νέας κίνησης */}
      {canEdit && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Νέα κίνηση</p>
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setShowForm(!showForm)}>
              {showForm ? '▲ Απόκρυψη' : '▼ Εμφάνιση'}
            </button>
          </div>

          {(showForm || true) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">Ημερομηνία</label>
                  <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Τύπος</label>
                  <select className="select" value={entryType} onChange={e => handleTypeChange(e.target.value)}>
                    {ENTRY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Ποσό (€)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => handleAmountChange(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">
                    {entryType === 'receipt' ? 'Πελάτης' :
                     entryType === 'distribution' ? 'Συνεταίρος' :
                     ['expense_fixed','expense_periodic','salary'].includes(entryType) ? 'Υποχρέωση / Υπάλληλος' :
                     'Περιγραφή (προαιρ.)'}
                  </label>
                  {getActiveOptions().length > 0 ? (
                    <Autocomplete
                      options={getActiveOptions()}
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSelect={handleSelectOption}
                      placeholder="Πληκτρολογήστε για αναζήτηση..."
                    />
                  ) : (
                    <input
                      type="text"
                      className="input"
                      placeholder="Περιγραφή..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {getActiveOptions().length > 0 && (
                <div>
                  <label className="label">Σχόλιο (προαιρετικό)</label>
                  <input type="text" className="input" placeholder="..." value={description} onChange={e => setDescription(e.target.value)} />
                </div>
              )}

              {/* Πρόταση εξόφλησης */}
              {suggestion && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
                  <span className="font-medium">Πρόταση:</span> {suggestion}
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="btn-primary btn-sm" disabled={loading}>
                  {loading ? 'Αποθήκευση...' : `${isIncome ? '+ Είσπραξη' : '− Πληρωμή'}`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Λίστα κινήσεων */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="section-title mb-0">Κινήσεις εβδομάδας</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="table-header w-24">Ημ/νία</th>
                <th className="table-header w-36">Τύπος</th>
                <th className="table-header">Περιγραφή</th>
                <th className="table-header w-28 text-right">Ποσό</th>
                <th className="table-header w-24">Χρήστης</th>
                {canEdit && <th className="table-header w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="table-cell text-gray-500 text-xs">{new Date(entry.entry_date).toLocaleDateString('el-GR')}</td>
                  <td className="table-cell">
                    <span className={clsx('badge', entry.entry_type === 'receipt' ? 'badge-green' : entry.entry_type === 'distribution' ? 'badge-amber' : 'badge-red')}>
                      {entryTypeLabel(entry.entry_type)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="font-medium">{entry.description || entry.client?.name || entry.partner?.name || entry.obligation?.name || '—'}</div>
                    {entry.client && entry.description && <div className="text-xs text-gray-400">{entry.client.name}</div>}
                  </td>
                  <td className={`table-cell text-right font-semibold ${entry.entry_type === 'receipt' ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.entry_type === 'receipt' ? '+' : '−'}{formatMoney(entry.amount)}
                  </td>
                  <td className="table-cell text-xs text-gray-400">{entry.user?.full_name || '—'}</td>
                  {canEdit && (
                    <td className="table-cell">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                        title="Διαγραφή"
                      >×</button>
                    </td>
                  )}
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={canEdit ? 6 : 5} className="table-cell text-center text-gray-400 py-10">Δεν υπάρχουν κινήσεις αυτή την εβδομάδα</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
