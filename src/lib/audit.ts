import { SupabaseClient } from '@supabase/supabase-js'
import { AuditAction } from '@/types'

export async function writeAuditLog(
  supabase: SupabaseClient,
  params: {
    userId: string
    userName: string
    action: AuditAction
    tableName?: string
    recordId?: string | number
    details?: string
    ipAddress?: string
  }
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      user_id: params.userId,
      user_name: params.userName,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId?.toString(),
      details: params.details,
      ip_address: params.ipAddress,
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}
