import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export async function pdfWithCyrillic(fontBytes: Uint8Array, text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const page = doc.addPage([595.28, 841.89]);
  page.drawText(text, { font, size: 16, x: 40, y: 780, color: rgb(0.11, 0.16, 0.2) });
  return doc.save();
}
