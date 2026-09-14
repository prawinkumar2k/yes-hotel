import { MessageCircle } from "lucide-react";

type Props = { open: boolean; onClick: () => void };

export default function ChatButton({ open, onClick }: Props) {
  return (
    <button
      type="button"
      aria-label={open ? "Close YES Hotels concierge" : "Open YES Hotels concierge"}
      onClick={onClick}
      className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-hotel-black text-hotel-gold shadow-[0_12px_35px_rgba(0,0,0,0.22)] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-hotel-gold focus:ring-offset-2 md:bottom-7 md:right-7"
    >
      <MessageCircle size={24} strokeWidth={1.5} />
    </button>
  );
}