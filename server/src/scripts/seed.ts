import "dotenv/config";
import mongoose from "mongoose";
import { hashPassword } from "../utils/auth";
import { User, UserRole } from "../models/User";
import { RoomCategory } from "../models/RoomCategory";
import { Room, RoomStatus } from "../models/Room";
import { FAQ } from "../models/FAQ";
import { Testimonial } from "../models/Testimonial";
import { Coupon, DiscountType } from "../models/Coupon";
import { Gallery, GalleryCategory } from "../models/Gallery";
import { WebsiteContent } from "../models/WebsiteContent";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels";

async function seed() {
  console.log("🌱 YES Hotels — Seed Script");
  console.log("Connecting to:", MONGODB_URI.replace(/\/\/.*@/, "//***@"));

  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // ─── USERS ─────────────────────────────────────────────────────────────────
  console.log("\n📦 Seeding users...");
  const USERS = [
    { firstName: "Super", lastName: "Admin", email: "admin@yeshotels.com", password: "Admin@123", role: UserRole.ADMIN },
    { firstName: "Hotel", lastName: "Manager", email: "manager@yeshotels.com", password: "Manager@123", role: UserRole.MANAGER },
    { firstName: "Front", lastName: "Desk", email: "reception@yeshotels.com", password: "Reception@123", role: UserRole.RECEPTIONIST },
    { firstName: "House", lastName: "Keeping", email: "housekeeping@yeshotels.com", password: "House@123", role: UserRole.HOUSEKEEPING },
    { firstName: "Main", lastName: "Tenance", email: "maintenance@yeshotels.com", password: "Main@123", role: UserRole.MAINTENANCE },
    { firstName: "John", lastName: "Doe", email: "customer@yeshotels.com", password: "Customer@123", role: UserRole.CUSTOMER },
  ];

  let adminId: mongoose.Types.ObjectId | undefined;
  for (const u of USERS) {
    let user = await User.findOne({ email: u.email });
    if (user) {
      console.log(`  ⏭  User exists: ${u.email}`);
    } else {
      const passwordHash = await hashPassword(u.password);
      user = await User.create({ ...u, passwordHash, isActive: true, isEmailVerified: true });
      console.log(`  ✅ Created: ${u.email} [${u.role}]`);
    }
    if (u.role === UserRole.ADMIN) adminId = user._id as mongoose.Types.ObjectId;
  }

  // ─── ROOM CATEGORIES ───────────────────────────────────────────────────────
  console.log("\n📦 Seeding room categories...");
  const CATEGORIES = [
    {
      slug: "standard-room",
      name: "Standard Room",
      description: "A thoughtfully appointed room with all essential amenities for a comfortable stay. Features a plush queen bed, contemporary décor, and a well-equipped workspace — perfect for the modern business or leisure traveler.",
      basePrice: 3500,
      capacity: { adults: 2, children: 1 },
      bedType: "Queen Bed",
      size: 320,
      amenities: ["Free Wi-Fi", "Air Conditioning", "Smart TV", "Mini Fridge", "Coffee Maker", "Work Desk", "In-room Safe", "Daily Housekeeping"],
      images: [
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=80",
      ],
    },
    {
      slug: "deluxe-room",
      name: "Deluxe Room",
      description: "An elevated experience featuring a king-sized bed, premium linens, and a partial city view. The Deluxe Room blends sophisticated style with generous space, complete with a luxurious marble bathroom and a curated minibar.",
      basePrice: 6500,
      capacity: { adults: 2, children: 2 },
      bedType: "King Bed",
      size: 480,
      amenities: ["Free Wi-Fi", "Air Conditioning", "55\" Smart TV", "Minibar", "Coffee Maker", "Work Desk", "In-room Safe", "Premium Toiletries", "Bathtub & Shower", "City View", "Turndown Service"],
      images: [
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
      ],
    },
    {
      slug: "executive-room",
      name: "Executive Room",
      description: "Designed for the discerning professional, the Executive Room offers a dedicated living area, high-speed connectivity, and exclusive access to the Executive Lounge. Wake up to panoramic views and unwind in a spacious rain shower.",
      basePrice: 9500,
      capacity: { adults: 2, children: 2 },
      bedType: "King Bed",
      size: 620,
      amenities: ["Free Wi-Fi (1Gbps)", "Nespresso Machine", "65\" Smart TV", "Full Minibar", "Executive Lounge Access", "In-room Safe", "Rainfall Shower", "Panoramic City View", "Complimentary Pressing (2 items)", "Pillow Menu", "Turndown Service"],
      images: [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
      ],
    },
    {
      slug: "suite",
      name: "Signature Suite",
      description: "The pinnacle of luxury at YES Hotels. The Signature Suite features a sprawling living room with a private dining area, floor-to-ceiling windows revealing breathtaking views, a grand master bedroom, and a private terrace. The ultimate expression of bespoke hospitality.",
      basePrice: 18000,
      capacity: { adults: 4, children: 2 },
      bedType: "Super King Bed",
      size: 1200,
      amenities: ["Free Wi-Fi (1Gbps)", "Butler Service", "Private Terrace", "Full Kitchen", "Jacuzzi Bathtub", "Rainfall Shower", "75\" Smart TV", "Bang & Olufsen Sound System", "Full Minibar (restocked daily)", "Complimentary Airport Transfer", "Personal Concierge", "Luxury Toiletries (Bulgari)", "Turndown Service", "Panoramic Views"],
      images: [
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
      ],
    },
  ];

  const categoryMap: Record<string, mongoose.Types.ObjectId> = {};

  for (const cat of CATEGORIES) {
    let category = await RoomCategory.findOne({ slug: cat.slug });
    if (!category) {
      category = await RoomCategory.create({ ...cat, isActive: true });
      console.log(`  ✅ Created category: ${cat.name} (₹${cat.basePrice}/night)`);
    } else {
      console.log(`  ⏭  Category exists: ${cat.name}`);
    }
    categoryMap[cat.slug] = category._id as mongoose.Types.ObjectId;
  }

  // ─── PHYSICAL ROOMS ─────────────────────────────────────────────────────────
  console.log("\n📦 Seeding physical rooms...");
  const ROOMS = [
    // Floor 1 — Standard Rooms
    { roomNumber: "101", floor: "1", slug: "standard-room" },
    { roomNumber: "102", floor: "1", slug: "standard-room" },
    { roomNumber: "103", floor: "1", slug: "standard-room" },
    { roomNumber: "104", floor: "1", slug: "standard-room" },
    // Floor 2 — Deluxe Rooms
    { roomNumber: "201", floor: "2", slug: "deluxe-room" },
    { roomNumber: "202", floor: "2", slug: "deluxe-room" },
    { roomNumber: "203", floor: "2", slug: "deluxe-room" },
    { roomNumber: "204", floor: "2", slug: "deluxe-room" },
    // Floor 3 — Executive Rooms
    { roomNumber: "301", floor: "3", slug: "executive-room" },
    { roomNumber: "302", floor: "3", slug: "executive-room" },
    { roomNumber: "303", floor: "3", slug: "executive-room" },
    // Floor 4 — Suites
    { roomNumber: "401", floor: "4", slug: "suite" },
    { roomNumber: "402", floor: "4", slug: "suite" },
  ];

  for (const r of ROOMS) {
    const exists = await Room.findOne({ roomNumber: r.roomNumber });
    if (exists) {
      console.log(`  ⏭  Room exists: ${r.roomNumber}`);
      continue;
    }
    await Room.create({
      roomNumber: r.roomNumber,
      floor: r.floor,
      category: categoryMap[r.slug],
      status: RoomStatus.AVAILABLE,
    });
    console.log(`  ✅ Created room: ${r.roomNumber} (Floor ${r.floor}) — ${r.slug}`);
  }

  // ─── FAQS ───────────────────────────────────────────────────────────────────
  console.log("\n📦 Seeding FAQs...");
  const FAQS = [
    { question: "What time is check-in and check-out?", answer: "Check-in is from 2:00 PM and check-out is until 11:00 AM. Early check-in and late check-out may be arranged, subject to availability.", category: "Booking", displayOrder: 1 },
    { question: "Is breakfast included in the room rate?", answer: "Complimentary breakfast is included with Deluxe rooms and above. Standard Room guests may add breakfast at booking or at the front desk.", category: "Amenities", displayOrder: 2 },
    { question: "What is your cancellation policy?", answer: "Free cancellation up to 48 hours before check-in. Cancellations within 48 hours are subject to a one-night charge.", category: "Booking", displayOrder: 3 },
    { question: "Do you offer airport transfers?", answer: "Yes, complimentary airport transfers are available for Signature Suite guests. Other guests may arrange a transfer at the front desk for a fee.", category: "Amenities", displayOrder: 4 },
    { question: "Is parking available on-site?", answer: "Yes, we offer complimentary self-parking and valet parking for all guests.", category: "General", displayOrder: 5 },
  ];
  for (const f of FAQS) {
    const exists = await FAQ.findOne({ question: f.question });
    if (exists) { console.log(`  ⏭  FAQ exists: ${f.question}`); continue; }
    await FAQ.create({ ...f, isPublished: true });
    console.log(`  ✅ Created FAQ: ${f.question}`);
  }

  // ─── TESTIMONIALS ───────────────────────────────────────────────────────────
  console.log("\n📦 Seeding testimonials...");
  const TESTIMONIALS = [
    { name: "Priya Sharma", location: "Mumbai, India", rating: 5, comment: "Absolutely stunning property with impeccable service. The Executive Room exceeded every expectation.", displayOrder: 1 },
    { name: "James Whitfield", location: "London, UK", rating: 5, comment: "From check-in to check-out, every detail was thoughtfully handled. Will definitely return on my next trip.", displayOrder: 2 },
    { name: "Aditya Rao", location: "Bangalore, India", rating: 4, comment: "Beautiful rooms and a wonderfully warm staff. The breakfast spread was a real highlight.", displayOrder: 3 },
  ];
  for (const t of TESTIMONIALS) {
    const exists = await Testimonial.findOne({ name: t.name, comment: t.comment });
    if (exists) { console.log(`  ⏭  Testimonial exists: ${t.name}`); continue; }
    await Testimonial.create({ ...t, isPublished: true });
    console.log(`  ✅ Created testimonial: ${t.name}`);
  }

  // ─── COUPONS ────────────────────────────────────────────────────────────────
  if (adminId) {
    console.log("\n📦 Seeding coupons...");
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    const COUPONS = [
      { code: "WELCOME10", description: "10% off your first stay", discountType: DiscountType.PERCENTAGE, discountValue: 10, minBookingAmount: 2000, maxDiscount: 2000, usageLimit: 100, perUserLimit: 1 },
      { code: "FLAT500", description: "Flat ₹500 off bookings above ₹5000", discountType: DiscountType.FIXED, discountValue: 500, minBookingAmount: 5000, usageLimit: 50, perUserLimit: 1 },
    ];
    for (const c of COUPONS) {
      const exists = await Coupon.findOne({ code: c.code });
      if (exists) { console.log(`  ⏭  Coupon exists: ${c.code}`); continue; }
      await Coupon.create({ ...c, startDate: new Date(), expiryDate: oneYearOut, isActive: true, createdBy: adminId });
      console.log(`  ✅ Created coupon: ${c.code}`);
    }
  }

  // ─── GALLERY ────────────────────────────────────────────────────────────────
  // Seeded directly with stable external URLs for demo purposes — real admin
  // uploads go through Cloudinary via the Gallery admin UI. These have no
  // cloudinaryPublicId, so the delete flow correctly skips the Cloudinary
  // call for them.
  console.log("\n📦 Seeding gallery...");
  const GALLERY = [
    { title: "Hotel Exterior at Dusk", category: GalleryCategory.EXTERIOR, imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80", altText: "YES Hotels exterior at dusk", featured: true, displayOrder: 1 },
    { title: "The Lobby", category: GalleryCategory.HOTEL, imageUrl: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80", altText: "Hotel lobby", featured: true, displayOrder: 2 },
    { title: "Deluxe Room", category: GalleryCategory.ROOMS, imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", altText: "Deluxe room interior", featured: false, displayOrder: 3 },
    { title: "Dining Area", category: GalleryCategory.DINING, imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80", altText: "Hotel restaurant", featured: true, displayOrder: 4 },
    { title: "Executive Suite", category: GalleryCategory.ROOMS, imageUrl: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80", altText: "Executive suite interior", featured: false, displayOrder: 5 },
    { title: "Poolside Lounge", category: GalleryCategory.EXPERIENCE, imageUrl: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80", altText: "Poolside lounge area", featured: false, displayOrder: 6 },
  ];
  for (const g of GALLERY) {
    const exists = await Gallery.findOne({ title: g.title });
    if (exists) { console.log(`  ⏭  Gallery image exists: ${g.title}`); continue; }
    await Gallery.create({ ...g, published: true });
    console.log(`  ✅ Created gallery image: ${g.title}`);
  }

  // ─── WEBSITE CONTENT (CMS) ──────────────────────────────────────────────────
  console.log("\n📦 Seeding website content...");
  const CONTENT = [
    {
      key: "homepage-hero",
      title: "Say yes to\ntime well spent.",
      subtitle: "Thoughtful rooms and warm hospitality—beautifully brought together.",
      images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80"],
      metadata: { label: "A Signature Stay by YES Hotels" },
    },
    {
      key: "homepage-about",
      title: "A place that feels\nwonderfully away.",
      description: "Created for those who value beautiful spaces and meaningful moments, YES Hotels brings nature, comfort and considered service into perfect balance.\n\nWhether it is a family weekend, celebration or focused business trip, every detail makes your time together feel effortless.",
      images: [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1800&q=80",
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=900&q=80",
      ],
    },
    {
      key: "about",
      title: "Our Story",
      subtitle: "Redefining luxury hospitality since 2010.",
      description: "At YES Hotels, we believe that true luxury lies in the details. From the moment you step into our grand lobby, you are enveloped in an atmosphere of refined elegance and warm hospitality.\n\nOur mission is to create moments that linger long after checkout. We don't just provide rooms; we curate experiences.",
      images: [
        "https://images.unsplash.com/photo-1542314831-c6a4d27df08f?auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1551882547-ff40c0d129df?auto=format&fit=crop&q=80",
      ],
    },
  ];
  for (const c of CONTENT) {
    const exists = await WebsiteContent.findOne({ key: c.key });
    if (exists) { console.log(`  ⏭  Content exists: ${c.key}`); continue; }
    await WebsiteContent.create({ ...c, isPublished: true });
    console.log(`  ✅ Created content: ${c.key}`);
  }

  // ─── DONE ───────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed complete!");
  console.log("\n📋 Development Login Credentials:");
  console.log("   Admin:       admin@yeshotels.com / Admin@123");
  console.log("   Manager:     manager@yeshotels.com / Manager@123");
  console.log("   Receptionist: reception@yeshotels.com / Reception@123");
  console.log("   Housekeeping: housekeeping@yeshotels.com / House@123");
  console.log("   Maintenance: maintenance@yeshotels.com / Main@123");
  console.log("   Customer:    customer@yeshotels.com / Customer@123");
  console.log("\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
