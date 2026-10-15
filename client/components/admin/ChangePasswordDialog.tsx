/**
 * Lets any signed-in staff member change their own password (current password required).
 * Other devices are signed out by the server; this one gets a fresh token.
 */
import { useState } from "react";
import { KeyRound, Loader2, X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const tooShort = form.next.length > 0 && form.next.length < 8;
  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next.length < 8 || form.next !== form.confirm) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const json = await res.json().catch(() => ({ success: false, message: res.status === 429 ? "Too many attempts. Please wait a few minutes." : `Server error (${res.status})` }));
      if (!json.success) throw new Error(json.message);
      if (user && json.data?.token) login({ ...user, token: json.data.token });
      toast({ title: "Password changed", description: "Use the new password next time. Other devices have been signed out." });
      setForm({ current: "", next: "", confirm: "" });
      onClose();
    } catch (err: any) {
      toast({ title: "Password not changed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-amber-500 focus:outline-none";
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Change password">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-slate-900"><KeyRound size={18} className="text-amber-600" /> Change password</h3>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] text-slate-400 hover:text-slate-700" aria-label="Close"><X size={20} className="mx-auto" /></button>
        </div>
        <p className="text-xs text-slate-500">Signed in as {user?.email}. Forgot your current password? Ask the Admin to reset it from Staff.</p>
        <label className="block text-xs font-semibold text-slate-600">Current password
          <input type={show ? "text" : "password"} autoComplete="current-password" required value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">New password (at least 8 characters)
          <input type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} className={`${field} mt-1`} />
          {tooShort && <span className="mt-1 block text-[11px] text-red-600">At least 8 characters</span>}
        </label>
        <label className="block text-xs font-semibold text-slate-600">Confirm new password
          <input type={show ? "text" : "password"} autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={`${field} mt-1`} />
          {mismatch && <span className="mt-1 block text-[11px] text-red-600">Passwords don't match</span>}
        </label>
        <button type="button" onClick={() => setShow(!show)} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-slate-600">
          {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? "Hide" : "Show"} passwords
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-[44px] flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="submit" disabled={busy || form.next.length < 8 || form.next !== form.confirm || !form.current} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-amber-500 text-sm font-bold text-white disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
