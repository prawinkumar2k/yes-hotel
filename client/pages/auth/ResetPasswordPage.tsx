import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
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
      <div className="min-h-screen bg-hotel-ivory flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <h2 className="text-2xl font-serif text-red-600 mb-4">Invalid Reset Link</h2>
          <p className="text-hotel-black/60 mb-6">The password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-hotel-gold-text hover:underline">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hotel-ivory flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="font-serif text-3xl font-semibold tracking-widest text-hotel-black">
            YES <span className="text-hotel-gold-text">HOTELS</span>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-serif text-hotel-black">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-hotel-black/60">
          Enter your new password below
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-hotel-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-hotel-black/10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-hotel-black">
                New Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  {...register("password")}
                  className="appearance-none block w-full px-3 py-2 border border-hotel-black/20 rounded-none shadow-sm focus:outline-none focus:ring-hotel-gold focus:border-hotel-gold sm:text-sm bg-transparent"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-hotel-black">
                Confirm New Password
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  type="password"
                  {...register("confirmPassword")}
                  className="appearance-none block w-full px-3 py-2 border border-hotel-black/20 rounded-none shadow-sm focus:outline-none focus:ring-hotel-gold focus:border-hotel-gold sm:text-sm bg-transparent"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium text-hotel-white bg-hotel-black hover:bg-hotel-black/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hotel-gold disabled:opacity-50 transition-colors"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Reset Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
