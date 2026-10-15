/**
 * Staff live connection (Socket.IO /staff). Calls the handler for every live event and re-syncs
 * (onReconnect) after any reconnect, because events missed while offline are not replayed —
 * the database is the source of truth.
 */
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getStoredAuthToken } from "@/lib/authStorage";

export function useStaffRealtime(handler: (event: string, payload: any) => void, onReconnect?: () => void, enabled = true) {
  const [connected, setConnected] = useState(false);
  const h = useRef(handler);
  const r = useRef(onReconnect);
  h.current = handler;
  r.current = onReconnect;

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!enabled || !token) return;
    const socket: Socket = io("/staff", { path: "/socket.io", auth: { token }, transports: ["websocket", "polling"] });
    let first = true;
    socket.on("connect", () => {
      setConnected(true);
      if (!first) r.current?.();
      first = false;
    });
    socket.on("disconnect", () => setConnected(false));
    socket.onAny((event, payload) => h.current(event, payload));
    return () => { socket.close(); };
  }, [enabled]);

  return { connected };
}
