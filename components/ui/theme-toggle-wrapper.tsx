'use client'

import dynamic from 'next/dynamic'

// Dynamically import theme toggle components with no SSR
export const ThemeToggle = dynamic(
  () => import('./theme-toggle').then(mod => mod.ThemeToggle),
  { ssr: false }
)

export const ThemeToggleSimple = dynamic(
  () => import('./theme-toggle').then(mod => mod.ThemeToggleSimple),
  { ssr: false }
)