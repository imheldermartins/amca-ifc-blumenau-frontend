/** Reserva toda a linha do título sem inventar conteúdo para uma página sem nome. */
export function PageTitleSkeleton() {
  return (
    <span
      aria-hidden="true"
      data-page-title-skeleton
      className="relative block w-full py-1"
    >
      <span className="block h-[1em] w-full animate-pulse rounded-lg bg-active" />
    </span>
  )
}
