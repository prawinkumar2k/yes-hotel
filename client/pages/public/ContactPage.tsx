import { useState, type ChangeEvent, type FormEvent } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { Mail, Phone, MapPin, Loader2, CheckCircle2, Clock3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

const contactCards = [
  {
    icon: MapPin,
    title: "Visit Us",
    lines: ["123 Grand Avenue", "Prestige District", "New York, NY 10001"],
  },
  {
    icon: Phone,
    title: "Reservations",
    lines: ["+1 (800) YES-STAY", "Available 24/7"],
  },
  {
    icon: Mail,
    title: "Email",
    lines: ["hello@yeshotels.com", "events@yeshotels.com"],
  },
  {
    icon: Clock3,
    title: "Front Desk",
    lines: ["Open daily", "6:00 AM - 11:00 PM"],
  },
];

export default function ContactPage() {
  usePageMeta("Contact Us", "Get in touch with YES Hotels for reservations, inquiries, and support.");
  const reducedMotion = useReducedMotion();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState<ContactFormState>({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast({
          title: "Failed to send",
          description: data.message || "Please check your inputs and try again.",
          variant: "destructive",
        });
        return;
      }

      setIsSuccess(true);
      toast({ title: "Message Sent", description: data.message });
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />

      <main className="mx-auto max-w-6xl px-6 py-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={reducedMotion ? false : { opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-hotel-gold-text">
              Contact
            </p>
            <h1 className="mt-4 font-serif text-5xl leading-tight text-hotel-black md:text-6xl">
              Let&apos;s plan your stay.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-hotel-black/65 md:text-lg">
              Whether you are booking a room, planning an event, or need help
              with an existing reservation, our team is here to help with a
              calm, quick response.
            </p>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {contactCards.map(({ icon: Icon, title, lines }, i) => (
                <motion.div
                  key={title}
                  initial={reducedMotion ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={reducedMotion ? undefined : { y: -4 }}
                  className="border border-hotel-black/10 bg-hotel-white p-6 shadow-sm"
                >
                  <Icon size={22} className="text-hotel-gold" />
                  <h2 className="mt-4 font-serif text-2xl text-hotel-black">
                    {title}
                  </h2>
                  <div className="mt-3 space-y-1 text-sm leading-relaxed text-hotel-black/60">
                    {lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={reducedMotion ? false : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="bg-hotel-white border border-hotel-black/10 p-6 shadow-sm md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-hotel-gold/15 p-3">
                <CheckCircle2 className="text-hotel-gold" size={20} />
              </div>
              <div>
                <h2 className="font-serif text-3xl text-hotel-black">
                  Send us a message
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-hotel-black/60">
                  We usually reply within 24 hours.
                </p>
              </div>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hotel-black/60">
                    Full name
                  </span>
                  <input
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full border border-hotel-black/10 bg-transparent px-4 py-3 text-hotel-black outline-none transition-colors placeholder:text-hotel-black/30 focus:border-hotel-gold"
                    placeholder="Your name"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hotel-black/60">
                    Email
                  </span>
                  <input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full border border-hotel-black/10 bg-transparent px-4 py-3 text-hotel-black outline-none transition-colors placeholder:text-hotel-black/30 focus:border-hotel-gold"
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hotel-black/60">
                    Phone
                  </span>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border border-hotel-black/10 bg-transparent px-4 py-3 text-hotel-black outline-none transition-colors placeholder:text-hotel-black/30 focus:border-hotel-gold"
                    placeholder="+1 (800) 123-4567"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hotel-black/60">
                    Subject
                  </span>
                  <input
                    required
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full border border-hotel-black/10 bg-transparent px-4 py-3 text-hotel-black outline-none transition-colors placeholder:text-hotel-black/30 focus:border-hotel-gold"
                    placeholder="Reservation inquiry"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hotel-black/60">
                  Message
                </span>
                <textarea
                  required
                  rows={6}
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full resize-none border border-hotel-black/10 bg-transparent px-4 py-3 text-hotel-black outline-none transition-colors placeholder:text-hotel-black/30 focus:border-hotel-gold"
                  placeholder="Tell us how we can help..."
                />
              </label>

              {isSuccess ? (
                <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Your message has been sent. We will be in touch shortly.
                </div>
              ) : null}

              <GoldButton
                type="submit"
                disabled={isSubmitting}
                className="w-full disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending
                  </>
                ) : (
                  "Send Message"
                )}
              </GoldButton>
            </form>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
