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

// ─── Shared State (what gets synced across tabs) ────────
interface SharedState {
    players: Player[];
    dealerHand: Card[];
    dealerScore: number;
    gamePhase: GamePhase;
    currentTurn: string | null;
    deck: Card[];
    message: string | null;
    hostId: string | null;
    isTableLocked: boolean;
    ledger: Record<string, LedgerEntry>;
    settings: GameSettings;
    handsPlayed: number;
    dealerId: string | null;
    tableCode: string | null;
}

// ─── GameState Interface ────────────────────────────────
interface GameState extends SharedState {
    myPlayerId: string | null;
    sessionId: string | null;

    // Actions
    createTable: (nickname: string, buyIn: number, settings?: Partial<GameSettings>) => Promise<void>;
    joinTable: (code: string, nickname: string, buyIn: number) => Promise<void>;
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
    if (hand.isSplit) return false;
    return cardValue(hand.cards[0]) === cardValue(hand.cards[1]);
}

function canDoubleDown(hand: PlayerHand): boolean {
    return hand.cards.length === 2 && !hand.isDoubledDown && !hand.isSurrendered;
}

function canSurrender(player: Player): boolean {
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

function findNextTurn(players: Player[], currentPlayerId: string, currentHandIndex: number): { playerId: string; handIndex: number } | null {
    const currentPlayerIdx = players.findIndex(p => p.id === currentPlayerId);
    if (currentPlayerIdx < 0) return null;

    const currentPlayer = players[currentPlayerIdx];
    for (let h = currentHandIndex + 1; h < currentPlayer.hands.length; h++) {
        if (currentPlayer.hands[h].status === "playing") {
            return { playerId: currentPlayer.id, handIndex: h };
        }
    }

    for (let p = currentPlayerIdx + 1; p < players.length; p++) {
        const player = players[p];
        if (player.isSittingOut) continue;
        for (let h = 0; h < player.hands.length; h++) {
            if (player.hands[h].status === "playing") {
                return { playerId: player.id, handIndex: h };
            }
        }
    }

    return null;
}

// ─── Cross-Tab Sync via BroadcastChannel + Supabase ──────
// The "host" is the source of truth — all mutations happen locally,
// then get broadcast and periodically saved to Supabase.

const LS_PREFIX = "bj_table_";
let _channel: BroadcastChannel | null = null;

function getTableStorageKey(code: string): string {
    return `${LS_PREFIX}${code}`;
}

function getSharedState(state: GameState): SharedState {
    return {
        players: state.players,
        dealerHand: state.dealerHand,
        dealerScore: state.dealerScore,
        gamePhase: state.gamePhase,
        currentTurn: state.currentTurn,
        deck: state.deck,
        message: state.message,
        hostId: state.hostId,
        isTableLocked: state.isTableLocked,
        ledger: state.ledger,
        settings: state.settings,
        handsPlayed: state.handsPlayed,
        dealerId: state.dealerId,
        tableCode: state.tableCode,
    };
}

async function saveTableState(state: GameState) {
    if (!state.tableCode) return;
    const shared = getSharedState(state);

    // 1. LocalStorage fallback
    try {
        localStorage.setItem(getTableStorageKey(state.tableCode), JSON.stringify(shared));
    } catch { /* ignore */ }

    // 2. Supabase persistence
    if (supabase) {
        try {
            await supabase
                .from('game_sessions')
                .upsert({
                    code: state.tableCode,
                    state: shared,
                    host_id: state.hostId,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'code' });
        } catch (error) {
            console.error("Supabase Save Error:", error);
        }
    }
}

async function loadTableState(code: string): Promise<SharedState | null> {
    // 1. Try Supabase first
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('game_sessions')
                .select('state')
                .eq('code', code)
                .single();

            if (data && !error) {
                return data.state as SharedState;
            }
        } catch (error) {
            console.error("Supabase Load Error:", error);
        }
    }

    // 2. Fallback to LocalStorage
    try {
        const raw = localStorage.getItem(getTableStorageKey(code));
        if (raw) return JSON.parse(raw) as SharedState;
    } catch { /* ignore */ }

    return null;
}

function broadcastUpdate(state: GameState) {
    saveTableState(state);
    if (_channel) {
        _channel.postMessage({ type: "state_sync", payload: getSharedState(state) });
    }
}

function setupChannel(
    code: string,
    set: (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void,
    get: () => GameState
) {
    if (_channel) {
        _channel.close();
        _channel = null;
    }

    _channel = new BroadcastChannel(`bj_channel_${code}`);

    _channel.onmessage = (event) => {
        const { type, payload } = event.data;

        if (type === "state_sync") {
            const incoming = payload as SharedState;
            set({
                players: incoming.players,
                dealerHand: incoming.dealerHand,
                dealerScore: incoming.dealerScore,
                gamePhase: incoming.gamePhase,
                currentTurn: incoming.currentTurn,
                deck: incoming.deck,
                message: incoming.message,
                hostId: incoming.hostId,
                isTableLocked: incoming.isTableLocked,
                ledger: incoming.ledger,
                settings: incoming.settings,
                handsPlayed: incoming.handsPlayed,
                dealerId: incoming.dealerId,
                tableCode: incoming.tableCode,
            });
        }

        if (type === "player_join") {
            const state = get();
            if (state.myPlayerId !== state.hostId) return;

            const { player, ledgerEntry } = payload as { player: Player; ledgerEntry: LedgerEntry };
            if (state.players.find(p => p.id === player.id)) return;

            set((s) => ({
                players: [...s.players, player],
                gamePhase: s.gamePhase === "idle" ? "betting" : s.gamePhase,
                message: `${player.nickname} joined!`,
                ledger: { ...s.ledger, [player.id]: ledgerEntry },
            }));

            setTimeout(() => broadcastUpdate(get()), 50);
        }

        if (type === "player_leave") {
            const state = get();
            if (state.myPlayerId !== state.hostId) return;
            const { playerId } = payload as { playerId: string };
            set((s) => ({
                players: s.players.filter(p => p.id !== playerId),
            }));
            setTimeout(() => broadcastUpdate(get()), 50);
        }

        if (type === "request_state") {
            const state = get();
            if (state.myPlayerId === state.hostId) {
                broadcastUpdate(state);
            }
        }
    };
}

function syncAfterUpdate(get: () => GameState) {
    broadcastUpdate(get());
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

        // Initialize channel and persist to Supabase
        setupChannel(code, set, get);
        await saveTableState(get());
        syncAfterUpdate(get);
    },

    joinTable: async (code, nickname, buyIn) => {
        const existingState = await loadTableState(code);
        if (!existingState) {
            alert("Table not found. Please check the code and try again.");
            return;
        }

        if (existingState.isTableLocked) {
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

        set({
            ...existingState,
            message: `Joining table ${code}...`,
            myPlayerId: playerId,
        });

        setupChannel(code, set, get);

        if (_channel) {
            _channel.postMessage({
                type: "player_join",
                payload: { player, ledgerEntry },
            });
            _channel.postMessage({ type: "request_state", payload: {} });
        }
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
        syncAfterUpdate(get);
    },

    leaveTable: () => {
        const { myPlayerId } = get();
        if (!myPlayerId) return;

        if (_channel) {
            _channel.postMessage({
                type: "player_leave",
                payload: { playerId: myPlayerId },
            });
            _channel.close();
            _channel = null;
        }

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
        syncAfterUpdate(get);
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
        syncAfterUpdate(get);
    },

    kickPlayer: (playerId) => {
        const { hostId, myPlayerId } = get();
        if (myPlayerId !== hostId) return;
        set((state) => ({
            players: state.players.filter(p => p.id !== playerId),
            message: "Player kicked.",
        }));
        syncAfterUpdate(get);
    },

    toggleLock: () => {
        const { hostId, myPlayerId } = get();
        if (myPlayerId !== hostId) return;
        set(state => ({ isTableLocked: !state.isTableLocked }));
        syncAfterUpdate(get);
    },

    updateSettings: (newSettings) => {
        set(state => ({ settings: { ...state.settings, ...newSettings } }));
        syncAfterUpdate(get);
    },

    // ── Round Flow ────────────────────────────────────────
    startRound: () => {
        const deck = createDeck();
        const { players, handsPlayed, settings, dealerId } = get();

        let newDealerId = dealerId;
        if (settings.rotationRule === "rotate" && handsPlayed > 0 && handsPlayed % settings.rotationInterval === 0) {
            const currentIdx = players.findIndex(p => p.id === dealerId);
            const nextIdx = (currentIdx + 1) % players.length;
            newDealerId = players[nextIdx]?.id || "system";
        }

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

            let effectiveBet = p.currentBet || DEFAULT_BET;
            if (effectiveBet > currentStack) {
                effectiveBet = currentStack;
            }

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

        const dealerCard1 = deck.pop()!;
        const dealerCard2 = { ...deck.pop()!, faceDown: true };
        const dealerHand = [dealerCard1, dealerCard2];

        const dealerShowsAce = dealerCard1.rank === "A";

        if (dealerShowsAce) {
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
            syncAfterUpdate(get);
            return;
        }

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
        syncAfterUpdate(get);

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
        syncAfterUpdate(get);

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
        syncAfterUpdate(get);

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
        const got21 = score === 21;

        const updatedHand: PlayerHand = {
            ...hand,
            cards: newCards,
            score,
            status: busted ? "busted" : got21 ? "stood" : "playing",
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

        if (busted || got21) {
            message = busted
                ? `${player.nickname} busted!`
                : `${player.nickname} hits 21!`;
            const next = findNextTurn(updatedPlayers, currentTurn, handIdx);
            if (next) {
                nextTurn = next.playerId;
                const np = updatedPlayers.find(p => p.id === next.playerId);
                if (np) np.activeHandIndex = next.handIndex;
            } else {
                nextTurn = null;
                phase = "dealer-turn";
            }
        }

        set({ players: updatedPlayers, deck, currentTurn: nextTurn, gamePhase: phase, message });
        syncAfterUpdate(get);

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
            syncAfterUpdate(get);
            get().dealerPlay();
            return;
        }
        syncAfterUpdate(get);
    },

    // ── Split ─────────────────────────────────────────────
    split: () => {
        const { currentTurn, players, deck, ledger } = get();
        if (!currentTurn || deck.length < 2) return;

        const player = players.find(p => p.id === currentTurn);
        if (!player) return;

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

        const card1ForHand1 = deck.pop()!;
        const card2ForHand2 = deck.pop()!;

        const hand1Cards = [hand.cards[0], card1ForHand1];
        const hand2Cards = [hand.cards[1], card2ForHand2];

        const hand1Score = handScore(hand1Cards);
        const hand2Score = handScore(hand2Cards);

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
            bet: hand.bet,
            status: isAces ? "stood" : (hand2Score === 21 ? "blackjack" : "playing"),
            isDoubledDown: false,
            isSplit: true,
            isSurrendered: false,
        };

        const updatedPlayers = players.map(p => {
            if (p.id !== currentTurn) return p;
            const newHands = [...p.hands];
            newHands.splice(handIdx, 1, hand1, hand2);
            return { ...p, hands: newHands, activeHandIndex: handIdx };
        });

        if (isAces) {
            const next = findNextTurn(updatedPlayers, currentTurn, handIdx + 1);
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
                syncAfterUpdate(get);
                get().dealerPlay();
                return;
            }
        } else {
            set({
                players: updatedPlayers,
                deck,
                message: `${player.nickname} splits!`,
            });
        }
        syncAfterUpdate(get);
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
            bet: hand.bet * 2,
            status: busted ? "busted" : "stood",
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
            syncAfterUpdate(get);
            get().dealerPlay();
            return;
        }
        syncAfterUpdate(get);
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
            bet: Math.floor(hand.bet / 2),
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
            syncAfterUpdate(get);
            get().dealerPlay();
            return;
        }
        syncAfterUpdate(get);
    },

    // ── Dealer Play ───────────────────────────────────────
    dealerPlay: async () => {
        await delay(800);

        const { dealerHand, deck } = get();
        const revealed: Card[] = dealerHand.map(c => ({ ...c, faceDown: false }));
        let hand = [...revealed];
        let score = handScore(hand);

        set({ dealerHand: hand, dealerScore: score, message: `Dealer shows ${score}.` });
        syncAfterUpdate(get);
        await delay(1000);

        while (score < 17 && deck.length > 0) {
            set({ message: "Dealer hits..." });
            const newCard = deck.pop()!;
            hand = [...hand, newCard];
            score = handScore(hand);
            set({ dealerHand: hand, dealerScore: score, deck });
            syncAfterUpdate(get);
            await delay(1000);
        }

        // Settlement
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

            let totalChange = 0;
            settledHands.forEach(h => {
                if (h.status === "waiting") return;
                if (h.isSurrendered) {
                    totalChange -= h.bet;
                } else if (h.status === "won") {
                    totalChange += h.bet;
                } else if (h.status === "blackjack") {
                    totalChange += Math.floor(h.bet * 1.5);
                } else if (h.status === "busted" || h.status === "lost") {
                    totalChange -= h.bet;
                }
            });

            if (p.insuranceBet > 0) {
                if (dealerBJ) {
                    totalChange += p.insuranceBet * 2;
                } else {
                    totalChange -= p.insuranceBet;
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
        syncAfterUpdate(get);
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
        syncAfterUpdate(get);
    },

    setDealerId: (playerId) => {
        set({ dealerId: playerId, message: "Dealer updated." });
        syncAfterUpdate(get);
    },
}));

// ── Insurance Resolution ────────────────────────────────
function resolveInsurance(
    set: (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void,
    get: () => GameState
) {
    const { dealerHand, players } = get();
    const revealed = dealerHand.map(c => ({ ...c, faceDown: false }));
    const dealerScore = handScore(revealed);
    const dealerHasBJ = dealerScore === 21 && revealed.length === 2;

    if (dealerHasBJ) {
        const { ledger } = get();
        const newLedger = { ...ledger };

        const settledPlayers = players.map(p => {
            if (p.isSittingOut || p.hands.length === 0) return p;

            let totalChange = 0;

            if (p.insuranceBet > 0) {
                totalChange += p.insuranceBet * 2;
            }

            const settledHands = p.hands.map(h => {
                if (h.status === "blackjack") {
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
        syncAfterUpdate(get);
    } else {
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
            players: updatedPlayers,
            ledger: newLedger,
            gamePhase: "playing",
            currentTurn: firstPlayer?.id || null,
            message: "No Blackjack. Play continues.",
        });
        syncAfterUpdate(get);

        if (!firstPlayer) {
            get().dealerPlay();
        }
    }
}
