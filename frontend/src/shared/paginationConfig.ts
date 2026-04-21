const fallbackPageSizes = [10, 20, 50, 100]
export const PAGE_SIZES = Array.from(
  new Set(
    (import.meta.env.VITE_PAGE_SIZES ?? fallbackPageSizes.join(','))
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  ),
)
if (PAGE_SIZES.length === 0) {
  PAGE_SIZES.push(...fallbackPageSizes)
}
const rawDefault = Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE ?? PAGE_SIZES[0])
export const DEFAULT_PAGE_SIZE = PAGE_SIZES.includes(rawDefault)
  ? rawDefault
  : PAGE_SIZES[0]
