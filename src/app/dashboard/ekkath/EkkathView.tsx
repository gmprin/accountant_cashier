'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, formatMonth } from '@/lib/utils'
import { format, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'
import * as XLSX from 'xlsx'
import clsx from 'clsx'

type PeriodMode = 'month' | 'quarter' | 'half' | 'year'

const MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος']

export default function EkkathView() {
  const supabase = createClient()
  const now = new Date()
  const [mode, setMode] = useState<PeriodMode>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [half, setHalf] = useState(now.getMonth() < 6 ? 1 : 2)
  const [summary, setSummary] = useState<any>(null)
  const [distributions, setDistributions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  function getDateRange(): { from: string; to: string } {
    if (mode === 'month') {
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const to = new Date(year, month, 0).toISOString().split('T')[0]
      return { from, to }
    }
    if (mode === 'quarter') {
      const qStart = new Date(year, (quarter - 1) * 3, 1)
      const qEnd = new Date(year, quarter * 3, 0)
      return { from: format(qStart, 'yyyy-MM-dd'), to: format(qEnd, 'yyyy-MM-dd') }
    }
    if (mode === 'half') {
      const hStart = new Date(year, half === 1 ? 0 : 6, 1)
      const hEnd = new Date(year, half === 1 ? 6 : 12, 0)
      return { from: format(hStart, 'yyyy-MM-dd'), to: format(hEnd, 'yyyy-MM-dd') }
    }
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    }
  }

  async function loadData() {
    setLoading(true)
    const { from, to } = getDateRange()
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.rpc('get_period_summary', { p_from: from, p_to: to }),
      supabase
        .from('partner_distributions')
        .select('*, partner:partners(name)')
        .gte('distribution_date', from)
        .lte('distribution_date', to)
        .order('distribution_date'),
    ])
    setSummary(s?.[0])
    setDistributions(d || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [mode, year, month, quarter, half])

  function periodLabel() {
    if (mode === 'month') return MONTHS[month - 1] + ' ' + year
    if (mode === 'quarter') return `${quarter}ο Τρίμηνο ${year}`
    if (mode === 'half') return `${half === 1 ? 'Α' : 'Β'} Εξάμηνο ${year}`
    return `Έτος ${year}`
  }

  function exportExcel() {
    if (!summary) return
    const { from, to } = getDateRange()
    const rows = [
      ['Περίοδος', periodLabel()],
      ['Από', from], ['Έως', to], [''],
      ['Κατηγορία', 'Ποσό'],
      ['Εισπράξεις', summary.total_receipts],
      ['Σταθερές υποχρεώσεις', -summary.total_expenses_fixed],
      ['Περιοδικές υποχρεώσεις', -summary.total_expenses_periodic],
      ['Έκτακτες πληρωμές', -summary.total_expenses_adhoc],
      ['Μισθοδοσία', -summary.total_salaries],
      ['Διανομές', -summary.total_distributions],
      [''],
      ['Καθαρό αποτέλεσμα', summary.net_result],
      [''],
      ['Αναλυτικές διανομές ανά συνεταίρο'],
    ]
    const byPartner: Record<string, number> = {}
    distributions.forEach(d => {
      const n = d.partner?.name || '—'
      byPartner[n] = (byPartner[n] || 0) + d.amount
    })
    Object.entries(byPartner).forEach(([name, amt]) => rows.push([name, -amt]))

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Εκκαθάριση')
    XLSX.writeFile(wb, `εκκαθαριση_${from}_${to}.xlsx`)
  }

  const totalExpenses = summary
    ? summary.total_expenses_fixed + summary.total_expenses_periodic +
      summary.total_expenses_adhoc + summary.total_salaries + summary.total_distributions
    : 0

  return (
    <div className="p-6 space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['month', 'quarter', 'half', 'year'] as PeriodMode[]).map(m => (
            <button key={m} className={clsx('btn btn-sm', mode === m ? 'btn-primary' : 'btn-secondary')} onClick={() => setMode(m)}>
              {m === 'month' ? 'Μήνας' : m === 'quarter' ? 'Τρίμηνο' : m === 'half' ? 'Εξάμηνο' : 'Έτος'}
            </button>
          ))}
        </div>

        <select className="select w-20 py-1 text-sm" value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {mode === 'month' && (
          <select className="select w-36 py-1 text-sm" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
        {mode === 'quarter' && (
          <select className="select w-36 py-1 text-sm" value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}>
            {[1,2,3,4].map(q => <option key={q} value={q}>{q}ο Τρίμηνο</option>)}
          </select>
        )}
        {mode === 'half' && (
          <select className="select w-36 py-1 text-sm" value={half} onChange={e => setHalf(parseInt(e.target.value))}>
            <option value={1}>Α΄ Εξάμηνο</option>
            <option value={2}>Β΄ Εξάμηνο</option>
          </select>
        )}

        <button className="btn-secondary btn-sm ml-auto" onClick={exportExcel}>↓ Excel</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Φόρτωση...</div>
      ) : summary ? (
        <div className="space-y-5">
          {/* Main summary */}
          <div className="card">
            <p className="section-title">Σύνοψη — {periodLabel()}</p>
            <div className="space-y-0">
              <SummaryRow label="Εισπράξεις" amount={summary.total_receipts} positive />
              <div className="divider my-2" />
              <SummaryRow label="Σταθερές υποχρεώσεις" amount={summary.total_expenses_fixed} />
              <SummaryRow label="Περιοδικές υποχρεώσεις" amount={summary.total_expenses_periodic} />
              <SummaryRow label="Έκτακτες πληρωμές" amount={summary.total_expenses_adhoc} />
              <SummaryRow label="Μισθοδοσία" amount={summary.total_salaries} />
              <SummaryRow label="Διανομές συνεταίρων" amount={summary.total_distributions} />
              <div className="divider my-2" />
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-gray-900">Καθαρό αποτέλεσμα</span>
                <span className={`text-lg font-bold ${summary.net_result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.net_result >= 0 ? '+' : ''}{formatMoney(summary.net_result)}
                </span>
              </div>
            </div>
          </div>

          {/* Distributions per partner */}
          {distributions.length > 0 && (
            <div className="card">
              <p className="section-title">Διανομές ανά συνεταίρο</p>
              {(() => {
                const byPartner: Record<string, number> = {}
                distributions.forEach(d => {
                  const n = d.partner?.name || '—'
                  byPartner[n] = (byPartner[n] || 0) + d.amount
                })
                return Object.entries(byPartner).map(([name, amt]) => (
                  <SummaryRow key={name} label={name} amount={amt} />
                ))
              })()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">Δεν βρέθηκαν δεδομένα</div>
      )}
    </div>
  )
}

function SummaryRow({ label, amount, positive }: { label: string; amount: number; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${positive ? 'text-green-600' : amount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
        {positive ? '+' : amount > 0 ? '−' : ''}{formatMoney(amount)}
      </span>
    </div>
  )
}
