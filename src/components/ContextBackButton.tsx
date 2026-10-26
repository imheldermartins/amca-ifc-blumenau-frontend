import { Icon } from '@iconify/react'
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { Button, cn } from 'cubs-components'

export function ContextBackButton({ fallback, label, className }: {
  fallback: string
  label: string
  className?: string
}) {
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="text"
      color="from-theme"
      className={cn('active:translate-y-0', className)}
      onClick={() => canGoBack ? router.history.back() : void navigate({ href: fallback, replace: true })}
    >
      <Icon icon="lucide:arrow-left" className="size-4" />
      {label}
    </Button>
  )
}
