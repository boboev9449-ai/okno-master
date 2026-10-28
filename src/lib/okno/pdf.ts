import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fontRegularUrl from "@/assets/DejaVuSans.ttf?url";
import fontBoldUrl from "@/assets/DejaVuSans-Bold.ttf?url";
import { lineEquipment, lineTitle, STATUS_LABEL } from "@/lib/okno/domain";
import { formatDate, money } from "@/lib/okno/format";
import type { Customer, Order, Settings, SiteObject } from "@/lib/okno/types";

const navy = rgb(0.082, 0.204, 0.314);
const ink = rgb(0.11, 0.16, 0.2);
const muted = rgb(0.36, 0.42, 0.48);

async function loadBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось загрузить шрифт для PDF.");
  return new Uint8Array(await response.arrayBuffer());
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  const pushLong = (token: string) => {
    let rest = token;
    while (rest.length > 0) {
      let take = rest.length;
      while (take > 1 && font.widthOfTextAtSize(rest.slice(0, take), size) > maxWidth) take -= 1;
      lines.push(rest.slice(0, take));
      rest = rest.slice(take);
    }
  };
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      current = "";
      pushLong(word);
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildOfferPdf(
  order: Order,
  customer: Customer | undefined,
  site: SiteObject | undefined,
  settings: Settings,
): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await Promise.all([loadBytes(fontRegularUrl), loadBytes(fontBoldUrl)]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  let page = doc.addPage([595.28, 841.89]);
  let y = 800;
  const left = 40;
  const right = 555;
  const width = right - left;

  const ensure = (need: number) => {
    if (y - need > 48) return;
    page = doc.addPage([595.28, 841.89]);
    y = 800;
  };

  const text = (value: string, size: number, face: PDFFont, color = ink, x = left) => {
    page.drawText(value, { font: face, size, x, y, color });
  };

  const paragraph = (value: string, size: number, face: PDFFont = font, color = ink) => {
    for (const line of wrap(value, face, size, width)) {
      ensure(size + 4);
      text(line, size, face, color);
      y -= size + 4;
    }
  };

  if (settings.logoDataUrl && settings.logoDataUrl.startsWith("data:image/")) {
    try {
      const bytes = dataUrlBytes(settings.logoDataUrl);
      const image = settings.logoDataUrl.includes("image/png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const height = 36;
      const scale = height / image.height;
      page.drawImage(image, { x: left, y: y - height + 10, width: image.width * scale, height });
      y -= height + 8;
    } catch {
      // Logo is optional. A bad file must not block the offer.
    }
  }

  text(settings.companyName || "Компания", 16, bold, navy);
  y -= 20;
  const contacts = [settings.phone, settings.email, settings.address].filter(Boolean).join(" · ");
  if (contacts) paragraph(contacts, 9, font, muted);
  y -= 6;
  text("Коммерческое предложение", 14, bold, navy);
  y -= 18;
  paragraph(`Заказ ${order.number} от ${formatDate(order.date)} · ${STATUS_LABEL[order.status]}`, 10);
  y -= 4;
  paragraph(`Клиент: ${customer?.name ?? "—"}`, 10);
  if (customer?.phone) paragraph(`Телефон: ${customer.phone}`, 10);
  if (customer?.email) paragraph(`Почта: ${customer.email}`, 10);
  paragraph(`Объект: ${site?.name ?? "—"}`, 10);
  if (site?.address || customer?.address) paragraph(`Адрес: ${site?.address || customer?.address || "—"}`, 10);
  y -= 8;

  order.lines.forEach((line, index) => {
    ensure(72);
    text(`${index + 1}. ${lineTitle(line)}`, 11, bold);
    y -= 15;
    paragraph(`Количество: ${line.draft.qty}. Площадь одной конструкции: ${line.calc.areaM2.toFixed(3).replace(".", ",")} м².`, 9);
    paragraph(lineEquipment(line), 9, font, muted);
    for (const formula of line.calc.rows) {
      if (formula.sale === 0 && formula.cost === 0) continue;
      paragraph(`${formula.label}: ${formula.formula} = ${money(formula.sale, settings.currency)}`, 8, font, muted);
    }
    paragraph(`Сумма позиции: ${money(line.calc.sale, settings.currency)}`, 10, bold);
    y -= 6;
  });

  ensure(120);
  y -= 4;
  paragraph(`Сумма позиций: ${money(order.totals.subtotalSale, settings.currency)}`, 10);
  paragraph(`Скидка: ${money(order.totals.discount, settings.currency)}`, 10);
  if (order.totals.extraSale) paragraph(`Дополнительные расходы: ${money(order.totals.extraSale, settings.currency)}`, 10);
  paragraph(`Себестоимость: ${money(order.totals.cost, settings.currency)}`, 10);
  paragraph(`Прибыль: ${money(order.totals.profit, settings.currency)}`, 10);
  y -= 2;
  text(`Итого: ${money(order.totals.sale, settings.currency)}`, 14, bold, navy);
  y -= 22;
  if (order.comment.trim()) {
    paragraph(`Комментарий: ${order.comment.trim()}`, 10);
    y -= 6;
  }
  y -= 16;
  ensure(40);
  text("Заказчик ____________________", 10, font);
  text("Исполнитель ____________________", 10, font, ink, 320);
  return doc.save();
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([Uint8Array.from(bytes)], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadPdf(bytes: Uint8Array, filename: string, title: string) {
  const file = new File([Uint8Array.from(bytes)], filename, { type: "application/pdf" });
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return;
  }
  downloadBytes(bytes, filename, "application/pdf");
}

export function printPdf(bytes: Uint8Array) {
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    downloadBytes(bytes, "okno-master.pdf", "application/pdf");
    return;
  }
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // The browser may still show the PDF without a print dialog.
    }
  }, 600);
}
