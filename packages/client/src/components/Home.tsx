import { useEffect, useState, type CSSProperties } from "react";
import { readJoinCodeFromUrl } from "../joinLink.js";
import { RulesModal } from "./RulesModal.js";

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

/** Small corner flourish echoing kolam line-work — purely decorative. */
function CornerFlourish({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 24C2 11.85 11.85 2 24 2" stroke="#e3bd5d" strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="24" cy="2" r="1.6" fill="#e3bd5d" fillOpacity="0.6" />
      <circle cx="2" cy="24" r="1.6" fill="#e3bd5d" fillOpacity="0.6" />
      <circle cx="9" cy="9" r="1.2" fill="#e3bd5d" fillOpacity="0.5" />
    </svg>
  );
}

function EyeToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim/60 hover:text-gold-300 transition-colors duration-150"
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

export function Home({
  onPlayBots,
  onCreateRoom,
  onJoin,
  error,
}: {
  onPlayBots: (name: string, dareMode: boolean, password: string) => void;
  onCreateRoom: (name: string, dareMode: boolean, password: string) => void;
  onJoin: (name: string, joinCode: string, password: string) => void;
  error: string | null;
}) {
  const [name, setName] = useState("Player");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [modalTab, setModalTab] = useState<"howto" | "rules" | null>(null);
  const [dareMode, setDareMode] = useState(true);
  const [pendingAction, setPendingAction] = useState<"bots" | "create" | "join" | null>(null);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [showJoinPw, setShowJoinPw] = useState(false);

  // A shared link (?join=CODE) pre-fills the join code so a tap-through from a
  // friend's message goes straight to "type your name, hit Join".
  useEffect(() => {
    const code = readJoinCodeFromUrl();
    if (code) setJoinCode(code);
  }, []);

  // Any request failure clears the pending state so the buttons re-enable —
  // success instead unmounts Home entirely once App switches views.
  useEffect(() => {
    if (error) setPendingAction(null);
  }, [error]);

  function handlePlayBots() {
    setPendingAction("bots");
    onPlayBots(name, dareMode, createPassword);
  }

  function handleCreateRoom() {
    setPendingAction("create");
    onCreateRoom(name, dareMode, createPassword);
  }

  function handleJoin() {
    setPendingAction("join");
    onJoin(name, joinCode, joinPassword);
  }

  /** Enter submits the contextually relevant action instead of doing nothing. */
  function onEnter(action: () => void) {
    return (e: React.KeyboardEvent) => {
      if (e.key === "Enter") action();
    };
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:py-16 overflow-hidden bg-kolam"
      style={{
        backgroundColor: "#06140f",
        backgroundImage:
          "radial-gradient(ellipse 120% 90% at 50% 0%, #123d2c 0%, #0a2c20 45%, #062017 78%, #030f0b 100%), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cg fill='none' stroke='%23e3bd5d' stroke-width='1'%3E%3Ccircle cx='36' cy='4' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Ccircle cx='36' cy='68' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Ccircle cx='4' cy='36' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Ccircle cx='68' cy='36' r='1.6' fill='%23e3bd5d' stroke='none'/%3E%3Cpath d='M36 4 C 50 12, 60 22, 68 36 C 60 50, 50 60, 36 68 C 22 60, 12 50, 4 36 C 12 22, 22 12, 36 4 Z'/%3E%3Ccircle cx='36' cy='36' r='3' /%3E%3C/g%3E%3C/svg%3E\")",
        backgroundBlendMode: "normal, soft-light",
        backgroundSize: "auto, 72px 72px",
        backgroundPosition: "center, center",
      }}
    >
      <div className="bg-grain" />

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-stretch gap-10 lg:gap-20">
        {/* Brand column — takes real estate on wide viewports instead of leaving it empty */}
        <div
          className="animate-rise-in flex flex-col items-center lg:items-start text-center lg:text-left lg:flex-1 lg:justify-center lg:max-w-md"
          style={{ "--delay": "0ms" } as CSSProperties}
        >
          <Emblem size={64} />
          <h1 className="font-display font-semibold text-6xl sm:text-7xl lg:text-8xl leading-none mt-5 bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-transparent">
            Omi
          </h1>
          <p className="text-ink-dim/80 text-sm sm:text-base mt-3 max-w-xs lg:max-w-sm">
            Sri Lanka's partnership card game — cut, call trumps, and take every trick as a team.
          </p>
          <div className="hidden lg:flex flex-col gap-2.5 mt-9 text-sm text-ink-dim/70">
            {["Four players, two partnerships", "Live rounds over a shared table", "Optional coin-stake Dare Mode"].map((line, i) => (
              <div key={line} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400/80 shrink-0" />
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div
          className="animate-rise-in relative w-full max-w-sm mx-auto lg:mx-0 shrink-0 bg-felt-800/80 backdrop-blur-md rounded-[1.75rem] p-7 sm:p-8 ring-foil shadow-[0_30px_70px_-16px_rgba(0,0,0,0.65)]"
          style={{ "--delay": "90ms" } as CSSProperties}
        >
          <CornerFlourish className="absolute -top-1 -left-1 w-9 h-9" />
          <CornerFlourish className="absolute -bottom-1 -right-1 w-9 h-9 rotate-180" />

          <label className="block text-xs uppercase tracking-wider text-ink-dim/70 mb-2 font-semibold">Your name</label>
          <input
            autoFocus
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onEnter(handlePlayBots)}
            className="w-full rounded-xl px-4 py-3 mb-5 bg-black/25 ring-1 ring-white/10 text-ink placeholder:text-ink-dim/40 transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
          />

          <label className="flex items-center justify-between bg-ruby-700/15 ring-1 ring-ruby-500/30 rounded-xl px-4 py-3 mb-4 cursor-pointer transition-colors duration-200 hover:bg-ruby-700/25 hover:ring-ruby-500/50">
            <span className="text-sm font-semibold text-ink">
              Omi Dare Mode <span className="text-ink-dim/70 font-normal">— fun coin bets</span>
            </span>
            <input
              type="checkbox"
              checked={dareMode}
              onChange={(e) => setDareMode(e.target.checked)}
              className="w-5 h-5 accent-ruby-500 cursor-pointer"
            />
          </label>

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
              className="block text-xs text-ink-dim/80 hover:text-gold-300 font-medium mb-4 underline-offset-2 hover:underline transition-colors duration-150"
            >
              Add a password (optional) — friends will need it to join
            </button>
          )}

          <div className="flex gap-2 mb-4">
            <button
              onClick={handlePlayBots}
              disabled={pendingAction !== null}
              className="shine-surface flex-1 bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold text-base py-3.5 rounded-xl shadow-[0_10px_24px_-8px_rgba(201,154,52,0.55)] hover:brightness-105 active:scale-95 transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none"
            >
              {pendingAction === "bots" ? "Starting…" : "vs Bots"}
            </button>
            <button
              onClick={handleCreateRoom}
              disabled={pendingAction !== null}
              className="flex-1 bg-white/[0.06] ring-1 ring-white/15 text-ink font-bold text-base py-3.5 rounded-xl hover:bg-white/[0.1] hover:ring-white/25 active:scale-95 transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none"
            >
              {pendingAction === "create" ? "Creating…" : "Create Room"}
            </button>
          </div>

          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px bg-gold-400/15" />
            <span className="text-ink-dim/60 text-[11px] font-semibold uppercase tracking-wider">or join a room</span>
            <div className="flex-1 h-px bg-gold-400/15" />
          </div>

          <div className="flex gap-2 mb-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={onEnter(handleJoin)}
              placeholder="JOIN CODE"
              className="flex-1 rounded-xl px-4 py-2.5 bg-black/25 ring-1 ring-white/10 text-ink uppercase tracking-wider placeholder:text-ink-dim/40 transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
            />
            <button
              onClick={handleJoin}
              disabled={pendingAction !== null}
              className="bg-sapphire-700/50 ring-1 ring-sapphire-500/40 px-5 py-2.5 rounded-xl font-semibold text-ink hover:bg-sapphire-700/70 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none"
            >
              {pendingAction === "join" ? "Joining…" : "Join"}
            </button>
          </div>
          <div className="relative">
            <input
              type={showJoinPw ? "text" : "password"}
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={onEnter(handleJoin)}
              placeholder="Password (if the room has one)"
              className="w-full rounded-xl pl-4 pr-10 py-2 bg-black/20 ring-1 ring-white/10 text-ink placeholder:text-ink-dim/40 text-sm transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
            />
            <EyeToggle shown={showJoinPw} onClick={() => setShowJoinPw((v) => !v)} />
          </div>

          {error && (
            <p className="text-ruby-300 text-sm mt-4 bg-ruby-700/20 ring-1 ring-ruby-500/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-center gap-4 mt-6 text-xs">
            <button onClick={() => setModalTab("howto")} className="text-ink-dim/80 hover:text-gold-300 font-medium underline-offset-2 hover:underline transition-colors duration-150">
              How to Play
            </button>
            <span className="text-white/15">·</span>
            <button onClick={() => setModalTab("rules")} className="text-ink-dim/80 hover:text-gold-300 font-medium underline-offset-2 hover:underline transition-colors duration-150">
              Full Rules
            </button>
          </div>
        </div>
      </div>

      {modalTab && <RulesModal initialTab={modalTab} onClose={() => setModalTab(null)} />}
    </div>
  );
}
