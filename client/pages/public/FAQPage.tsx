import Navbar from "@/components/hotel/Navbar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFAQs } from "@/hooks/usePublicData";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Loader2 } from "lucide-react";

export default function FAQPage() {
  usePageMeta("Frequently Asked Questions", "Answers to common questions about booking, check-in, cancellations, and more at YES Hotels.");
  const { data: faqs, isLoading, isError } = useFAQs();

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="font-serif text-5xl text-hotel-black mb-6 text-center">Frequently Asked Questions</h1>
        <p className="text-center text-hotel-black/60 mb-16 max-w-2xl mx-auto">
          Find answers to common questions about our services, policies, and amenities.
        </p>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-hotel-gold" />
          </div>
        )}

        {isError && (
          <p className="text-center text-gray-500 py-12">Unable to load FAQs. Please try again later.</p>
        )}

        {!isLoading && !isError && faqs && (
          <div className="bg-hotel-white border border-hotel-black/10 p-8 md:p-12 shadow-sm">
            {faqs.length === 0 ? (
              <p className="text-center text-gray-500">No FAQs available yet.</p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq: any, index: number) => (
                  <AccordionItem key={faq._id || index} value={`item-${index}`} className="border-b border-hotel-black/10 last:border-0">
                    <AccordionTrigger className="text-left font-serif text-xl text-hotel-black hover:text-hotel-gold transition-colors py-6">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-hotel-black/70 leading-relaxed pb-6">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}
        
        <div className="mt-16 text-center">
          <p className="text-hotel-black/60 mb-4">Still have questions?</p>
          <a href="/contact" className="text-sm font-medium uppercase tracking-widest text-hotel-black border-b border-hotel-gold pb-1 hover:text-hotel-gold transition-colors">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
