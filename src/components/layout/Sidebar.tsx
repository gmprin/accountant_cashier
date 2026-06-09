'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { UserProfile } from '@/types'
import { roleLabel } from '@/lib/utils'
import clsx from 'clsx'

const NAV_ITEMS = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard' },
  { href: '/dashboard/tamio', icon: '⊟', label: 'Ταμείο' },
  { href: '/dashboard/pelates', icon: '⊕', label: 'Πελάτες' },
  { href: '/dashboard/ypohrewseis', icon: '⊞', label: 'Υποχρεώσεις' },
  { href: '/dashboard/ekkath', icon: '≡', label: 'Εκκαθάριση' },
  { href: '/dashboard/syntairoi', icon: '⊗', label: 'Συνεταίροι' },
]

const ADMIN_ITEMS = [
  { href: '/dashboard/diaxeirisi/xristes', icon: '⊛', label: 'Χρήστες' },
  { href: '/dashboard/diaxeirisi/audit', icon: '⊜', label: 'Audit log' },
]

interface Props { user: UserProfile }

export default function Sidebar({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside className="w-56 bg-gray-50 border-r border-gray-100 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Ταμείο</p>
            <p className="text-xs text-gray-400">Λογιστικό γραφείο</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              isActive(item.href) ? 'sidebar-item-active' : 'sidebar-item'
            )}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}

        {user.role === 'admin' && (
          <>
            <div className="px-3 pt-4 pb-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Διαχείριση</p>
            </div>
            {ADMIN_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  isActive(item.href) ? 'sidebar-item-active' : 'sidebar-item'
                )}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user.full_name}</p>
            <p className="text-[11px] text-gray-400">{roleLabel(user.role)}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-400 hover:text-gray-600 px-1 py-1 transition-colors"
        >
          Αποσύνδεση
        </button>
      </div>
    </aside>
  )
}
