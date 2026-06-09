'use client'
import { useState, useRef, useEffect } from 'react'
import { scoreMatch } from '@/lib/utils'
import clsx from 'clsx'

export interface AutocompleteOption {
  id: number
  label: string
  sublabel?: string
  type?: string
}

interface Props {
  options: AutocompleteOption[]
  value: string
  onChange: (value: string) => void
  onSelect: (option: AutocompleteOption) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function Autocomplete({
  options, value, onChange, onSelect, placeholder, className, disabled
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = value.trim().length < 1
    ? []
    : options
        .map(o => ({ ...o, score: scoreMatch(value, o.label) }))
        .filter(o => o.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

  useEffect(() => {
    setActiveIndex(0)
    setOpen(filtered.length > 0)
  }, [value, filtered.length])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault()
      onSelect(filtered[activeIndex])
      setOpen(false)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        className={clsx('input', className)}
        value={value}
        onChange={e => { onChange(e.target.value); }}
        onFocus={() => { if (filtered.length > 0) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map((opt, i) => (
            <div
              key={opt.id}
              className={clsx(
                'px-4 py-2.5 cursor-pointer text-sm transition-colors',
                i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              )}
              onMouseDown={() => { onSelect(opt); setOpen(false) }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="font-medium text-gray-900">{opt.label}</div>
              {opt.sublabel && <div className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
