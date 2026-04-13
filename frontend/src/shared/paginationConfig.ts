export const PAGE_SIZES = (import.meta.env.VITE_PAGE_SIZES ?? '10,20,50,100')
  .split(',')
  .map(Number)
  .filter((n) => n > 0)

export const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE ?? 20)
