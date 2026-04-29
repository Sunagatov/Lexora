export type SortMode = 'default' | 'weakest' | 'strongest' | 'largest' | 'az' | 'za'

export const SORT_LABELS: Record<SortMode, string> = {
  default: 'Default',
  weakest: 'Weakest first',
  strongest: 'Strongest first',
  largest: 'Largest first',
  az: 'A → Z',
  za: 'Z → A',
}

export const SORT_OPTIONS: {value: SortMode; label: string}[] = [
  {value: 'default', label: 'Default'},
  {value: 'weakest', label: 'Weakest first'},
  {value: 'strongest', label: 'Strongest first'},
  {value: 'largest', label: 'Largest first'},
  {value: 'az', label: 'A → Z'},
  {value: 'za', label: 'Z → A'},
]
