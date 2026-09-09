import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { RadioGroup } from './RadioGroup'

const options = [
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'member', label: 'Member' },
]

function Probe() {
  const [value, setValue] = useState('member')
  return <RadioGroup aria-label="Role" options={options} value={value} onValueChange={setValue} inline />
}

describe('RadioGroup', () => {
  it('expõe semântica de radio e atualiza o modo state', () => {
    render(<Probe />)
    const admin = screen.getByRole('radio', { name: 'Superadmin' })
    const member = screen.getByRole('radio', { name: 'Member' })
    expect((member as HTMLInputElement).checked).toBe(true)
    fireEvent.click(admin)
    expect((admin as HTMLInputElement).checked).toBe(true)
  })
})
