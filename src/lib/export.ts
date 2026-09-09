import { buildWorkbook, type CellValue, type Sheet } from '@/lib/xlsx';
import { saveFile, type SaveOutcome } from '@/lib/download';

export type { CellValue, Sheet };
export { buildWorkbook };

export async function downloadWorkbook(sheets: Sheet[], fileName: string): Promise<SaveOutcome> {
  const name = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  return saveFile(name, buildWorkbook(sheets));
}

export function safeFileName(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
