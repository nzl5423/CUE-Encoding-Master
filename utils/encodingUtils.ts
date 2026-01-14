
/**
 * Detects if a string is likely garbled (Mojibake).
 * Checks for replacement characters, high density of symbols, or missing CUE keywords.
 */
export const isLikelyGarbled = (text: string): boolean => {
  if (!text) return true;
  
  // High count of replacement characters is a dead giveaway
  const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCharCount > 0) return true;

  // Check for common CUE keywords.
  const keywords = ['TITLE', 'PERFORMER', 'TRACK', 'FILE', 'INDEX'];
  const upperText = text.toUpperCase();
  const foundKeywords = keywords.filter(k => upperText.includes(k));
  
  // If no basic keywords found, it's probably not decoded correctly
  if (foundKeywords.length < 2) return true;

  // Check for "Mojibake" patterns (e.g., "ÄãºÃ" for "你好" in Latin-1)
  // Usually involves lots of accented characters or mathematical symbols appearing in patterns
  const suspiciousPattern = /[ÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]{3,}/;
  if (suspiciousPattern.test(text)) return true;

  return false;
};

/**
 * Decodes an ArrayBuffer using a specific encoding
 */
export const decodeBuffer = (buffer: ArrayBuffer, encoding: string): string => {
  try {
    // GBK is technically subset of GB18030, which is more robust
    const targetEncoding = encoding.toLowerCase() === 'gbk' ? 'gb18030' : encoding;
    const decoder = new TextDecoder(targetEncoding, { fatal: true });
    return decoder.decode(buffer);
  } catch (e) {
    // If fatal:true triggers, return a basic decode as fallback
    const fallbackDecoder = new TextDecoder(encoding);
    return fallbackDecoder.decode(buffer);
  }
};

/**
 * Downloads a string as a UTF-8 file with BOM.
 * Adding BOM (Byte Order Mark) helps Foobar2000 and Windows Notepad recognize UTF-8 immediately.
 */
export const downloadFile = (content: string, fileName: string) => {
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([BOM, content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
