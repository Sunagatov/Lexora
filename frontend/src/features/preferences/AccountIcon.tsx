import type { ReactNode } from 'react'

export function AccountIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    account: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="9" r="3" />
        <path d="M6 19v-1a6 6 0 0 1 12 0v1" />
      </>
    ),
    back: <path d="m10 5-7 7 7 7M3 12h18" />,
    next: <path d="m9 5 7 7-7 7" />,
    languages: (
      <>
        <path d="M3 5h12M8 3v2m-3 3c2 4 5 6 9 7M12 5c-1 5-4 8-9 11m11 5 4-11 4 11m-6-4h4" />
      </>
    ),
    study: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="9" cy="18" r="2" />
      </>
    ),
    appearance: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
      </>
    ),
    statistics: (
      <>
        <path d="M4 20V10m8 10V4m8 16v-7" />
      </>
    ),
    data: (
      <>
        <path d="M3 7V4h7l2 3h9v13H3Z" />
        <path d="M8 13h8m-8 3h5" />
      </>
    ),
    offline: (
      <>
        <path d="M7 18a5 5 0 1 1 0-10 6 6 0 0 1 11-1 5 5 0 0 1 0 10" />
        <path d="M12 12v10m-3-3 3 3 3-3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H4v16h5m4-8h8m-3-3 3 3-3 3" />
      </>
    ),
    check: <path d="m5 12 4 4 10-10" />,
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),
  }
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.study}
    </svg>
  )
}
