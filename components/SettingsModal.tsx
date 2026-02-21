"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, Moon, Gauge } from "lucide-react";
import { useGameStore } from "@/store/use-game-store";
import clsx from "clsx";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { settings, updateSettings } = useGameStore();

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="w-full max-w-sm bg-[#1c1c1e] sm:bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Settings</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <X size={18} className="text-white/60" />
                        </button>
                    </div>

                    {/* Options */}
                    <div className="space-y-6 sm:space-y-8">

                        {/* Sound Effects */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-blue-500/20 text-blue-400">
                                    <Volume2 size={20} className="sm:size-6" />
                                </div>
                                <span className="text-base sm:text-lg font-medium text-white/90">Sound Effects</span>
                            </div>
                            <button
                                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                                className={clsx(
                                    "w-12 h-7 sm:w-14 sm:h-8 rounded-full transition-colors relative",
                                    settings.soundEnabled ? "bg-[#30d158]" : "bg-white/10"
                                )}
                            >
                                <motion.div
                                    animate={{ x: settings.soundEnabled ? 22 : 2 }}
                                    className="absolute top-1 left-0 w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full shadow-sm"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* Background Ambience */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-purple-500/20 text-purple-400">
                                    <Moon size={20} className="sm:size-6" />
                                </div>
                                <span className="text-base sm:text-lg font-medium text-white/90">Ambience</span>
                            </div>
                            <button
                                onClick={() => updateSettings({ ambienceEnabled: !settings.ambienceEnabled })}
                                className={clsx(
                                    "w-12 h-7 sm:w-14 sm:h-8 rounded-full transition-colors relative",
                                    settings.ambienceEnabled ? "bg-[#30d158]" : "bg-white/10"
                                )}
                            >
                                <motion.div
                                    animate={{ x: settings.ambienceEnabled ? 22 : 2 }}
                                    className="absolute top-1 left-0 w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full shadow-sm"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* Card Speed */}
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-center gap-3 sm:gap-4 mb-1">
                                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-orange-500/20 text-orange-400">
                                    <Gauge size={20} className="sm:size-6" />
                                </div>
                                <span className="text-base sm:text-lg font-medium text-white/90">Card Speed</span>
                            </div>

                            <div className="flex items-center gap-3 sm:gap-4 px-2">
                                <span className="text-[10px] sm:text-xs text-white/40 font-medium uppercase tracking-wider">Slow</span>
                                <input
                                    type="range"
                                    min="1" max="3" step="1"
                                    value={settings.cardSpeed || 2}
                                    onChange={(e) => updateSettings({ cardSpeed: parseInt(e.target.value) })}
                                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 sm:[&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-5 sm:[&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg cursor-pointer"
                                />
                                <span className="text-[10px] sm:text-xs text-white/40 font-medium uppercase tracking-wider">Fast</span>
                            </div>
                        </div>

                    </div>

                    <div className="mt-8 sm:mt-10 pt-4 sm:pt-6 border-t border-white/5 text-center">
                        <span className="text-[10px] sm:text-xs text-white/20 font-medium tracking-wide">Blackjack Now v1.2</span>
                    </div>

                </motion.div>
            </div>
        </AnimatePresence>
    );
}
