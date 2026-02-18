"use client";

import { useState } from "react";
import Image from "next/image";
import { GameSetupModal } from "./GameSetupModal";
import { motion } from "framer-motion";
import clsx from "clsx";

export function LandingPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<"create" | "join">("create");

    const openModal = (m: "create" | "join") => {
        setMode(m);
        setModalOpen(true);
    };

    return (
        <div className="relative min-h-screen bg-[#222222] flex flex-col items-center justify-center overflow-hidden font-sans">

            {/* Background Image - REMOVED for clean black look */}
            <div className="absolute inset-0 z-0 pointer-events-none select-none bg-black" />

            {/* Hero Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-4">

                {/* Logo/Title */}
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    className="mb-12"
                >
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <span className="text-6xl text-[#d4af37]">♠</span>
                        <span className="text-6xl text-white font-serif tracking-widest uppercase">21 BLACKJACK</span>
                        <span className="text-6xl text-[#ef4444]">♥</span>
                    </div>
                    <div className="h-[2px] w-32 bg-[#d4af37] mx-auto mb-4" />
                    <span className="text-[#d4af37] text-xl tracking-[0.5em] uppercase font-light">BLACKJACK</span>
                </motion.div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-6 mt-8">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openModal("create")}
                        className="px-10 py-5 bg-[#d4af37] text-black font-bold text-lg uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:shadow-[0_0_40px_rgba(212,175,55,0.6)] transition-all"
                    >
                        Create Table
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openModal("join")}
                        className="px-10 py-5 bg-transparent border-2 border-white/20 text-white font-bold text-lg uppercase tracking-widest rounded-2xl hover:border-white/60 hover:bg-white/5 transition-all"
                    >
                        Join Table
                    </motion.button>
                </div>

                {/* Footer Info */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="mt-24 text-white/30 text-sm font-light tracking-wide"
                >
                    REAL-TIME MULTIPLAYER • NO LOGIN REQUIRED • SECURE
                </motion.p>

            </div>

            <GameSetupModal isOpen={modalOpen} onClose={() => setModalOpen(false)} defaultTab={mode} />
        </div>
    );
}
