import { describe, expect, it } from "vitest";
import {
  beginHand,
  callTrump,
  continueTrick,
  createInitialState,
  cutDeck,
  declareDare,
  declareSlam,
  GameState,
  IllegalActionError,
  legalCardsFor,
  nextHand,
  nextSeat,
  prevSeat,
  playCard,
  raiseFlag,
  redactStateForSeat,
  respondToDare,
  teamHoldsNoTrump,
  voteForfeit,
} from "../src/index.js";
import { Card, Seat, Suit } from "../src/types.js";

/** Begins a hand, performs the ritual cut, and returns the AWAIT_TRUMP_CALL state. */
function freshHandState(rules: Partial<GameState["rules"]> = {}, dealerSeat: Seat = 0): GameState {
  const cut = beginHand(createInitialState(rules, dealerSeat));
  return cutDeck(cut, cut.cutSeat, 16);
}

function callDefaultTrump(state: GameState): GameState {
  return callTrump(state, state.trumpCallerSeat, "S");
}

/** Plays out a full trick (4 cards) and advances past the TRICK_RESOLVED pause. */
function playTrickWithWinner(state: GameState, winnerSeat: Seat, suit: Suit = "D"): GameState {
  const seatOrder: Seat[] = [];
  let s = state.currentTurnSeat!;
  for (let i = 0; i < 4; i++) {
    seatOrder.push(s);
    s = nextSeat(s);
  }
  const ranksDesc: Card["rank"][] = ["A", "K", "Q", "J"];
  let rankIdx = 0;
  for (const seat of seatOrder) {
    const rank = seat === winnerSeat ? ranksDesc[0] : ranksDesc[++rankIdx];
    const card: Card = { suit, rank };
    state.hands[seat] = [
      card,
      ...state.hands[seat].filter((c) => !(c.suit === card.suit && c.rank === card.rank)),
    ];
  }
  for (const seat of seatOrder) {
    const card = state.hands[seat][0];
    state = playCard(state, seat, card);
  }
  expect(state.phase).toBe("TRICK_RESOLVED");
  return continueTrick(state);
}

function playHandWithWinners(state: GameState, winnerSeats: Seat[]): GameState {
  for (const winnerSeat of winnerSeats) {
    state = playTrickWithWinner(state, winnerSeat);
  }
  return state;
}

describe("deck cut", () => {
  it("awaits the cut from the seat to the dealer's left before dealing", () => {
    const state = beginHand(createInitialState({}, 0));
    expect(state.phase).toBe("AWAIT_CUT");
    expect(state.cutSeat).toBe(prevSeat(0));
    expect(state.hands[0]).toHaveLength(0);
  });

  it("the cutter (dealer's left) is a different seat from the trump caller (dealer's right)", () => {
    const state = beginHand(createInitialState({}, 0));
    expect(state.cutSeat).toBe(prevSeat(state.dealerSeat));
    expect(state.trumpCallerSeat).toBe(nextSeat(state.dealerSeat));
    expect(state.cutSeat).not.toBe(state.trumpCallerSeat);
  });

  it("rejects a cut from any seat other than the designated cutter", () => {
    const state = beginHand(createInitialState({}, 0));
    const wrongSeat = nextSeat(state.cutSeat);
    expect(() => cutDeck(state, wrongSeat)).toThrow(IllegalActionError);
  });

  it("deals batch 1 (4 cards each) immediately after the cut", () => {
    const state = freshHandState({}, 0);
    expect(state.phase).toBe("AWAIT_TRUMP_CALL");
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(state.hands[seat]).toHaveLength(4);
    }
  });
});

describe("dealing and trump call", () => {
  it("deals exactly 4 cards to each seat after batch 1, awaiting trump call from dealer's right", () => {
    const state = freshHandState({}, 0);
    expect(state.phase).toBe("AWAIT_TRUMP_CALL");
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(state.hands[seat]).toHaveLength(4);
    }
    expect(state.trumpCallerSeat).toBe(nextSeat(0));
  });

  it("only the trump caller may call trump", () => {
    const state = freshHandState();
    const wrongSeat = nextSeat(state.trumpCallerSeat);
    expect(() => callTrump(state, wrongSeat, "H")).toThrow(IllegalActionError);
  });

  it("deals the remaining 4 cards to each seat after trump is called", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    expect(state.phase).toBe("TRICK_PLAY");
    expect(state.trumpSuit).toBe("S");
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(state.hands[seat]).toHaveLength(8);
    }
    expect(state.deckRemainder).toBeUndefined();
    expect(state.currentTurnSeat).toBe(state.trumpCallerSeat);
  });

  it("rejects trump call outside AWAIT_TRUMP_CALL phase", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    expect(() => callTrump(state, state.trumpCallerSeat, "H")).toThrow(IllegalActionError);
  });
});

describe("follow-suit legality", () => {
  it("requires following the led suit when able, in strict mode", () => {
    let state = freshHandState({ strictFollowSuit: true });
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    state.hands[leader] = [
      { suit: "H", rank: "A" },
      { suit: "H", rank: "K" },
      { suit: "S", rank: "7" },
      { suit: "D", rank: "9" },
      { suit: "C", rank: "9" },
      { suit: "C", rank: "8" },
      { suit: "C", rank: "7" },
      { suit: "D", rank: "7" },
    ];
    state = playCard(state, leader, { suit: "H", rank: "A" });

    const second = state.currentTurnSeat!;
    state.hands[second] = [
      { suit: "H", rank: "7" },
      { suit: "S", rank: "A" },
      { suit: "D", rank: "A" },
      { suit: "C", rank: "A" },
      { suit: "C", rank: "K" },
      { suit: "C", rank: "Q" },
      { suit: "C", rank: "J" },
      { suit: "C", rank: "10" },
    ];
    const legal = legalCardsFor(state, second);
    expect(legal).toEqual([{ suit: "H", rank: "7" }]);
    expect(() => playCard(state, second, { suit: "S", rank: "A" })).toThrow(IllegalActionError);
    expect(() => playCard(state, second, { suit: "H", rank: "7" })).not.toThrow();
  });

  it("allows any card, including trump, when void in the led suit", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    state.currentTrick = [{ seat: leader, card: { suit: "H", rank: "A" } }];
    state.hands[leader] = state.hands[leader].filter((c) => c.suit !== "H");

    const voidSeat = nextSeat(leader);
    state.hands[voidSeat] = [
      { suit: "S", rank: "7" },
      { suit: "D", rank: "9" },
      { suit: "C", rank: "9" },
      { suit: "C", rank: "8" },
      { suit: "C", rank: "7" },
      { suit: "D", rank: "7" },
      { suit: "D", rank: "8" },
      { suit: "D", rank: "10" },
    ];
    const legal = legalCardsFor(state, voidSeat);
    expect(legal).toHaveLength(8);
  });

  it("rejects an unowned card", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    const notMine: Card = { suit: "S", rank: "A" };
    state.hands[leader] = state.hands[leader].filter(
      (c) => !(c.suit === notMine.suit && c.rank === notMine.rank)
    );
    expect(() => playCard(state, leader, notMine)).toThrow(IllegalActionError);
  });

  it("rejects a play out of turn", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    const other = nextSeat(leader);
    expect(() => playCard(state, other, state.hands[other][0])).toThrow(IllegalActionError);
  });
});

describe("trick resolution", () => {
  it("highest card of the led suit wins when no trump is played, and holds in TRICK_RESOLVED until continued", () => {
    let state = freshHandState();
    state = callDefaultTrump(state); // trump = S
    const a = state.currentTurnSeat!;
    const b = nextSeat(a);
    const c = nextSeat(b);
    const d = nextSeat(c);
    state.hands[a] = [{ suit: "H", rank: "9" }, ...state.hands[a].slice(1)];
    state.hands[b] = [{ suit: "H", rank: "A" }, ...state.hands[b].slice(1)];
    state.hands[c] = [{ suit: "H", rank: "7" }, ...state.hands[c].slice(1)];
    // d must be void in the led suit (H) to legally play an off-suit card.
    state.hands[d] = [{ suit: "D", rank: "K" }, ...state.hands[d].filter((c) => c.suit !== "H").slice(0, 7)];

    state = playCard(state, a, { suit: "H", rank: "9" });
    state = playCard(state, b, { suit: "H", rank: "A" });
    state = playCard(state, c, { suit: "H", rank: "7" });
    state = playCard(state, d, { suit: "D", rank: "K" });

    expect(state.phase).toBe("TRICK_RESOLVED");
    expect(state.lastTrick!.winnerSeat).toBe(b);
    expect(state.currentTurnSeat).toBeNull();

    state = continueTrick(state);
    expect(state.phase).toBe("TRICK_PLAY");
    expect(state.currentTrick).toHaveLength(0);
    expect(state.currentTurnSeat).toBe(b);
  });

  it("highest trump beats every led-suit card", () => {
    let state = freshHandState();
    state = callDefaultTrump(state); // trump = S
    const a = state.currentTurnSeat!;
    const b = nextSeat(a);
    const c = nextSeat(b);
    const d = nextSeat(c);
    state.hands[a] = [{ suit: "H", rank: "A" }, ...state.hands[a].slice(1)];
    state.hands[b] = [{ suit: "H", rank: "K" }, ...state.hands[b].slice(1)];
    // c must be void in the led suit (H) to legally play an off-suit trump.
    state.hands[c] = [{ suit: "S", rank: "7" }, ...state.hands[c].filter((card) => card.suit !== "H").slice(0, 7)];
    state.hands[d] = [{ suit: "H", rank: "Q" }, ...state.hands[d].slice(1)];

    state = playCard(state, a, { suit: "H", rank: "A" });
    state = playCard(state, b, { suit: "H", rank: "K" });
    state = playCard(state, c, { suit: "S", rank: "7" });
    state = playCard(state, d, { suit: "H", rank: "Q" });

    expect(state.lastTrick!.winnerSeat).toBe(c);
  });

  it("continueTrick is rejected outside the TRICK_RESOLVED phase", () => {
    const state = freshHandState();
    expect(() => continueTrick(state)).toThrow(IllegalActionError);
  });
});

describe("scoring matrix (spec 4.4)", () => {
  it("awards 1 token to the trump-choosing team for 5-7 tricks", () => {
    let state = freshHandState();
    const caller = state.trumpCallerSeat;
    state = callDefaultTrump(state);
    const winners: Seat[] = [caller, caller, caller, caller, caller, nextSeat(caller), nextSeat(caller), nextSeat(caller)];
    state = playHandWithWinners(state, winners);
    expect(state.lastHandResult!.trickCounts[caller % 2]).toBe(5);
    expect(state.lastHandResult!.tokensAwarded[caller % 2]).toBe(1);
    expect(state.lastHandResult!.tokensAwarded[(caller % 2) === 0 ? 1 : 0]).toBe(0);
  });

  it("awards 2 tokens to the non-choosing team for 5-7 tricks", () => {
    let state = freshHandState();
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    state = callDefaultTrump(state);
    const winners: Seat[] = [opponent, opponent, opponent, opponent, opponent, caller, caller, caller];
    state = playHandWithWinners(state, winners);
    const opponentTeam = opponent % 2;
    expect(state.lastHandResult!.trickCounts[opponentTeam]).toBe(5);
    expect(state.lastHandResult!.tokensAwarded[opponentTeam]).toBe(2);
  });

  it("awards 3 tokens (kapothi) when a team wins all 8 tricks, with no house rule", () => {
    let state = freshHandState();
    const caller = state.trumpCallerSeat;
    state = callDefaultTrump(state);
    const winners: Seat[] = Array(8).fill(caller);
    state = playHandWithWinners(state, winners);
    expect(state.lastHandResult!.kapothi).toBe(true);
    expect(state.lastHandResult!.kapothiTeam).toBe(caller % 2);
    expect(state.lastHandResult!.tokensAwarded[caller % 2]).toBe(3);
  });

  it("awards 0 tokens on a 4-4 tie and sets a +1 carry-over bonus", () => {
    let state = freshHandState();
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    state = callDefaultTrump(state);
    const winners: Seat[] = [caller, caller, caller, caller, opponent, opponent, opponent, opponent];
    state = playHandWithWinners(state, winners);
    expect(state.lastHandResult!.tokensAwarded).toEqual([0, 0]);
    expect(state.pendingBonus).toBe(1);
    expect(state.phase).toBe("HAND_SCORING");
  });

  it("applies the carry-over bonus to the next decisive hand and resets it", () => {
    let state = freshHandState();
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    state = callDefaultTrump(state);
    const tieWinners: Seat[] = [caller, caller, caller, caller, opponent, opponent, opponent, opponent];
    state = playHandWithWinners(state, tieWinners);
    expect(state.pendingBonus).toBe(1);

    state = nextHand(state);
    state = cutDeck(state, state.cutSeat, 16);
    const caller2 = state.trumpCallerSeat;
    state = callDefaultTrump(state);
    const winners2: Seat[] = Array(5).fill(caller2).concat(Array(3).fill(nextSeat(caller2)));
    state = playHandWithWinners(state, winners2);
    expect(state.lastHandResult!.tokensAwarded[caller2 % 2]).toBe(2); // 1 base + 1 carry-over
    expect(state.pendingBonus).toBe(0);
  });

  it("stacks consecutive tie bonuses", () => {
    let state = freshHandState();
    for (let i = 0; i < 2; i++) {
      const caller = state.trumpCallerSeat;
      const opponent = nextSeat(caller);
      state = callDefaultTrump(state);
      const tieWinners: Seat[] = [caller, caller, caller, caller, opponent, opponent, opponent, opponent];
      state = playHandWithWinners(state, tieWinners);
      state = nextHand(state);
      state = cutDeck(state, state.cutSeat, 16);
    }
    expect(state.pendingBonus).toBe(2);
  });
});

describe("declared slam house rule", () => {
  it("rejects slam declaration when the house rule is disabled", () => {
    let state = freshHandState({ slamHouseRule: false });
    state = callDefaultTrump(state);
    expect(() => declareSlam(state, (state.trumpCallerSeat % 2) as 0 | 1)).toThrow(IllegalActionError);
  });

  it("rejects slam declaration after the 6th trick has completed", () => {
    let state = freshHandState({ slamHouseRule: true });
    const caller = state.trumpCallerSeat;
    state = callDefaultTrump(state);
    state = playHandWithWinners(state, Array(6).fill(caller));
    expect(() => declareSlam(state, (caller % 2) as 0 | 1)).toThrow(IllegalActionError);
  });

  it("awards 3 tokens when the declaring team wins all 8 and holds the last two tricks", () => {
    let state = freshHandState({ slamHouseRule: true });
    const caller = state.trumpCallerSeat;
    const team = (caller % 2) as 0 | 1;
    state = callDefaultTrump(state);
    state = declareSlam(state, team);
    state = playHandWithWinners(state, Array(8).fill(caller));
    expect(state.lastHandResult!.kapothi).toBe(true);
    expect(state.lastHandResult!.tokensAwarded[team]).toBe(3);
  });

  it("forfeits 4 tokens to the opponents if the declaring team loses either of the last two tricks", () => {
    let state = freshHandState({ slamHouseRule: true });
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    const team = (caller % 2) as 0 | 1;
    const opponentTeam = (opponent % 2) as 0 | 1;
    state = callDefaultTrump(state);
    state = declareSlam(state, team);
    const winners: Seat[] = [caller, caller, caller, caller, caller, caller, opponent, caller];
    state = playHandWithWinners(state, winners);
    expect(state.lastHandResult!.slamFailedTeam).toBe(team);
    expect(state.lastHandResult!.tokensAwarded[opponentTeam]).toBe(4);
    expect(state.lastHandResult!.tokensAwarded[team]).toBe(0);
  });
});

describe("win condition and dealer rotation", () => {
  it("ends the game once a team reaches the token target", () => {
    let state = freshHandState({ targetTokens: 3 });
    const caller = state.trumpCallerSeat;
    state = callDefaultTrump(state);
    state = playHandWithWinners(state, Array(8).fill(caller)); // kapothi -> 3 tokens, hits target of 3
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winningTeam).toBe(caller % 2);
  });

  it("rotates the dealer to the right after each hand", () => {
    let state = freshHandState({}, 0);
    state = callDefaultTrump(state);
    state = playHandWithWinners(state, [0, 0, 0, 0, 1, 1, 1, 1] as Seat[]);
    expect(state.phase).toBe("HAND_SCORING");
    state = nextHand(state);
    expect(state.phase).toBe("AWAIT_CUT");
    expect(state.dealerSeat).toBe(nextSeat(0));
  });

  it("ends the game at the round cap even below the token target, giving it to the token leader", () => {
    // Round cap of 1, unreachable token target: the game must end after hand 1.
    let state = freshHandState({ maxRounds: 1, targetTokens: 100 });
    const caller = state.trumpCallerSeat;
    state = callDefaultTrump(state);
    state = playHandWithWinners(state, Array(8).fill(caller)); // caller's team sweeps -> more tokens
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winningTeam).toBe(caller % 2);
  });

  it("declares a draw when the round cap is hit with tokens tied", () => {
    // A 4-4 hand awards no tokens, so at the cap both teams sit at 0 -> draw.
    let state = freshHandState({ maxRounds: 1, targetTokens: 100 });
    state = callDefaultTrump(state);
    state = playHandWithWinners(state, [0, 0, 0, 0, 1, 1, 1, 1] as Seat[]);
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winningTeam).toBeNull();
  });

  it("does not end early when maxRounds is 0 (unlimited)", () => {
    let state = freshHandState({ maxRounds: 0, targetTokens: 100 });
    const caller = state.trumpCallerSeat;
    state = callDefaultTrump(state);
    state = playHandWithWinners(state, Array(8).fill(caller));
    expect(state.phase).toBe("HAND_SCORING");
    expect(state.winningTeam).toBeNull();
  });
});

describe("cut/call seating", () => {
  it("has the deck-cutter and the trump-caller on the same team, for every dealer", () => {
    for (let d = 0 as Seat; d < 4; d = (d + 1) as Seat) {
      const s = beginHand(createInitialState({}, d));
      expect(s.cutSeat % 2).toBe(s.trumpCallerSeat % 2); // same team
      expect(s.cutSeat).not.toBe(s.trumpCallerSeat); // but two different players
      expect(s.cutSeat % 2).not.toBe(d % 2); // and the opposing team from the dealer
    }
  });
});

describe("no-trump forfeit vote", () => {
  /** Forces team 0 (seats 0,2) to hold no trump by stripping spades from their hands. */
  function noTrumpForTeam0(): GameState {
    const base = callDefaultTrump(freshHandState({}));
    const stripSpades = (hand: Card[]) => hand.filter((c) => c.suit !== "S");
    return {
      ...base,
      trumpSuit: "S",
      hands: [stripSpades(base.hands[0]), base.hands[1], stripSpades(base.hands[2]), base.hands[3]],
    };
  }

  it("voids the hand once both members of a trumpless team vote", () => {
    const state0 = noTrumpForTeam0();
    expect(teamHoldsNoTrump(state0, 0)).toBe(true);

    let state = voteForfeit(state0, 0);
    expect(state.phase).toBe("TRICK_PLAY"); // one vote isn't enough

    state = voteForfeit(state, 2);
    expect(state.phase).toBe("HAND_SCORING");
    expect(state.lastHandResult?.forfeit).toEqual({ team: 0 });
    expect(state.lastHandResult?.tokensAwarded).toEqual([0, 0]);
    expect(state.tokens).toEqual(state0.tokens); // no points to anyone
  });

  it("rejects a forfeit vote from a team that holds a trump", () => {
    const state = noTrumpForTeam0(); // team 1 (seats 1,3) still has the spades
    expect(teamHoldsNoTrump(state, 1)).toBe(false);
    expect(() => voteForfeit(state, 1)).toThrow(IllegalActionError);
  });
});

describe("view redaction (security)", () => {
  it("never exposes another seat's hand, only counts", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const view = redactStateForSeat(state, seat);
      expect(view.myHand).toHaveLength(8);
      for (const otherSeat of [0, 1, 2, 3] as Seat[]) {
        if (otherSeat === seat) continue;
        expect(view.opponents.find((o) => o.seat === otherSeat)).toBeDefined();
      }
      expect(JSON.stringify(view)).not.toContain('"deckRemainder"');
      expect(view.opponents.every((o) => typeof o.cardCount === "number")).toBe(true);
      // Ensure no key resembling another seat's hand exists in the view object.
      expect(Object.keys(view)).not.toContain("hands");
    }
  });

  it("only sends legalCards to the seat whose turn it is", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    const activeSeat = state.currentTurnSeat!;
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const view = redactStateForSeat(state, seat);
      if (seat === activeSeat) {
        expect(view.legalCards).not.toBeNull();
      } else {
        expect(view.legalCards).toBeNull();
      }
    }
  });

  it("never leaks the deck remainder between batch deals", () => {
    let state = freshHandState();
    expect(state.deckRemainder).toBeDefined();
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const view = redactStateForSeat(state, seat) as unknown as Record<string, unknown>;
      expect(view.deckRemainder).toBeUndefined();
    }
  });

  it("exposes the resolved trick (already-public cards) but never the undealt deck", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    state = playTrickWithWinnerNoAdvance(state);
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const view = redactStateForSeat(state, seat);
      expect(view.lastTrick).not.toBeNull();
      expect(view.lastTrick!.plays).toHaveLength(4);
    }
  });
});

/** Begins a hand with Dare Mode on and calls trump, landing on AWAIT_DARE_CHALLENGE. */
function freshDareHandState(rules: Partial<GameState["rules"]> = {}, dealerSeat: Seat = 0): GameState {
  const cut = beginHand(createInitialState({ dareMode: true, ...rules }, dealerSeat));
  const state = cutDeck(cut, cut.cutSeat, 16);
  return callTrump(state, state.trumpCallerSeat, "S");
}

describe("Omi Dare Mode", () => {
  it("opens a dare challenge window after trump is called, when the mode is on", () => {
    const state = freshDareHandState();
    expect(state.phase).toBe("AWAIT_DARE_CHALLENGE");
    expect(state.dare).toEqual({ level: "none", challengerTeam: null });
  });

  it("the trump-calling team cannot declare a dare", () => {
    const state = freshDareHandState();
    expect(() => declareDare(state, state.trumpCallerSeat, "dare")).toThrow(IllegalActionError);
  });

  it("passing deals batch 2 with no bet", () => {
    const state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    const next = declareDare(state, opponent, "pass");
    expect(next.phase).toBe("TRICK_PLAY");
    expect(next.dare).toEqual({ level: "none", challengerTeam: null });
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(next.hands[seat]).toHaveLength(8);
    }
  });

  it("a dare opens a response window for the trump team only", () => {
    const state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    const next = declareDare(state, opponent, "dare");
    expect(next.phase).toBe("AWAIT_DARE_RESPONSE");
    expect(next.dare.level).toBe("dare");
    expect(next.dare.challengerTeam).toBe((opponent % 2) as 0 | 1);
    expect(() => respondToDare(next, opponent, "accept")).toThrow(IllegalActionError);
  });

  it("the trump team can accept, locking the dare at x2 and dealing batch 2", () => {
    let state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    state = declareDare(state, opponent, "dare");
    state = respondToDare(state, state.trumpCallerSeat, "accept");
    expect(state.phase).toBe("TRICK_PLAY");
    expect(state.dare.level).toBe("dare");
  });

  it("the trump team can play safe to cancel the bet entirely", () => {
    let state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    state = declareDare(state, opponent, "dare");
    state = respondToDare(state, state.trumpCallerSeat, "safe");
    expect(state.phase).toBe("TRICK_PLAY");
    expect(state.dare).toEqual({ level: "none", challengerTeam: null });
  });

  it("the trump team can redare to escalate to x4", () => {
    let state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    state = declareDare(state, opponent, "dare");
    state = respondToDare(state, state.trumpCallerSeat, "redare");
    expect(state.phase).toBe("TRICK_PLAY");
    expect(state.dare.level).toBe("redare");
  });

  it("all-in locks the max stake immediately and is capped at one per team per game", () => {
    let state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    const opponentTeam = (opponent % 2) as 0 | 1;
    state = declareDare(state, opponent, "allin");
    expect(state.phase).toBe("TRICK_PLAY");
    expect(state.dare.level).toBe("allin");
    expect(state.allInUsed[opponentTeam]).toBe(true);

    // Simulate reaching the same decision point again later in the game.
    state = { ...state, phase: "AWAIT_DARE_CHALLENGE", dare: { level: "none", challengerTeam: null } };
    expect(() => declareDare(state, opponent, "allin")).toThrow(IllegalActionError);
  });

  it("pays the losing team's stake to the winners when the trump team wins the dare", () => {
    let state = freshDareHandState({ targetTokens: 1000 });
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    state = declareDare(state, opponent, "dare"); // x2
    state = respondToDare(state, caller, "accept");
    const winners: Seat[] = [caller, caller, caller, caller, caller, opponent, opponent, opponent];
    state = playHandWithWinners(state, winners);

    const dare = state.lastHandResult!.dare!;
    expect(dare.cancelled).toBe(false);
    expect(dare.winnerTeam).toBe((caller % 2) as 0 | 1);
    expect(dare.multiplier).toBe(2);
    const payment = 20; // base stake 10 * x2
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const expected = (seat % 2) === (caller % 2) ? payment : -payment;
      expect(dare.coinsDelta[seat]).toBe(expected);
      expect(state.coins[seat]).toBe(500 + expected);
    }
  });

  it("applies the +50% Kapothi bonus on top of a redare stake", () => {
    let state = freshDareHandState({ targetTokens: 1000 });
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    state = declareDare(state, opponent, "dare");
    state = respondToDare(state, caller, "redare"); // x4
    state = playHandWithWinners(state, Array(8).fill(caller)); // Kapothi

    const dare = state.lastHandResult!.dare!;
    expect(dare.kapothiBonusApplied).toBe(true);
    expect(dare.coinsDelta[caller]).toBe(60); // 10 * 4 * 1.5
  });

  it("cancels and refunds the dare on a 4-4 draw", () => {
    let state = freshDareHandState();
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    state = declareDare(state, opponent, "dare");
    state = respondToDare(state, caller, "accept");
    const tieWinners: Seat[] = [caller, caller, caller, caller, opponent, opponent, opponent, opponent];
    state = playHandWithWinners(state, tieWinners);

    const dare = state.lastHandResult!.dare!;
    expect(dare.cancelled).toBe(true);
    expect(dare.winnerTeam).toBeNull();
    expect(dare.coinsDelta).toEqual([0, 0, 0, 0]);
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(state.coins[seat]).toBe(500);
    }
  });

  it("awards a streak bonus on a second consecutive dare win by the same team", () => {
    // The trump-calling seat alternates teams every hand (dealer rotates by
    // one seat), so to keep the SAME team winning twice in a row, that team
    // plays the trump-caller role in hand 1 and the challenger role in hand 2.
    let state = freshDareHandState({ targetTokens: 1000 });
    const caller1 = state.trumpCallerSeat;
    const opponent1 = nextSeat(caller1);
    const streakTeam = (caller1 % 2) as 0 | 1;

    state = declareDare(state, opponent1, "dare");
    state = respondToDare(state, caller1, "accept");
    state = playHandWithWinners(state, Array(8).fill(caller1)); // streakTeam (as trump team) wins
    expect(state.lastHandResult!.dare!.streakBonusApplied).toBe(false);
    expect(state.dareStreak[streakTeam]).toBe(1);

    state = nextHand(state);
    state = cutDeck(state, state.cutSeat, 16);
    const caller2 = state.trumpCallerSeat;
    const opponent2 = nextSeat(caller2);
    expect((opponent2 % 2) as 0 | 1).toBe(streakTeam); // confirms the role flip

    state = callTrump(state, caller2, "S");
    state = declareDare(state, opponent2, "dare");
    state = respondToDare(state, caller2, "accept");
    state = playHandWithWinners(state, Array(8).fill(opponent2)); // streakTeam (now the challenger) wins again

    expect(state.dareStreak[streakTeam]).toBe(2);
    expect(state.lastHandResult!.dare!.streakBonusApplied).toBe(true);
  });

  it("awards a comeback bonus when the dare-winning team was behind on tokens", () => {
    let state = freshDareHandState({ targetTokens: 1000 });
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    const callerTeam = (caller % 2) as 0 | 1;
    state = { ...state, tokens: callerTeam === 0 ? [0, 5] : [5, 0] };
    state = declareDare(state, opponent, "dare");
    state = respondToDare(state, caller, "accept");
    state = playHandWithWinners(state, Array(8).fill(caller));

    const dare = state.lastHandResult!.dare!;
    expect(dare.comebackBonusApplied).toBe(true);
    // base 20 (kapothi x1.5 -> 30) + comeback 15 = 45
    expect(dare.coinsDelta[caller]).toBe(45);
  });

  it("a correct flag mid-dare cancels and refunds it just like a 4-4 draw", () => {
    let state = freshDareHandState();
    const caller = state.trumpCallerSeat;
    const opponent = nextSeat(caller);
    state = declareDare(state, opponent, "dare");
    state = respondToDare(state, caller, "accept");

    state.hands[caller] = [{ suit: "H", rank: "9" }, ...state.hands[caller].slice(1)];
    state.hands[opponent] = [
      { suit: "H", rank: "A" },
      { suit: "C", rank: "7" },
      ...state.hands[opponent].slice(2),
    ];
    state = playCard(state, caller, { suit: "H", rank: "9" });
    state = playCard(state, opponent, { suit: "C", rank: "7" }); // violation

    const { state: next, correct } = raiseFlag(state, caller, opponent);
    expect(correct).toBe(true);
    expect(next.lastHandResult!.dare).not.toBeNull();
    expect(next.lastHandResult!.dare!.cancelled).toBe(true);
    expect(next.coins).toEqual(state.coins);
  });
});

describe("flag / challenge rule (wrong suit play)", () => {
  it("allows an off-suit play while holding the led suit by default, tagging it as a violation", () => {
    let state = freshHandState();
    state = callDefaultTrump(state); // trump = S
    const leader = state.currentTurnSeat!;
    const second = nextSeat(leader);
    state.hands[leader] = [{ suit: "H", rank: "9" }, ...state.hands[leader].slice(1)];
    state.hands[second] = [{ suit: "H", rank: "A" }, { suit: "C", rank: "7" }, ...state.hands[second].slice(2)];

    state = playCard(state, leader, { suit: "H", rank: "9" });
    expect(() => playCard(state, second, { suit: "C", rank: "7" })).not.toThrow();
    state = playCard(state, second, { suit: "C", rank: "7" });

    const play = state.currentTrick.find((p) => p.seat === second)!;
    expect(play.violatesFollowSuit).toBe(true);
  });

  it("a correct flag penalizes the offending team, awards 3 tokens, and ends the hand immediately", () => {
    let state = freshHandState({ targetTokens: 100 });
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!; // opposing team to `second`
    const second = nextSeat(leader);
    state.hands[leader] = [{ suit: "H", rank: "9" }, ...state.hands[leader].slice(1)];
    state.hands[second] = [{ suit: "H", rank: "A" }, { suit: "C", rank: "7" }, ...state.hands[second].slice(2)];

    state = playCard(state, leader, { suit: "H", rank: "9" });
    state = playCard(state, second, { suit: "C", rank: "7" }); // violation: held H, played C

    const accusingTeam = (leader % 2) as 0 | 1;
    const offendingTeam = (second % 2) as 0 | 1;
    const flagsBefore = state.flagsRemaining[accusingTeam];

    const { state: next, correct } = raiseFlag(state, leader, second);
    expect(correct).toBe(true);
    expect(next.flagsRemaining[accusingTeam]).toBe(flagsBefore - 1);
    expect(next.tokens[accusingTeam]).toBe(3);
    expect(next.tokens[offendingTeam]).toBe(0);
    expect(next.phase).toBe("HAND_SCORING");
    expect(next.lastHandResult!.flag).toEqual({
      raisedByTeam: accusingTeam,
      offendingSeat: second,
      offendingTeam,
    });
  });

  it("a wrong flag consumes a chance with no penalty and the game continues", () => {
    let state = freshHandState();
    state = callDefaultTrump(state); // trump = S
    const leader = state.currentTurnSeat!;
    const second = nextSeat(leader);
    state.hands[leader] = [{ suit: "H", rank: "9" }, ...state.hands[leader].slice(1)];
    // second is genuinely void in H, so playing off-suit is legitimate.
    state.hands[second] = [{ suit: "C", rank: "7" }, ...state.hands[second].filter((c) => c.suit !== "H").slice(1)];

    state = playCard(state, leader, { suit: "H", rank: "9" });
    state = playCard(state, second, { suit: "C", rank: "7" });

    const accusingTeam = (leader % 2) as 0 | 1;
    const flagsBefore = state.flagsRemaining[accusingTeam];
    const tokensBefore = [...state.tokens];

    const { state: next, correct } = raiseFlag(state, leader, second);
    expect(correct).toBe(false);
    expect(next.flagsRemaining[accusingTeam]).toBe(flagsBefore - 1);
    expect(next.tokens).toEqual(tokensBefore);
    expect(next.phase).toBe("TRICK_PLAY");
  });

  it("rejects flagging a teammate", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    const second = nextSeat(leader);
    state.hands[leader] = [{ suit: "H", rank: "9" }, ...state.hands[leader].slice(1)];
    state.hands[second] = [{ suit: "H", rank: "A" }, { suit: "C", rank: "7" }, ...state.hands[second].slice(2)];
    state = playCard(state, leader, { suit: "H", rank: "9" });
    state = playCard(state, second, { suit: "C", rank: "7" });

    const teammateOfSecond = ((second + 2) % 4) as Seat;
    expect(() => raiseFlag(state, teammateOfSecond, second)).toThrow(IllegalActionError);
  });

  it("rejects flagging a play that followed the led suit", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    const second = nextSeat(leader);
    state.hands[leader] = [{ suit: "H", rank: "9" }, ...state.hands[leader].slice(1)];
    state.hands[second] = [{ suit: "H", rank: "A" }, ...state.hands[second].slice(1)];
    state = playCard(state, leader, { suit: "H", rank: "9" });
    state = playCard(state, second, { suit: "H", rank: "A" });

    expect(() => raiseFlag(state, leader, second)).toThrow(IllegalActionError);
  });

  it("blocks further flags once a team has used all of its chances", () => {
    let state = freshHandState({ flagsPerTeam: 3 });
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    const second = nextSeat(leader);
    state.hands[leader] = [{ suit: "H", rank: "9" }, ...state.hands[leader].slice(1)];
    state.hands[second] = [{ suit: "C", rank: "7" }, ...state.hands[second].filter((c) => c.suit !== "H").slice(1)];
    state = playCard(state, leader, { suit: "H", rank: "9" });
    state = playCard(state, second, { suit: "C", rank: "7" });

    const accusingTeam = (leader % 2) as 0 | 1;
    for (let i = 0; i < 3; i++) {
      const outcome = raiseFlag(state, leader, second);
      expect(outcome.correct).toBe(false);
      state = outcome.state;
    }
    expect(state.flagsRemaining[accusingTeam]).toBe(0);
    expect(() => raiseFlag(state, leader, second)).toThrow(IllegalActionError);
  });

  it("never exposes violatesFollowSuit through the redacted view", () => {
    let state = freshHandState();
    state = callDefaultTrump(state);
    const leader = state.currentTurnSeat!;
    const second = nextSeat(leader);
    state.hands[leader] = [{ suit: "H", rank: "9" }, ...state.hands[leader].slice(1)];
    state.hands[second] = [{ suit: "H", rank: "A" }, { suit: "C", rank: "7" }, ...state.hands[second].slice(2)];
    state = playCard(state, leader, { suit: "H", rank: "9" });
    state = playCard(state, second, { suit: "C", rank: "7" });

    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const view = redactStateForSeat(state, seat);
      expect(JSON.stringify(view)).not.toContain("violatesFollowSuit");
    }
  });
});

describe("hardening against malformed/malicious input", () => {
  // A real attacker doesn't go through the typed client — they connect a raw
  // socket and send whatever bytes they want. These tests bypass the type
  // system (as a hostile client would) to prove the engine still fails
  // closed instead of silently corrupting state.

  it("rejects a trump suit that isn't one of the four real suits", () => {
    const state = freshHandState();
    expect(() => callTrump(state, state.trumpCallerSeat, "nonsense" as unknown as Suit)).toThrow(IllegalActionError);
  });

  it("rejects an unrecognized dare challenge action instead of defaulting to a dare", () => {
    const state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    expect(() => declareDare(state, opponent, "drop tables;" as unknown as "pass")).toThrow(IllegalActionError);
  });

  it("rejects an unrecognized dare response action instead of defaulting to accept", () => {
    let state = freshDareHandState();
    const opponent = nextSeat(state.trumpCallerSeat);
    state = declareDare(state, opponent, "dare");
    expect(() => respondToDare(state, state.trumpCallerSeat, "yolo" as unknown as "accept")).toThrow(IllegalActionError);
  });

  it("treats a non-finite cut position as the safe default instead of corrupting the deck", () => {
    const cut = beginHand(createInitialState());
    const afterNaN = cutDeck(cut, cut.cutSeat, NaN);
    expect(afterNaN.phase).toBe("AWAIT_TRUMP_CALL");
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(afterNaN.hands[seat]).toHaveLength(4);
    }

    const cut2 = beginHand(createInitialState());
    const afterInfinity = cutDeck(cut2, cut2.cutSeat, Infinity);
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(afterInfinity.hands[seat]).toHaveLength(4);
    }
  });
});

/** Like playTrickWithWinner but stops at TRICK_RESOLVED instead of continuing. */
function playTrickWithWinnerNoAdvance(state: GameState): GameState {
  const winnerSeat = state.currentTurnSeat!;
  const seatOrder: Seat[] = [];
  let s = state.currentTurnSeat!;
  for (let i = 0; i < 4; i++) {
    seatOrder.push(s);
    s = nextSeat(s);
  }
  const ranksDesc: Card["rank"][] = ["A", "K", "Q", "J"];
  let rankIdx = 0;
  for (const seat of seatOrder) {
    const rank = seat === winnerSeat ? ranksDesc[0] : ranksDesc[++rankIdx];
    const card: Card = { suit: "D", rank };
    state.hands[seat] = [
      card,
      ...state.hands[seat].filter((c) => !(c.suit === card.suit && c.rank === card.rank)),
    ];
  }
  for (const seat of seatOrder) {
    const card = state.hands[seat][0];
    state = playCard(state, seat, card);
  }
  return state;
}
