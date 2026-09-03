import Navbar from "@/components/hotel/Navbar";
import Hero from "@/components/hotel/Hero";
import About from "@/components/hotel/About";
import Stats from "@/components/hotel/Stats";
import Rooms from "@/components/hotel/Rooms";
import Amenities from "@/components/hotel/Amenities";
import WhyChooseUs from "@/components/hotel/WhyChooseUs";
import Gallery from "@/components/hotel/Gallery";
import Testimonials from "@/components/hotel/Testimonials";
import FeaturedBooking from "@/components/hotel/FeaturedBooking";
import Footer from "@/components/hotel/Footer";


export default function Index() {
  return (
    <div className="min-h-screen bg-hotel-ivory">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Stats />
        <Rooms />
        <WhyChooseUs />
        <Amenities />
        <Gallery />
        <Testimonials />
        <FeaturedBooking />
      </main>
      <Footer />
    </div>
  );
}
