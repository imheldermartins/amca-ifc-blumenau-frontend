import { Select, Switch } from 'cubs-components'

import type { DataViewKind } from '../types'
import { mappedForm, type ViewMockSettings } from '../viewSettings'

export function ViewSettingsForm({
  type,
  settings,
  onChange,
}: {
  type: DataViewKind
  settings: ViewMockSettings
  onChange: (patch: Partial<ViewMockSettings>) => void
}) {
  return (
    <div className="grid gap-4">
      {mappedForm[type].map((field) => (
        <div key={field.key} className="grid gap-2">
          {field.control === 'select' ? (
            <Select
              label={field.label}
              aria-label={field.label}
              value={String(settings[field.key])}
              options={field.options ?? []}
              onValueChange={(value) => onChange({ [field.key]: value })}
            />
          ) : (
            <Switch
              label={field.label}
              checked={Boolean(settings[field.key])}
              onCheckedChange={(checked) => onChange({ [field.key]: checked })}
            />
          )}
        </div>
      ))}
    </div>
  )
}
