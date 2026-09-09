/**
 * A minimal .xlsx writer.
 *
 * Excel opens SpreadsheetML 2003 (.xls), but hosts that gate downloads accept
 * `xlsx` and not `xls`, and .xlsx is the better file anyway. Everything here is
 * the small subset a register export needs: inline strings, numbers, column
 * widths, a frozen header row, and one header style. No dependency.
 */

export type CellValue = string | number | null | undefined;

export interface Sheet {
  name: string;
  headers: string[];
  rows: CellValue[][];
  /** Column widths in characters, matched to the header order. */
  widths?: number[];
}

/* ------------------------------------------------------------------ *
 * ZIP (stored — no compression, which every reader accepts)
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entry { name: string; size: number; crc: number; offset: number }

function zip(files: Array<{ name: string; content: string }>): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const entries: Entry[] = [];
  let offset = 0;

  const push = (b: Uint8Array) => { chunks.push(b); offset += b.length; };
  const u32 = (v: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return b; };
  const u16 = (v: number) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v & 0xffff, true); return b; };

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const bytes = enc.encode(f.content);
    const crc = crc32(bytes);
    entries.push({ name: f.name, size: bytes.length, crc, offset });
    push(u32(0x04034b50));             // local file header
    push(u16(20)); push(u16(0x0800));  // version needed, UTF-8 filename flag
    push(u16(0));                      // stored, no compression
    push(u16(0)); push(u16(0));        // mod time, mod date
    push(u32(crc)); push(u32(bytes.length)); push(u32(bytes.length));
    push(u16(nameBytes.length)); push(u16(0));
    push(nameBytes);
    push(bytes);
  }

  const centralStart = offset;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    push(u32(0x02014b50));             // central directory header
    push(u16(20)); push(u16(20)); push(u16(0x0800));
    push(u16(0));
    push(u16(0)); push(u16(0));
    push(u32(e.crc)); push(u32(e.size)); push(u32(e.size));
    push(u16(nameBytes.length)); push(u16(0)); push(u16(0));
    push(u16(0)); push(u16(0)); push(u32(0));
    push(u32(e.offset));
    push(nameBytes);
  }
  const centralSize = offset - centralStart;

  push(u32(0x06054b50));               // end of central directory
  push(u16(0)); push(u16(0));
  push(u16(entries.length)); push(u16(entries.length));
  push(u32(centralSize)); push(u32(centralStart)); push(u16(0));

  return new Blob(chunks as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ------------------------------------------------------------------ *
 * Workbook parts
 * ------------------------------------------------------------------ */

// Excel rejects most control characters outright, so they are dropped.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(CONTROL_CHARS, '');
}

function colName(i: number): string {
  let s = '';
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

/** Excel refuses sheet names with these characters, or longer than 31. */
function safeSheetName(name: string, index: number): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || `Sheet${index + 1}`;
}

function cell(ref: string, v: CellValue, style: number): string {
  if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function sheetXml(s: Sheet): string {
  const widths = s.widths ?? s.headers.map(() => 18);
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const head = `<row r="1" ht="28" customHeight="1">${s.headers.map((h, i) => cell(`${colName(i)}1`, h, 1)).join('')}</row>`;
  const body = s.rows
    .map((r, ri) => `<row r="${ri + 2}">${r.map((v, ci) => cell(`${colName(ci)}${ri + 2}`, v, 2)).join('')}</row>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${head}${body}</sheetData>
</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF33307C"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function buildWorkbook(sheets: Sheet[]): Blob {
  const names = sheets.map((s, i) => safeSheetName(s.name, i));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return zip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/styles.xml', content: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(s) })),
  ]);
}
