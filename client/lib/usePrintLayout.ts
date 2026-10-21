import { useEffect } from "react";

/**
 * Sets the paper for the page being shown: A4, landscape or portrait, with the browser's own header and footer
 * (date, page title, web address) removed by a zero page margin and an even margin on the content instead.
 * Reports use this; invoices and cards keep the browser's default paper.
 */
export function usePrintLayout(orientation: "landscape" | "portrait" = "landscape", marginMm = 10) {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-print-layout", orientation);
    style.textContent = `@page { size: A4 ${orientation}; margin: 0; } @media print { #root { padding: ${marginMm}mm; box-sizing: border-box; } }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [orientation, marginMm]);
}
