import type { SessionFilters } from '../types'
import { ArrowRightIcon } from './Icons'

type Filters = Omit<SessionFilters, 'projectId' | 'afterCursor'>

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
}

export function FilterBar({ filters, onChange }: Props) {
  return (
    <div className="filter-bar">
      <select
        value={filters.minEnergy ?? ''}
        onChange={e => onChange({ ...filters, minEnergy: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">All energy levels</option>
        <option value="3">3+ energy</option>
        <option value="4">4+ energy</option>
        <option value="5">Peak only (5)</option>
      </select>
      <label className="filter-checkbox">
        <input type="checkbox" checked={!!filters.shippedOnly}
          onChange={e => onChange({ ...filters, shippedOnly: e.target.checked || undefined })} />
        Shipped only
      </label>
      <input type="date" value={filters.from ?? ''}
        onChange={e => onChange({ ...filters, from: e.target.value || undefined })} title="From date" />
      <ArrowRightIcon />
      <input type="date" value={filters.to ?? ''}
        onChange={e => onChange({ ...filters, to: e.target.value || undefined })} title="To date" />
      <button className="btn btn-ghost btn-sm" onClick={() => onChange({})}>Clear</button>
    </div>
  )
}