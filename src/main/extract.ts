import fs from 'node:fs'
import path from 'node:path'

/** Interop helper: dynamic import of CJS deps may or may not nest under .default. */
function unwrap<T>(mod: unknown): T {
  const m = mod as { default?: T }
  return (m.default ?? (mod as T)) as T
}

export const SUPPORTED_EXTS = ['.pdf', '.docx', '.pptx', '.xlsx', '.xls', '.csv', '.txt', '.md', '.markdown']

export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  const buf = fs.readFileSync(filePath)
  switch (ext) {
    case '.pdf': {
      const pdfParse = unwrap<(b: Buffer) => Promise<{ text: string }>>(await import('pdf-parse'))
      const r = await pdfParse(buf)
      return r.text
    }
    case '.docx': {
      const mammoth = await import('mammoth')
      const r = await mammoth.extractRawText({ buffer: buf })
      return r.value
    }
    case '.pptx':
      return extractPptx(buf)
    case '.xlsx':
    case '.xls':
    case '.csv': {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buf, { type: 'buffer' })
      return wb.SheetNames.map(
        (n) => `# Sheet: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])
      ).join('\n\n')
    }
    case '.txt':
    case '.md':
    case '.markdown':
      return buf.toString('utf8')
    default:
      throw new Error(`Unsupported file type: ${ext || '(none)'}`)
  }
}

const slideNum = (name: string): number => Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0)

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function extractPptx(buf: Buffer): Promise<string> {
  const JSZip = unwrap<{ loadAsync(b: Buffer): Promise<any> }>(await import('jszip'))
  const zip = await (JSZip as any).loadAsync(buf)
  const slides = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => slideNum(a) - slideNum(b))
  const parts: string[] = []
  for (const s of slides) {
    const xml: string = await zip.files[s].async('string')
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1]))
    parts.push(`# Slide ${slideNum(s)}\n` + texts.join('\n'))
  }
  return parts.join('\n\n')
}
