/**
 * Excel export. SpreadsheetML 2003 — a real workbook Excel opens natively, with
 * no dependency and no CSV ambiguity about commas inside an action's text.
 */

export type CellValue = string | number | null | undefined;

export interface Sheet {
  name: string;
  headers: string[];
  rows: CellValue[][];
  /** Column widths in characters, matched to the header order. */
  widths?: number[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '&#10;');
}

function cell(v: CellValue): string {
  if (v === null || v === undefined || v === '') return '<Cell ss:StyleID="body"/>';
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `<Cell ss:StyleID="body"><Data ss:Type="Number">${v}</Data></Cell>`;
  }
  return `<Cell ss:StyleID="body"><Data ss:Type="String">${esc(String(v))}</Data></Cell>`;
}

/** Excel refuses sheet names with these characters, or longer than 31. */
function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1';
}

export function buildWorkbook(sheets: Sheet[]): string {
  const body = sheets.map((s) => {
    const cols = (s.widths ?? s.headers.map(() => 18))
      .map((w) => `<Column ss:AutoFitWidth="0" ss:Width="${Math.round(w * 6.2)}"/>`)
      .join('');
    const head = `<Row ss:StyleID="head">${s.headers.map((h) => `<Cell ss:StyleID="head"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>`;
    const rows = s.rows.map((r) => `<Row>${r.map(cell).join('')}</Row>`).join('');
    return `<Worksheet ss:Name="${esc(safeSheetName(s.name))}"><Table>${cols}${head}${rows}</Table>` +
      `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/>` +
      `<SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
  }).join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
<Style ss:ID="head"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#33307C" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
<Style ss:ID="body"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
</Styles>
${body}
</Workbook>`;
}

export function downloadWorkbook(sheets: Sheet[], fileName: string): void {
  const xml = buildWorkbook(sheets);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a moment to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
