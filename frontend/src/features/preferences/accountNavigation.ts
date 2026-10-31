import { routes } from '@/app/routes'
import type { LearningLanguage } from '@/features/languages/api'

type AccountNavigationState = {
  returnTo?: string
  returnLanguage?: LearningLanguage
  returnScrollTop?: number
  returnState?: Record<string, unknown> | null
}

/** Both the account icon and Back to words restore the same study location. */
export function accountReturnTarget(
  state: AccountNavigationState | null,
  language: LearningLanguage,
) {
  const sameLanguage = !state?.returnLanguage || state.returnLanguage === language
  const path = state?.returnTo
  const validPath =
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith(routes.account)
  return {
    to: sameLanguage && validPath ? path : routes.home,
    state: {
      ...(sameLanguage ? state?.returnState : undefined),
      learningLanguage: language,
      wordListScrollTop: sameLanguage ? (state?.returnScrollTop ?? 0) : 0,
    },
  }
}
