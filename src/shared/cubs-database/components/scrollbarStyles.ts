import { cn } from 'cubs-components'

/** Cub's scrollbar: trilho neutro + thumb roxo, ambos theme-aware. */
export const CUBS_SCROLLBAR_CLASS_NAME = cn(
  '[scrollbar-color:var(--p-purple)_var(--contrast)] [scrollbar-width:thin]',
  '[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-contrast',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2',
  '[&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-contrast',
  '[&::-webkit-scrollbar-thumb]:bg-p-purple [&::-webkit-scrollbar-thumb:hover]:bg-p-purple-500',
)
