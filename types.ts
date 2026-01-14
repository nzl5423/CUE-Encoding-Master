
export enum FileStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FIXED = 'FIXED',
  ERROR = 'ERROR'
}

export interface CueFile {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  originalRaw: ArrayBuffer;
  decodedContent: string;
  fixedContent: string;
  detectedEncoding: string;
  status: FileStatus;
  errorMessage?: string;
}

export const SUPPORTED_ENCODINGS = [
  { label: 'Auto (Gemini)', value: 'auto' },
  { label: 'Simplified Chinese (GBK)', value: 'gbk' },
  { label: 'Traditional Chinese (Big5)', value: 'big5' },
  { label: 'Japanese (Shift-JIS)', value: 'shift-jis' },
  { label: 'Korean (EUC-KR)', value: 'euc-kr' },
  { label: 'UTF-8', value: 'utf-8' },
  { label: 'Windows-1252 (Western)', value: 'windows-1252' }
];
