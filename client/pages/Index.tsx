import React from "react";
import Navbar from "@/components/hotel/Navbar";
import Hero from "@/components/hotel/Hero";
import HotelStory from "@/components/hotel/HotelStory";
import YesExperience from "@/components/hotel/YesExperience";
import HorizontalStory from "@/components/hotel/HorizontalStory";
import Rooms from "@/components/hotel/Rooms";
import Gallery from "@/components/hotel/Gallery";
import Footer from "@/components/hotel/Footer";
import CursorFollower from "@/components/hotel/CursorFollower";
import ScrollProgress from "@/components/hotel/ScrollProgress";

export default function Index() {
  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white selection:bg-[#c9a227] selection:text-black">
      <ScrollProgress />
      <CursorFollower />
      <Navbar transparent={true} />
      <main className="overflow-hidden">
        <Hero />
        <HotelStory />
        <YesExperience />
        <HorizontalStory />
        <Rooms />
        <Gallery />
      </main>
      <Footer />
    </div>
  );
}
