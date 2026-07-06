/**
 * PDF → text extraction. `unpdf` is serverless-safe (bundled pdf.js, no native
 * deps), so the same code runs in the local harness now and in a Vercel route
 * later. Registry letters frequently arrive as "please see attached" with the
 * real document in the PDF, so this feeds the content-first classifier.
 */
import { extractText, getDocumentProxy } from 'unpdf';

export async function extractPdfText(data: Buffer | Uint8Array): Promise<string> {
  try {
    // pdf.js needs a plain Uint8Array — a Node Buffer (a Uint8Array subclass
    // with a byteOffset into a shared pool) is not accepted, so copy into one.
    const pdf = await getDocumentProxy(Uint8Array.from(data));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join('\n') : text).trim();
  } catch {
    // A corrupt/scanned-image PDF yields no text — not a fatal error; the
    // classifier just works from subject/body. (OCR is out of v1 scope.)
    return '';
  }
}

export const isPdf = (filename?: string, mimeType?: string): boolean =>
  mimeType === 'application/pdf' || /\.pdf$/i.test(filename ?? '');
