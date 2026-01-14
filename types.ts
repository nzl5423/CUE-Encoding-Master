
export enum FileStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FIXED = 'FIXED',
  ERROR = 'ERROR'
}

export interface CueFile {
  id: string;
  name: string;
  path: string; // Relative path for folder structure reconstruction
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
  { label: '自动识别 (本地)', value: 'auto' },
  { label: '简体中文 (GB18030)', value: 'gb18030' },
  { label: '繁体中文 (Big5)', value: 'big5' },
  { label: '日文 (Shift-JIS)', value: 'shift-jis' },
  { label: '韩文 (EUC-KR)', value: 'euc-kr' },
  { label: '西欧 (Windows-1252)', value: 'windows-1252' },
  { label: 'UTF-8', value: 'utf-8' }
];
