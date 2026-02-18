"use client";

import { create } from "zustand";
import { supabase } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type PlayerStatus = "playing" | "stood" | "busted" | "blackjack" | "waiting" | "won" | "lost" | "push" | "surrendered";

export interface Card {
    suit: Suit;
    rank: Rank;
    faceDown?: boolean;
}

export interface PlayerHand {
    cards: Card[];
    score: number;
    bet: number;
    status: PlayerStatus;
    isDoubledDown: boolean;
    isSplit: boolean;
    isSurrendered: boolean;
}

export interface Player {
    id: string;
    nickname: string;
    hands: PlayerHand[];
    activeHandIndex: number;
    insuranceBet: number;
    currentBet: number;
    avatarId?: number;
    isSittingOut?: boolean;
    hasRespondedInsurance?: boolean;
}

export type GamePhase = "idle" | "betting" | "insurance" | "playing" | "dealer-turn" | "settlement";

export interface LedgerEntry {
    playerId: string;
    nickname: string;
    totalBuyIn: number;
    netProfit: number;
    currentStack: number;
}

export interface GameSettings {
    dealerMode: "me" | "random";
    rotationRule: "permanent" | "rotate";
    rotationInterval: number;
    soundEnabled: boolean;
    ambienceEnabled: boolean;
    cardSpeed: number;
}

// ─── Convenience helpers for backwards compat ───────────
// Many UI components reference player.hand, player.score etc.
// We provide getters that return the "active" hand data.
export function getActiveHand(player: Player): PlayerHand | null {
    return player.hands[player.activeHandIndex] ?? player.hands[0] ?? null;
}

export function getPlayerScore(player: Player): number {
    const h = getActiveHand(player);
    return h?.score ?? 0;
}

export function getPlayerStatus(player: Player): PlayerStatus {
    const h = getActiveHand(player);
    return h?.status ?? "waiting";
}

export function getPlayerBet(player: Player): number {
    return player.hands.reduce((sum, h) => sum + h.bet, 0);
}

export function getPlayerCards(player: Player): Card[] {
    const h = getActiveHand(player);
    return h?.cards ?? [];
}

// ─── GameState Interface ────────────────────────────────
interface GameState {
    players: Player[];
    dealerHand: Card[];
    dealerScore: number;
    gamePhase: GamePhase;
    currentTurn: string | null;
    myPlayerId: string | null;
    tableCode: string | null;
    deck: Card[];
    message: string | null;

    hostId: string | null;
    isTableLocked: boolean;
    ledger: Record<string, LedgerEntry>;
    settings: GameSettings;
    handsPlayed: number;
    dealerId: string | null;
    sessionId: string | null;

    // Actions
    createTable: (nickname: string, buyIn: number, settings?: Partial<GameSettings>) => void;
    joinTable: (code: string, nickname: string, buyIn: number) => void;
    startRound: () => void;
    hit: () => void;
    stand: () => void;
    dealerPlay: () => Promise<void>;
    reset: () => void;

    // Advanced actions
    split: () => void;
    doubleDown: () => void;
    insurance: () => void;
    declineInsurance: () => void;
    surrender: () => void;

    setBet: (amount: number) => void;
    rebuy: (amount: number) => void;
    kickPlayer: (playerId: string) => void;
    toggleLock: () => void;
    updateSettings: (newSettings: Partial<GameSettings>) => void;
    toggleSitOut: () => void;
    leaveTable: () => void;
    setDealerId: (playerId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardValue(card: Card): number {
    if (["J", "Q", "K"].includes(card.rank)) return 10;
    if (card.rank === "A") return 11;
    return parseInt(card.rank);
}

function handScore(cards: Card[]): number {
    let score = cards.reduce((sum, c) => sum + cardValue(c), 0);
    let aces = cards.filter(c => c.rank === "A").length;
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

function canSplitHand(hand: PlayerHand): boolean {
    if (hand.cards.length !== 2) return false;
    if (hand.isSplit) return false; // Already a split hand — no re-split for simplicity
    return cardValue(hand.cards[0]) === cardValue(hand.cards[1]);
}

function canDoubleDown(hand: PlayerHand): boolean {
    return hand.cards.length === 2 && !hand.isDoubledDown && !hand.isSurrendered;
}

function canSurrender(player: Player): boolean {
    // Can only surrender on original hand (no splits), with exactly 2 cards
    if (player.hands.length > 1) return false;
    const h = player.hands[0];
    if (!h) return false;
    return h.cards.length === 2 && !h.isDoubledDown && !h.isSurrendered && !h.isSplit;
}

function generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DEFAULT_BET = 100;
const DEFAULT_BUY_IN = 1000;

function createEmptyHand(bet: number): PlayerHand {
    return {
        cards: [],
        score: 0,
        bet,
        status: "playing",
        isDoubledDown: false,
        isSplit: false,
        isSurrendered: false,
    };
}

// Move to next player/hand. Returns { playerId, handIndex } or null if all done.
function findNextTurn(players: Player[], currentPlayerId: string, currentHandIndex: number): { playerId: string; handIndex: number } | null {
    const currentPlayerIdx = players.findIndex(p => p.id === currentPlayerId);
    if (currentPlayerIdx < 0) return null;

    // First: check if current player has more hands to play
    const currentPlayer = players[currentPlayerIdx];
    for (let h = currentHandIndex + 1; h < currentPlayer.hands.length; h++) {
        if (currentPlayer.hands[h].status === "playing") {
            return { playerId: currentPlayer.id, handIndex: h };
        }
    }

    // Then: check subsequent players
    for (let p = currentPlayerIdx + 1; p < players.length; p++) {
        const player = players[p];
        if (player.isSittingOut) continue;
        for (let h = 0; h < player.hands.length; h++) {
            if (player.hands[h].status === "playing") {
                return { playerId: player.id, handIndex: h };
            }
        }
    }

    return null; // All done → dealer's turn
}

// ─── Store ──────────────────────────────────────────────
export const useGameStore = create<GameState>((set, get) => ({
    players: [],
    dealerHand: [],
    dealerScore: 0,
    gamePhase: "idle",
    currentTurn: null,
    myPlayerId: null,
    tableCode: null,
    deck: [],
    message: null,

    hostId: null,
    isTableLocked: false,
    ledger: {},
    settings: {
        dealerMode: "me",
        rotationRule: "permanent",
        rotationInterval: 5,
        soundEnabled: true,
        ambienceEnabled: true,
        cardSpeed: 2,
    },
    handsPlayed: 0,
    dealerId: "system",
    sessionId: null,

    // ── Table Management ──────────────────────────────────
    createTable: async (nickname, buyIn, customSettings) => {
        const playerId = generateId();
        const code = generateCode();
        const stack = buyIn || DEFAULT_BUY_IN;
        const player: Player = {
            id: playerId,
            nickname,
            hands: [],
            activeHandIndex: 0,
            insuranceBet: 0,
            currentBet: DEFAULT_BET,
            avatarId: Math.floor(Math.random() * 8) + 1,
            isSittingOut: false,
        };

        const ledgerEntry: LedgerEntry = {
            playerId,
            nickname,
            totalBuyIn: stack,
            netProfit: 0,
            currentStack: stack,
        };

        set({
            players: [player],
            myPlayerId: playerId,
            hostId: playerId,
            tableCode: code,
            gamePhase: "betting",
            dealerHand: [],
            dealerScore: 0,
            currentTurn: null,
            deck: [],
            message: `Table ${code} created!`,
            ledger: { [playerId]: ledgerEntry },
            settings: { ...get().settings, ...customSettings },
            dealerId: customSettings?.dealerMode === "me" ? playerId : "system",
        });

        // Supabase Integration: Create Session
        try {
            const { data, error } = await supabase
                .from("game_sessions")
                .insert({
                    table_code: code,
                    host_nickname: nickname,
                    initial_buy_in: stack,
                    dealer_mode: customSettings?.dealerMode || "me",
                    rotation_rule: customSettings?.rotationRule || "permanent",
                })
                .select()
                .single();

            if (data && !error) {
                set({ sessionId: data.id });
            }
        } catch (err) {
            console.error("Supabase Error:", err);
        }
    },

    joinTable: (code, nickname, buyIn) => {
        const { isTableLocked } = get();
        if (isTableLocked) {
            alert("Table is locked.");
            return;
        }

        const playerId = generateId();
        const stack = buyIn || DEFAULT_BUY_IN;
        const player: Player = {
            id: playerId,
            nickname,
            hands: [],
            activeHandIndex: 0,
            insuranceBet: 0,
            currentBet: DEFAULT_BET,
            avatarId: Math.floor(Math.random() * 8) + 1,
            isSittingOut: false,
        };

        const ledgerEntry: LedgerEntry = {
            playerId,
            nickname,
            totalBuyIn: stack,
            netProfit: 0,
            currentStack: stack,
        };

        set((state) => ({
            players: [...state.players, player],
            myPlayerId: playerId,
            tableCode: code,
            gamePhase: state.gamePhase === "idle" ? "betting" : state.gamePhase,
            message: `${nickname} joined!`,
            ledger: { ...state.ledger, [playerId]: ledgerEntry },
        }));
    },

    toggleSitOut: () => {
        const { myPlayerId, players } = get();
        if (!myPlayerId) return;
        set({
            players: players.map(p =>
                p.id === myPlayerId ? { ...p, isSittingOut: !p.isSittingOut } : p
            ),
            message: "Player status updated.",
        });
    },

    leaveTable: () => {
        const { myPlayerId } = get();
        if (!myPlayerId) return;
        set(state => ({
            players: state.players.filter(p => p.id !== myPlayerId),
            myPlayerId: null,
            gamePhase: "idle",
            tableCode: null,
        }));
    },

    setBet: (amount) => {
        const { myPlayerId, players, ledger } = get();
        if (!myPlayerId) return;
        const stack = ledger[myPlayerId]?.currentStack ?? 0;
        const clamped = Math.max(10, Math.min(amount, stack));
        set({
            players: players.map(p =>
                p.id === myPlayerId ? { ...p, currentBet: clamped } : p
            ),
        });
    },

    rebuy: (amount) => {
        const { myPlayerId, ledger } = get();
        if (!myPlayerId || !ledger[myPlayerId]) return;
        const entry = ledger[myPlayerId];
        const updatedEntry = {
            ...entry,
            totalBuyIn: entry.totalBuyIn + amount,
            currentStack: entry.currentStack + amount,
            netProfit: (entry.currentStack + amount) - (entry.totalBuyIn + amount),
        };
        set((state) => ({
            ledger: { ...state.ledger, [myPlayerId]: updatedEntry },
            message: "Rebuy successful!",
        }));
    },

    kickPlayer: (playerId) => {
        const { hostId, myPlayerId } = get();
        if (myPlayerId !== hostId) return;
        set((state) => ({
            players: state.players.filter(p => p.id !== playerId),
            message: "Player kicked.",
        }));
    },

    toggleLock: () => {
        const { hostId, myPlayerId } = get();
        if (myPlayerId !== hostId) return;
        set(state => ({ isTableLocked: !state.isTableLocked }));
    },

    updateSettings: (newSettings) => {
        set(state => ({ settings: { ...state.settings, ...newSettings } }));
    },

    // ── Round Flow ────────────────────────────────────────
    startRound: () => {
        const deck = createDeck();
        const { players, handsPlayed, settings, dealerId } = get();

        // Dealer rotation
        let newDealerId = dealerId;
        if (settings.rotationRule === "rotate" && handsPlayed > 0 && handsPlayed % settings.rotationInterval === 0) {
            const currentIdx = players.findIndex(p => p.id === dealerId);
            const nextIdx = (currentIdx + 1) % players.length;
            newDealerId = players[nextIdx]?.id || "system";
        }

        // Deal to players
        const updatedPlayers = players.map((p) => {
            if (p.isSittingOut) {
                return { ...p, hands: [], activeHandIndex: 0, insuranceBet: 0, hasRespondedInsurance: true };
            }

            const card1 = deck.pop()!;
            const card2 = deck.pop()!;
            const cards = [card1, card2];
            const score = handScore(cards);
            const ledgerEntry = get().ledger[p.id];
            const currentStack = ledgerEntry?.currentStack ?? 0;

            // Critical Fix: Clamp bet to actual stack size
            // If they have 0, they can't play (should sit out, but here we just give 0 bet or force sit out?)
            // Let's clamp to stack. If stack is 0, bet is 0.
            let effectiveBet = p.currentBet || DEFAULT_BET;
            if (effectiveBet > currentStack) {
                effectiveBet = currentStack;
            }

            // If stack is 0 or less, force sit out for this round
            if (effectiveBet <= 0) {
                return { ...p, hands: [], activeHandIndex: 0, insuranceBet: 0, hasRespondedInsurance: true, isSittingOut: true };
            }

            const hand: PlayerHand = {
                cards,
                score,
                bet: effectiveBet,
                status: score === 21 ? "blackjack" : "playing",
                isDoubledDown: false,
                isSplit: false,
                isSurrendered: false,
            };

            return {
                ...p,
                hands: [hand],
                activeHandIndex: 0,
                insuranceBet: 0,
                hasRespondedInsurance: false,
            };
        });

        // Dealer cards
        const dealerCard1 = deck.pop()!;
        const dealerCard2 = { ...deck.pop()!, faceDown: true };
        const dealerHand = [dealerCard1, dealerCard2];

        // Check if dealer up-card is Ace → insurance phase
        const dealerShowsAce = dealerCard1.rank === "A";

        if (dealerShowsAce) {
            // Mark sitting-out players as already responded
            set({
                players: updatedPlayers,
                dealerHand,
                dealerScore: cardValue(dealerCard1),
                deck,
                gamePhase: "insurance",
                currentTurn: null,
                message: "Dealer shows Ace — Insurance?",
                dealerId: newDealerId,
            });
            return;
        }

        // Normal play
        const firstPlayer = updatedPlayers.find(p => !p.isSittingOut && p.hands.length > 0 && p.hands[0].status === "playing");

        set({
            players: updatedPlayers,
            dealerHand,
            dealerScore: cardValue(dealerCard1),
            deck,
            gamePhase: "playing",
            currentTurn: firstPlayer?.id || null,
            message: "Cards dealt!",
            dealerId: newDealerId,
        });

        // If all players have blackjack, go to dealer
        if (!firstPlayer) {
            get().dealerPlay();
        }
    },

    // ── Insurance ─────────────────────────────────────────
    insurance: () => {
        const { myPlayerId, players } = get();
        if (!myPlayerId) return;

        const updatedPlayers = players.map(p => {
            if (p.id !== myPlayerId) return p;
            const mainBet = p.hands[0]?.bet ?? DEFAULT_BET;
            return { ...p, insuranceBet: Math.floor(mainBet / 2), hasRespondedInsurance: true };
        });

        set({ players: updatedPlayers, message: "Insurance taken." });

        // Check if all active players have responded
        const allResponded = updatedPlayers.every(p => p.isSittingOut || p.hasRespondedInsurance || p.hands.length === 0);
        if (allResponded) {
            resolveInsurance(set, get);
        }
    },

    declineInsurance: () => {
        const { myPlayerId, players } = get();
        if (!myPlayerId) return;

        const updatedPlayers = players.map(p => {
            if (p.id !== myPlayerId) return p;
            return { ...p, insuranceBet: 0, hasRespondedInsurance: true };
        });

        set({ players: updatedPlayers, message: "Insurance declined." });

        const allResponded = updatedPlayers.every(p => p.isSittingOut || p.hasRespondedInsurance || p.hands.length === 0);
        if (allResponded) {
            resolveInsurance(set, get);
        }
    },

    // ── Hit ───────────────────────────────────────────────
    hit: () => {
        const { deck, currentTurn, players } = get();
        if (!currentTurn || deck.length === 0) return;

        const player = players.find(p => p.id === currentTurn);
        if (!player) return;
        const handIdx = player.activeHandIndex;
        const hand = player.hands[handIdx];
        if (!hand || hand.status !== "playing") return;

        const newCard = deck.pop()!;
        const newCards = [...hand.cards, newCard];
        const score = handScore(newCards);
        const busted = score > 21;

        const updatedHand: PlayerHand = {
            ...hand,
            cards: newCards,
            score,
            status: busted ? "busted" : "playing",
        };

        const updatedPlayers = players.map(p => {
            if (p.id !== currentTurn) return p;
            const newHands = [...p.hands];
            newHands[handIdx] = updatedHand;
            return { ...p, hands: newHands };
        });

        let nextTurn: string | null = currentTurn;
        let phase: GamePhase = "playing";
        let message: string | null = null;

        if (busted) {
            message = `${player.nickname} busted!`;
            const next = findNextTurn(updatedPlayers, currentTurn, handIdx);
            if (next) {
                nextTurn = next.playerId;
                // Update activeHandIndex on the next player
                const np = updatedPlayers.find(p => p.id === next.playerId);
                if (np) np.activeHandIndex = next.handIndex;
            } else {
                nextTurn = null;
                phase = "dealer-turn";
            }
        }

        set({ players: updatedPlayers, deck, currentTurn: nextTurn, gamePhase: phase, message });

        if (phase === "dealer-turn") {
            get().dealerPlay();
        }
    },

    // ── Stand ─────────────────────────────────────────────
    stand: () => {
        const { currentTurn, players } = get();
        if (!currentTurn) return;

        const player = players.find(p => p.id === currentTurn);
        if (!player) return;
        const handIdx = player.activeHandIndex;

        const updatedPlayers = players.map(p => {
            if (p.id !== currentTurn) return p;
            const newHands = [...p.hands];
            newHands[handIdx] = { ...newHands[handIdx], status: "stood" };
            return { ...p, hands: newHands };
        });

        const next = findNextTurn(updatedPlayers, currentTurn, handIdx);

        if (next) {
            // Update activeHandIndex
            const np = updatedPlayers.find(p => p.id === next.playerId);
            if (np) np.activeHandIndex = next.handIndex;

            set({
                players: updatedPlayers,
                currentTurn: next.playerId,
                message: `${player.nickname} stands.`,
            });
        } else {
            set({
                players: updatedPlayers,
                currentTurn: null,
                gamePhase: "dealer-turn",
                message: "Dealer's turn...",
            });
            get().dealerPlay();
        }
    },

    // ── Split ─────────────────────────────────────────────
    split: () => {
        const { currentTurn, players, deck, ledger } = get();
        if (!currentTurn || deck.length < 2) return;

        const player = players.find(p => p.id === currentTurn);
        if (!player) return;

        // Betting Limit Check: Need equal amount for split
        const handIdx = player.activeHandIndex;
        const hand = player.hands[handIdx];
        if (!hand || !canSplitHand(hand)) return;

        const splitCost = hand.bet;
        const playerStack = ledger[player.id]?.currentStack ?? 0;

        if (playerStack < splitCost) {
            set({ message: "Insufficient funds to split!" });
            return;
        }

        const isAces = hand.cards[0].rank === "A";

        // Create two new hands from the split cards
        const card1ForHand1 = deck.pop()!;
        const card2ForHand2 = deck.pop()!;

        const hand1Cards = [hand.cards[0], card1ForHand1];
        const hand2Cards = [hand.cards[1], card2ForHand2];

        const hand1Score = handScore(hand1Cards);
        const hand2Score = handScore(hand2Cards);

        // If split aces: one card only, auto-stand both
        const hand1: PlayerHand = {
            cards: hand1Cards,
            score: hand1Score,
            bet: hand.bet,
            status: isAces ? "stood" : (hand1Score === 21 ? "blackjack" : "playing"),
            isDoubledDown: false,
            isSplit: true,
            isSurrendered: false,
        };

        const hand2: PlayerHand = {
            cards: hand2Cards,
            score: hand2Score,
            bet: hand.bet, // Same bet as original
            status: isAces ? "stood" : (hand2Score === 21 ? "blackjack" : "playing"),
            isDoubledDown: false,
            isSplit: true,
            isSurrendered: false,
        };

        const updatedPlayers = players.map(p => {
            if (p.id !== currentTurn) return p;
            const newHands = [...p.hands];
            newHands.splice(handIdx, 1, hand1, hand2); // Replace original with two
            return { ...p, hands: newHands, activeHandIndex: handIdx };
        });

        if (isAces) {
            // Both hands auto-stood, move to next
            const next = findNextTurn(updatedPlayers, currentTurn, handIdx + 1); // Skip both split hands
            if (next) {
                const np = updatedPlayers.find(p => p.id === next.playerId);
                if (np) np.activeHandIndex = next.handIndex;
                set({
                    players: updatedPlayers,
                    deck,
                    currentTurn: next.playerId,
                    message: `${player.nickname} splits Aces — one card each.`,
                });
            } else {
                set({
                    players: updatedPlayers,
                    deck,
                    currentTurn: null,
                    gamePhase: "dealer-turn",
                    message: "Dealer's turn...",
                });
                get().dealerPlay();
            }
        } else {
            // Play hand1 first
            set({
                players: updatedPlayers,
                deck,
                message: `${player.nickname} splits!`,
            });
        }
    },

    // ── Double Down ───────────────────────────────────────
    doubleDown: () => {
        const { currentTurn, players, deck, ledger } = get();
        if (!currentTurn || deck.length === 0) return;

        const player = players.find(p => p.id === currentTurn);
        if (!player) return;
        const handIdx = player.activeHandIndex;
        const hand = player.hands[handIdx];
        if (!hand || !canDoubleDown(hand)) return;

        // Betting Limit Check: Need equal amount for double
        const doubleCost = hand.bet;
        const playerStack = ledger[player.id]?.currentStack ?? 0;

        if (playerStack < doubleCost) {
            set({ message: "Insufficient funds to double down!" });
            return;
        }

        const newCard = deck.pop()!;
        const newCards = [...hand.cards, newCard];
        const score = handScore(newCards);
        const busted = score > 21;

        const updatedHand: PlayerHand = {
            ...hand,
            cards: newCards,
            score,
            bet: hand.bet * 2, // Double the bet
            status: busted ? "busted" : "stood", // Auto-stand after one card
            isDoubledDown: true,
        };

        const updatedPlayers = players.map(p => {
            if (p.id !== currentTurn) return p;
            const newHands = [...p.hands];
            newHands[handIdx] = updatedHand;
            return { ...p, hands: newHands };
        });

        const msg = busted
            ? `${player.nickname} doubles down and busts!`
            : `${player.nickname} doubles down!`;

        const next = findNextTurn(updatedPlayers, currentTurn, handIdx);

        if (next) {
            const np = updatedPlayers.find(p => p.id === next.playerId);
            if (np) np.activeHandIndex = next.handIndex;
            set({ players: updatedPlayers, deck, currentTurn: next.playerId, message: msg });
        } else {
            set({ players: updatedPlayers, deck, currentTurn: null, gamePhase: "dealer-turn", message: "Dealer's turn..." });
            get().dealerPlay();
        }
    },

    // ── Surrender ─────────────────────────────────────────
    surrender: () => {
        const { currentTurn, players } = get();
        if (!currentTurn) return;

        const player = players.find(p => p.id === currentTurn);
        if (!player || !canSurrender(player)) return;

        const hand = player.hands[0];
        const updatedHand: PlayerHand = {
            ...hand,
            status: "surrendered",
            bet: Math.floor(hand.bet / 2), // Lose half
            isSurrendered: true,
        };

        const updatedPlayers = players.map(p => {
            if (p.id !== currentTurn) return p;
            return { ...p, hands: [updatedHand] };
        });

        const next = findNextTurn(updatedPlayers, currentTurn, 0);

        if (next) {
            const np = updatedPlayers.find(p => p.id === next.playerId);
            if (np) np.activeHandIndex = next.handIndex;
            set({ players: updatedPlayers, currentTurn: next.playerId, message: `${player.nickname} surrenders.` });
        } else {
            set({ players: updatedPlayers, currentTurn: null, gamePhase: "dealer-turn", message: "Dealer's turn..." });
            get().dealerPlay();
        }
    },

    // ── Dealer Play ───────────────────────────────────────
    dealerPlay: async () => {
        await delay(800);

        const { dealerHand, deck } = get();
        const revealed: Card[] = dealerHand.map(c => ({ ...c, faceDown: false }));
        let hand = [...revealed];
        let score = handScore(hand);

        set({ dealerHand: hand, dealerScore: score, message: `Dealer shows ${score}.` });
        await delay(1000);

        while (score < 17 && deck.length > 0) {
            set({ message: "Dealer hits..." });
            const newCard = deck.pop()!;
            hand = [...hand, newCard];
            score = handScore(hand);
            set({ dealerHand: hand, dealerScore: score, deck });
            await delay(1000);
        }

        // Settlement — iterate every hand of every player
        const { players, ledger } = get();
        const dealerBJ = score === 21 && hand.length === 2;
        const newLedger = { ...ledger };

        const settledPlayers = players.map((p) => {
            if (p.isSittingOut || p.hands.length === 0) return p;

            const settledHands = p.hands.map((h) => {
                if (h.status === "waiting") return h;

                let status: PlayerStatus = "lost";

                if (h.isSurrendered) {
                    status = "surrendered";
                } else if (h.status === "busted") {
                    status = "busted";
                } else if (h.status === "blackjack") {
                    if (dealerBJ) status = "push";
                    else status = "blackjack";
                } else if (score > 21) {
                    status = "won";
                } else if (h.score > score) {
                    status = "won";
                } else if (h.score === score) {
                    status = "push";
                } else {
                    status = "lost";
                }

                return { ...h, status };
            });

            // Calculate ledger changes for this player
            let totalChange = 0;
            settledHands.forEach(h => {
                if (h.status === "waiting") return;
                if (h.isSurrendered) {
                    totalChange -= h.bet; // Already halved during surrender action
                } else if (h.status === "won") {
                    totalChange += h.bet;
                } else if (h.status === "blackjack") {
                    totalChange += Math.floor(h.bet * 1.5);
                } else if (h.status === "busted" || h.status === "lost") {
                    totalChange -= h.bet;
                }
                // Push = 0 change
            });

            // Insurance payout
            if (p.insuranceBet > 0) {
                if (dealerBJ) {
                    totalChange += p.insuranceBet * 2; // Pays 2:1
                } else {
                    totalChange -= p.insuranceBet; // Loses insurance bet
                }
            }

            const entry = newLedger[p.id];
            if (entry) {
                newLedger[p.id] = {
                    ...entry,
                    currentStack: entry.currentStack + totalChange,
                    netProfit: (entry.currentStack + totalChange) - entry.totalBuyIn,
                };
            }

            return { ...p, hands: settledHands };
        });

        const resultMsg = score > 21 ? "Dealer busts!" : `Dealer stands at ${score}.`;

        set(state => ({
            dealerHand: hand,
            dealerScore: score,
            deck,
            players: settledPlayers,
            ledger: newLedger,
            gamePhase: "settlement",
            currentTurn: null,
            message: resultMsg,
            handsPlayed: state.handsPlayed + 1,
        }));

        // Supabase Integration: Log Hand & Results
        const { sessionId, handsPlayed } = get();
        if (sessionId) {
            try {
                // 1. Create Hand Record
                const { data: handData, error: handError } = await supabase
                    .from("hands")
                    .insert({
                        session_id: sessionId,
                        hand_number: handsPlayed,
                        dealer_score: score,
                        dealer_cards: hand,
                        result_message: resultMsg,
                    })
                    .select()
                    .single();

                if (handData && !handError) {
                    const handId = handData.id;

                    // 2. Create Player Result Records
                    const resultsPayload = settledPlayers
                        .filter(p => !p.isSittingOut && p.hands.length > 0 && p.hands[0].status !== "waiting")
                        .flatMap(p => {
                            // Calculate net profit for this round only
                            const previousStack = ledger[p.id]?.currentStack ?? p.hands.reduce((s, h) => s + h.bet, 0); // approx
                            const currentStack = newLedger[p.id]?.currentStack ?? previousStack;
                            const roundProfit = currentStack - (ledger[p.id]?.currentStack ?? currentStack);

                            // We'll log the first hand for simplicity, or we could log multiple rows if split?
                            // For simplicity, let's just log the player's summary for the round
                            return {
                                hand_id: handId,
                                session_id: sessionId,
                                player_nickname: p.nickname,
                                player_id: p.id,
                                bet_amount: getPlayerBet(p),
                                payout_amount: roundProfit,
                                outcome: getPlayerStatus(p), // e.g. "won", "lost", "split"
                                cards: p.hands.flatMap(h => h.cards),
                                final_score: getPlayerScore(p),
                            };
                        });

                    if (resultsPayload.length > 0) {
                        await supabase.from("player_results").insert(resultsPayload);
                    }
                }
            } catch (err) {
                console.error("Supabase Log Error:", err);
            }
        }
    },

    // ── Reset ─────────────────────────────────────────────
    reset: () => {
        set((state) => ({
            players: state.players.map(p => ({
                ...p,
                hands: [],
                activeHandIndex: 0,
                insuranceBet: 0,
                hasRespondedInsurance: false,
            })),
            dealerHand: [],
            dealerScore: 0,
            gamePhase: "betting",
            currentTurn: null,
            deck: [],
            message: "Place your bets.",
        }));
    },

    setDealerId: (playerId) => {
        set({ dealerId: playerId, message: "Dealer updated." });
    },
}));

// ── Insurance Resolution (outside store for clarity) ────
function resolveInsurance(
    set: (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void,
    get: () => GameState
) {
    const { dealerHand, players } = get();
    // Reveal dealer's hole card
    const revealed = dealerHand.map(c => ({ ...c, faceDown: false }));
    const dealerScore = handScore(revealed);
    const dealerHasBJ = dealerScore === 21 && revealed.length === 2;

    if (dealerHasBJ) {
        // Dealer has blackjack — insurance pays, round ends immediately
        const { ledger } = get();
        const newLedger = { ...ledger };

        const settledPlayers = players.map(p => {
            if (p.isSittingOut || p.hands.length === 0) return p;

            let totalChange = 0;

            // Insurance payout: 2:1
            if (p.insuranceBet > 0) {
                totalChange += p.insuranceBet * 2;
            } else {
                // No insurance taken
            }

            // Main hand: player BJ = push, else lose
            const settledHands = p.hands.map(h => {
                if (h.status === "blackjack") {
                    // Push — no change
                    return { ...h, status: "push" as PlayerStatus };
                } else {
                    totalChange -= h.bet;
                    return { ...h, status: "lost" as PlayerStatus };
                }
            });

            const entry = newLedger[p.id];
            if (entry) {
                newLedger[p.id] = {
                    ...entry,
                    currentStack: entry.currentStack + totalChange,
                    netProfit: (entry.currentStack + totalChange) - entry.totalBuyIn,
                };
            }

            return { ...p, hands: settledHands };
        });

        set(state => ({
            dealerHand: revealed,
            dealerScore,
            players: settledPlayers,
            ledger: newLedger,
            gamePhase: "settlement",
            currentTurn: null,
            message: "Dealer has Blackjack!",
            handsPlayed: state.handsPlayed + 1,
        }));
    } else {
        // No dealer BJ — lose insurance bets, continue to play
        const { ledger } = get();
        const newLedger = { ...ledger };

        const updatedPlayers = players.map(p => {
            if (p.insuranceBet > 0) {
                const entry = newLedger[p.id];
                if (entry) {
                    newLedger[p.id] = {
                        ...entry,
                        currentStack: entry.currentStack - p.insuranceBet,
                        netProfit: (entry.currentStack - p.insuranceBet) - entry.totalBuyIn,
                    };
                }
            }
            return { ...p, insuranceBet: 0 };
        });

        const firstPlayer = updatedPlayers.find(p => !p.isSittingOut && p.hands.length > 0 && p.hands[0].status === "playing");

        set({
            // Don't reveal hole card yet — keep it face down
            players: updatedPlayers,
            ledger: newLedger,
            gamePhase: "playing",
            currentTurn: firstPlayer?.id || null,
            message: "No Blackjack. Play continues.",
        });

        if (!firstPlayer) {
            get().dealerPlay();
        }
    }
}
