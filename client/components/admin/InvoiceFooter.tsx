import { Key } from "lucide-react";

/** Invoice footer in normal flow (no absolute positions), so text can never overlap however long it gets. */
export default function InvoiceFooter() {
  return (
    <div className="border-t border-black p-2 break-inside-avoid text-[9px]">
      <div className="flex justify-between gap-4">
        <div className="w-1/2 space-y-0.5">
          <p>*Regardless of the billing instruction, I agree to be held personally liable for the payment of the total amount of bill for my stay in the hotel.</p>
          <p>*All disputes subject to BENGALURU Jurisdiction.</p>
        </div>
        <div className="w-1/2 text-right text-[10px]">
          <p>Certified that the particulars given above are true and correct.</p>
          <p className="mt-1 font-bold">For YES HOTELS</p>
        </div>
      </div>
      <div className="flex justify-center items-center gap-2 text-[10px] font-bold mt-1">
        <Key size={14} className="text-gray-600 rotate-90" />
        We Request You To Return The Room Key
      </div>
      <div className="flex justify-between items-end mt-8 font-bold uppercase text-[10px]">
        <span>Guest Signatory</span>
        <span className="text-right leading-tight">User<br />Authorised Signatory</span>
      </div>
      <div className="relative text-center text-[10px] font-bold mt-1">
        Thank You! Visit Again!
        <span className="absolute right-0 bottom-0 text-[8px] font-normal">E.&O.E.</span>
      </div>
    </div>
  );
}
