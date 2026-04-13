/** Returns the string value or empty string if null/undefined. */
export function toStr(v: string | null | undefined): string { return v ?? '' }

/** Returns trimmed string or null if empty. */
export function toNullStr(v: string): string | null { return v.trim() || null }

/** Returns trimmed string or null if condition is false or value is empty. */
export function toNullStrIf(cond: boolean, v: string): string | null { return cond && v.trim() ? v.trim() : null }
