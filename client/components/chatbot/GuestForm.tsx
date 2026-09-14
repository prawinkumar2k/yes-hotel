type Props = { onSubmit: (values: { adults: number; children: number; childAges: number[]; rooms: number }) => void };

export default function GuestForm({ onSubmit }: Props) {
  return (
    <form className="border-t border-hotel-black/10 bg-hotel-white px-4 py-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const children = Number(form.get("children")); const ages = Array.from({ length: children }, (_, index) => Number(form.get(`childAge-${index}`))).filter(Number.isFinite); onSubmit({ adults: Number(form.get("adults")), children, childAges: ages, rooms: Number(form.get("rooms")) }); }}>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-hotel-black/60">Adults<input name="adults" type="number" min="1" max="20" defaultValue="1" className="mt-1 w-full border border-hotel-black/15 bg-hotel-ivory px-2 py-2 text-sm" /></label>
        <label className="text-xs text-hotel-black/60">Children<input name="children" type="number" min="0" max="6" defaultValue="0" className="mt-1 w-full border border-hotel-black/15 bg-hotel-ivory px-2 py-2 text-sm" /></label>
        <label className="text-xs text-hotel-black/60">Rooms<input name="rooms" type="number" min="1" max="10" defaultValue="1" className="mt-1 w-full border border-hotel-black/15 bg-hotel-ivory px-2 py-2 text-sm" /></label>
      </div>
      <p className="mt-2 text-[11px] text-hotel-black/50">Child ages are optional and can be shared with our team later.</p>
      <button className="mt-3 w-full bg-hotel-black px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-hotel-white hover:bg-hotel-gold hover:text-hotel-black">Check live availability</button>
    </form>
  );
}