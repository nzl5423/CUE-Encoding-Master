
/**
 * Detects if a string is likely garbled (Mojibake).
 */
export const isLikelyGarbled = (text: string): boolean => {
  if (!text || text.trim().length === 0) return true;
  
  // 1. Check for replacement characters (U+FFFD)
  const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCharCount > 0) return true;

  // 2. Validate CUE structure
  const upperText = text.toUpperCase();
  const keywords = ['TITLE', 'PERFORMER', 'TRACK', 'FILE', 'INDEX'];
  const foundKeywords = keywords.filter(k => upperText.includes(k));
  
  // A valid CUE should have at least some of these keywords
  if (foundKeywords.length < 2) return true;

  // 3. Pattern check for common Mojibake (Latvian/Latin-1 accents appearing as placeholders for CJK)
  // Usually seen as multiple accented chars in a row
  const suspiciousPattern = /[ÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]{3,}/;
  if (suspiciousPattern.test(text)) return true;

  return false;
};

/**
 * Decodes an ArrayBuffer using a specific encoding.
 */
export const decodeBuffer = (buffer: ArrayBuffer, encoding: string): string => {
  try {
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
 * Heuristic to find the best encoding among candidates.
 */
export const autoDetectEncoding = (buffer: ArrayBuffer): { text: string; encoding: string } => {
  const candidates = ['utf-8', 'gb18030', 'big5', 'shift-jis', 'euc-kr', 'windows-1252'];
  
  for (const enc of candidates) {
    try {
      const decoded = decodeBuffer(buffer, enc);
      if (!isLikelyGarbled(decoded)) {
        return { text: decoded, encoding: enc };
      }
    } catch (e) {
      continue;
    }
  }

  // Fallback to first candidate if all fail
  return { text: decodeBuffer(buffer, 'gb18030'), encoding: 'gb18030' };
};

/**
 * Downloads a string as a UTF-8 file with BOM.
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
