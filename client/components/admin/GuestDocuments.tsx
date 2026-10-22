import { useRef, useState } from "react";
import { Download, FileText, Trash2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { imageFileToDataUrl } from "@/lib/imageFile";

export type GuestDoc = { kind: "ID_FRONT" | "ID_BACK" | "PHOTO" | "OTHER"; label?: string; image: string };
export const DOC_KINDS: { value: GuestDoc["kind"]; label: string }[] = [
  { value: "ID_FRONT", label: "ID proof (front)" },
  { value: "ID_BACK", label: "ID proof (back)" },
  { value: "PHOTO", label: "Guest photo" },
  { value: "OTHER", label: "Other document" },
];
export const kindLabel = (k?: string) => DOC_KINDS.find((x) => x.value === k)?.label ?? (k === "ID" ? "ID proof" : k || "Document");
const isPdf = (src: string) => src.startsWith("data:application/pdf");

/** Picks photos / PDFs from the camera, gallery or files, each with a type: kept in the form until it is saved. */
export function DocumentPicker({ value, onChange }: { value: GuestDoc[]; onChange: (v: GuestDoc[]) => void }) {
  const [kind, setKind] = useState<GuestDoc["kind"]>("ID_FRONT");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next: GuestDoc[] = [];
      for (const f of Array.from(files)) next.push({ kind, image: await imageFileToDataUrl(f, 1600) });
      onChange([...value, ...next]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as GuestDoc["kind"])} className="border rounded-md p-2 text-sm" aria-label="Document type">
          {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="px-3 py-2 border rounded-md text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-50">
          <Upload size={14} /> {busy ? "Reading…" : "Take photo / choose file"}
        </button>
        <input ref={input} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      </div>
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((d, i) => (
            <div key={i} className="relative border rounded-md overflow-hidden bg-gray-50">
              {isPdf(d.image) ? <div className="h-20 flex items-center justify-center text-gray-500"><FileText /></div> : <img src={d.image} alt={kindLabel(d.kind)} className="h-20 w-full object-cover" />}
              <div className="text-[10px] px-1 py-0.5 truncate">{kindLabel(d.kind)}</div>
              <button type="button" aria-label="Remove document" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-500">Photos are scaled down automatically. JPEG, PNG, WebP or PDF.</p>
    </div>
  );
}

export type Proof = { id?: string; source: "DIRECTORY" | "STAY"; kind: string; label?: string; image: string; bookingReference?: string; at?: string };

/** Every proof on file for a guest, in one place: open large, download, and remove the ones added in the directory. */
export function ProofGallery({ proofs, onRemove }: { proofs: Proof[]; onRemove?: (id: string) => void }) {
  const [open, setOpen] = useState<Proof | null>(null);
  if (!proofs.length) return <p className="text-sm text-gray-500">No documents on file yet.</p>;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {proofs.map((p, i) => (
          <div key={p.id ?? i} className="border rounded-lg overflow-hidden bg-white">
            <button type="button" onClick={() => setOpen(p)} className="block w-full" aria-label={`Open ${kindLabel(p.kind)}`}>
              {isPdf(p.image) ? <div className="h-28 flex items-center justify-center text-gray-500"><FileText size={28} /></div> : <img src={p.image} alt={kindLabel(p.kind)} loading="lazy" className="h-28 w-full object-cover" />}
            </button>
            <div className="p-2 text-xs space-y-1">
              <div className="font-semibold truncate">{p.label || kindLabel(p.kind)}</div>
              <div className="text-gray-500 truncate">{p.source === "STAY" ? p.bookingReference : "Added in directory"}</div>
              <div className="flex items-center justify-between">
                <a href={p.image} download={`${kindLabel(p.kind).replace(/\W+/g, "-")}-${i + 1}`} className="text-blue-700 flex items-center gap-1"><Download size={12} /> Download</a>
                {p.source === "DIRECTORY" && p.id && onRemove && (
                  <button type="button" onClick={() => { if (window.confirm("Remove this document?")) onRemove(p.id!); }} className="text-red-600 flex items-center gap-1"><Trash2 size={12} /> Remove</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
          <DialogHeader><DialogTitle>{open?.label || kindLabel(open?.kind)}</DialogTitle></DialogHeader>
          {open && (isPdf(open.image) ? <iframe src={open.image} title="Document" className="w-full h-[75vh]" /> : <img src={open.image} alt={kindLabel(open.kind)} className="max-w-full mx-auto" />)}
        </DialogContent>
      </Dialog>
    </>
  );
}
