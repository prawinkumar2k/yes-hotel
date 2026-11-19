import { useRef, useState } from "react";
import { FileCheck2, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";
import { imageFileToDataUrl } from "@/lib/imageFile";
import { docImageSrc } from "@/lib/docImage";

type Props = {
  bookingId: string;
  images: string[];
  /** Called after any add or remove so the page can reload the booking. */
  onChanged: () => void;
  /** Show the thumbnails with a remove button (default) or only the "Add ID" button. */
  addOnly?: boolean;
  className?: string;
};

const auth = () => {
  const t = getStoredAuthToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

/**
 * Guest ID documents for a booking: add any number, at any time (before, during or after the stay), and remove a
 * wrong one. Photos are scaled down on the device first, so many documents stay small.
 */
export default function IdDocumentsPanel({ bookingId, images, onChanged, addOnly = false, className = "" }: Props) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const encoded = (await Promise.all(Array.from(files).map((f) => imageFileToDataUrl(f, 1400, 0.75).catch(() => "")))).filter(Boolean);
      if (!encoded.length) throw new Error("Those files could not be read");
      // A few at a time so one request stays small however many documents are chosen.
      let added = 0;
      for (let i = 0; i < encoded.length; i += 5) {
        const r = await fetch(`/api/bookings/${bookingId}/id-documents`, { method: "POST", headers: auth(), body: JSON.stringify({ images: encoded.slice(i, i + 5) }) });
        const j = await r.json().catch(() => ({ success: false, message: `Server error (${r.status})` }));
        if (!j.success) throw new Error(j.message);
        added += j.data?.added ?? 0;
      }
      toast({ title: added ? `${added} ID document${added > 1 ? "s" : ""} added` : "Already on the booking" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Could not add the ID", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (index: number) => {
    if (!window.confirm(`Remove ID document #${index + 1}?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/id-documents/${index}`, { method: "DELETE", headers: auth() });
      const j = await r.json();
      if (!j.success) throw new Error(j.message);
      onChanged();
    } catch (e: any) {
      toast({ title: "Could not remove it", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`print:hidden ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {!addOnly && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1"><FileCheck2 size={12} /> ID documents ({images.length})</span>}
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-black bg-white rounded text-[11px] font-bold uppercase hover:bg-gray-100 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add ID document(s)
        </button>
        <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => add(e.target.files)} />
        <span className="text-[10px] text-gray-500">Any number, any time.</span>
      </div>
      {!addOnly && images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((img, i) => {
            const d = docImageSrc(img);
            return (
              <div key={i} className="relative h-20 w-28 overflow-hidden rounded border border-gray-300 bg-gray-100">
                {d.kind === "image" ? <img src={d.src} alt={`ID ${i + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-gray-500">{d.kind === "pdf" ? "PDF" : "Document"}</div>}
                <button type="button" aria-label={`Remove ID ${i + 1}`} onClick={() => remove(i)} disabled={busy} className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-600 shadow hover:bg-white"><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
