import { useEffect, useState, type CSSProperties } from "react";
import { readJoinCodeFromUrl } from "../joinLink.js";
import { CornerAccent } from "./CornerAccent.js";
import { RulesModal } from "./RulesModal.js";

const STAKE_OPTIONS = [10, 25, 50, 100];
const TOKEN_OPTIONS = [5, 10, 15, 21];
/** value 0 = no round cap (play until a team hits the token target). */
const ROUND_OPTIONS: { label: string; value: number }[] = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "15", value: 15 },
  { label: "∞", value: 0 },
];

export interface CreateSettings {
  name: string;
  dareMode: boolean;
  dareStake: number;
  password: string;
  targetTokens: number;
  maxRounds: number;
}

/** Medallion emblem — a hand-drawn spade inside a coin ring, standing in for
    the old 🂡 glyph so the brand mark renders identically everywhere instead
    of depending on the OS emoji font. */
function Emblem({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30.5" stroke="url(#omi-ring)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="26" stroke="#e3bd5d" strokeOpacity="0.35" strokeWidth="1" />
      <path
        d="M32 14c6 8 15 14.5 15 23a10 10 0 0 1-14 9.2V50h-2v-3.8A10 10 0 0 1 17 37c0-8.5 9-15 15-23Z"
        fill="url(#omi-spade)"
      />
      <defs>
        <linearGradient id="omi-ring" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f3d78a" />
          <stop offset="1" stopColor="#96721f" />
        </linearGradient>
        <linearGradient id="omi-spade" x1="17" y1="14" x2="47" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f3d78a" />
          <stop offset="1" stopColor="#c99a34" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function EyeToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim/50 hover:text-gold-300 transition-colors duration-150"
    >
      {shown ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.17 5.24A9.96 9.96 0 0 1 12 5c6.5 0 10 7 10 7a13.6 13.6 0 0 1-3.06 3.94M6.6 6.6C4.1 8.2 2 12 2 12s1.6 3.2 4.6 5.16" />
        </svg>
      )}
    </button>
  );
}

/** Purely visual — the click/keyboard handling lives on the wrapping row
    (see usage below) so there's exactly one place that toggles state. A
    <button> nested inside a <label> can double-fire (the label's native
    click-forwarding plus the button's own click), which made this switch
    look completely unresponsive: it flipped and immediately flipped back. */
function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      className={[
        "relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200",
        checked ? "bg-ruby-500" : "bg-white/15",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </span>
  );
}

/** Gold segmented picker for a small set of game-setting choices. */
function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-4">
      <div className="text-xs text-ink-dim/60 mb-1.5">{label}</div>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150",
              value === o.value
                ? "bg-gold-400 text-felt-950 shadow-sm"
                : "bg-white/[0.05] text-ink-dim/70 ring-1 ring-white/10 hover:bg-white/[0.09]",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Home({
  onPlayBots,
  onCreateRoom,
  onJoin,
  error,
}: {
  onPlayBots: (settings: CreateSettings) => void;
  onCreateRoom: (settings: CreateSettings) => void;
  onJoin: (name: string, joinCode: string, password: string) => void;
  error: string | null;
}) {
  const [mode, setMode] = useState<"play" | "join">("play");
  const [name, setName] = useState("Player");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [modalTab, setModalTab] = useState<"howto" | "rules" | null>(null);
  const [dareMode, setDareMode] = useState(true);
  const [dareStake, setDareStake] = useState(10);
  const [targetTokens, setTargetTokens] = useState(10);
  const [maxRounds, setMaxRounds] = useState(0);
  const [pendingAction, setPendingAction] = useState<"bots" | "create" | "join" | null>(null);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [showJoinPw, setShowJoinPw] = useState(false);

  // A shared link (?join=CODE) pre-fills the join code and switches straight
  // to the Join tab so a tap-through from a friend's message needs one field.
  useEffect(() => {
    const code = readJoinCodeFromUrl();
    if (code) {
      setJoinCode(code);
      setMode("join");
    }
  }, []);

  // Any request failure clears the pending state so the buttons re-enable —
  // success instead unmounts Home entirely once App switches views.
  useEffect(() => {
    if (error) setPendingAction(null);
  }, [error]);

  function currentSettings(): CreateSettings {
    return { name, dareMode, dareStake, password: createPassword, targetTokens, maxRounds };
  }

  function handlePlayBots() {
    setPendingAction("bots");
    onPlayBots(currentSettings());
  }

  function handleCreateRoom() {
    setPendingAction("create");
    onCreateRoom(currentSettings());
  }

  function handleJoin() {
    setPendingAction("join");
    onJoin(name, joinCode, joinPassword);
  }

  /** Enter submits whichever action fits the active tab instead of doing nothing. */
  function onEnter(action: () => void) {
    return (e: React.KeyboardEvent) => {
      if (e.key === "Enter") action();
    };
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:py-16 overflow-hidden"
      style={{
        backgroundColor: "#06140f",
        backgroundImage: "radial-gradient(ellipse 120% 90% at 50% 0%, #123d2c 0%, #0a2c20 45%, #062017 78%, #030f0b 100%)",
      }}
    >
      <div className="bg-grain opacity-40" />

      <div className="relative w-full max-w-4xl flex flex-col lg:flex-row items-center lg:items-center gap-10 lg:gap-16">
        {/* Brand column — takes real estate on wide viewports instead of leaving it empty */}
        <div
          className="animate-rise-in flex flex-col items-center lg:items-start text-center lg:text-left lg:flex-1 lg:max-w-sm"
          style={{ "--delay": "0ms" } as CSSProperties}
        >
          <div className="relative">
            <span className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-gold-400/40 blur-2xl animate-glow-pulse pointer-events-none" />
            <Emblem size={56} />
          </div>
          <h1 className="font-display font-semibold text-6xl sm:text-7xl leading-none mt-4 text-gold-300">
            Omi
          </h1>
          <p className="text-ink-dim/70 text-sm sm:text-base mt-3 max-w-xs lg:max-w-sm">
            Sri Lanka's partnership card game — cut, call trumps, and take every trick as a team.
          </p>
          <div className="hidden lg:flex flex-col gap-2 mt-8 text-sm text-ink-dim/60">
            {["Four players, two partnerships", "Live rounds over a shared table", "Optional coin-stake Dare Mode"].map((line) => (
              <div key={line} className="flex items-center gap-2.5">
                <span className="w-1 h-1 rounded-full bg-gold-400/70 shrink-0" />
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div
          className="animate-rise-in relative w-full max-w-sm mx-auto lg:mx-0 shrink-0 bg-felt-800/70 backdrop-blur-md rounded-3xl p-6 sm:p-7 ring-1 ring-gold-400/15 shadow-[0_30px_70px_-16px_rgba(0,0,0,0.65),0_0_60px_-24px_rgba(227,189,93,0.35)]"
          style={{ "--delay": "90ms" } as CSSProperties}
        >
          <CornerAccent className="absolute -top-1 -left-1 w-7 h-7" />
          <CornerAccent className="absolute -bottom-1 -right-1 w-7 h-7 rotate-180" />

          {/* Mode switcher */}
          <div className="flex bg-black/25 rounded-full p-1 mb-5">
            {(["play", "join"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={[
                  "flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200",
                  mode === m ? "bg-gold-400 text-felt-950 shadow-sm" : "text-ink-dim/70 hover:text-ink",
                ].join(" ")}
              >
                {m === "play" ? "Play" : "Join a Room"}
              </button>
            ))}
          </div>

          <label className="block text-xs uppercase tracking-wider text-ink-dim/60 mb-1.5 font-semibold">Your name</label>
          <input
            autoFocus
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onEnter(mode === "join" ? handleJoin : handlePlayBots)}
            className="w-full rounded-xl px-4 py-3 mb-4 bg-black/25 ring-1 ring-white/10 text-ink placeholder:text-ink-dim/40 transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
          />

          {mode === "play" ? (
            <>
              <div
                role="switch"
                tabIndex={0}
                aria-checked={dareMode}
                onClick={() => setDareMode((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDareMode((v) => !v);
                  }
                }}
                className="flex items-center justify-between mb-4 cursor-pointer select-none"
              >
                <span className="text-sm text-ink">
                  Dare Mode <span className="text-ink-dim/50">— coin bets</span>
                </span>
                <Toggle checked={dareMode} />
              </div>

              {dareMode && (
                <div className="mb-4">
                  <div className="text-xs text-ink-dim/60 mb-1.5">Bet per dare</div>
                  <div className="flex gap-1.5">
                    {STAKE_OPTIONS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setDareStake(amount)}
                        className={[
                          "flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150",
                          dareStake === amount
                            ? "bg-ruby-500 text-white shadow-sm"
                            : "bg-white/[0.05] text-ink-dim/70 ring-1 ring-white/10 hover:bg-white/[0.09]",
                        ].join(" ")}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Segmented
                label="Tokens to win"
                options={TOKEN_OPTIONS.map((t) => ({ label: String(t), value: t }))}
                value={targetTokens}
                onChange={setTargetTokens}
              />
              <Segmented label="Rounds" options={ROUND_OPTIONS} value={maxRounds} onChange={setMaxRounds} />

              {showCreatePassword ? (
                <div className="relative mb-4">
                  <input
                    type={showCreatePw ? "text" : "password"}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    onKeyDown={onEnter(handleCreateRoom)}
                    placeholder="Room password"
                    autoFocus
                    className="w-full rounded-xl pl-4 pr-10 py-2.5 bg-black/20 ring-1 ring-white/10 text-ink text-sm transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
                  />
                  <EyeToggle shown={showCreatePw} onClick={() => setShowCreatePw((v) => !v)} />
                </div>
              ) : (
                <button
                  onClick={() => setShowCreatePassword(true)}
                  className="flex items-center gap-1.5 text-xs text-ink-dim/60 hover:text-gold-300 font-medium mb-4 transition-colors duration-150"
                >
                  <LockIcon /> Add a password
                </button>
              )}

              <button
                onClick={handleCreateRoom}
                disabled={pendingAction !== null}
                className="shine-surface w-full bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold text-base py-3.5 rounded-xl shadow-[0_10px_24px_-8px_rgba(201,154,52,0.55)] hover:brightness-105 hover:scale-[1.015] active:scale-95 transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none"
              >
                {pendingAction === "create" ? "Creating…" : "Create Room"}
              </button>
              <p className="text-center text-[11px] text-ink-dim/50 mt-2 mb-4">Get a code to invite friends</p>

              <button
                onClick={handlePlayBots}
                disabled={pendingAction !== null}
                className="w-full bg-white/[0.05] ring-1 ring-white/10 text-ink font-semibold text-sm py-3 rounded-xl hover:bg-white/[0.09] hover:ring-white/20 active:scale-95 transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none"
              >
                {pendingAction === "bots" ? "Starting…" : "Practice vs Bots"}
              </button>
            </>
          ) : (
            <>
              <label className="block text-xs uppercase tracking-wider text-ink-dim/60 mb-1.5 font-semibold">Join code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={onEnter(handleJoin)}
                placeholder="ABCDE"
                className="w-full rounded-xl px-4 py-3 mb-4 bg-black/25 ring-1 ring-white/10 text-ink uppercase tracking-[0.3em] placeholder:text-ink-dim/30 placeholder:tracking-[0.3em] transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
              />
              <div className="relative mb-5">
                <input
                  type={showJoinPw ? "text" : "password"}
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  onKeyDown={onEnter(handleJoin)}
                  placeholder="Password (if the room has one)"
                  className="w-full rounded-xl pl-4 pr-10 py-2.5 bg-black/20 ring-1 ring-white/10 text-ink placeholder:text-ink-dim/40 text-sm transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
                />
                <EyeToggle shown={showJoinPw} onClick={() => setShowJoinPw((v) => !v)} />
              </div>

              <button
                onClick={handleJoin}
                disabled={pendingAction !== null}
                className="shine-surface w-full bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold text-base py-3.5 rounded-xl shadow-[0_10px_24px_-8px_rgba(201,154,52,0.55)] hover:brightness-105 hover:scale-[1.015] active:scale-95 transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none"
              >
                {pendingAction === "join" ? "Joining…" : "Join Room"}
              </button>
            </>
          )}

          {error && (
            <p className="text-ruby-300 text-sm mt-4 bg-ruby-700/20 ring-1 ring-ruby-500/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-center gap-4 mt-5 text-xs">
            <button onClick={() => setModalTab("howto")} className="text-ink-dim/60 hover:text-gold-300 font-medium transition-colors duration-150">
              How to Play
            </button>
            <span className="text-white/15">·</span>
            <button onClick={() => setModalTab("rules")} className="text-ink-dim/60 hover:text-gold-300 font-medium transition-colors duration-150">
              Full Rules
            </button>
          </div>
        </div>
      </div>

      {modalTab && <RulesModal initialTab={modalTab} onClose={() => setModalTab(null)} />}
    </div>
  );
}
