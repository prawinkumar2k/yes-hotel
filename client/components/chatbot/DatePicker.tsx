import { format, addDays } from "date-fns";

type Props = { label: string; min?: string; onSubmit: (value: string) => void; onBack: () => void };

export default function DatePicker({ label, min, onSubmit, onBack }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  return (
    <form className="border-t border-hotel-black/10 bg-hotel-white px-4 py-3" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("date"); if (typeof value === "string" && value) onSubmit(value); }}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-hotel-black/60" htmlFor={`chat-${label}`}>{label}</label>
      <div className="flex gap-2">
        <input id={`chat-${label}`} name="date" type="date" required min={min || today} defaultValue={min ? format(addDays(new Date(min), 1), "yyyy-MM-dd") : undefined} className="min-w-0 flex-1 border border-hotel-black/15 bg-hotel-ivory px-3 py-2 text-sm outline-none focus:border-hotel-gold" />
        <button type="button" onClick={onBack} className="border border-hotel-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-hotel-black hover:border-hotel-gold hover:text-hotel-gold-text">Back</button>
        <button className="bg-hotel-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-hotel-white hover:bg-hotel-gold hover:text-hotel-black">Next</button>
      </div>
    </form>
  );
}