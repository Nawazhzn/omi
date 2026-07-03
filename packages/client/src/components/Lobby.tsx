import { useState } from "react";
import type { RoomSnapshot, Seat, Team } from "@omi/engine";
import { buildJoinLink } from "../joinLink.js";

const TEAM: Record<Team, { ring: string; bg: string; text: string; label: string }> = {
  0: { ring: "ring-sapphire-400/50", bg: "bg-sapphire-400/10", text: "text-sapphire-300", label: "Team A" },
  1: { ring: "ring-ruby-400/50", bg: "bg-ruby-400/10", text: "text-ruby-300", label: "Team B" },
};

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function Lobby({
  view,
  onReady,
  onLeave,
}: {
  view: RoomSnapshot;
  onReady: (ready: boolean) => void;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const me = view.players.find((p) => p.seat === view.mySeat);
  const isReady = me?.ready ?? false;
  const humanCount = view.players.filter((p) => !p.isBot).length;
  const readyCount = view.players.filter((p) => !p.isBot && p.ready).length;

  function copyCode() {
    navigator.clipboard.writeText(view.joinCode).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(buildJoinLink(view.joinCode)).catch(() => undefined);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const SEAT_ORDER: Seat[] = [0, 2, 1, 3];

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden bg-kolam"
      style={{
        backgroundColor: "#06140f",
        backgroundImage:
          "radial-gradient(ellipse 120% 90% at 50% 0%, #123d2c 0%, #0a2c20 45%, #062017 78%, #030f0b 100%)",
        backgroundSize: "auto, 72px 72px",
      }}
    >
      <div className="bg-grain" />

      <div className="animate-rise-in relative w-full max-w-md ring-foil bg-felt-800/80 backdrop-blur-md rounded-[1.75rem] p-7 sm:p-8 shadow-[0_30px_70px_-16px_rgba(0,0,0,0.65)] text-ink">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display font-semibold text-3xl text-ink">Waiting for Players</h1>
          <p className="text-ink-dim/75 text-sm mt-1.5">
            {humanCount < 4
              ? `${humanCount}/4 joined — share the code to invite friends`
              : "All players joined!"}
          </p>
        </div>

        {/* Join code */}
        <button
          onClick={copyCode}
          aria-label="Copy room code"
          className="w-full flex items-center justify-between bg-black/25 ring-1 ring-gold-400/20 rounded-2xl px-5 py-4 mb-2 hover:bg-black/35 active:scale-[0.99] transition-all duration-150 text-left"
        >
          <div>
            <p className="text-[10px] font-bold text-ink-dim/60 uppercase tracking-widest mb-1">
              {view.hasPassword ? "🔒 Password-protected" : "Room Code"}
            </p>
            <p className="font-display text-3xl font-semibold tracking-[0.2em] text-gold-300">{view.joinCode}</p>
          </div>
          <span className="text-sm font-semibold text-ink-dim/80 bg-white/[0.06] ring-1 ring-white/10 px-3 py-1.5 rounded-full shrink-0 ml-4">
            {copied ? "✓ Copied" : "Copy"}
          </span>
        </button>
        <button
          onClick={copyLink}
          aria-label="Copy invite link"
          className="w-full text-xs text-ink-dim/60 hover:text-gold-300 mb-6 transition-colors duration-150"
        >
          {linkCopied ? "✓ Link copied" : "or copy a shareable invite link"}
        </button>

        {/* Seats — Team A (0,2) left column, Team B (1,3) right column */}
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {SEAT_ORDER.map((seatNum) => {
            const player = view.players.find((p) => p.seat === seatNum)!;
            const team = (player.seat % 2) as Team;
            const colors = TEAM[team];
            const isMe = player.seat === view.mySeat;
            const isEmpty = player.isBot;

            return (
              <div
                key={seatNum}
                className={[
                  "rounded-xl border p-3 flex flex-col gap-1 transition-all duration-300",
                  isEmpty
                    ? "border-white/10 bg-white/[0.03]"
                    : `ring-1 ${colors.ring} ${colors.bg} border-transparent`,
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className={["text-[10px] font-bold uppercase tracking-wider", isEmpty ? "text-white/25" : colors.text].join(" ")}>
                    {colors.label}
                  </span>
                  {!isEmpty && player.ready && (
                    <span className="text-[9px] font-bold text-emerald-300 bg-emerald-400/15 px-1.5 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                  {!isEmpty && !player.ready && (
                    <span className="text-[9px] text-gold-300/80 bg-gold-400/10 px-1.5 py-0.5 rounded-full">
                      Not ready
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      isEmpty ? "bg-white/10 text-white/20" : "bg-felt-700 text-ink",
                    ].join(" ")}
                  >
                    {isEmpty ? "?" : initials(player.name)}
                  </div>
                  <div className="min-w-0">
                    <p className={["text-sm font-semibold truncate", isEmpty ? "text-white/25 italic" : "text-ink"].join(" ")}>
                      {isEmpty ? "Waiting…" : player.name}
                    </p>
                    {isMe && <p className="text-[10px] text-gold-300 font-bold">You</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ready progress */}
        {humanCount > 1 && (
          <p className="text-xs text-center text-ink-dim/60 mb-4">
            {readyCount}/{humanCount} players ready
          </p>
        )}

        {view.rules.dareMode && (
          <p className="text-xs text-center text-ink-dim/50 mb-4">🎲 Dare Mode on</p>
        )}

        {/* Ready button */}
        <button
          onClick={() => onReady(!isReady)}
          className={[
            "shine-surface w-full font-bold text-lg py-3.5 rounded-xl mb-3 transition-all duration-200 ease-out",
            isReady
              ? "bg-felt-700/60 ring-1 ring-emerald-500/30 text-ink hover:bg-felt-700/40 active:scale-[0.98]"
              : "bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 shadow-[0_10px_24px_-8px_rgba(201,154,52,0.55)] hover:brightness-105 active:scale-95",
          ].join(" ")}
        >
          {isReady ? "✓ Ready — waiting for others…" : "I'm Ready to Play"}
        </button>

        <button
          onClick={onLeave}
          className="w-full text-sm text-ink-dim/60 hover:text-ruby-300 transition-colors duration-150 py-1"
        >
          Leave room
        </button>
      </div>
    </div>
  );
}
