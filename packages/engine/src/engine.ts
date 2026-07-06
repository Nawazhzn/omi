import { freshDeck, rankValue, shuffle } from "./deck.js";
import { secureRandomInt } from "./rng.js";
import {
  Card,
  cardsEqual,
  DareLevel,
  DareResult,
  DARE_MULTIPLIER,
  DEFAULT_RULES,
  FlagResult,
  GameState,
  HandResult,
  nextSeat,
  prevSeat,
  ResolvedTrick,
  RuleConfig,
  Seat,
  SEATS,
  Suit,
  SUITS,
  Team,
  teamOfSeat,
  TrickPlay,
} from "./types.js";

export class IllegalActionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "IllegalActionError";
  }
}

function emptyHands(): [Card[], Card[], Card[], Card[]] {
  return [[], [], [], []];
}

export function createInitialState(rules: Partial<RuleConfig> = {}, dealerSeat: Seat = 0): GameState {
  return {
    phase: "LOBBY",
    rules: { ...DEFAULT_RULES, ...rules },
    handNumber: 0,
    dealerSeat,
    cutSeat: prevSeat(dealerSeat),
    trumpCallerSeat: nextSeat(dealerSeat),
    trumpSuit: null,
    hands: emptyHands(),
    currentTurnSeat: null,
    currentTrick: [],
    trickHistory: [],
    lastTrick: null,
    tokens: [0, 0],
    pendingBonus: 0,
    flagsRemaining: [rules.flagsPerTeam ?? DEFAULT_RULES.flagsPerTeam, rules.flagsPerTeam ?? DEFAULT_RULES.flagsPerTeam],
    dare: { level: "none", challengerTeam: null },
    coins: [500, 500, 500, 500],
    allInUsed: [false, false],
    dareStreak: [0, 0],
    slamDeclaredByTeam: null,
    forfeitVotes: [false, false, false, false],
    winningTeam: null,
    lastHandResult: null,
  };
}

/**
 * Decides whether the game ends after the hand that was just scored, given the
 * updated team token totals. The game ends when either a team reaches
 * targetTokens, OR (when maxRounds > 0) the round cap is reached — in which
 * case the team with more tokens wins, or it's a draw (winningTeam: null) on a
 * tie. Returns the phase to enter and the resulting winner.
 */
function decideGameEnd(
  state: GameState,
  tokens: [number, number]
): { phase: "GAME_OVER" | "HAND_SCORING"; winningTeam: Team | null } {
  const target = state.rules.targetTokens;
  const tokenWinner: Team | null = tokens[0] >= target ? 0 : tokens[1] >= target ? 1 : null;
  if (tokenWinner !== null) return { phase: "GAME_OVER", winningTeam: tokenWinner };

  const maxRounds = state.rules.maxRounds;
  if (maxRounds > 0 && state.handNumber >= maxRounds) {
    const roundWinner: Team | null = tokens[0] > tokens[1] ? 0 : tokens[1] > tokens[0] ? 1 : null;
    return { phase: "GAME_OVER", winningTeam: roundWinner };
  }
  return { phase: "HAND_SCORING", winningTeam: null };
}

/**
 * Begins a new hand: shuffles the deck and awaits the cut from the seat to
 * the dealer's left, before any cards are dealt. The trump caller (dealer's
 * right) is a different seat and only acts once batch 1 has been dealt.
 */
export function beginHand(state: GameState): GameState {
  if (state.phase !== "LOBBY" && state.phase !== "HAND_SCORING") {
    throw new IllegalActionError("BAD_PHASE", `Cannot start hand from phase ${state.phase}`);
  }
  const deck = shuffle(freshDeck());
  return {
    ...state,
    phase: "AWAIT_CUT",
    handNumber: state.handNumber + 1,
    cutSeat: prevSeat(state.dealerSeat),
    trumpCallerSeat: nextSeat(state.dealerSeat),
    trumpSuit: null,
    hands: emptyHands(),
    currentTurnSeat: null,
    currentTrick: [],
    trickHistory: [],
    lastTrick: null,
    dare: { level: "none", challengerTeam: null },
    slamDeclaredByTeam: null,
    forfeitVotes: [false, false, false, false],
    winningTeam: null,
    lastHandResult: null,
    deckRemainder: deck,
  };
}

/**
 * A crypto-random cut point clustered around the middle of the 32-card deck
 * (roughly 12–20), so an omitted/auto cut still "splits the deck near the
 * half" like a real cut instead of always slicing at a fixed spot.
 */
export function randomCutPosition(): number {
  // secureRandomInt(9) -> 0..8, offset to 12..20 (a natural near-half cut).
  return 12 + secureRandomInt(9);
}

/**
 * The seat to the dealer's left cuts the shuffled deck before dealing begins:
 * the deck is split at `cutPosition` and the bottom portion (from the cut
 * point onward — the "second half") is brought to the top. The exact cut
 * point has no statistical effect on an already-shuffled deck — it's a ritual,
 * not a security measure — so any position is accepted, and when one is
 * omitted a crypto-random near-half cut is used.
 */
export function cutDeck(state: GameState, seat: Seat, cutPosition?: number): GameState {
  if (state.phase !== "AWAIT_CUT") {
    throw new IllegalActionError("BAD_PHASE", "The deck can only be cut in AWAIT_CUT phase");
  }
  if (seat !== state.cutSeat) {
    throw new IllegalActionError("NOT_YOUR_CUT", "Only the seat to the dealer's left may cut");
  }
  const deck = state.deckRemainder;
  if (!deck || deck.length !== 32) {
    throw new Error("Internal error: missing deck for cut");
  }
  const requested = Number.isFinite(cutPosition) ? Math.floor(cutPosition as number) : randomCutPosition();
  const pos = Math.max(1, Math.min(31, requested));
  // Bring the second half (deck[pos..]) up on top of the first half.
  const cut = [...deck.slice(pos), ...deck.slice(0, pos)];
  return dealBatch1({ ...state, deckRemainder: cut });
}

function dealBatch1(state: GameState): GameState {
  const deck = state.deckRemainder;
  if (!deck || deck.length !== 32) {
    throw new Error("Internal error: missing deck for batch 1 deal");
  }
  const hands = emptyHands();
  for (let i = 0; i < 4; i++) {
    for (const seat of SEATS) {
      hands[seat].push(deck[i * 4 + seat]);
    }
  }
  return {
    ...state,
    phase: "AWAIT_TRUMP_CALL",
    hands,
    deckRemainder: deck.slice(16),
  };
}

export function callTrump(state: GameState, seat: Seat, suit: Suit): GameState {
  if (state.phase !== "AWAIT_TRUMP_CALL") {
    throw new IllegalActionError("BAD_PHASE", "Trump can only be called in AWAIT_TRUMP_CALL phase");
  }
  if (seat !== state.trumpCallerSeat) {
    throw new IllegalActionError("NOT_YOUR_CALL", "Only the trump caller may call trump");
  }
  if (!SUITS.includes(suit)) {
    throw new IllegalActionError("INVALID_SUIT", "Trump must be one of the four suits");
  }
  if (state.rules.dareMode) {
    // Omi Dare Mode: the opposing team gets a window to challenge before
    // batch 2 is dealt, instead of dealing immediately.
    return { ...state, trumpSuit: suit, phase: "AWAIT_DARE_CHALLENGE", dare: { level: "none", challengerTeam: null } };
  }
  const withTrump: GameState = { ...state, trumpSuit: suit, phase: "DEALING_BATCH_2" };
  return dealBatch2(withTrump);
}

/**
 * Omi Dare Mode — the opposing team's response to a freshly-called trump.
 * "pass" deals batch 2 normally with no bet. "dare" opens a response window
 * for the trump team. "allin" locks in the maximum stake immediately
 * (capped at one per team for the whole game).
 */
export function declareDare(state: GameState, seat: Seat, action: "pass" | "dare" | "allin"): GameState {
  if (!state.rules.dareMode) {
    throw new IllegalActionError("RULE_DISABLED", "Dare Mode is not enabled for this game");
  }
  if (state.phase !== "AWAIT_DARE_CHALLENGE") {
    throw new IllegalActionError("BAD_PHASE", "No dare challenge is open");
  }
  const challengerTeam = teamOfSeat(seat);
  const trumpTeam = teamOfSeat(state.trumpCallerSeat);
  if (challengerTeam === trumpTeam) {
    throw new IllegalActionError("WRONG_TEAM", "Only the team that didn't call trump may challenge");
  }
  if (action !== "pass" && action !== "dare" && action !== "allin") {
    throw new IllegalActionError("INVALID_ACTION", "Dare action must be pass, dare, or allin");
  }

  if (action === "pass") {
    return dealBatch2({ ...state, phase: "DEALING_BATCH_2", dare: { level: "none", challengerTeam: null } });
  }
  if (action === "allin") {
    if (state.allInUsed[challengerTeam]) {
      throw new IllegalActionError("ALL_IN_USED", "Your team has already used its all-in dare this game");
    }
    const allInUsed: [boolean, boolean] = [...state.allInUsed];
    allInUsed[challengerTeam] = true;
    return dealBatch2({
      ...state,
      phase: "DEALING_BATCH_2",
      dare: { level: "allin", challengerTeam },
      allInUsed,
    });
  }
  return { ...state, phase: "AWAIT_DARE_RESPONSE", dare: { level: "dare", challengerTeam } };
}

/**
 * Omi Dare Mode — the trump team's response to an open dare. "safe" cancels
 * the bet (normal round). "redare" doubles the stake again (x4) and locks
 * it in. "accept" locks in the dare at its current level (x2).
 */
export function respondToDare(state: GameState, seat: Seat, action: "accept" | "safe" | "redare"): GameState {
  if (state.phase !== "AWAIT_DARE_RESPONSE") {
    throw new IllegalActionError("BAD_PHASE", "No dare response is pending");
  }
  const responderTeam = teamOfSeat(seat);
  const trumpTeam = teamOfSeat(state.trumpCallerSeat);
  if (responderTeam !== trumpTeam) {
    throw new IllegalActionError("WRONG_TEAM", "Only the trump-calling team may respond to a dare");
  }
  if (action !== "accept" && action !== "safe" && action !== "redare") {
    throw new IllegalActionError("INVALID_ACTION", "Dare response must be accept, safe, or redare");
  }

  if (action === "safe") {
    return dealBatch2({ ...state, phase: "DEALING_BATCH_2", dare: { level: "none", challengerTeam: null } });
  }
  if (action === "redare") {
    return dealBatch2({ ...state, phase: "DEALING_BATCH_2", dare: { ...state.dare, level: "redare" } });
  }
  return dealBatch2({ ...state, phase: "DEALING_BATCH_2" });
}

function dealBatch2(state: GameState): GameState {
  if (state.phase !== "DEALING_BATCH_2") {
    throw new IllegalActionError("BAD_PHASE", "Cannot deal batch 2 outside DEALING_BATCH_2 phase");
  }
  const remainder = state.deckRemainder;
  if (!remainder || remainder.length !== 16) {
    throw new Error("Internal error: missing deck remainder for batch 2 deal");
  }
  const hands: [Card[], Card[], Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
    [...state.hands[2]],
    [...state.hands[3]],
  ];
  for (let i = 0; i < 4; i++) {
    for (const seat of SEATS) {
      hands[seat].push(remainder[i * 4 + seat]);
    }
  }
  const leader = state.trumpCallerSeat;
  const next: GameState = {
    ...state,
    phase: "TRICK_PLAY",
    hands,
    currentTurnSeat: leader,
    currentTrick: [],
  };
  delete next.deckRemainder;
  return next;
}

export function legalCardsFor(state: GameState, seat: Seat): Card[] {
  const hand = state.hands[seat];
  if (state.currentTrick.length === 0) return hand;
  const leadSuit = state.currentTrick[0].card.suit;
  const followable = hand.filter((c) => c.suit === leadSuit);
  return followable.length > 0 ? followable : hand;
}

export function playCard(state: GameState, seat: Seat, card: Card): GameState {
  if (state.phase !== "TRICK_PLAY") {
    throw new IllegalActionError("BAD_PHASE", "Cards can only be played during TRICK_PLAY");
  }
  if (seat !== state.currentTurnSeat) {
    throw new IllegalActionError("NOT_YOUR_TURN", "It is not this seat's turn");
  }
  const hand = state.hands[seat];
  const owned = hand.some((c) => cardsEqual(c, card));
  if (!owned) {
    throw new IllegalActionError("CARD_NOT_IN_HAND", "Seat does not hold this card");
  }
  const legal = legalCardsFor(state, seat);
  const followsSuit = legal.some((c) => cardsEqual(c, card));
  if (state.rules.strictFollowSuit && !followsSuit) {
    throw new IllegalActionError("MUST_FOLLOW_SUIT", "Must follow suit when able");
  }
  // In flag mode (the default), an off-suit play while holding the led suit
  // is allowed through but tagged so a later raiseFlag() can be verified
  // against the truth — without ever exposing this flag to clients.
  const leadSuitOfTrick = state.currentTrick[0]?.card.suit ?? null;
  const violatesFollowSuit =
    leadSuitOfTrick !== null && card.suit !== leadSuitOfTrick && hand.some((c) => c.suit === leadSuitOfTrick);

  const newHands: [Card[], Card[], Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
    [...state.hands[2]],
    [...state.hands[3]],
  ];
  newHands[seat] = newHands[seat].filter((c) => !cardsEqual(c, card));

  const newTrick: TrickPlay[] = [...state.currentTrick, { seat, card, violatesFollowSuit }];

  if (newTrick.length < 4) {
    return {
      ...state,
      hands: newHands,
      currentTrick: newTrick,
      currentTurnSeat: nextSeat(seat),
    };
  }

  // Trick complete: resolve the winner but hold the cards visible — the
  // trick is not cleared and the next trick does not begin until
  // continueTrick() is called, giving players a moment to see the result.
  const leadSuit = newTrick[0].card.suit;
  const winnerSeat = resolveTrickWinner(newTrick, leadSuit, state.trumpSuit);
  const resolved: ResolvedTrick = {
    index: state.trickHistory.length,
    plays: newTrick,
    leadSuit,
    winnerSeat,
  };
  const trickHistory = [...state.trickHistory, resolved];

  return {
    ...state,
    hands: newHands,
    currentTrick: newTrick,
    trickHistory,
    lastTrick: resolved,
    currentTurnSeat: null,
    phase: "TRICK_RESOLVED",
  };
}

/**
 * Advances past the TRICK_RESOLVED pause: clears the resolved trick from the
 * table and either starts the next trick (winner leads) or, after the 8th
 * trick, scores the hand.
 */
export function continueTrick(state: GameState): GameState {
  if (state.phase !== "TRICK_RESOLVED") {
    throw new IllegalActionError("BAD_PHASE", "No resolved trick to continue from");
  }
  if (state.trickHistory.length === 8) {
    return scoreHand({
      ...state,
      currentTrick: [],
      currentTurnSeat: null,
      phase: "HAND_SCORING",
    });
  }
  const winnerSeat = state.lastTrick!.winnerSeat;
  return {
    ...state,
    currentTrick: [],
    currentTurnSeat: winnerSeat,
    phase: "TRICK_PLAY",
  };
}

export interface RaiseFlagOutcome {
  state: GameState;
  correct: boolean;
}

/**
 * Either team may challenge a specific play from the current (or just-
 * resolved) trick, claiming the player failed to follow suit while holding
 * it. Costs one of the team's flag chances regardless of outcome. A correct
 * flag penalizes the offending team and ends the hand immediately, awarding
 * the flagging team 3 tokens instead of the normal trick-count scoring.
 */
export function raiseFlag(state: GameState, accusingSeat: Seat, targetSeat: Seat): RaiseFlagOutcome {
  if (state.phase !== "TRICK_PLAY" && state.phase !== "TRICK_RESOLVED") {
    throw new IllegalActionError("BAD_PHASE", "Flags can only be raised during or right after a trick");
  }
  const accusingTeam = teamOfSeat(accusingSeat);
  const targetTeam = teamOfSeat(targetSeat);
  if (accusingTeam === targetTeam) {
    throw new IllegalActionError("SAME_TEAM", "You can only flag an opposing player");
  }
  // Flags are unlimited — a wrong flag simply has no effect and play continues,
  // so a genuine follow-suit violation can always be caught. No per-team cap.
  const play = state.currentTrick.find((p) => p.seat === targetSeat);
  if (!play) {
    throw new IllegalActionError("NOTHING_TO_FLAG", "That player hasn't played a card in this trick");
  }
  const leadSuit = state.currentTrick[0].card.suit;
  if (play.card.suit === leadSuit) {
    throw new IllegalActionError("NOTHING_TO_FLAG", "That play followed the led suit — nothing to flag");
  }

  if (!play.violatesFollowSuit) {
    // Wrong flag: no penalty, no cost, game continues normally.
    return { state, correct: false };
  }

  // Correct flag: offending team penalized, flagging team gets 3 tokens,
  // and the hand ends immediately rather than playing out the remaining tricks.
  const tokens: [number, number] = [...state.tokens];
  tokens[accusingTeam] += 3;
  const tokensAwarded: [number, number] = [0, 0];
  tokensAwarded[accusingTeam] = 3;

  // A flag ending the hand early also cancels any active dare — refunded, same as a 4-4 draw.
  const cancelledDare: DareResult | null =
    state.rules.dareMode && state.dare.level !== "none"
      ? {
          level: state.dare.level,
          multiplier: DARE_MULTIPLIER[state.dare.level],
          challengerTeam: state.dare.challengerTeam!,
          winnerTeam: null,
          cancelled: true,
          coinsDelta: [0, 0, 0, 0],
          kapothiBonusApplied: false,
          streakBonusApplied: false,
          comebackBonusApplied: false,
          streakAfter: state.dareStreak[state.dare.challengerTeam!],
        }
      : null;

  const result: HandResult = {
    trickCounts: countTricksByTeam(state),
    tokensAwarded,
    kapothi: false,
    kapothiTeam: null,
    pendingBonusApplied: 0,
    pendingBonusAfter: state.pendingBonus,
    slamFailedTeam: null,
    flag: { raisedByTeam: accusingTeam, offendingSeat: targetSeat, offendingTeam: targetTeam } as FlagResult,
    dare: cancelledDare,
    forfeit: null,
  };

  const outcome = decideGameEnd(state, tokens);

  return {
    state: {
      ...state,
      tokens,
      currentTrick: [],
      currentTurnSeat: null,
      lastHandResult: result,
      phase: outcome.phase,
      winningTeam: outcome.winningTeam,
    },
    correct: true,
  };
}

function resolveTrickWinner(plays: TrickPlay[], leadSuit: Suit, trumpSuit: Suit | null): Seat {
  const trumpPlays = trumpSuit ? plays.filter((p) => p.card.suit === trumpSuit) : [];
  const pool = trumpPlays.length > 0 ? trumpPlays : plays.filter((p) => p.card.suit === leadSuit);
  let best = pool[0];
  for (const p of pool) {
    if (rankValue(p.card.rank) > rankValue(best.card.rank)) best = p;
  }
  return best.seat;
}

export function declareSlam(state: GameState, team: Team): GameState {
  if (!state.rules.slamHouseRule) {
    throw new IllegalActionError("RULE_DISABLED", "Slam house rule is not enabled for this game");
  }
  if (state.phase !== "TRICK_PLAY") {
    throw new IllegalActionError("BAD_PHASE", "Slam can only be declared during trick play");
  }
  if (state.trickHistory.length >= 6) {
    throw new IllegalActionError("TOO_LATE", "Slam must be declared before the 7th trick begins");
  }
  if (state.slamDeclaredByTeam !== null) {
    throw new IllegalActionError("ALREADY_DECLARED", "Slam already declared this hand");
  }
  return { ...state, slamDeclaredByTeam: team };
}

function countTricksByTeam(state: GameState): [number, number] {
  const counts: [number, number] = [0, 0];
  for (const trick of state.trickHistory) {
    counts[teamOfSeat(trick.winnerSeat)]++;
  }
  return counts;
}

function lastTwoTricksWonBy(state: GameState, team: Team): boolean {
  const lastTwo = state.trickHistory.slice(-2);
  return lastTwo.length === 2 && lastTwo.every((t) => teamOfSeat(t.winnerSeat) === team);
}

interface DareOutcome {
  dareResult: DareResult | null;
  coins: [number, number, number, number];
  dareStreak: [number, number];
}

/**
 * Resolves Omi Dare Mode's virtual-coin side bet for the hand, independent
 * of the normal token score. A 4-4 draw cancels and refunds the dare. A
 * decisive hand pays the losing team's stake to the winners, with a +50%
 * bonus on a Kapothi win, a flat bonus on a 2-in-a-row dare win streak, and
 * a flat "comeback" bonus if the dare-winning team was behind on tokens.
 */
function resolveDare(state: GameState, trickCounts: [number, number]): DareOutcome {
  const coins: [number, number, number, number] = [...state.coins];
  const dareStreak: [number, number] = [...state.dareStreak];

  if (!state.rules.dareMode || state.dare.level === "none") {
    return { dareResult: null, coins, dareStreak };
  }

  const level: DareLevel = state.dare.level;
  const multiplier = DARE_MULTIPLIER[level];
  const challengerTeam = state.dare.challengerTeam!;

  if (trickCounts[0] === 4 && trickCounts[1] === 4) {
    return {
      dareResult: {
        level,
        multiplier,
        challengerTeam,
        winnerTeam: null,
        cancelled: true,
        coinsDelta: [0, 0, 0, 0],
        kapothiBonusApplied: false,
        streakBonusApplied: false,
        comebackBonusApplied: false,
        streakAfter: dareStreak[challengerTeam],
      },
      coins,
      dareStreak,
    };
  }

  const winnerTeam: Team = trickCounts[0] > trickCounts[1] ? 0 : 1;
  const loserTeam: Team = winnerTeam === 0 ? 1 : 0;
  const kapothi = trickCounts[winnerTeam] === 8;

  let payment = state.rules.dareBaseStake * multiplier;
  if (kapothi) payment = Math.round(payment * 1.5);
  const comebackBonusApplied = state.tokens[winnerTeam] < state.tokens[loserTeam];
  if (comebackBonusApplied) payment += 15;

  for (const seat of SEATS) {
    coins[seat] += teamOfSeat(seat) === winnerTeam ? payment : -payment;
  }

  dareStreak[winnerTeam] += 1;
  dareStreak[loserTeam] = 0;
  const streakBonusApplied = dareStreak[winnerTeam] >= 2 && dareStreak[winnerTeam] % 2 === 0;
  if (streakBonusApplied) {
    for (const seat of SEATS) {
      if (teamOfSeat(seat) === winnerTeam) coins[seat] += 20;
    }
  }

  const coinsDelta: [number, number, number, number] = [0, 0, 0, 0];
  for (const seat of SEATS) coinsDelta[seat] = coins[seat] - state.coins[seat];

  return {
    dareResult: {
      level,
      multiplier,
      challengerTeam,
      winnerTeam,
      cancelled: false,
      coinsDelta,
      kapothiBonusApplied: kapothi,
      streakBonusApplied,
      comebackBonusApplied,
      streakAfter: dareStreak[winnerTeam],
    },
    coins,
    dareStreak,
  };
}

export function scoreHand(state: GameState): GameState {
  const trickCounts = countTricksByTeam(state);
  const callerTeam = teamOfSeat(state.trumpCallerSeat);

  let tokensAwarded: [number, number] = [0, 0];
  let kapothi = false;
  let kapothiTeam: Team | null = null;
  let slamFailedTeam: Team | null = null;
  let pendingBonusApplied = 0;
  const incomingBonus = state.pendingBonus;
  let pendingBonusAfter = incomingBonus;

  const declarer = state.slamDeclaredByTeam;
  if (declarer !== null && !lastTwoTricksWonBy(state, declarer)) {
    // Declared an intent to win all 8 but lost one of the last two tricks ->
    // forfeit 4 to the opponents, overriding the normal scoring matrix
    // (including the 4-4 tie rule) for this hand.
    const opponent: Team = declarer === 0 ? 1 : 0;
    slamFailedTeam = declarer;
    tokensAwarded[opponent] = 4 + incomingBonus;
    pendingBonusApplied = incomingBonus;
    pendingBonusAfter = 0;
  } else if (trickCounts[0] === 4 && trickCounts[1] === 4) {
    pendingBonusAfter = incomingBonus + 1;
  } else {
    const winningTeam: Team = trickCounts[0] > trickCounts[1] ? 0 : 1;
    const allEight = trickCounts[winningTeam] === 8;

    if (allEight) {
      kapothi = true;
      kapothiTeam = winningTeam;
      tokensAwarded[winningTeam] = 3 + incomingBonus;
    } else {
      const isChooser = winningTeam === callerTeam;
      tokensAwarded[winningTeam] = (isChooser ? 1 : 2) + incomingBonus;
    }
    pendingBonusApplied = incomingBonus;
    pendingBonusAfter = 0;
  }

  const tokens: [number, number] = [
    state.tokens[0] + tokensAwarded[0],
    state.tokens[1] + tokensAwarded[1],
  ];

  const { dareResult, coins, dareStreak } = resolveDare(state, trickCounts);

  const result: HandResult = {
    trickCounts,
    tokensAwarded,
    kapothi,
    kapothiTeam,
    pendingBonusApplied,
    pendingBonusAfter,
    slamFailedTeam,
    flag: null,
    dare: dareResult,
    forfeit: null,
  };

  const outcome = decideGameEnd(state, tokens);

  return {
    ...state,
    phase: outcome.phase,
    tokens,
    pendingBonus: pendingBonusAfter,
    coins,
    dareStreak,
    lastHandResult: result,
    winningTeam: outcome.winningTeam,
  };
}

/** Advances to the next hand: dealer rotates to the right (next seat), then awaits the cut. */
export function nextHand(state: GameState): GameState {
  if (state.phase !== "HAND_SCORING") {
    throw new IllegalActionError("BAD_PHASE", "Can only advance to next hand after scoring");
  }
  const advanced: GameState = {
    ...state,
    phase: "LOBBY",
    dealerSeat: nextSeat(state.dealerSeat),
  };
  return beginHand(advanced);
}

/** True when trump is set and neither seat of `team` holds a single trump card. */
export function teamHoldsNoTrump(state: GameState, team: Team): boolean {
  if (state.trumpSuit === null) return false;
  return SEATS.filter((s) => teamOfSeat(s) === team).every(
    (s) => !state.hands[s].some((c) => c.suit === state.trumpSuit)
  );
}

/**
 * Whether `seat` may currently vote to forfeit the hand: it's the very start
 * of trick play (no trick resolved yet), the seat's team holds no trump, and
 * it hasn't already voted.
 */
export function canForfeit(state: GameState, seat: Seat): boolean {
  return (
    state.phase === "TRICK_PLAY" &&
    state.trickHistory.length === 0 &&
    !state.forfeitVotes[seat] &&
    teamHoldsNoTrump(state, teamOfSeat(seat))
  );
}

/**
 * Records a forfeit vote from `seat`. When BOTH members of a team that holds
 * no trump have voted, the hand is voided immediately: no tokens are awarded
 * to anyone, and any active dare is cancelled/refunded. A single vote just
 * registers, leaving the hand in progress for the teammate to confirm.
 */
export function voteForfeit(state: GameState, seat: Seat): GameState {
  if (state.phase !== "TRICK_PLAY" || state.trickHistory.length !== 0) {
    throw new IllegalActionError("BAD_PHASE", "Can only forfeit at the very start of a hand");
  }
  const team = teamOfSeat(seat);
  if (!teamHoldsNoTrump(state, team)) {
    throw new IllegalActionError("HAS_TRUMP", "Only a team holding no trump may forfeit");
  }

  const forfeitVotes = [...state.forfeitVotes] as [boolean, boolean, boolean, boolean];
  forfeitVotes[seat] = true;

  const bothVoted = SEATS.filter((s) => teamOfSeat(s) === team).every((s) => forfeitVotes[s]);
  if (!bothVoted) {
    return { ...state, forfeitVotes };
  }

  const dareResult: DareResult | null =
    state.dare.level === "none"
      ? null
      : {
          level: state.dare.level,
          multiplier: DARE_MULTIPLIER[state.dare.level],
          challengerTeam: state.dare.challengerTeam ?? team,
          winnerTeam: null,
          cancelled: true,
          coinsDelta: [0, 0, 0, 0],
          kapothiBonusApplied: false,
          streakBonusApplied: false,
          comebackBonusApplied: false,
          streakAfter: state.dareStreak[team],
        };

  const result: HandResult = {
    trickCounts: [0, 0],
    tokensAwarded: [0, 0],
    kapothi: false,
    kapothiTeam: null,
    pendingBonusApplied: 0,
    pendingBonusAfter: state.pendingBonus,
    slamFailedTeam: null,
    flag: null,
    dare: dareResult,
    forfeit: { team },
  };

  const outcome = decideGameEnd(state, state.tokens); // tokens unchanged — the hand is a wash
  return {
    ...state,
    forfeitVotes,
    currentTrick: [],
    currentTurnSeat: null,
    lastHandResult: result,
    phase: outcome.phase,
    winningTeam: outcome.winningTeam,
  };
}
