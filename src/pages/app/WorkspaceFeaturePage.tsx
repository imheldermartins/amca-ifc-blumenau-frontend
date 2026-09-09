import { Icon } from '@iconify/react'

import { Typography } from '@/components/Typography'

export function WorkspaceFeaturePage({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: string
}) {
  return (
    <section className="mx-auto w-full max-w-6xl p-4">
      <div className="flex items-center gap-3">
        <Icon icon={icon} className="size-6 text-p-purple" />
        <Typography variant="h1">{title}</Typography>
      </div>
      <Typography variant="body" as="p" className="mt-2 text-dark-100 dark:text-light-900">
        {description}
      </Typography>
    </section>
  )
}
