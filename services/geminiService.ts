
import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  /**
   * Analyzes a garbled text snippet to identify its original encoding.
   * Following the SDK guidelines, we instantiate GoogleGenAI right before the API call
   * and use the .text property of the response.
   */
  async analyzeGarbledText(textSnippet: string): Promise<{ encoding: string; cleanedText: string }> {
    // DO: Create a new GoogleGenAI instance right before making an API call.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are a character encoding expert. I have a music CUE file that appears garbled (Mojibake).
        Based on the garbled snippet below, identify the ORIGINAL intended encoding.
        
        Common suspects:
        - Simplified Chinese: 'gb18030' or 'gbk'
        - Traditional Chinese: 'big5'
        - Japanese: 'shift-jis' or 'euc-jp'
        - Korean: 'euc-kr'
        - Western: 'windows-1252'

        Garbled Snippet:
        "${textSnippet}"

        If you can recognize song titles or artist names within the mess, provide a cleaned version.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            encoding: {
              type: Type.STRING,
              description: "The identified IANA encoding name (e.g., 'gb18030', 'big5', 'shift-jis')."
            },
            cleanedText: {
              type: Type.STRING,
              description: "A small sample of the text if you successfully reconstructed it."
            }
          },
          required: ["encoding", "cleanedText"]
        }
      }
    });

    try {
      // DO: Access the .text property directly (not as a function).
      const text = response.text || '{}';
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return { encoding: 'gb18030', cleanedText: textSnippet };
    }
  }
}

export const geminiService = new GeminiService();
