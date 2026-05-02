import type {WorkbookImportResponse} from '@/features/words/types/wordTypes'

export function getWorkbookActionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function formatWorkbookImportSuccessMessage(result: WorkbookImportResponse): string {
  const lines = [
    'Workbook imported successfully.',
    '',
    `Created: ${result.created}`,
    `Updated: ${result.updated}`,
    `Skipped: ${result.skipped}`,
  ]

  if (result.sheets.length > 0) {
    lines.push(
      '',
      ...result.sheets.map((sheet) => `${sheet.topic_name}: +${sheet.created} new, ${sheet.updated} updated`),
    )
  }

  return lines.join('\n')
}
