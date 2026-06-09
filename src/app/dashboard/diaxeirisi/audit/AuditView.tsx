'use client'
import { formatDateTime } from '@/lib/utils'
import { AuditLog } from '@/types'
import clsx from 'clsx'
import Link from 'next/link'

interface Props { logs: AuditLog[]; total: number; page: number; pageSize: number }

export default function AuditView({ logs, total, page, pageSize }: Props) {
  const totalPages = Math.ceil(total / pageSize)

  function actionBadge(action: string) {
    return {
      INSERT: 'badge-green',
      UPDATE: 'badge-amber',
      DELETE: 'badge-red',
      LOGIN: 'badge-blue',
      EXPORT: 'badge-gray',
    }[action] || 'badge-gray'
  }

  return (
    <div className="p-6 space-y-5">
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header w-36">Ημ/ώρα</th>
                <th className="table-header w-32">Χρήστης</th>
                <th className="table-header w-24">Ενέργεια</th>
                <th className="table-header">Λεπτομέρειες</th>
                <th className="table-header w-28">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="table-cell text-xs font-mono text-gray-500">{formatDateTime(log.created_at)}</td>
                  <td className="table-cell text-sm">{log.user_name || '—'}</td>
                  <td className="table-cell">
                    <span className={`badge ${actionBadge(log.action)}`}>{log.action}</span>
                  </td>
                  <td className="table-cell text-sm">{log.details || `${log.table_name}#${log.record_id}` || '—'}</td>
                  <td className="table-cell text-xs font-mono text-gray-400">{log.ip_address || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-10">Δεν υπάρχουν εγγραφές</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">{total} εγγραφές συνολικά</span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link href={`?page=${page - 1}`} className="btn-secondary btn-sm">← Προηγ.</Link>
            )}
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            {page < totalPages && (
              <Link href={`?page=${page + 1}`} className="btn-secondary btn-sm">Επόμ. →</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
