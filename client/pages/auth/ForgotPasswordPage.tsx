import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2, Mail, ShieldCheck, Star } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const LIGHT_HERO_IMAGE = "/gallery/hotel-61.jpg";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: z.infer<typeof forgotSchema>) => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send reset link");

      setSuccess(true);
      toast({
        title: "Email Sent",
        description: "If an account exists, you will receive a password reset link.",
      });
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

  return (
    <div className="min-h-screen bg-[#FDFBF7] grid grid-cols-1 lg:grid-cols-12 text-slate-800 selection:bg-amber-100 selection:text-amber-900">
      {/* Left visual showcase */}
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
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Account Recovery
          </div>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
            Secure password <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900">
              restoration.
            </span>
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed font-light">
            Enter your registered email address and we will send you a single-use secure link to reset your account password.
          </p>
        </motion.div>

        <div className="relative z-10 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} YES HOTELS Group.
        </div>
      </div>

      {/* Right form section */}
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
          <Link to="/login" className="text-xs font-semibold text-amber-700 hover:text-amber-900">
            Back to Sign In
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
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">Forgot Password</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your email address to receive reset instructions
              </p>
            </div>

            {success ? (
              <div className="text-center space-y-6 py-4">
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-sm">
                  A password reset link has been sent to your email address if an account exists. Please check your inbox.
                </div>
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-900 hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Return to login
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      {...register("email")}
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-sm shadow-lg shadow-amber-600/25 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Send Reset Link"}
                </button>

                <div className="text-center pt-2">
                  <Link to="/login" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

