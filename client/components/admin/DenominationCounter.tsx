import React from "react";
import { Banknote, Coins, Calculator } from "lucide-react";

export interface DenominationState {
  n2000: number;
  n500: number;
  n200: number;
  n100: number;
  n50: number;
  n20: number;
  n10: number;
  coins: number;
}

interface DenominationCounterProps {
  values: DenominationState;
  onChange: (values: DenominationState, total: number) => void;
  readOnly?: boolean;
}

const DENOMINATIONS: { key: keyof DenominationState; label: string; multiplier: number; isCoin?: boolean }[] = [
  { key: "n2000", label: "₹2,000", multiplier: 2000 },
  { key: "n500", label: "₹500", multiplier: 500 },
  { key: "n200", label: "₹200", multiplier: 200 },
  { key: "n100", label: "₹100", multiplier: 100 },
  { key: "n50", label: "₹50", multiplier: 50 },
  { key: "n20", label: "₹20", multiplier: 20 },
  { key: "n10", label: "₹10", multiplier: 10 },
  { key: "coins", label: "Coins / Mixed", multiplier: 1, isCoin: true },
];

export function calculateDenominationTotal(d: DenominationState): number {
  return (
    (Number(d.n2000) || 0) * 2000 +
    (Number(d.n500) || 0) * 500 +
    (Number(d.n200) || 0) * 200 +
    (Number(d.n100) || 0) * 100 +
    (Number(d.n50) || 0) * 50 +
    (Number(d.n20) || 0) * 20 +
    (Number(d.n10) || 0) * 10 +
    (Number(d.coins) || 0)
  );
}

export default function DenominationCounter({ values, onChange, readOnly = false }: DenominationCounterProps) {
  const total = calculateDenominationTotal(values);

  const handleInputChange = (key: keyof DenominationState, valStr: string) => {
    const qty = Math.max(0, parseInt(valStr, 10) || 0);
    const updated = { ...values, [key]: qty };
    const newTotal = calculateDenominationTotal(updated);
    onChange(updated, newTotal);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
          <Calculator size={15} className="text-[#c9a227]" />
          <span>Physical Currency Denomination Breakdown</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase block font-mono">Counted Total</span>
          <span className="text-sm font-bold font-mono text-emerald-600">
            ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {DENOMINATIONS.map(({ key, label, multiplier, isCoin }) => {
          const qty = values[key] || 0;
          const subtotal = qty * multiplier;

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-2xs"
            >
              <div className="flex items-center gap-1.5 w-24">
                {isCoin ? (
                  <Coins size={14} className="text-amber-500 shrink-0" />
                ) : (
                  <Banknote size={14} className="text-emerald-500 shrink-0" />
                )}
                <span className="font-semibold text-gray-700">{label}</span>
              </div>

              <div className="flex items-center gap-1.5 flex-1 justify-center">
                <span className="text-gray-400 text-[10px]">×</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={readOnly}
                  value={qty === 0 ? "" : qty}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder="0"
                  className="w-16 px-2 py-1 text-right font-mono font-bold bg-gray-50 border border-gray-200 rounded focus:border-[#c9a227] focus:bg-white outline-none disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>

              <div className="w-20 text-right font-mono font-semibold text-gray-800">
                ₹{subtotal.toLocaleString("en-IN")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
