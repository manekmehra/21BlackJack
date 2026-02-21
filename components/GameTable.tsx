"use client";

import {
    useGameStore,
    Player,
    PlayerHand,
    getActiveHand,
    getPlayerScore,
    getPlayerStatus,
    getPlayerCards,
    getPlayerBet,
} from "@/store/use-game-store";
import { User, Settings, Copy, BookOpen, Lock, Unlock, MoreHorizontal, LogOut, Coffee, X, Layers, ChevronsUp, Shield, Flag, Minus, Plus, DollarSign } from "lucide-react";
import useSound from "use-sound";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { Card } from "./Card";
import { AnimatePresence, motion } from "framer-motion";
import { SettingsModal } from "./SettingsModal";

// ─── Score Chip ────────────────────────────────────────
function ScoreChip({ score, status }: { score: number; status: string }) {
    if (status === "waiting" || score === 0) return null;

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={clsx(
                "score-chip flex items-center justify-center min-w-[24px] h-[24px] sm:min-w-[40px] sm:h-[40px] px-1.5 sm:px-4 rounded-md sm:rounded-2xl text-[10px] sm:text-lg font-bold backdrop-blur-xl",
                status === "busted" ? "bg-gradient-to-b from-red-500 to-red-700 text-white" :
                    status === "blackjack" ? "bg-gradient-to-b from-[#f0d060] to-[#d4af37] text-black" :
                        "bg-gradient-to-b from-[#2a2a2e] to-[#1c1c1e] text-white border border-white/10"
            )}
        >
            {score}
        </motion.div>
    );
}

// ─── Hand Card Group Renderer ──────────────────────────
function HandCards({ hand, handIndex, isActive }: { hand: PlayerHand; handIndex: number; isActive: boolean }) {
    return (
        <div className={clsx(
            "relative flex items-end justify-center",
            isActive && "ring-2 ring-[#d4af37]/40 rounded-2xl sm:rounded-3xl p-1 sm:p-2"
        )}>
            <AnimatePresence>
                {hand.cards.map((card, i) => (
                    <div key={i} className="relative" style={{ marginLeft: i > 0 ? -24 : 0, zIndex: i }}>
                        <Card rank={card.rank} suit={card.suit} faceDown={card.faceDown} index={i} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// ─── Player Seat ───────────────────────────────────────
function PlayerSeat({ player, isMe, isActive, position, isHost, onKick, activeHandIdx, stack, onMakeDealer }: {
    player: Player;
    isMe: boolean;
    isActive: boolean;
    position: { left: string; top: string };
    isHost: boolean;
    onKick: (id: string) => void;
    activeHandIdx: number;
    stack: number;
    onMakeDealer: (id: string) => void;
}) {
    const [showAdmin, setShowAdmin] = useState(false);
    const isSittingOut = player.isSittingOut;

    const overallStatus = (): string | null => {
        if (isSittingOut) return "AWAY";
        const statuses = player.hands.map(h => h.status);
        if (statuses.every(s => s === "playing" || s === "waiting")) return null;
        if (statuses.includes("blackjack")) return "BJ!";
        if (statuses.includes("won")) return "WIN!";
        if (statuses.includes("push")) return "PUSH";
        if (statuses.includes("surrendered")) return "FOLD";
        if (statuses.every(s => s === "busted")) return "BUST";
        if (statuses.every(s => s === "lost" || s === "busted")) return "LOST";
        return null;
    };

    const label = overallStatus();

    return (
        <div
            className={clsx(
                "absolute flex flex-col items-center transition-opacity duration-500",
                isSittingOut ? "opacity-40 grayscale" : "opacity-100"
            )}
            style={{
                left: position.left,
                top: position.top,
                transform: "translate(-50%, -50%)",
            }}
        >
            {/* Cards + Score — vertical stack */}
            <div className="flex flex-col items-center gap-1 sm:gap-3 mb-1 sm:mb-3">
                {/* Cards Area — multiple hands side by side */}
                <div className="flex items-end gap-2 sm:gap-5 min-h-[80px] sm:min-h-[130px]">
                    {!isSittingOut && player.hands.map((hand, hIdx) => (
                        <HandCards
                            key={hIdx}
                            hand={hand}
                            handIndex={hIdx}
                            isActive={isActive && activeHandIdx === hIdx}
                        />
                    ))}
                </div>

                {/* Score Chips */}
                {!isSittingOut && player.hands.length > 0 && (
                    <div className="flex items-center gap-1 sm:gap-2">
                        {player.hands.map((hand, hIdx) => (
                            <div key={hIdx} className="flex items-center gap-1">
                                <ScoreChip score={hand.score} status={hand.status} />
                                {hand.isDoubledDown && (
                                    <span className="bg-blue-500 text-white text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl shadow">2×</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Result Label */}
            <AnimatePresence>
                {label && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={clsx(
                            "absolute -top-6 sm:-top-8 z-50 px-3 sm:px-5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold uppercase shadow-xl border tracking-widest backdrop-blur-xl",
                            label === "WIN!" || label === "BJ!" ? "bg-gradient-to-r from-[#f0d060] to-[#d4af37] text-black border-yellow-300" :
                                label === "BUST" || label === "LOST" ? "bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400" :
                                    label === "AWAY" ? "bg-gray-700 text-white border-gray-600" :
                                        label === "FOLD" ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400" :
                                            "bg-white/90 text-black border-white"
                        )}
                    >
                        {label}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Insurance Indicator */}
            {player.insuranceBet > 0 && (
                <div className="absolute -top-2 right-0 bg-blue-500 text-white text-[8px] sm:text-[10px] font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl shadow flex items-center gap-1">
                    <Shield size={8} /> INS
                </div>
            )}

            {/* Player Info Pill */}
            <div
                className="relative group cursor-pointer"
                onClick={() => isHost && !isMe && setShowAdmin(!showAdmin)}
            >
                <div className={clsx(
                    "flex items-center gap-1.5 sm:gap-3 pr-3 sm:pr-6 pl-1.5 sm:pl-2.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border transition-all backdrop-blur-xl",
                    isActive
                        ? "bg-white/15 border-[#f0d060]/60 shadow-[0_0_32px_rgba(212,175,55,0.3)] scale-105"
                        : "bg-black/50 border-white/[0.06] shadow-lg group-hover:bg-black/60"
                )}>
                    <div className={clsx(
                        "w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-sm font-bold border shadow-inner",
                        isMe
                            ? "bg-gradient-to-br from-[#f0d060] to-[#d4af37] text-black border-[#d4af37]/50"
                            : "bg-gradient-to-br from-gray-700 to-gray-800 text-white/50 border-white/10"
                    )}>
                        {isMe ? "ME" : <User size={12} className="sm:hidden" />}
                        {isMe ? null : <User size={16} className="hidden sm:block" />}
                    </div>
                    <div className="flex flex-col items-start">
                        <span className={clsx("text-[10px] sm:text-sm font-semibold tracking-tight", isMe ? "text-white" : "text-white/70")}>
                            {player.nickname}
                        </span>
                        <span className="text-[8px] sm:text-[11px] font-medium text-[#d4af37]/80 hidden xs:inline">
                            ${getPlayerBet(player) > 0 ? `Bet: ${getPlayerBet(player)}` : "—"}
                        </span>
                        <span className="text-[8px] sm:text-[10px] font-medium text-white/40">
                            ${stack.toLocaleString()}
                        </span>
                    </div>

                    {/* Split indicator */}
                    {player.hands.length > 1 && (
                        <span className="ml-0.5 sm:ml-1 bg-purple-500 text-white text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg sm:rounded-xl">
                            SPLIT
                        </span>
                    )}
                </div>

                {showAdmin && isHost && (
                    <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex flex-col gap-1 bg-[#1c1c1e] p-1 rounded-xl shadow-2xl border border-white/10 z-50 min-w-[110px]">
                        <button
                            onClick={(e) => { e.stopPropagation(); onMakeDealer(player.id); setShowAdmin(false); }}
                            className="w-full text-left px-3 py-2 text-[11px] font-bold text-[#d4af37] hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap"
                        >
                            Make Dealer
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onKick(player.id); }}
                            className="w-full text-left px-3 py-2 text-[11px] font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors whitespace-nowrap"
                        >
                            Kick Player
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const SEAT_POSITIONS = [
    { left: "50%", top: "85%" },
    { left: "15%", top: "62%" },
    { left: "85%", top: "62%" },
    { left: "28%", top: "35%" },
    { left: "72%", top: "35%" },
];

// ─── Helper: Check if action buttons should show ───────
function useActionState() {
    const { currentTurn, myPlayerId, players, gamePhase } = useGameStore();
    const isMyTurn = currentTurn === myPlayerId;
    const myPlayer = players.find(p => p.id === myPlayerId);

    if (!isMyTurn || !myPlayer) return { canHit: false, canStand: false, canSplit: false, canDouble: false, canSurrender: false };

    const hand = myPlayer.hands[myPlayer.activeHandIndex];
    if (!hand || hand.status !== "playing") return { canHit: false, canStand: false, canSplit: false, canDouble: false, canSurrender: false };

    const canSplit = hand.cards.length === 2 && !hand.isSplit &&
        hand.cards[0] && hand.cards[1] &&
        (["J", "Q", "K", "10"].includes(hand.cards[0].rank) && ["J", "Q", "K", "10"].includes(hand.cards[1].rank) ||
            hand.cards[0].rank === hand.cards[1].rank);

    const canDouble = hand.cards.length === 2 && !hand.isDoubledDown && !hand.isSurrendered;

    const canSurrender = myPlayer.hands.length === 1 && hand.cards.length === 2 && !hand.isDoubledDown && !hand.isSurrendered && !hand.isSplit;

    return { canHit: true, canStand: true, canSplit, canDouble, canSurrender };
}

// ─── Main Table ────────────────────────────────────────
export function GameTable() {
    const {
        players,
        dealerHand,
        dealerScore,
        gamePhase,
        currentTurn,
        myPlayerId,
        tableCode,
        message,
        hit,
        stand,
        split,
        doubleDown,
        surrender,
        insurance,
        declineInsurance,
        startRound,
        reset,
        hostId,
        isTableLocked,
        toggleLock,
        kickPlayer,
        ledger,
        dealerId,
        toggleSitOut,
        leaveTable,
        setBet,
        handsPlayed,
        setDealerId,
    } = useGameStore();

    const actions = useActionState();
    const [copied, setCopied] = useState(false);
    const [showLedger, setShowLedger] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showPlayerMenu, setShowPlayerMenu] = useState(false);

    // Sounds
    const [playChip] = useSound("/sounds/chip.mp3", { volume: 0.5 });
    const [playCard] = useSound("/sounds/card-flip.mp3", { volume: 0.4 });

    const totalPot = players.reduce((sum, p) => sum + getPlayerBet(p), 0);
    useEffect(() => {
        if (gamePhase === "betting" && totalPot > 0) {
            playChip();
        }
    }, [totalPot, gamePhase, playChip]);

    useEffect(() => {
        if (handsPlayed > 0) {
            playCard();
        }
    }, [handsPlayed, playCard]);

    const isHost = myPlayerId === hostId;
    const isMyTurn = currentTurn === myPlayerId;
    const myPlayer = players.find(p => p.id === myPlayerId);

    const copyCode = () => {
        if (tableCode) {
            navigator.clipboard.writeText(tableCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="min-h-dvh bg-[#0a0a0a] flex flex-col relative overflow-hidden font-sans text-foreground">

            {/* ── Top Bar ────────────────── */}
            <div className="relative z-40 flex items-center justify-between h-12 sm:h-16 px-3 sm:px-6 bg-black/40 backdrop-blur-2xl border-b border-white/[0.06]">

                {/* Left: Player Menu */}
                <div className="flex items-center gap-2 sm:gap-3 relative">
                    <button
                        onClick={() => setShowPlayerMenu(!showPlayerMenu)}
                        className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors text-white/80"
                    >
                        <MoreHorizontal size={16} className="sm:hidden" />
                        <MoreHorizontal size={20} className="hidden sm:block" />
                    </button>

                    <AnimatePresence>
                        {showPlayerMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="absolute top-12 sm:top-14 left-0 bg-[#1c1c1e] rounded-xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden w-44 sm:w-52 z-50"
                            >
                                <button
                                    onClick={() => { toggleSitOut(); setShowPlayerMenu(false); }}
                                    className="w-full flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
                                >
                                    <Coffee size={14} />
                                    {myPlayer?.isSittingOut ? "Rejoin Game" : "Sit Out"}
                                </button>
                                <button
                                    onClick={() => { leaveTable(); setShowPlayerMenu(false); }}
                                    className="w-full flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut size={14} />
                                    Leave Table
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Ledger */}
                    <button
                        onClick={() => setShowLedger(true)}
                        className="flex items-center gap-1.5 sm:gap-2 text-white/50 hover:text-white transition-colors"
                    >
                        <BookOpen size={16} />
                        <span className="text-xs sm:text-sm font-medium hidden sm:inline">Ledger</span>
                    </button>
                </div>

                {/* Center: Room Code */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <button
                        onClick={copyCode}
                        className="flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/[0.06] border border-white/[0.06] hover:bg-white/10 transition-colors group"
                    >
                        <span className="text-[8px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest">Table</span>
                        <span className="font-mono text-white/90 text-xs sm:text-sm tracking-wider font-semibold">{tableCode}</span>
                        {copied ? <span className="text-green-400 text-[10px] sm:text-xs font-bold">✓</span> : <Copy size={10} className="sm:hidden text-white/30 group-hover:text-white/60" />}
                        {!copied && <Copy size={12} className="hidden sm:block text-white/30 group-hover:text-white/60" />}
                    </button>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {isHost && (
                        <button
                            onClick={toggleLock}
                            className={clsx(
                                "p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors",
                                isTableLocked ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/[0.06] hover:bg-white/10 text-white/60"
                            )}
                        >
                            {isTableLocked ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                    )}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors text-white/60"
                    >
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {/* Message Banner */}
            {message && (
                <motion.div
                    key={message}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute top-14 sm:top-20 left-1/2 -translate-x-1/2 z-30 px-4 sm:px-8 py-2 sm:py-3 bg-black/60 backdrop-blur-2xl border border-white/[0.08] rounded-xl sm:rounded-2xl shadow-2xl max-w-[90vw]"
                >
                    <span className="text-xs sm:text-sm font-semibold text-white tracking-wide">{message}</span>
                </motion.div>
            )}

            {/* ── Table Area ────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-1 sm:p-4 min-h-0 relative">
                <div className="relative w-full max-w-[1100px] max-h-[52vh] sm:max-h-[65vh] aspect-[1.4/1] sm:aspect-[1.8/1] mx-auto">

                    {/* The Table */}
                    <div className="absolute inset-2 sm:inset-4 rounded-[120px] sm:rounded-[300px] bg-[#0a5c36] border-[8px] sm:border-[20px] border-[#1c1c1e] table-border-glow overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6),0_0_20px_rgba(10,92,54,0.4)]">
                        {/* Subtle felt texture */}
                        <div className="absolute inset-0 opacity-[0.1] bg-[url('https://www.transparenttextures.com/patterns/felt.png')] mix-blend-overlay pointer-events-none" />

                        {/* Decorative Racetrack Lines */}
                        <div className="absolute inset-[16px] sm:inset-[32px] rounded-[104px] sm:rounded-[268px] border-[1px] sm:border-[2px] border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.2)] pointer-events-none" />
                        <div className="hidden sm:block absolute inset-[42px] rounded-[258px] border-[2px] border-[#c41e3a]/30 pointer-events-none" />

                        {/* Center branding text */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.08] pointer-events-none text-center select-none">
                            <div className="text-xl sm:text-5xl font-serif text-black font-bold tracking-[0.15em] mb-1">BLACKJACK</div>
                            <div className="text-[8px] sm:text-xs font-bold text-black tracking-[0.4em]">PAYS 3 TO 2</div>
                        </div>
                    </div>

                    {/* ── Pot Display ─────────────────────── */}
                    <div className="absolute top-[35%] left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-0 opacity-80 pointer-events-none select-none">
                        <div className="text-[8px] sm:text-[10px] font-bold text-[#d4af37] tracking-[0.2em] uppercase mb-0.5 sm:mb-1 drop-shadow-md">Total Pot</div>
                        <div className="text-xl sm:text-3xl font-mono font-bold text-white tracking-tight drop-shadow-lg flex items-center gap-0.5 sm:gap-1">
                            <span className="text-[#d4af37]">$</span>
                            {players.reduce((sum, p) => sum + getPlayerBet(p), 0).toLocaleString()}
                        </div>
                    </div>

                    {/* ── Dealer Area ─────────────────────── */}
                    <div className="absolute top-[8%] sm:top-[10%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
                        <div className="mb-2 sm:mb-5 flex items-center gap-2 sm:gap-3">
                            <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 bg-black/30 backdrop-blur px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl">
                                {dealerId === "system" ? "House" : players.find(p => p.id === dealerId)?.nickname}
                            </span>
                            {/* Dealer Score */}
                            <div className={clsx(
                                "score-chip min-w-[24px] h-[24px] sm:min-w-[44px] sm:h-[44px] flex items-center justify-center rounded-lg sm:rounded-2xl text-[10px] sm:text-lg font-bold backdrop-blur-xl",
                                gamePhase === "playing" || gamePhase === "insurance"
                                    ? "bg-white/10 text-white/50 border border-white/10"
                                    : dealerScore > 21
                                        ? "bg-gradient-to-b from-red-500 to-red-700 text-white"
                                        : "bg-gradient-to-b from-[#2a2a2e] to-[#1c1c1e] text-white border border-white/10"
                            )}>
                                {gamePhase === "playing" || gamePhase === "insurance" ? "?" : dealerScore}
                            </div>
                        </div>

                        <div className="relative h-16 w-32 sm:h-32 sm:w-48 flex justify-center">
                            <AnimatePresence>
                                {dealerHand.map((card, i) => (
                                    <div key={i} className="absolute" style={{ left: i * 14, zIndex: i }}>
                                        <Card rank={card.rank} suit={card.suit} faceDown={card.faceDown} index={i} />
                                    </div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Player Seats - Circularly shifted so local player is always at index 0 (bottom center) */}
                    {(() => {
                        const meIndex = players.findIndex(p => p.id === myPlayerId);
                        let displayPlayers = [...players];
                        if (meIndex > 0) {
                            displayPlayers = [...players.slice(meIndex), ...players.slice(0, meIndex)];
                        }

                        return displayPlayers.map((player, idx) => (
                            <PlayerSeat
                                key={player.id}
                                player={player}
                                isMe={player.id === myPlayerId}
                                isActive={player.id === currentTurn}
                                position={SEAT_POSITIONS[idx % SEAT_POSITIONS.length]}
                                isHost={Boolean(isHost)}
                                onKick={kickPlayer}
                                activeHandIdx={player.activeHandIndex}
                                stack={ledger[player.id]?.currentStack ?? 0}
                                onMakeDealer={setDealerId}
                            />
                        ));
                    })()}
                </div>
            </div>

            {/* ── Action Bar ──────────────────────────────── */}
            <div className="relative z-30 flex flex-wrap items-center justify-center gap-1.5 sm:gap-4 px-2 sm:px-8 py-2 sm:py-5 bg-black/40 backdrop-blur-3xl border-t border-white/[0.06] mt-auto">

                {/* Betting / Idle */}
                {(gamePhase === "betting" || gamePhase === "idle") && (
                    <div className="flex items-center gap-2 sm:gap-4 w-full justify-center">
                        {/* Custom Bet Input & Controls */}
                        {!myPlayer?.isSittingOut && (
                            <div className="flex items-center gap-2 sm:gap-3 bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-2.5 shadow-2xl">
                                <div className="flex flex-col">
                                    <label className="text-[8px] sm:text-[9px] font-bold text-white/30 uppercase tracking-widest pl-1">Bet Amount</label>
                                    <div className="flex items-center gap-0.5">
                                        <span className="text-white/40 font-mono text-base sm:text-xl mr-0.5 sm:mr-1">$</span>
                                        <input
                                            type="number"
                                            value={myPlayer?.currentBet ?? 100}
                                            onChange={(e) => setBet(Number(e.target.value))}
                                            className="bg-transparent border-none outline-none text-xl sm:text-3xl font-bold font-mono text-white w-20 sm:w-32 placeholder-white/20 appearance-none m-0"
                                            placeholder="0"
                                            min="1"
                                            style={{ MozAppearance: "textfield" }}
                                        />
                                    </div>
                                </div>

                                <div className="w-[1px] h-8 sm:h-10 bg-white/10 mx-1 sm:mx-2" />

                                <div className="flex flex-col gap-1 items-center">
                                    <div className="flex gap-1.5 sm:gap-2">
                                        <button
                                            type="button"
                                            onClick={() => myPlayer && setBet(Math.floor((ledger[myPlayer.id]?.currentStack ?? 0) / 2))}
                                            className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 text-[10px] sm:text-xs font-bold text-white/60 hover:text-white transition-colors border border-white/5"
                                        >
                                            1/2
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => myPlayer && setBet(ledger[myPlayer.id]?.currentStack ?? 0)}
                                            className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[10px] sm:text-xs font-bold text-[#d4af37] transition-colors border border-[#d4af37]/20 shadow-[0_0_10px_rgba(212,175,55,0.1)]"
                                        >
                                            ALL IN
                                        </button>
                                    </div>
                                    {/* Stack Info inside the betting block to save vertical space */}
                                    {myPlayer && ledger[myPlayer.id] && (
                                        <span className="text-[9px] sm:text-[10px] text-white/20 font-semibold tracking-wider">
                                            ${ledger[myPlayer.id].currentStack.toLocaleString()} avail.
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Deal Button - Now next to betting */}
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={startRound}
                            disabled={myPlayer?.isSittingOut}
                            className="action-btn px-6 sm:px-14 py-2 sm:py-3.5 bg-gradient-to-b from-white to-gray-100 text-black font-bold text-sm sm:text-lg rounded-xl sm:rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_32px_rgba(255,255,255,0.15)]"
                        >
                            {myPlayer?.isSittingOut ? "Sitting Out" : "Deal"}
                        </motion.button>
                    </div>
                )}

                {/* Insurance Phase */}
                {gamePhase === "insurance" && myPlayer && !myPlayer.hasRespondedInsurance && !myPlayer.isSittingOut && (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={insurance}
                            className="action-btn px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-b from-blue-500 to-blue-600 text-white font-bold text-sm sm:text-base rounded-xl sm:rounded-2xl flex items-center gap-1.5 sm:gap-2.5"
                        >
                            <Shield size={16} /> Insurance (${Math.floor((myPlayer.hands[0]?.bet ?? 100) / 2)})
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={declineInsurance}
                            className="action-btn px-4 sm:px-8 py-3 sm:py-4 bg-white/[0.06] text-white font-bold text-sm sm:text-base rounded-xl sm:rounded-2xl border border-white/[0.08]"
                        >
                            No Insurance
                        </motion.button>
                    </>
                )}

                {/* Insurance waiting */}
                {gamePhase === "insurance" && myPlayer?.hasRespondedInsurance && (
                    <div className="px-4 sm:px-8 py-3 sm:py-4 bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-xl sm:rounded-2xl text-white/40 text-xs sm:text-sm font-semibold tracking-wide flex items-center gap-2 sm:gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        Waiting for others...
                    </div>
                )}

                {/* Playing Phase — My Turn */}
                {gamePhase === "playing" && isMyTurn && !myPlayer?.isSittingOut && (
                    <div className="flex items-center gap-2 sm:gap-4 w-full justify-center">
                        {/* Primary: Hit / Stand - Replacing the Bet input position */}
                        <div className="flex items-center gap-2 sm:gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-1.5 sm:p-2 shadow-2xl">
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 1.03 }}
                                onClick={hit}
                                disabled={!actions.canHit}
                                className="action-btn px-6 sm:px-10 py-2 sm:py-4 bg-gradient-to-b from-[#34d660] to-[#28b84d] text-white font-bold text-sm sm:text-lg rounded-xl sm:rounded-2xl min-w-[80px] sm:min-w-[140px] disabled:opacity-30 shadow-[0_8px_32px_rgba(52,214,96,0.2)]"
                            >
                                Hit
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 1.03 }}
                                onClick={stand}
                                disabled={!actions.canStand}
                                className="action-btn px-6 sm:px-10 py-2 sm:py-4 bg-gradient-to-b from-[#ff5046] to-[#d63a30] text-white font-bold text-sm sm:text-lg rounded-xl sm:rounded-2xl min-w-[80px] sm:min-w-[140px] disabled:opacity-30 shadow-[0_8px_32px_rgba(255,80,70,0.2)]"
                            >
                                Stand
                            </motion.button>
                        </div>

                        {/* Secondary: Split / Double / Surrender - Floating next to primary */}
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                            {actions.canDouble && (
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={doubleDown}
                                    className="action-btn px-3 sm:px-6 py-2 sm:py-3 bg-white/[0.06] hover:bg-white/10 text-white font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl border border-white/10 flex items-center justify-center gap-1 sm:gap-2"
                                >
                                    <ChevronsUp size={12} /> Double
                                </motion.button>
                            )}
                            {(actions.canSplit || actions.canSurrender) && (
                                <div className="flex gap-1.5 sm:gap-2">
                                    {actions.canSplit && (
                                        <motion.button
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            onClick={split}
                                            className="action-btn px-3 sm:px-5 py-2 sm:py-2.5 bg-white/[0.06] hover:bg-white/10 text-white font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl border border-white/10 flex items-center justify-center gap-1 sm:gap-2"
                                        >
                                            <Layers size={12} /> Split
                                        </motion.button>
                                    )}
                                    {actions.canSurrender && (
                                        <motion.button
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            onClick={surrender}
                                            className="action-btn px-3 sm:px-5 py-2 sm:py-2.5 bg-white/[0.06] hover:bg-white/10 text-white font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl border border-white/10 flex items-center justify-center gap-1 sm:gap-2"
                                        >
                                            <Flag size={12} /> Fold
                                        </motion.button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Waiting for other player */}
                {gamePhase === "playing" && !isMyTurn && (
                    <div className="px-4 sm:px-8 py-3 sm:py-4 bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-xl sm:rounded-2xl text-white/40 text-xs sm:text-sm font-semibold tracking-wide flex items-center gap-2 sm:gap-3">
                        <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-pulse" />
                        Waiting for {players.find(p => p.id === currentTurn)?.nickname}...
                    </div>
                )}

                {/* Settlement */}
                {gamePhase === "settlement" && (
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={reset}
                        className="action-btn px-8 sm:px-14 py-3 sm:py-4 bg-gradient-to-b from-white to-gray-100 text-black font-bold text-sm sm:text-lg rounded-xl sm:rounded-2xl"
                    >
                        New Round
                    </motion.button>
                )}
            </div>

            {/* Settings Modal */}
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

            {/* Ledger Modal */}
            {showLedger && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-2xl p-4" onClick={() => setShowLedger(false)}>
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full max-w-lg bg-[#1c1c1e] rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl border border-white/10"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4 sm:mb-8">
                            <h2 className="text-white text-xl sm:text-2xl font-bold tracking-tight">Ledger</h2>
                            <button onClick={() => setShowLedger(false)} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/10">
                                <X size={16} className="text-white/60" />
                            </button>
                        </div>
                        <div className="overflow-x-auto overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-white/[0.04] text-white/30 uppercase tracking-wider text-[10px] sm:text-xs font-semibold">
                                    <tr>
                                        <th className="p-3 sm:p-4 pl-4 sm:pl-6">Player</th>
                                        <th className="p-3 sm:p-4 text-right">Buy-In</th>
                                        <th className="p-3 sm:p-4 text-right">Net</th>
                                        <th className="p-3 sm:p-4 pr-4 sm:pr-6 text-right">Stack</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {Object.values(ledger).map((entry) => (
                                        <tr key={entry.playerId} className="text-white">
                                            <td className="p-3 sm:p-4 pl-4 sm:pl-6 font-semibold">{entry.nickname}</td>
                                            <td className="p-3 sm:p-4 text-right text-white/40 font-mono">${entry.totalBuyIn}</td>
                                            <td className={clsx("p-3 sm:p-4 text-right font-mono font-semibold", entry.netProfit >= 0 ? "text-[#30d158]" : "text-[#ff453a]")}>
                                                {entry.netProfit >= 0 ? "+" : ""}{entry.netProfit}
                                            </td>
                                            <td className="p-3 sm:p-4 pr-4 sm:pr-6 text-right font-mono text-[#d4af37] font-semibold">${entry.currentStack}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
