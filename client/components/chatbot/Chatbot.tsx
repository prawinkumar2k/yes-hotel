import { useState } from "react";
import { useLocation } from "react-router-dom";
import ChatButton from "./ChatButton";
import ChatWindow from "./ChatWindow";

export default function Chatbot() {
  const location = useLocation();
  const hidden = ["/admin", "/staff", "/customer", "/login", "/register", "/forgot-password", "/reset-password"].some((path) => location.pathname.startsWith(path));
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  if (hidden) return null;
  return <>{(!open || minimized) && <ChatButton open={open} onClick={() => { setOpen(true); setMinimized(false); }} />}{open && !minimized && <ChatWindow onMinimize={() => setMinimized(true)} onClose={() => { setOpen(false); setMinimized(false); }} />}</>;
}