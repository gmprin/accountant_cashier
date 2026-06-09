import { SupabaseClient } from '@supabase/supabase-js'
import { calcMonthlyAmount, currentYear, currentMonth, getLastWorkingDayOfMonth } from './utils'
import { Client } from '@/types'

// ============================================================
// ΑΥΤΟΜΑΤΕΣ ΧΡΕΩΣΕΙΣ
// Τρέχει κάθε φορά που ανοίγει η εφαρμογή.
// Ελέγχει αν υπάρχουν εκκρεμείς χρεώσεις και τις εκτελεί.
// ============================================================

export async function runAutoCharges(supabase: SupabaseClient): Promise<void> {
  try {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1

    // Έλεγχος αν έχουμε ήδη τρέξει για αυτόν τον μήνα
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'last_auto_charge_date')
      .single()

    const lastRun = setting?.value ? new Date(setting.value) : null
    const lastRunYear = lastRun?.getFullYear()
    const lastRunMonth = lastRun ? lastRun.getMonth() + 1 : null

    // Αν έχουμε ήδη τρέξει για τον τρέχοντα μήνα, σταμάτα
    if (lastRunYear === year && lastRunMonth === month) return

    // Βρες όλους τους ενεργούς πελάτες
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)

    if (!clients || clients.length === 0) return

    // Υπολόγισε ποιοι μήνες χρειάζονται χρέωση
    // (από τον μήνα δημιουργίας πελάτη μέχρι τον τρέχοντα)
    for (const client of clients as Client[]) {
      await chargeClientIfNeeded(supabase, client, year, month)
    }

    // Χαρτόσημο Δεκεμβρίου
    if (month === 12) {
      await chargeDecemberStampAndVat(supabase, clients as Client[], year)
    }

    // Ενημέρωσε την ημερομηνία τελευταίας εκτέλεσης
    await supabase
      .from('app_settings')
      .update({ value: today.toISOString().split('T')[0] })
      .eq('key', 'last_auto_charge_date')

  } catch (error) {
    console.error('Auto-charge error:', error)
  }
}

async function chargeClientIfNeeded(
  supabase: SupabaseClient,
  client: Client,
  year: number,
  month: number
): Promise<void> {
  // Μόνο χονδρικής με μηνιαία περιοδικότητα
  if (client.type !== 'hond' || client.period !== 'monthly') return
  if (!client.invoice_amount || client.invoice_amount <= 0) return

  // Έλεγχος αν υπάρχει ήδη χρέωση για τον τρέχοντα μήνα
  const { data: existing } = await supabase
    .from('client_charges')
    .select('id, amount')
    .eq('client_id', client.id)
    .eq('year', year)
    .eq('month', month)
    .in('charge_type', ['monthly', 'manual'])
    .limit(1)

  if (existing && existing.length > 0) return

  // Βρες την τελευταία χρέωση για να πάρεις το τρέχον ποσό
  const { data: lastCharge } = await supabase
    .from('client_charges')
    .select('amount')
    .eq('client_id', client.id)
    .in('charge_type', ['monthly', 'manual'])
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)

  // Αν δεν υπάρχει προηγούμενη χρέωση, χρησιμοποίησε το βασικό ποσό
  let amount: number
  if (lastCharge && lastCharge.length > 0) {
    amount = lastCharge[0].amount
  } else {
    amount = calcMonthlyAmount(
      client.invoice_amount,
      client.inc_stamp,
      client.inc_vat,
      client.vat_period
    )
  }

  // Καταχώριση χρέωσης
  await supabase.from('client_charges').insert({
    client_id: client.id,
    year,
    month,
    charge_type: 'monthly',
    amount,
    description: `Αυτόματη μηνιαία χρέωση`,
    is_auto: true,
  })
}

async function chargeDecemberStampAndVat(
  supabase: SupabaseClient,
  clients: Client[],
  year: number
): Promise<void> {
  for (const client of clients) {
    if (client.type !== 'hond') continue

    // Χαρτόσημο 20% - ετήσιο
    if (client.inc_stamp && client.invoice_amount > 0) {
      const { data: existingStamp } = await supabase
        .from('client_charges')
        .select('id')
        .eq('client_id', client.id)
        .eq('year', year)
        .eq('charge_type', 'stamp')
        .limit(1)

      if (!existingStamp || existingStamp.length === 0) {
        const stampAmount = client.invoice_amount * 0.20
        await supabase.from('client_charges').insert({
          client_id: client.id,
          year,
          month: 12,
          charge_type: 'stamp',
          amount: stampAmount,
          description: `Χαρτόσημο 20% έτους ${year}`,
          is_auto: true,
        })
      }
    }

    // ΦΠΑ ετήσιο - Δεκέμβριο
    if (client.inc_vat && client.vat_period === 'yearly' && client.invoice_amount > 0) {
      const { data: existingVat } = await supabase
        .from('client_charges')
        .select('id')
        .eq('client_id', client.id)
        .eq('year', year)
        .eq('charge_type', 'vat_yearly')
        .limit(1)

      if (!existingVat || existingVat.length === 0) {
        const base = client.invoice_amount
        const stamp = client.inc_stamp ? base * 0.20 : 0
        const vatAmount = (base + stamp) * 0.24
        await supabase.from('client_charges').insert({
          client_id: client.id,
          year,
          month: 12,
          charge_type: 'vat_yearly',
          amount: vatAmount,
          description: `ΦΠΑ 24% έτους ${year}`,
          is_auto: true,
        })
      }
    }
  }
}
