"use client";

import { motion } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";

export default function Hero() {
  const scrollToMenu = () => {
    const menuSection = document.getElementById("menu-section");
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center bg-[#0e0e0e] overflow-hidden px-6 lg:px-8">
      
      {/* 1. CINEMATIC BACKGROUND (SMOKY NOISE + AMBIENT SPILLS) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3%3Cfilter id='noiseFilter'%3%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3%3C/filter%3%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3%3C/svg%3")`,
          filter: 'contrast(120%) brightness(100%)'
        }}
      />
      
      {/* Background Ambient Spills */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 15% 15%, rgba(255, 255, 255, 0.04) 0%, transparent 55%),
            radial-gradient(circle at 85% 85%, rgba(220, 30, 10, 0.06) 0%, transparent 55%)
          `
        }}
      />

      {/* 2. SURGICAL OBSIDIAN GLASS CARD */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-7xl backdrop-blur-[32px] rounded-[32px] p-8 md:p-20 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 60% 60% at 0% 0%, 
              rgba(255, 255, 255, 0.12) 0%, 
              rgba(255, 255, 255, 0.05) 25%, 
              rgba(0, 0, 0, 0) 55%),
            radial-gradient(ellipse 60% 60% at 100% 100%, 
              rgba(220, 30, 10, 0.18) 0%, 
              rgba(220, 30, 10, 0.10) 30%, 
              rgba(0, 0, 0, 0) 58%),
            #0d0d0d
          `,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: `
            inset 1.5px 1.5px 0px rgba(255, 255, 255, 0.25),
            inset -1.5px -1.5px 0px rgba(220, 30, 10, 0.7),
            0 40px 100px rgba(0, 0, 0, 0.7),
            0 0 80px -20px rgba(220, 30, 10, 0.15)
          `
        }}
      >
        <div className="max-w-4xl">
          {/* Tagline Feature */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-[3px] h-6 bg-[#dc1e0a]" />
            <p className="text-[#dc1e0a] font-bold text-sm tracking-[0.15em] uppercase">
              Serving Gaya for 70+ Years
            </p>
          </div>

          <h1 className="text-[56px] md:text-[80px] font-extrabold text-white leading-[1.05] tracking-[-0.03em] mb-10 filter drop-shadow-sm">
            Authentic Taste.<br />
            <span className="text-[#dc1e0a]">Delivered Fresh.</span>
          </h1>

          <p className="text-lg md:text-[18px] text-zinc-400 mb-12 max-w-xl leading-[1.6] font-medium">
            Loved by <span className="text-white font-semibold">10,000+</span> people. Experience the heritage of Gaya&apos;s finest biryani, crafted with surgical passion.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-8">
            <button
              onClick={scrollToMenu}
              className="group relative px-10 py-5 bg-[#dc1e0a] text-white font-bold rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-[0_10px_25px_-5px_rgba(220,30,10,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(220,30,10,0.5)] hover:scale-[1.02] active:scale-95 text-lg overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #dc1e0a 0%, #991b1b 100%)'
              }}
            >
              Explore Menu & Order 
              <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="flex items-center gap-5 text-zinc-500 font-semibold border-l sm:border-l border-white/10 pl-6 sm:ml-4">
              <div className="flex -space-x-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-[#0d0d0d] shadow-sm overflow-hidden flex items-center justify-center">
                    <div className="w-full h-full bg-zinc-700/50" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-white font-bold">4.3/5</span>
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={12} fill={s <= 4 ? "#dc1e0a" : "none"} className={s <= 4 ? "text-[#dc1e0a]" : "text-zinc-600"} />
                    ))}
                  </div>
                </div>
                <span className="text-[12px] opacity-60 uppercase tracking-wider">Verified Rating</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
