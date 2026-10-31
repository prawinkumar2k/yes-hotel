import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, FileText, FileSpreadsheet, FileType2, Image as ImageIcon, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Format = "pdf" | "xlsx" | "csv" | "doc" | "png" | "html";

/** A clean copy of the on-screen document: toolbar, modals and other print-hidden parts removed. */
function cloneDocument(): HTMLElement | null {
  const root = document.querySelector("[data-doc-root]") as HTMLElement | null;
  if (!root) return null;
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[class~="print:hidden"], .hidden, button, script').forEach((n) => n.remove());
  return copy;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

/** Every table as rows of text, plus the remaining text as a "Details" list. */
function extract(copy: HTMLElement) {
  const tables = Array.from(copy.querySelectorAll("table")).map((t) =>
    Array.from(t.querySelectorAll("tr")).map((tr) => Array.from(tr.querySelectorAll("th,td")).map((c) => text(c))).filter((r) => r.some(Boolean)),
  );
  const clone = copy.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("table").forEach((t) => t.remove());
  const lines = (clone.innerText || clone.textContent || "")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { tables, lines };
}

/** The nearest blank pixel row at or above `target` (not above `min`), so a page never cuts through text or a box line. */
function findBreak(canvas: HTMLCanvasElement, target: number, min: number) {
  const ctx = canvas.getContext("2d")!;
  for (let row = target; row > min; row--) {
    const d = ctx.getImageData(0, row, canvas.width, 1).data;
    let blank = true;
    for (let i = 0; i < d.length; i += 16) {
      if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { blank = false; break; }
    }
    if (blank) return row;
  }
  return target;
}

async function renderCanvas(copy: HTMLElement) {
  // Rendered by the browser itself (SVG foreignObject), so modern CSS colours (oklch) and fonts match the screen.
  const { toCanvas } = await import("html-to-image");
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:0;top:0;width:850px;background:#fff;padding:16px;z-index:-1;pointer-events:none;";
  holder.appendChild(copy);
  document.body.appendChild(holder);
  try {
    try { await (document as any).fonts?.ready; } catch { /* fonts still loading: render anyway */ }
    return await toCanvas(holder, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  } finally {
    holder.remove();
  }
}

export default function DocumentDownloadMenu({ filename, label = "Download" }: { filename: string; label?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const run = async (fmt: Format) => {
    setBusy(fmt);
    try {
      const copy = cloneDocument();
      if (!copy) throw new Error("Nothing to download yet. Wait for the page to finish loading.");
      const base = filename.replace(/[^\w.-]+/g, "_");

      if (fmt === "pdf" || fmt === "png") {
        const canvas = await renderCanvas(copy);
        if (fmt === "png") {
          canvas.toBlob((b) => b && save(b, `${base}.png`), "image/png");
        } else {
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const margin = 6;
          const imgW = pageW - margin * 2;
          const pxPerMm = canvas.width / imgW;
          const sliceH = Math.floor((pageH - margin * 2) * pxPerMm);
          let y = 0;
          for (let page = 0; y < canvas.height; page++) {
            const end = y + sliceH >= canvas.height ? canvas.height : findBreak(canvas, y + sliceH, y + Math.floor(sliceH * 0.7));
            const h = end - y;
            const part = document.createElement("canvas");
            part.width = canvas.width;
            part.height = h;
            part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            if (page > 0) pdf.addPage();
            pdf.addImage(part.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, imgW, h / pxPerMm);
            y = end;
          }
          pdf.save(`${base}.pdf`);
        }
      } else if (fmt === "xlsx") {
        const ExcelJS = (await import("exceljs")).default;
        const { tables, lines } = extract(copy);
        const wb = new ExcelJS.Workbook();
        const details = wb.addWorksheet("Details");
        lines.forEach((l) => details.addRow([l]));
        details.getColumn(1).width = 100;
        tables.forEach((rows, i) => {
          const ws = wb.addWorksheet(`Table ${i + 1}`);
          rows.forEach((r, ri) => {
            const row = ws.addRow(r.map((c) => (c !== "" && /^-?[\d,]+(\.\d+)?$/.test(c.replace(/[₹\s]/g, "")) && /\d/.test(c) ? Number(c.replace(/[₹,\s]/g, "")) : c)));
            if (ri === 0) row.font = { bold: true };
          });
          ws.columns.forEach((c) => { c.width = 18; });
        });
        const buf = await wb.xlsx.writeBuffer();
        save(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}.xlsx`);
      } else if (fmt === "csv") {
        const { tables, lines } = extract(copy);
        const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const out: string[] = lines.map((l) => q(l));
        tables.forEach((rows) => { out.push(""); rows.forEach((r) => out.push(r.map(q).join(","))); });
        save(new Blob(["﻿" + out.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      } else {
        const css = "body{font-family:Arial,sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:4px}img{max-width:200px}";
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${base}</title><style>${css}</style></head><body>${copy.innerHTML}</body></html>`;
        save(new Blob(["﻿" + html], { type: fmt === "doc" ? "application/msword" : "text/html;charset=utf-8" }), `${base}.${fmt === "doc" ? "doc" : "html"}`);
      }
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Could not create the file", description: e?.message || "Try again", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const items: { fmt: Format; label: string; icon: React.ReactNode }[] = [
    { fmt: "pdf", label: "PDF", icon: <FileText size={14} className="text-red-600" /> },
    { fmt: "xlsx", label: "Excel (.xlsx)", icon: <FileSpreadsheet size={14} className="text-emerald-600" /> },
    { fmt: "csv", label: "CSV", icon: <FileDown size={14} className="text-gray-600" /> },
    { fmt: "doc", label: "Word (.doc)", icon: <FileType2 size={14} className="text-blue-600" /> },
    { fmt: "png", label: "Image (PNG)", icon: <ImageIcon size={14} className="text-purple-600" /> },
    { fmt: "html", label: "Web page (HTML)", icon: <FileText size={14} className="text-amber-600" /> },
  ];

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded text-xs font-bold text-gray-800 transition shadow-sm"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {label}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {items.map((i) => (
            <button
              key={i.fmt}
              type="button"
              disabled={busy !== null}
              onClick={() => run(i.fmt)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-50 text-left"
            >
              {busy === i.fmt ? <Loader2 size={14} className="animate-spin" /> : i.icon} {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
