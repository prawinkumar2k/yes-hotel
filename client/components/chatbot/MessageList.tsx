import { motion } from "framer-motion";
import type { RefObject } from "react";
import type { ChatMessage } from "./types";

type Props = { messages: ChatMessage[]; onQuickAction: (action: string) => void; endRef: RefObject<HTMLDivElement> };

export default function MessageList({ messages, onQuickAction, endRef }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-hotel-ivory/70 px-4 py-4 [webkit-overflow-scrolling:touch]" aria-live="polite">
      {messages.map((message) => (
        <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={message.sender === "user" ? "ml-auto max-w-[86%]" : "max-w-[92%]"}>
          <div className={message.sender === "user" ? "rounded-2xl rounded-br-sm bg-hotel-black px-3.5 py-2.5 text-sm leading-relaxed text-hotel-white" : "rounded-2xl rounded-bl-sm border border-hotel-black/10 bg-hotel-white px-3.5 py-2.5 text-sm leading-relaxed text-hotel-black"}>
            {message.kind === "details" ? (() => {
              const [heading, ...rows] = message.text.split("\n");
              return <><p className="mb-3 font-medium">{heading}</p><div className="space-y-2">{rows.slice(0, -1).map((row) => { const separator = row.indexOf(":"); return <p key={row} className="border-b border-hotel-black/8 pb-1.5 last:border-0"><strong className="font-semibold">{row.slice(0, separator)}:</strong>{row.slice(separator + 1)}</p>; })}</div><p className="mt-3 border-t border-hotel-black/10 pt-2 text-xs text-hotel-black/60">{rows[rows.length - 1]}</p></>;
            })() : message.text}
          </div>
          {message.kind === "availability" && message.rooms?.map((room) => (
            <div key={room._id} className="mt-2 rounded-xl border border-hotel-gold/40 bg-hotel-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <strong className="font-serif text-base font-normal">{room.name}</strong>
                <span className="font-medium text-hotel-gold-text">{room.pricePerNight ? `₹${room.pricePerNight.toLocaleString("en-IN")}/night` : "Rate to be confirmed"}</span>
              </div>
              <p className="mt-1 text-xs text-hotel-black/60">{room.availableCount} room{room.availableCount === 1 ? "" : "s"} currently available</p>
              <button type="button" onClick={() => onQuickAction(`select-room:${room._id}`)} className="mt-3 w-full bg-hotel-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-hotel-white transition hover:bg-hotel-gold hover:text-hotel-black">Continue</button>
            </div>
          ))}
        </motion.div>
      ))}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}