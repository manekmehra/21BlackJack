"use client";

import { useState } from "react";
import { useGameStore } from "@/store/use-game-store";
import { X, ArrowRight, User, DollarSign, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { motion } from "framer-motion";

interface GameSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab?: "create" | "join";
}

const BUY_IN_PRESETS = [500, 1000, 2000, 5000];
const ROTATION_PRESETS = [3, 5, 8, 10];

export function GameSetupModal({ isOpen, onClose, defaultTab = "create" }: GameSetupModalProps) {
    const [activeTab, setActiveTab] = useState<"create" | "join">(defaultTab);
    const [nickname, setNickname] = useState("");
    const [tableCode, setTableCode] = useState("");

    // Settings State
    const [dealerMode, setDealerMode] = useState<"me" | "random">("me");
    const [rotationRule, setRotationRule] = useState<"permanent" | "rotate">("permanent");
    const [rotationInterval, setRotationInterval] = useState(5);
    const [buyIn, setBuyIn] = useState(1000);
    const [customBuyIn, setCustomBuyIn] = useState("");

    const { createTable, joinTable } = useGameStore();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname) return;

        const finalBuyIn = customBuyIn ? parseInt(customBuyIn) || buyIn : buyIn;

        if (activeTab === "create") {
            createTable(nickname, finalBuyIn, { dealerMode, rotationRule, rotationInterval });
        } else {
            if (!tableCode) return;
            joinTable(tableCode, nickname, finalBuyIn);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-[#222222] border border-[#333333] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors z-10"
                >
                    <X size={20} />
                </button>

                {/* Tabs */}
                <div className="flex border-b border-[#333333]">
                    <button
                        onClick={() => setActiveTab("create")}
                        className={clsx(
                            "flex-1 py-6 text-sm font-bold tracking-widest uppercase transition-colors relative",
                            activeTab === "create" ? "text-white bg-[#2a2a2a]" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        Create Table
                        {activeTab === "create" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4af37]" />}
                    </button>
                    <button
                        onClick={() => setActiveTab("join")}
                        className={clsx(
                            "flex-1 py-6 text-sm font-bold tracking-widest uppercase transition-colors relative",
                            activeTab === "join" ? "text-white bg-[#2a2a2a]" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        Join Table
                        {activeTab === "join" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4af37]" />}
                    </button>
                </div>

                {/* Form */}
                <div className="p-8">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                        {/* Nickname Input */}
                        <div>
                            <label className="block text-xs font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                                Your Nickname
                            </label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="Enter name..."
                                className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-4 py-3 rounded-sm focus:outline-none focus:border-[#d4af37] transition-colors font-sans"
                                maxLength={12}
                            />
                        </div>

                        {/* Buy-In Selection */}
                        <div className="p-4 bg-[#1a1a1a] rounded-sm border border-[#333333]">
                            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                                <DollarSign size={14} className="text-[#d4af37]" />
                                Buy-In Amount
                            </h3>
                            <div className="grid grid-cols-4 gap-2 mb-2">
                                {BUY_IN_PRESETS.map(amount => (
                                    <button
                                        type="button"
                                        key={amount}
                                        onClick={() => { setBuyIn(amount); setCustomBuyIn(""); }}
                                        className={clsx(
                                            "py-2 text-xs font-bold border rounded-sm transition-colors",
                                            buyIn === amount && !customBuyIn
                                                ? "bg-[#d4af37] text-black border-[#d4af37]"
                                                : "bg-transparent text-white/40 border-[#333333] hover:text-white/60"
                                        )}
                                    >
                                        ${amount.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="number"
                                value={customBuyIn}
                                onChange={(e) => setCustomBuyIn(e.target.value)}
                                placeholder="Custom amount..."
                                min={100}
                                className="w-full bg-[#151515] border border-[#333333] text-white/60 px-3 py-2 rounded-sm text-xs focus:outline-none focus:border-[#d4af37] transition-colors font-mono"
                            />
                        </div>

                        {/* Create Options */}
                        {activeTab === "create" && (
                            <div className="space-y-4">
                                <div className="p-4 bg-[#1a1a1a] rounded-sm border border-[#333333]">
                                    <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                                        <User size={14} className="text-[#d4af37]" />
                                        Dealer Rules
                                    </h3>

                                    {/* Dealer Selection */}
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setDealerMode("me")}
                                            className={clsx("flex-1 py-2 text-xs font-bold uppercase border rounded-sm transition-colors",
                                                dealerMode === "me" ? "bg-[#d4af37] text-black border-[#d4af37]" : "bg-transparent text-white/40 border-[#333333]")}
                                        >
                                            I am Dealer
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDealerMode("random")}
                                            className={clsx("flex-1 py-2 text-xs font-bold uppercase border rounded-sm transition-colors",
                                                dealerMode === "random" ? "bg-[#d4af37] text-black border-[#d4af37]" : "bg-transparent text-white/40 border-[#333333]")}
                                        >
                                            Random
                                        </button>
                                    </div>

                                    {/* Rotation Rules */}
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRotationRule("permanent")}
                                            className={clsx("flex-1 py-2 text-xs font-bold uppercase border rounded-sm transition-colors",
                                                rotationRule === "permanent" ? "bg-[#d4af37] text-black border-[#d4af37]" : "bg-transparent text-white/40 border-[#333333]")}
                                        >
                                            Permanent
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRotationRule("rotate")}
                                            className={clsx("flex-1 py-2 text-xs font-bold uppercase border rounded-sm transition-colors",
                                                rotationRule === "rotate" ? "bg-[#d4af37] text-black border-[#d4af37]" : "bg-transparent text-white/40 border-[#333333]")}
                                        >
                                            Rotate
                                        </button>
                                    </div>

                                    {/* Rotation Interval — only when rotate is selected */}
                                    {rotationRule === "rotate" && (
                                        <div className="mt-3 pt-3 border-t border-[#333333]">
                                            <label className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
                                                <RefreshCw size={12} className="text-[#d4af37]" />
                                                Rotate every
                                            </label>
                                            <div className="flex gap-2">
                                                {ROTATION_PRESETS.map(n => (
                                                    <button
                                                        type="button"
                                                        key={n}
                                                        onClick={() => setRotationInterval(n)}
                                                        className={clsx(
                                                            "flex-1 py-2 text-xs font-bold border rounded-sm transition-colors",
                                                            rotationInterval === n
                                                                ? "bg-[#d4af37] text-black border-[#d4af37]"
                                                                : "bg-transparent text-white/40 border-[#333333] hover:text-white/60"
                                                        )}
                                                    >
                                                        {n} hands
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Join Options */}
                        {activeTab === "join" && (
                            <div>
                                <label className="block text-xs font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                                    Table Code
                                </label>
                                <input
                                    type="text"
                                    value={tableCode}
                                    onChange={(e) => setTableCode(e.target.value.toUpperCase())}
                                    placeholder="EX: X2Y9Z"
                                    className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-4 py-3 rounded-sm focus:outline-none focus:border-[#d4af37] transition-colors font-mono tracking-widest uppercase"
                                    maxLength={6}
                                />
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={!nickname || (activeTab === "join" && !tableCode)}
                            className="w-full mt-2 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-sm uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2"
                        >
                            <span className="text-sm">
                                {activeTab === "create" ? "Create & Play" : "Join Game"}
                            </span>
                            <ArrowRight size={16} />
                        </button>

                    </form>
                </div>
            </motion.div>
        </div>
    );
}
