"use client";

import { motion } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import Image from "next/image";

export default function Hero() {
  const scrollToMenu = () => {
    const menuSection = document.getElementById("menu-section");
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative w-full min-h-[90vh] flex items-center bg-[#000000] overflow-hidden">
      
      {/* RIGHT ALIGNED BACKGROUND IMAGE */}
      <div 
        className="absolute inset-y-0 right-0 z-0 w-full md:w-[70%] bg-cover bg-[right_center] bg-no-repeat"
        style={{ backgroundImage: "url('/hero-feast-v2.png')" }}
      >
        {/* Steam Effect Overlays */}
        <div className="hero-steam-wrapper">
          <div className="organic-steam steam-1"></div>
          <div className="organic-steam steam-2"></div>
          <div className="organic-steam steam-3"></div>
          <div className="organic-steam steam-4"></div>
          <div className="organic-steam steam-5"></div>
        </div>
      </div>

      {/* STRICT LINEAR GRADIENT OVERLAY FOR CONTRAST & BLENDING */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.3) 75%, rgba(0,0,0,0) 100%)"
        }}
      ></div>

      {/* CONTENT STRUCTURE (LEFT SIDE) */}
      <div className="relative z-10 w-full pt-32 pb-16 pl-6 md:pl-[140px]">
        <div className="max-w-xl">
          
          <p 
            className="text-[#9CA3AF] uppercase font-medium mb-[12px] flex items-center gap-2"
            style={{ fontSize: "15px", letterSpacing: "1px" }}
          >
            <span className="w-8 h-[2px] bg-[#EF4444]"></span> Serving GayaJi for 70+ years
          </p>

          <h1 className="text-[44px] md:text-[56px] font-[800] text-white leading-[1.1] tracking-tight mb-[24px] font-sans">
            Authentic Taste.<br />
            <span className="text-[#EF4444]">Delivered Fresh.</span>
          </h1>

          <p className="text-[16px] text-[#D1D5DB] mb-[28px] font-medium leading-relaxed">
            Loved by <span className="text-white font-bold text-lg">10,000+</span> people in the city.
          </p>

          <button
            onClick={scrollToMenu}
            className="btn-strong bg-[#EF4444] hover:bg-[#DC2626] text-white px-8 py-4 rounded-[12px] text-[18px] flex items-center justify-center gap-2 mb-[24px]"
            style={{ letterSpacing: "0.5px" }}
          >
            Explore Menu & Order Now <ArrowRight size={20} strokeWidth={2.5} />
          </button>
            
          {/* Social Proof Strip */}
          <div className="flex flex-wrap items-center gap-x-[16px] gap-y-2 text-[15px] font-medium text-[#D1D5DB]">
            <span className="flex items-center gap-1.5">
              <Star size={16} className="text-yellow-400 fill-yellow-400" /> 4.3 rating
            </span>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <span>2,000+ monthly orders</span>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <span className="text-yellow-500">⚡</span> Fast table ordering
            </span>
          </div>

        </div>
      </div>
    </section>
  );
}
