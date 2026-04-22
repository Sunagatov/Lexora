const fallbackPageSizes = [5, 10, 20, 50, 100]
const configuredPageSizes = (import.meta.env.VITE_PAGE_SIZES ?? fallbackPageSizes.join(','))
  .split(',')
  .map((value: string) => Number(value.trim()))
  .filter((value: number): value is number => Number.isInteger(value) && value > 0)

export const PAGE_SIZES: number[] = Array.from(new Set<number>(configuredPageSizes))
if (PAGE_SIZES.length === 0) {
  PAGE_SIZES.push(...fallbackPageSizes)
}
const fallbackDefaultPageSize = 10
const rawDefault = Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE ?? fallbackDefaultPageSize)
export const DEFAULT_PAGE_SIZE = PAGE_SIZES.includes(rawDefault)
  ? rawDefault
  : PAGE_SIZES[0]
