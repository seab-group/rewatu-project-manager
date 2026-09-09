export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'gif', 'svg',
  'csv', 'txt', 'md', 'zip', 'msg', 'eml',
] as const;

export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',');

export const LIMITS_MESSAGE =
  'PDF, Word, Excel, PowerPoint, images, CSV, text, zip and email files. 25 MB per file.';

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export interface FileRejection { file: File; reason: string }

export function validateFile(file: File): string | null {
  const ext = extensionOf(file.name);
  if (!ext) {
    return 'This file has no extension, so we cannot tell what it is. Rename it and try again.';
  }
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `.${ext} files are not accepted. ${LIMITS_MESSAGE}`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `This file is ${formatBytes(file.size)}. The limit is 25 MB — compress it or upload it in parts.`;
  }
  if (file.size === 0) {
    return 'This file is empty. Check it saved properly before uploading.';
  }
  return null;
}

/** True where the browser can render the file in place. */
export function isPreviewable(fileName: string, mimeType: string): boolean {
  const ext = extensionOf(fileName);
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'pdf', 'txt', 'md', 'csv'].includes(ext)
    || mimeType.startsWith('image/')
    || mimeType === 'application/pdf';
}

export function fileKindLabel(fileName: string): string {
  const ext = extensionOf(fileName);
  const map: Record<string, string> = {
    pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel',
    ppt: 'PowerPoint', pptx: 'PowerPoint', png: 'Image', jpg: 'Image', jpeg: 'Image',
    gif: 'Image', svg: 'Image', csv: 'CSV', txt: 'Text', md: 'Text',
    zip: 'Archive', msg: 'Email', eml: 'Email',
  };
  return map[ext] ?? ext.toUpperCase() ?? 'File';
}
