import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const LIGHT_HERO_IMAGE = "/gallery/hotel-58.jpg";

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: z.infer<typeof resetSchema>) => {
    if (!token) {
      toast({ variant: "destructive", title: "Error", description: "Invalid or missing token" });
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: data.password }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to reset password");

      toast({
        title: "Success",
        description: "Password reset successfully. You can now login.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-6 text-slate-800">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-stone-200 text-center shadow-xl">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">!</div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2">Invalid Reset Link</h2>
          <p className="text-sm text-slate-500 mb-6">The password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="inline-block py-3 px-6 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition-colors">
            Request a New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] grid grid-cols-1 lg:grid-cols-12 text-slate-800 selection:bg-amber-100 selection:text-amber-900">
      <div className="lg:col-span-5 relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100/50 border-r border-amber-200/50">
        <div className="absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-multiply" style={{ backgroundImage: `url(${LIGHT_HERO_IMAGE})` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#FDFBF7] via-transparent to-amber-50/80" />

        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20 text-white font-serif font-bold text-xl group-hover:scale-105 transition-transform">
              Y
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-wider text-slate-900 uppercase block leading-none">
                YES <span className="text-amber-600">HOTELS</span>
              </span>
              <span className="text-[10px] tracking-[0.25em] text-amber-700/80 font-medium uppercase">Luxurious Sanctuaries</span>
            </div>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 my-auto py-12 max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-300/60 text-amber-900 text-xs font-semibold uppercase tracking-widest mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Account Security
          </div>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
            Create your new <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900">
              secure password.
            </span>
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed font-light">
            Choose a strong password containing at least 8 characters to safeguard your account.
          </p>
        </motion.div>

        <div className="relative z-10 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} YES HOTELS Group.
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#FDFBF7]">
        <div className="flex lg:hidden items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-serif font-bold text-lg">
              Y
            </div>
            <span className="font-serif text-xl font-bold tracking-wider text-slate-900 uppercase">
              YES <span className="text-amber-600">HOTELS</span>
            </span>
          </Link>
        </div>

        <div className="max-w-md w-full mx-auto my-auto py-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-white p-8 sm:p-10 rounded-2xl border border-stone-200/80 shadow-xl shadow-amber-900/5"
          >
            <div className="mb-6 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">Reset Password</h2>
              <p className="mt-1 text-sm text-slate-500">
                Set a new password for your account
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...register("password")}
                    className="w-full pl-10 pr-11 py-3 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...register("confirmPassword")}
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-sm shadow-lg shadow-amber-600/25 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

