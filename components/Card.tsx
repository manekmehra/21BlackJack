import { motion } from "framer-motion";
import { Suit } from "@/store/use-game-store";
import clsx from "clsx";

interface CardProps {
    rank: string;
    suit: Suit;
    faceDown?: boolean;
    index: number;
}

// Map internal suit/rank to DeckOfCardsAPI code
const SUIT_MAP: Record<Suit, string> = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
const RANK_MAP: Record<string, string> = {
    "A": "A",
    "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
    "10": "0",
    "J": "J", "Q": "Q", "K": "K"
};

export function Card({ rank, suit, faceDown, index }: CardProps) {
    // ─── Card Back ──────────────────────
    if (faceDown) {
        return (
            <motion.div
                initial={{ y: -80, rotateY: 180, opacity: 0 }}
                animate={{ y: 0, rotateY: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 140, damping: 16, delay: index * 0.12 }}
                className="w-[36px] h-[52px] xs:w-[48px] xs:h-[68px] sm:w-[58px] sm:h-[82px] md:w-[74px] md:h-[106px] rounded-md sm:rounded-lg shrink-0 cursor-default relative overflow-hidden select-none"
                style={{
                    background: "linear-gradient(145deg, #1a1a3e, #0f0f2a)",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                    border: "2px solid #d4af37",
                }}
            >
                {/* Inner gold frame */}
                <div className="absolute inset-[3px] sm:inset-[5px] rounded-md sm:rounded-lg border border-[#d4af37]/30" />
                {/* Diagonal cross-hatch pattern */}
                <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id={`hatch-${index}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="8" stroke="#d4af37" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#hatch-${index})`} />
                </svg>
                {/* Center emblem */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center"
                        style={{
                            background: "radial-gradient(circle, #f0d060, #d4af37, #b8962e)",
                            boxShadow: "0 2px 12px rgba(212,175,55,0.4), inset 0 -2px 4px rgba(0,0,0,0.2)",
                        }}
                    >
                        <span className="text-[#1a1a2e] text-xs xs:text-base sm:text-xl" style={{ fontFamily: "serif" }}>♠</span>
                    </div>
                </div>
                {/* Corner dots */}
                <div className="absolute top-1 left-1 sm:top-2 sm:left-2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#d4af37]/40" />
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#d4af37]/40" />
                <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#d4af37]/40" />
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#d4af37]/40" />
            </motion.div>
        );
    }

    // ─── Card Face (Image) ──────────────────────
    const code = `${RANK_MAP[rank] || rank}${SUIT_MAP[suit]}`;
    const url = `https://deckofcardsapi.com/static/img/${code}.png`;

    return (
        <motion.div
            initial={{ y: -80, rotateY: 180, opacity: 0 }}
            animate={{ y: 0, rotateY: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 16, delay: index * 0.12 }}
            className="w-[40px] h-[56px] xs:w-[52px] xs:h-[72px] sm:w-[62px] sm:h-[86px] md:w-[78px] md:h-[110px] rounded-md sm:rounded-lg shrink-0 cursor-default relative overflow-hidden select-none shadow-[0_8px_32px_rgba(0,0,0,0.6)] bg-white"
        >
            <img
                src={url}
                alt={`${rank}${suit}`}
                className="w-full h-full object-cover"
                loading="eager"
            />

            {/* Subtle overlay for finish */}
            <div className="absolute inset-0 rounded-md sm:rounded-lg border border-black/10 pointer-events-none mix-blend-multiply" />
        </motion.div>
    );
}
