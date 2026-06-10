'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, formatWeekRange, getWeekStartStr, formatDate } from '@/lib/utils'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'

export default function DashboardPage() {
  const supabase = createClient()
  const [weekly, setWeekly] = useState<any>(null)
  const [monthly, setMonthly] = useState<any>(null)
  const [balance, setBalance] = useState(0)
  const [receipts, setReceipts] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showOblModal, setShowOblModal] = useState(false)
  const [oblData, setOblData] = useState<any[]>([])
  const weekStart = getWeekStartStr()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0]

    const [{ data: w }, { data: m }, { data: b }, { data: e }] = await Promise.all([
      supabase.rpc('get_weekly_summary', { p_week_start: weekStart }),
      supabase.rpc('get_period_summary', { p_from: monthStart, p_to: monthEnd }),
      supabase.rpc('get_cashflow_balance'),
      supabase.from('cashflow_entries')
        .select('*, client:clients(name), partner:partners(name), user:user_profiles(full_name)')
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(20),
    ])
    setWeekly(w?.[0]); setMonthly(m?.[0]); setBalance(b||0)
    setReceipts((e||[]).filter((x:any) => x.entry_type === 'receipt'))
    setPayments((e||[]).filter((x:any) => x.entry_type !== 'receipt'))
    setLoading(false)
  }

  async function loadObligations() {
    const { data: obls } = await supabase.from('obligations').select('*, payments:obligation_payments(amount)').eq('is_active', true)
    const result = (obls||[]).map((o:any) => {
      const paid = (o.payments||[]).reduce((s:number,p:any)=>s+p.amount, 0)
      const balance = o.amount > 0 ? o.amount - paid : 0
      return { ...o, paid, balance }
    }).filter((o:any) => o.balance > 0 || o.amount === 0)
    setOblData(result)
    setShowOblModal(true)
  }

  const totalObligations = oblData.reduce((s,o)=>s+o.balance,0)

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">{formatWeekRange(weekStart)}</p>
        </div>
        <Link href="/dashboard/tamio" className="btn-primary btn-sm">+ Νέα κίνηση</Link>
      </div>

      <div className="p-6 space-y-6">
        {/* Υπόλοιπο ταμείου */}
        <div className="card bg-gray-900 text-white">
          <p className="text-sm text-gray-400 mb-1">Τρέχον υπόλοιπο ταμείου</p>
          <p className={`text-3xl font-semibold ${balance>=0?'text-green-400':'text-red-400'}`}>{formatMoney(balance)}</p>
        </div>

        {/* Εβδομαδιαία */}
        <div>
          <p className="section-title">Τρέχουσα εβδομάδα</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Εισπράξεις</p><p className="text-lg font-semibold text-green-600">{formatMoney(weekly?.total_receipts||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Πληρωμές</p><p className="text-lg font-semibold text-red-600">{formatMoney((weekly?.total_expenses||0)+(weekly?.total_salaries||0))}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Διανομές κερδών</p><p className="text-lg font-semibold text-amber-600">{formatMoney(weekly?.total_distributions||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Αποτέλεσμα</p><p className={`text-lg font-semibold ${(weekly?.net_result||0)>=0?'text-green-600':'text-red-600'}`}>{formatMoney(weekly?.net_result||0)}</p></div>
            <div className="metric-card cursor-pointer hover:bg-gray-100 transition-colors" onClick={loadObligations}>
              <p className="text-xs text-gray-500 mb-1">Ανεξόφλητες υποχρεώσεις <span className="text-blue-500">↗</span></p>
              <p className="text-lg font-semibold text-orange-600">{formatMoney(weekly?.total_expenses||0)}</p>
            </div>
          </div>
        </div>

        {/* Μηνιαία */}
        <div>
          <p className="section-title">Τρέχων μήνας</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Εισπράξεις</p><p className="text-base font-semibold text-green-600">{formatMoney(monthly?.total_receipts||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Πληρωμές</p><p className="text-base font-semibold text-red-600">{formatMoney((monthly?.total_expenses_fixed||0)+(monthly?.total_expenses_periodic||0)+(monthly?.total_expenses_adhoc||0)+(monthly?.total_salaries||0))}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Διανομές κερδών</p><p className="text-base font-semibold text-amber-600">{formatMoney(monthly?.total_distributions||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Αποτέλεσμα μήνα</p><p className={`text-base font-semibold ${(monthly?.net_result||0)>=0?'text-green-600':'text-red-600'}`}>{formatMoney(monthly?.net_result||0)}</p></div>
          </div>
        </div>

        {/* Τελευταίες κινήσεις - διπλός πίνακας */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Εισπράξεις */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="section-title mb-0">Εισπράξεις</p>
              <Link href="/dashboard/tamio" className="text-xs text-blue-600 hover:underline">Όλες →</Link>
            </div>
            {loading ? <p className="text-center text-gray-400 py-6 text-sm">Φόρτωση...</p> : (
              <>
                <table className="w-full">
                  <thead><tr className="bg-gray-50">
                    <th className="table-header w-20">Ημ/νία</th>
                    <th className="table-header">Πελάτης</th>
                    <th className="table-header w-24 text-right">Ποσό</th>
                  </tr></thead>
                  <tbody>
                    {receipts.slice(0,8).map(e=>(
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="table-cell text-gray-500 text-xs">{new Date(e.entry_date).toLocaleDateString('el-GR')}</td>
                        <td className="table-cell text-sm">{e.client?.name || e.description || '—'}</td>
                        <td className="table-cell text-right font-semibold text-green-600">+{formatMoney(e.amount)}</td>
                      </tr>
                    ))}
                    {receipts.length===0 && <tr><td colSpan={3} className="table-cell text-center text-gray-400 py-6">Καμία είσπραξη</td></tr>}
                  </tbody>
                </table>
                <div className="px-5 py-2 border-t border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-500">Σύνολο</span>
                  <span className="font-semibold text-green-600">+{formatMoney(receipts.reduce((s,e)=>s+e.amount,0))}</span>
                </div>
              </>
            )}
          </div>

          {/* Πληρωμές */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="section-title mb-0">Πληρωμές</p>
              <Link href="/dashboard/tamio" className="text-xs text-blue-600 hover:underline">Όλες →</Link>
            </div>
            {loading ? <p className="text-center text-gray-400 py-6 text-sm">Φόρτωση...</p> : (
              <>
                <table className="w-full">
                  <thead><tr className="bg-gray-50">
                    <th className="table-header w-20">Ημ/νία</th>
                    <th className="table-header">Περιγραφή</th>
                    <th className="table-header w-24 text-right">Ποσό</th>
                  </tr></thead>
                  <tbody>
                    {payments.slice(0,8).map(e=>(
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="table-cell text-gray-500 text-xs">{new Date(e.entry_date).toLocaleDateString('el-GR')}</td>
                        <td className="table-cell text-sm">{e.description || e.partner?.name || '—'}</td>
                        <td className="table-cell text-right font-semibold text-red-600">−{formatMoney(e.amount)}</td>
                      </tr>
                    ))}
                    {payments.length===0 && <tr><td colSpan={3} className="table-cell text-center text-gray-400 py-6">Καμία πληρωμή</td></tr>}
                  </tbody>
                </table>
                <div className="px-5 py-2 border-t border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-500">Σύνολο</span>
                  <span className="font-semibold text-red-600">−{formatMoney(payments.reduce((s,e)=>s+e.amount,0))}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal υποχρεώσεων */}
      {showOblModal && (
        <Modal title="Ανεξόφλητες υποχρεώσεις" onClose={()=>setShowOblModal(false)}>
          <div className="space-y-3">
            {oblData.length === 0 ? (
              <p className="text-center text-gray-400 py-6">Δεν υπάρχουν ανεξόφλητες υποχρεώσεις</p>
            ) : (
              <>
                <table className="w-full">
                  <thead><tr className="bg-gray-50">
                    <th className="table-header">Υποχρέωση</th>
                    <th className="table-header w-28 text-right">Πληρωθέν</th>
                    <th className="table-header w-28 text-right">Υπόλοιπο</th>
                    <th className="table-header w-28">Επόμ. λήξη</th>
                  </tr></thead>
                  <tbody>
                    {oblData.map(o=>(
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{o.employee_name||o.name}</td>
                        <td className="table-cell text-right text-green-600">{formatMoney(o.paid)}</td>
                        <td className="table-cell text-right font-semibold text-red-600">{formatMoney(o.balance)}</td>
                        <td className="table-cell text-xs">{o.next_due_date ? <span className={new Date(o.next_due_date)<new Date()?'text-red-600 font-medium':'text-gray-500'}>{formatDate(o.next_due_date)}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between pt-2 border-t border-gray-100 font-semibold text-sm">
                  <span>Σύνολο ανεξόφλητων</span>
                  <span className="text-red-600">{formatMoney(oblData.reduce((s,o)=>s+o.balance,0))}</span>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
