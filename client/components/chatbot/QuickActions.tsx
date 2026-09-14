type Props = { onAction: (action: string) => void; unavailable?: boolean };

export default function QuickActions({ onAction, unavailable }: Props) {
  const actions = unavailable
    ? ["Change Dates", "Try Another Room", "Book on Website", "Contact YES Hotels"]
    : ["Check Room Availability", "Hotel Information", "Contact YES Hotels"];
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {actions.map((action) => <button key={action} type="button" onClick={() => onAction(action)} className="rounded-full border border-hotel-black/15 bg-hotel-white px-3 py-2 text-left text-xs text-hotel-black transition hover:border-hotel-gold hover:text-hotel-gold-text focus:outline-none focus:ring-2 focus:ring-hotel-gold">{action}</button>)}
    </div>
  );
}