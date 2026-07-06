import { useEffect, useRef, useState } from "react";
import type { Card, RoomSnapshot, Seat, Team } from "@omi/engine";
import { buildJoinLink } from "../joinLink.js";
import { sortHand } from "../sortHand.js";
import { CardBack, CardFace, SUIT_SYMBOLS } from "./Card.js";
import { ContinuePrompt } from "./ContinuePrompt.js";
import { RulesModal } from "./RulesModal.js";
import { SoundToggle } from "./SoundToggle.js";

type Direction = "top" | "right" | "bottom" | "left";

/** Counts down from `seconds`, resetting whenever `resetKey` changes. Purely a client-side estimate of the server's auto-play timeout. */
function useLocalCountdown(active: boolean, resetKey: string, seconds: number): number {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining(Math.max(0, seconds - Math.floor((Date.now() - start) / 1000)));
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, active, seconds]);
  return remaining;
}

function seatLabel(view: RoomSnapshot, seat: Seat): string {
  const player = view.players.find((p) => p.seat === seat);
  return player ? player.name : `Seat ${seat}`;
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function teamOf(seat: Seat): Team {
  return (seat % 2) as Team;
}

/** Seats across the table from each other share a team: top+bottom are one pair, left+right are the other. Named for two Ceylon gems instead of generic sky/rose. */
const TEAM_ACCENT: Record<Team, { ring: string; dot: string; text: string }> = {
  0: { ring: "ring-sapphire-400/70", dot: "bg-sapphire-400", text: "text-sapphire-300" },
  1: { ring: "ring-ruby-400/70", dot: "bg-ruby-400", text: "text-ruby-300" },
};

const SLOT_POSITION: Record<Direction, string> = {
  top: "top-4 left-1/2 -translate-x-1/2",
  right: "right-6 top-1/2 -translate-y-1/2",
  bottom: "bottom-4 left-1/2 -translate-x-1/2",
  left: "left-6 top-1/2 -translate-y-1/2",
};

/** Approximate on-table anchor for each direction, used to compute how far cards travel when a trick is collected. Scaled to the 40rem x 30rem oval. */
const ANCHOR: Record<Direction, { x: number; y: number }> = {
  top: { x: 0, y: -190 },
  bottom: { x: 0, y: 190 },
  left: { x: -260, y: 0 },
  right: { x: 260, y: 0 },
};

/** Small per-source jitter so the four collected cards land as a tidy fanned stack rather than exactly overlapping. */
const STACK_JITTER: Record<Direction, { x: number; y: number; rot: number }> = {
  top: { x: -8, y: -5, rot: -8 },
  right: { x: 6, y: -8, rot: 6 },
  bottom: { x: 8, y: 5, rot: 10 },
  left: { x: -6, y: 8, rot: -6 },
};

function collectTransform(from: Direction, to: Direction): string {
  const jitter = STACK_JITTER[from];
  if (from === to) {
    return `translate(${jitter.x}px, ${jitter.y}px) rotate(${jitter.rot}deg) scale(0.55)`;
  }
  const dx = ANCHOR[to].x - ANCHOR[from].x + jitter.x;
  const dy = ANCHOR[to].y - ANCHOR[from].y + jitter.y;
  return `translate(${dx}px, ${dy}px) rotate(${jitter.rot}deg) scale(0.55)`;
}

function TrickSlot({
  position,
  card,
  isActive,
  collectToward,
  canFlag,
  onFlag,
}: {
  position: Direction;
  card: Card | null;
  isActive: boolean;
  collectToward: Direction | null;
  canFlag: boolean;
  onFlag?: () => void;
}) {
  return (
    <div
      className={["absolute transition-all ease-out", SLOT_POSITION[position]].join(" ")}
      style={
        collectToward
          ? { transform: collectTransform(position, collectToward), opacity: 0.95, transitionDuration: "650ms" }
          : { transitionDuration: "300ms" }
      }
    >
      {card ? (
        <div className="relative">
          <CardFace card={card} size="md" />
          {canFlag && (
            <button
              onClick={onFlag}
              title="Raise a flag — claim this play didn't follow suit"
              aria-label="Raise a flag on this play"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ruby-600 hover:bg-ruby-500 active:scale-90 text-white text-xs flex items-center justify-center shadow-md transition-all duration-150"
            >
              🚩
            </button>
          )}
        </div>
      ) : (
        <div
          className={[
            "w-20 h-28 rounded-2xl border-2 border-dashed transition-colors duration-300",
            isActive ? "border-gold-400/50" : "border-gold-400/10",
          ].join(" ")}
        />
      )}
    </div>
  );
}

function TrickPileBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-300/80 tabular-nums">
      <span className="w-1 h-1 rounded-full bg-gold-300/80" />
      {count} won
    </span>
  );
}

function CoinChip({ coins, onDark = true }: { coins: number; onDark?: boolean }) {
  return (
    <span className={["inline-flex items-center gap-1 text-xs font-semibold tabular-nums", onDark ? "text-gold-300" : "text-felt-900"].join(" ")}>
      <span className="w-2 h-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-600 shadow-sm" />
      {coins.toLocaleString()}
    </span>
  );
}

const DARE_METER: Record<string, { label: string; cls: string }> = {
  none: { label: "🎲 Safe", cls: "bg-white/[0.06] ring-1 ring-white/10 text-ink-dim/85" },
  dare: { label: "🎲 Dare ×2", cls: "bg-gradient-to-r from-gold-300 to-gold-500 text-felt-950" },
  redare: { label: "🔥 Redare ×4", cls: "bg-gradient-to-r from-[#c97a2e] to-[#a85a1f] text-white" },
  allin: { label: "🔥 ALL-IN ×6", cls: "bg-gradient-to-r from-ruby-600 to-ruby-700 text-white animate-pulse" },
};

function OpponentBox({
  view,
  seat,
  cardCount,
}: {
  view: RoomSnapshot;
  seat: Seat;
  cardCount: number;
}) {
  const isTurn = view.currentTurnSeat === seat;
  const isCaller = view.trumpCallerSeat === seat && view.trumpSuit === null;
  const isCutter = view.phase === "AWAIT_CUT" && view.cutSeat === seat;
  const isDealer = view.dealerSeat === seat;
  const name = seatLabel(view, seat);
  const teamTricksWon = view.trickCounts[teamOf(seat)];
  const accent = TEAM_ACCENT[teamOf(seat)];
  const playerInfo = view.players.find((p) => p.seat === seat);
  const isReconnecting = playerInfo ? !playerInfo.connected : false;
  const statusText = isReconnecting ? "reconnecting…" : isCaller ? "calling trump…" : isCutter ? "cutting the deck…" : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={[
          "flex items-center gap-2 pl-1 pr-4 py-1 rounded-full text-sm font-semibold transition-all duration-300 max-w-[13rem]",
          isTurn
            ? "bg-gradient-to-r from-gold-300 to-gold-500 text-felt-950 shadow-md scale-105"
            : "bg-white/[0.06] ring-1 ring-white/10 text-ink backdrop-blur",
        ].join(" ")}
      >
        <span
          className={[
            "relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-2 shrink-0",
            accent.ring,
            isTurn ? "bg-felt-950 text-gold-300" : "bg-felt-700 text-ink",
          ].join(" ")}
        >
          {initials(name)}
          {isReconnecting && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gold-400 border border-felt-950 animate-pulse" />
          )}
          {isDealer && !isReconnecting && (
            <span
              title="Dealer"
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gold-400 border border-felt-950 text-felt-950 text-[8px] font-bold flex items-center justify-center"
            >
              D
            </span>
          )}
        </span>
        <span className="truncate">{name}</span>
        {view.rules.dareMode && (
          <>
            <span className={["w-px h-3.5", isTurn ? "bg-felt-950/30" : "bg-white/15"].join(" ")} />
            <CoinChip coins={view.coins[seat]} onDark={!isTurn} />
          </>
        )}
      </div>
      <div className="min-h-[1rem] flex items-center">
        {statusText && (
          <span className={["text-[10px] font-medium", isReconnecting ? "text-gold-300 animate-pulse" : "text-ink-dim/70"].join(" ")}>
            {statusText}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 min-h-[5rem]">
        <div className="flex -space-x-10">
          {Array.from({ length: cardCount }).map((_, i) => (
            <CardBack key={i} size="sm" />
          ))}
        </div>
        <TrickPileBadge count={teamTricksWon} />
      </div>
    </div>
  );
}

function MenuRow({
  onClick,
  children,
  tone = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-medium text-left rounded-lg transition-colors duration-150",
        tone === "danger" ? "text-ruby-300 hover:bg-ruby-500/10" : "text-ink hover:bg-white/[0.06]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Consolidates the room/help/settings/danger-zone actions that used to sit
    as separate buttons directly in the header — keeping only the live
    gameplay pills always visible, with everything else one tap away. */
function HeaderMenu({
  view,
  isHost,
  codeCopied,
  linkCopied,
  onCopyCode,
  onCopyLink,
  onOpenHowTo,
  onOpenRules,
  confirmEndSession,
  setConfirmEndSession,
  onEndSession,
  confirmLeave,
  setConfirmLeave,
  onLeave,
}: {
  view: RoomSnapshot;
  isHost: boolean;
  codeCopied: boolean;
  linkCopied: boolean;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onOpenHowTo: () => void;
  onOpenRules: () => void;
  confirmEndSession: boolean;
  setConfirmEndSession: (v: boolean) => void;
  onEndSession: () => void;
  confirmLeave: boolean;
  setConfirmLeave: (v: boolean) => void;
  onLeave: () => void;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    setConfirmEndSession(false);
    setConfirmLeave(false);
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Menu"
        aria-label="Open menu"
        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10 text-ink-dim hover:bg-white/[0.1] hover:text-ink active:scale-95 transition-all duration-150 text-lg leading-none"
      >
        ⋯
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 max-h-[calc(100vh-5rem)] overflow-y-auto ring-foil bg-felt-800/95 backdrop-blur-md rounded-2xl shadow-2xl p-1.5 text-sm">
            <div className="px-3.5 py-2 text-[10px] font-bold text-ink-dim/60 uppercase tracking-widest">Invite</div>
            <MenuRow onClick={onCopyCode}>
              <span>{view.hasPassword ? "🔒" : "🔗"} Room code</span>
              <span className="text-ink-dim/70 font-semibold">{codeCopied ? "✓ Copied" : view.joinCode}</span>
            </MenuRow>
            <MenuRow onClick={onCopyLink}>
              <span>Invite link</span>
              <span className="text-ink-dim/70 font-semibold">{linkCopied ? "✓ Copied" : "Copy"}</span>
            </MenuRow>

            <div className="h-px bg-white/10 my-1.5" />
            <MenuRow onClick={() => { onOpenHowTo(); close(); }}>How to Play</MenuRow>
            <MenuRow onClick={() => { onOpenRules(); close(); }}>Rules</MenuRow>

            <div className="h-px bg-white/10 my-1.5" />
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-sm font-medium text-ink">Sound</span>
              <SoundToggle />
            </div>

            <div className="h-px bg-white/10 my-1.5" />
            {isHost && (
              confirmEndSession ? (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                  <span className="text-ink-dim/85 text-xs">End for everyone?</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button onClick={onEndSession} className="bg-ruby-600 hover:bg-ruby-500 active:scale-95 text-white text-xs font-bold px-2.5 py-1 rounded-full transition-all duration-150">
                      Yes
                    </button>
                    <button onClick={() => setConfirmEndSession(false)} className="text-ink-dim/85 hover:text-ink text-xs px-1 transition-colors duration-150">
                      No
                    </button>
                  </span>
                </div>
              ) : (
                <MenuRow tone="danger" onClick={() => setConfirmEndSession(true)}>End Session (everyone)</MenuRow>
              )
            )}
            {confirmLeave ? (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                <span className="text-ink-dim/85 text-xs">Leave game?</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <button onClick={onLeave} className="bg-ruby-600 hover:bg-ruby-500 active:scale-95 text-white text-xs font-bold px-2.5 py-1 rounded-full transition-all duration-150">
                    Yes
                  </button>
                  <button onClick={() => setConfirmLeave(false)} className="text-ink-dim/85 hover:text-ink text-xs px-1 transition-colors duration-150">
                    No
                  </button>
                </span>
              </div>
            ) : (
              <MenuRow tone="danger" onClick={() => setConfirmLeave(true)}>Leave game</MenuRow>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Table({
  view,
  onPlayCard,
  onDeclareSlam,
  onContinue,
  onRaiseFlag,
  onLeave,
  onEndSession,
  onVoteForfeit,
}: {
  view: RoomSnapshot;
  onPlayCard: (card: Card) => void;
  onDeclareSlam: () => void;
  onContinue: () => void;
  onRaiseFlag: (targetSeat: Seat) => void;
  onLeave: () => void;
  onEndSession: () => void;
  onVoteForfeit: () => void;
}) {
  const mySeat = view.mySeat;
  const partner = ((mySeat + 2) % 4) as Seat;
  const left = ((mySeat + 1) % 4) as Seat;
  const right = ((mySeat + 3) % 4) as Seat;
  const myTeam = teamOf(mySeat);
  const myAccent = TEAM_ACCENT[myTeam];
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmEndSession, setConfirmEndSession] = useState(false);
  const isDealer = view.dealerSeat === mySeat;
  const isHost = mySeat === 0;
  const iVotedForfeit = view.forfeitVotes[mySeat];
  const partnerVotedForfeit = view.forfeitVotes[partner];
  const showForfeit = view.phase === "TRICK_PLAY" && (view.canForfeit || iVotedForfeit);

  function copyJoinCode() {
    const flash = () => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1800);
    };
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(view.joinCode).then(flash).catch(() => {
      // Clipboard permission denied or document not focused — the code is
      // already shown in the chip itself, so this is a soft failure.
    });
  }

  function copyJoinLink() {
    const flash = () => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    };
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(buildJoinLink(view.joinCode)).then(flash).catch(() => {
      // Soft failure — the code itself is still shown and copyable.
    });
  }

  const directionOf = (seat: Seat): Direction => {
    if (seat === mySeat) return "bottom";
    if (seat === partner) return "top";
    if (seat === left) return "left";
    return "right";
  };

  const opponentCount = (seat: Seat) => view.opponents.find((o) => o.seat === seat)?.cardCount ?? 0;
  const isMyTurn = view.currentTurnSeat === mySeat;
  const canDeclareSlam = view.rules.slamHouseRule && view.slamDeclaredByTeam === null;
  const activeSeat =
    view.phase === "AWAIT_CUT" ? view.cutSeat : view.phase === "AWAIT_TRUMP_CALL" ? view.trumpCallerSeat : view.currentTurnSeat;
  const waitingOnName = activeSeat !== null ? seatLabel(view, activeSeat) : null;
  const isCallingTrump = view.phase === "AWAIT_TRUMP_CALL" && view.trumpCallerSeat === mySeat;
  const isCutting = view.phase === "AWAIT_CUT" && view.cutSeat === mySeat;
  const cardAtSeat = (seat: Seat) => view.currentTrick.find((p) => p.seat === seat)?.card ?? null;

  // Mirrors the server's 20s auto-play/auto-call timeout — a local estimate, not perfectly synced.
  const turnTimeoutActive =
    activeSeat !== null && (view.phase === "AWAIT_CUT" || view.phase === "AWAIT_TRUMP_CALL" || view.phase === "TRICK_PLAY");
  const turnCountdown = useLocalCountdown(turnTimeoutActive, `${view.phase}-${activeSeat}-${view.currentTrick.length}`, 20);

  const leadSuit = view.currentTrick[0]?.card.suit ?? null;
  // Flags are unlimited — a wrong flag simply has no effect, so there is no
  // per-team cap gating whether a seat can be challenged.
  const canFlagSeat = (seat: Seat, card: Card | null) =>
    card !== null &&
    (view.phase === "TRICK_PLAY" || view.phase === "TRICK_RESOLVED") &&
    teamOf(seat) !== myTeam &&
    leadSuit !== null &&
    card.suit !== leadSuit;

  const [collecting, setCollecting] = useState(false);
  const [modalTab, setModalTab] = useState<"howto" | "rules" | null>(null);
  const lastTrickKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (view.phase !== "TRICK_RESOLVED" || !view.lastTrick) {
      setCollecting(false);
      lastTrickKeyRef.current = null;
      return;
    }
    if (lastTrickKeyRef.current === view.lastTrick.index) return;
    lastTrickKeyRef.current = view.lastTrick.index;
    setCollecting(false);
    const id = setTimeout(() => setCollecting(true), 900);
    return () => clearTimeout(id);
  }, [view.phase, view.lastTrick]);

  const collectDirection: Direction | null =
    view.phase === "TRICK_RESOLVED" && view.lastTrick && collecting ? directionOf(view.lastTrick.winnerSeat) : null;

  const isDarePhase = view.phase === "AWAIT_DARE_CHALLENGE" || view.phase === "AWAIT_DARE_RESPONSE";
  const dareGlowColor =
    view.dare.level === "allin"
      ? "rgba(168,48,79,0.65)"
      : view.dare.level === "redare"
        ? "rgba(200,122,46,0.55)"
        : view.dare.level === "dare"
          ? "rgba(227,189,93,0.5)"
          : isDarePhase
            ? "rgba(227,189,93,0.3)"
            : null;
  const trumpTeam = teamOf(view.trumpCallerSeat);
  const dareDecidingTeam: Team | null =
    view.phase === "AWAIT_DARE_CHALLENGE" ? (trumpTeam === 0 ? 1 : 0) : view.phase === "AWAIT_DARE_RESPONSE" ? trumpTeam : null;
  const isMyTeamDeciding = dareDecidingTeam !== null && myTeam === dareDecidingTeam;
  const dareWaitingLabel =
    view.phase === "AWAIT_DARE_CHALLENGE"
      ? "Opponents are deciding whether to Dare…"
      : view.phase === "AWAIT_DARE_RESPONSE"
        ? "The trump team is responding to the Dare…"
        : null;

  return (
    <div
      className="min-h-screen flex flex-col text-ink bg-kolam"
      style={{
        backgroundColor: "#06140f",
        backgroundImage:
          "radial-gradient(circle at 50% 35%, #123d2c 0%, #0a2c20 55%, #062017 100%), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cg fill='none' stroke='%23e3bd5d' stroke-width='1'%3E%3Ccircle cx='36' cy='4' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Ccircle cx='36' cy='68' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Ccircle cx='4' cy='36' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Ccircle cx='68' cy='36' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Cpath d='M36 4 C 50 12, 60 22, 68 36 C 60 50, 50 60, 36 68 C 22 60, 12 50, 4 36 C 12 22, 22 12, 36 4 Z'/%3E%3Ccircle cx='36' cy='36' r='3' /%3E%3C/g%3E%3C/svg%3E\")",
        backgroundBlendMode: "normal, soft-light",
        backgroundSize: "auto, 72px 72px",
      }}
    >
      <header className="flex items-center gap-3 px-5 py-3 bg-felt-900/70 backdrop-blur-md border-b border-gold-400/10 shadow-lg">
        <span className="font-display text-sm font-medium text-ink-dim shrink-0">
          Round {view.handNumber}{view.rules.maxRounds > 0 ? ` / ${view.rules.maxRounds}` : ""}{" "}
          <span className="text-ink-dim/40 font-sans">·</span> Tricks{" "}
          <span className="text-ink font-bold">{view.trickCounts[0]}</span>
          <span className="text-ink-dim/40"> – </span>
          <span className="text-ink font-bold">{view.trickCounts[1]}</span>
        </span>

        <div className="flex-1 flex items-center gap-2 text-sm flex-wrap justify-end min-w-0">
          <span className="flex items-center gap-2 bg-white/[0.06] ring-1 ring-white/10 px-3 py-1.5 rounded-full font-semibold">
            <span className={TEAM_ACCENT[0].text}>A</span> {view.tokens[0]}
            <span className="text-ink-dim/30">/</span>
            <span className={TEAM_ACCENT[1].text}>B</span> {view.tokens[1]}
          </span>
          {view.pendingBonus > 0 && (
            <span className="bg-gold-400/15 text-gold-300 px-3 py-1.5 rounded-full font-semibold">
              +{view.pendingBonus} carry-over
            </span>
          )}
          <span className="flex items-center gap-2 bg-white/[0.06] ring-1 ring-white/10 px-3 py-1.5 rounded-full font-semibold" title="Flags are unlimited — a wrong flag just has no effect">
            🚩 <span className="text-gold-300 text-lg leading-none">∞</span>
          </span>
          {view.trumpSuit && (
            <span className="shine-surface flex items-center gap-1 bg-gradient-to-r from-gold-300 to-gold-500 text-felt-950 px-3 py-1.5 rounded-full font-bold shadow-md">
              Trump {SUIT_SYMBOLS[view.trumpSuit]}
            </span>
          )}
          {view.rules.dareMode && (
            <span className={["px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-wide", DARE_METER[view.dare.level].cls].join(" ")}>
              {DARE_METER[view.dare.level].label}
            </span>
          )}
          {canDeclareSlam && (
            <button
              onClick={onDeclareSlam}
              className="bg-gradient-to-r from-ruby-500 to-ruby-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg shadow-ruby-700/40 hover:scale-105 active:scale-95 transition-transform duration-150 ease-out"
            >
              Declare Slam ⚡
            </button>
          )}
        </div>

        <HeaderMenu
          view={view}
          isHost={isHost}
          codeCopied={codeCopied}
          linkCopied={linkCopied}
          onCopyCode={copyJoinCode}
          onCopyLink={copyJoinLink}
          onOpenHowTo={() => setModalTab("howto")}
          onOpenRules={() => setModalTab("rules")}
          confirmEndSession={confirmEndSession}
          setConfirmEndSession={setConfirmEndSession}
          onEndSession={onEndSession}
          confirmLeave={confirmLeave}
          setConfirmLeave={setConfirmLeave}
          onLeave={onLeave}
        />
      </header>

      {modalTab && <RulesModal initialTab={modalTab} onClose={() => setModalTab(null)} />}

      <div className="flex-1 grid grid-rows-[auto_1fr_auto] place-items-center gap-3 py-3 min-h-0">
        <OpponentBox view={view} seat={partner} cardCount={opponentCount(partner)} />

        <div className="w-full grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4">
          <div className="justify-self-end">
            <OpponentBox view={view} seat={left} cardCount={opponentCount(left)} />
          </div>

          <div
            className="relative shrink-0"
            style={{
              // Leaves room for the fixed-width opponent boxes on either side so the
              // row never overflows the viewport and forces a horizontal scrollbar.
              width: "min(40rem, calc(100vw - 21rem))",
              height: "min(30rem, calc((100vw - 21rem) * 0.75))",
            }}
          >
            {/* brass rim — glows when a dare is live, color scaling with the stakes */}
            <div
              className={["absolute inset-0 rounded-[50%] bg-gradient-to-br from-gold-600 via-[#7c5a1d] to-felt-950 shadow-2xl transition-shadow duration-700", dareGlowColor ? "animate-pulse" : ""].join(" ")}
              style={dareGlowColor ? { boxShadow: `0 0 70px 10px ${dareGlowColor}` } : undefined}
            />
            {/* felt */}
            <div
              className="absolute inset-[10px] rounded-[50%] border border-black/20 shadow-inner overflow-hidden"
              style={{
                background: "radial-gradient(circle at 38% 32%, #1d6b4a 0%, #123d2c 45%, #062017 100%)",
              }}
            >
              <span className="absolute inset-0 bg-kolam opacity-[0.18]" style={{ backgroundSize: "56px 56px" }} />
              {/* team pairing axes: top-bottom share a team, left-right share the other */}
              <div className="absolute left-1/2 top-[8%] bottom-[8%] w-px bg-gradient-to-b from-sapphire-400/0 via-sapphire-400/25 to-sapphire-400/0" />
              <div className="absolute top-1/2 left-[8%] right-[8%] h-px bg-gradient-to-r from-ruby-400/0 via-ruby-400/25 to-ruby-400/0" />

              {view.trumpSuit && (
                <span className="absolute inset-0 flex items-center justify-center text-[8rem] leading-none text-gold-300/[0.08] select-none">
                  {SUIT_SYMBOLS[view.trumpSuit]}
                </span>
              )}

              {view.phase === "AWAIT_CUT" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="relative w-16 h-24">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="absolute left-0 w-full" style={{ top: `${i * 2}px` }}>
                        <CardBack size="sm" />
                      </div>
                    ))}
                  </div>
                  <span className="text-ink-dim/75 text-xs font-medium text-center px-10">
                    {isCutting ? "Cut the deck above" : `${waitingOnName ?? "A player"} is cutting the deck…`}
                  </span>
                </div>
              ) : isDarePhase ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="text-4xl">{view.phase === "AWAIT_DARE_RESPONSE" ? "🔥" : "🎲"}</span>
                  <span className="text-gold-300 text-sm font-bold uppercase tracking-wide">
                    {isMyTeamDeciding ? "Your move…" : dareWaitingLabel}
                  </span>
                </div>
              ) : (
                <>
                  {view.currentTrick.length === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-ink-dim/70 text-xs font-medium text-center px-10">
                      {waitingOnName ? `Waiting for ${waitingOnName} to lead…` : "Waiting for the lead…"}
                    </span>
                  )}

                  <TrickSlot
                    position="top"
                    card={cardAtSeat(partner)}
                    isActive={activeSeat === partner}
                    collectToward={collectDirection}
                    canFlag={canFlagSeat(partner, cardAtSeat(partner))}
                    onFlag={() => onRaiseFlag(partner)}
                  />
                  <TrickSlot
                    position="left"
                    card={cardAtSeat(left)}
                    isActive={activeSeat === left}
                    collectToward={collectDirection}
                    canFlag={canFlagSeat(left, cardAtSeat(left))}
                    onFlag={() => onRaiseFlag(left)}
                  />
                  <TrickSlot
                    position="right"
                    card={cardAtSeat(right)}
                    isActive={activeSeat === right}
                    collectToward={collectDirection}
                    canFlag={canFlagSeat(right, cardAtSeat(right))}
                    onFlag={() => onRaiseFlag(right)}
                  />
                  <TrickSlot
                    position="bottom"
                    card={cardAtSeat(mySeat)}
                    isActive={activeSeat === mySeat}
                    collectToward={collectDirection}
                    canFlag={false}
                  />
                </>
              )}
            </div>
          </div>

          <div className="justify-self-start">
            <OpponentBox view={view} seat={right} cardCount={opponentCount(right)} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full pb-4">
          <div className="min-h-[1.5rem] flex items-center">
            {view.phase === "TRICK_RESOLVED" && view.lastTrick ? (
              <ContinuePrompt
                seconds={5}
                label={`${seatLabel(view, view.lastTrick.winnerSeat)} won the trick`}
                onContinue={onContinue}
                compact
              />
            ) : isMyTurn ? (
              <div className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                Your turn
                {turnTimeoutActive && turnCountdown <= 10 && (
                  <span className={["text-xs font-bold tabular-nums", turnCountdown <= 5 ? "text-ruby-400" : "text-gold-300"].join(" ")}>
                    · {turnCountdown}s
                  </span>
                )}
              </div>
            ) : isCallingTrump ? (
              <div className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                Your call — choose trumps above
                {turnTimeoutActive && turnCountdown <= 10 && (
                  <span className={["text-xs font-bold tabular-nums", turnCountdown <= 5 ? "text-ruby-400" : "text-gold-300"].join(" ")}>
                    · {turnCountdown}s
                  </span>
                )}
              </div>
            ) : isDarePhase ? (
              <div className={["flex items-center gap-1.5 text-sm font-medium", isMyTeamDeciding ? "text-gold-300" : "text-ink-dim/75"].join(" ")}>
                {isMyTeamDeciding && <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />}
                {isMyTeamDeciding ? "Your team is deciding above" : dareWaitingLabel}
              </div>
            ) : (
              <div className="text-ink-dim/75 text-sm font-medium flex items-center gap-1.5">
                Waiting for {waitingOnName ?? "the table"}…
                {turnTimeoutActive && turnCountdown <= 10 && (
                  <span className={["text-xs font-bold tabular-nums", turnCountdown <= 5 ? "text-ruby-400" : "text-gold-300/80"].join(" ")}>
                    {turnCountdown}s
                  </span>
                )}
              </div>
            )}
          </div>
          {showForfeit && (
            <div className="flex items-center gap-2.5 bg-ruby-700/25 ring-1 ring-ruby-500/40 rounded-full pl-4 pr-2 py-1.5">
              {iVotedForfeit ? (
                <span className="text-ruby-200 text-xs font-semibold">
                  {partnerVotedForfeit ? "Forfeiting…" : "Waiting for your partner to forfeit…"}
                </span>
              ) : (
                <>
                  <span className="text-ruby-200 text-xs font-semibold">
                    {partnerVotedForfeit ? "Partner wants to forfeit — no trumps." : "Your team holds no trump."}
                  </span>
                  <button
                    onClick={onVoteForfeit}
                    className="bg-ruby-600 hover:bg-ruby-500 active:scale-95 text-white text-xs font-bold px-3 py-1 rounded-full transition-all duration-150"
                  >
                    {partnerVotedForfeit ? "Confirm forfeit" : "Vote to forfeit"}
                  </button>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className={["w-1.5 h-1.5 rounded-full", myAccent.dot].join(" ")} />
            <span className="text-ink-dim/70 text-xs">You{isDealer ? " · Dealer" : ""}</span>
            <TrickPileBadge count={view.trickCounts[myTeam]} />
            {view.rules.dareMode && (
              <>
                <span className="w-px h-3.5 bg-white/15" />
                <CoinChip coins={view.coins[mySeat]} />
              </>
            )}
          </div>
          <div className={["min-h-[8rem] flex items-center rounded-2xl transition-all duration-500", isMyTurn ? "ring-2 ring-gold-400/40 shadow-[0_0_32px_-4px_rgba(227,189,93,0.25)]" : ""].join(" ")}>
            <div className="flex gap-3 flex-wrap justify-center px-2">
              {sortHand(view.myHand).map((card) => {
                const followsSuit = (view.legalCards ?? []).some((c) => c.suit === card.suit && c.rank === card.rank);
                // In flag mode (default), any card may be played and misplays are caught by challenge,
                // not blocked outright. strictFollowSuit reverts to the old hard-block behavior.
                const clickable = isMyTurn && (!view.rules.strictFollowSuit || followsSuit);
                return (
                  <CardFace
                    key={`${card.rank}${card.suit}`}
                    card={card}
                    size="lg"
                    selectable={clickable}
                    highlight={clickable && followsSuit}
                    onClick={clickable ? () => onPlayCard(card) : undefined}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
