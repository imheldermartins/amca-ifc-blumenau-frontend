import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { Button, Popover, Switch } from 'cubs-components'

import './index.css'
import { GuidedAddControl } from './shared/cubs-database/components/GuidedAddControl'

function Preview() {
  const [dark, setDark] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <main className="grid min-h-dvh place-content-center gap-8 bg-background p-8 text-foreground">
      <Popover
        open={open}
        onOpenChange={setOpen}
        side="right"
        align="end"
        sideOffset={8}
        className="min-w-52"
        trigger={<Button color="from-theme">Conta</Button>}
      >
        <div role="menu" className="flex flex-col">
          <button type="button" role="menuitem" className="rounded px-2 py-1 text-left text-sm hover:bg-active">
            Configurações
          </button>
          <Switch
            checked={dark}
            onCheckedChange={setDark}
            label="Modo escuro"
            className="glow-purple-hover w-full flex-row-reverse justify-between rounded px-2 py-1 transition-[color,background-color,box-shadow] hover:bg-active focus-within:bg-active"
          />
        </div>
      </Popover>

      <div className="flex h-36 w-96 overflow-hidden rounded-xl border border-divider bg-background">
        <div className="flex min-w-0 flex-1 flex-col justify-end">
          <GuidedAddControl axis="horizontal" label="Adicionar linha" onClick={() => undefined} />
        </div>
        <GuidedAddControl axis="vertical" label="Adicionar coluna" onClick={() => undefined} />
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)
