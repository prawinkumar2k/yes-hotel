import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

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
    <div className="min-h-screen bg-hotel-ivory flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="font-serif text-3xl font-semibold tracking-widest text-hotel-black">
            YES <span className="text-hotel-gold-text">HOTELS</span>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-serif text-hotel-black">
          Forgot Password
        </h2>
        <p className="mt-2 text-center text-sm text-hotel-black/60">
          Enter your email to reset your password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-hotel-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-hotel-black/10">
          {success ? (
            <div className="text-center space-y-6">
              <div className="bg-green-50 text-green-800 p-4 rounded-md text-sm">
                A password reset link has been sent to your email address. Please check your inbox.
              </div>
              <Link to="/login" className="text-sm font-medium text-hotel-gold-text hover:text-hotel-gold-text/80 flex items-center justify-center gap-2">
                <ArrowLeft size={16} /> Return to login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-hotel-black">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    className="appearance-none block w-full px-3 py-2 border border-hotel-black/20 rounded-none shadow-sm placeholder-hotel-black/40 focus:outline-none focus:ring-hotel-gold focus:border-hotel-gold sm:text-sm bg-transparent"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium text-hotel-white bg-hotel-black hover:bg-hotel-black/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hotel-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Send Reset Link"}
                </button>
              </div>

              <div className="text-center">
                <Link to="/login" className="text-sm font-medium text-hotel-black/60 hover:text-hotel-gold transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft size={16} /> Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
