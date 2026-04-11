'use client'

import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

export type UnifiedSuggestion = {
  id: string
  title: string
  subtitle?: string
  value?: string
}

type UnifiedSearchBarProps = {
  value: string
  placeholder: string
  hasActiveSearch: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onClear: () => void
  suggestions?: UnifiedSuggestion[]
  showSuggestions?: boolean
  onShowSuggestionsChange?: (value: boolean) => void
  onSelectSuggestion?: (item: UnifiedSuggestion) => void
  loadingSuggestions?: boolean
  emptySuggestionsText?: string
}

export default function UnifiedSearchBar({
  value,
  placeholder,
  hasActiveSearch,
  onChange,
  onSubmit,
  onClear,
  suggestions = [],
  showSuggestions = false,
  onShowSuggestionsChange,
  onSelectSuggestion,
  loadingSuggestions = false,
  emptySuggestionsText = 'Aucune suggestion',
}: UnifiedSearchBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current || !onShowSuggestionsChange) {
        return
      }

      if (!rootRef.current.contains(event.target as Node)) {
        onShowSuggestionsChange(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onShowSuggestionsChange])

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (onShowSuggestionsChange && suggestions.length > 0) {
            onShowSuggestionsChange(true)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onSubmit()
          }
        }}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-12 text-sm font-medium text-slate-800 outline-none transition-all focus:border-blue-300 focus:ring-4 ring-blue-900/5"
      />

      <button
        type="button"
        onClick={hasActiveSearch ? onClear : onSubmit}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700"
        aria-label={hasActiveSearch ? 'Annuler la recherche' : 'Executer la recherche'}
      >
        {hasActiveSearch ? <X size={16} /> : <Search size={16} />}
      </button>

      {showSuggestions && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          {loadingSuggestions ? (
            <p className="px-3 py-2 text-sm text-slate-500">Recherche en cours...</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">{emptySuggestionsText}</p>
          ) : (
            suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSuggestion?.(item)}
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100"
              >
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
