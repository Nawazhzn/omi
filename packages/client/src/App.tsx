import { useEffect, useRef, useState } from "react";
import type { Card, RoomSnapshot, Seat, Suit } from "@omi/engine";
import { socket } from "./socket.js";
import { playCardSound, playTrickWonSound, playYourTurnSound, vibrate } from "./soundEffects.js";
import { clearMembership, readMembership, saveMembership } from "./sessionMembership.js";
import { Home } from "./components/Home.js";
import { Lobby } from "./components/Lobby.js";
import { Table } from "./components/Table.js";
import { TrumpModal } from "./components/TrumpModal.js";
import { CutDeckModal } from "./components/CutDeckModal.js";
import { DealingOverlay } from "./components/DealingOverlay.js";
import { HandResultOverlay } from "./components/HandResultOverlay.js";
import { GameOverScreen } from "./components/GameOverScreen.js";
import { DareChallengeModal } from "./components/DareChallengeModal.js";
import { DareResponseModal } from "./components/DareResponseModal.js";

export default function App() {
  const [view, setView] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dealBatch, setDealBatch] = useState<1 | 2 | null>(null);
  const [serverDisconnected, setServerDisconnected] = useState(false);
  const prevPhaseRef = useRef<RoomSnapshot["phase"] | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSnapshotRef = useRef<{ trickLen: number; phase: RoomSnapshot["phase"]; isMyTurn: boolean } | null>(null);

  useEffect(() => {
    socket.connect();
    socket.on("state:sync", (snapshot) => setView(snapshot));
    socket.on("error", (payload) => showError(payload.message));
    // Fires on the very first connect AND every automatic reconnect after a
    // dropped connection — either way, try to reclaim whatever seat this tab
    // last held so a network blip or accidental refresh doesn't boot the
    // player out to a bot takeover with no way back in.
    socket.on("connect", () => {
      setServerDisconnected(false);
      const membership = readMembership();
      if (!membership) return;
      socket.emit("room:rejoin", membership, (res) => {
        if (!res.ok) clearMembership();
      });
    });
    socket.on("disconnect", () => setServerDisconnected(true));
    // Broadcast to every seat (including the host's own socket) when the host
    // ends the session early — everyone lands back on Home with the same message.
    socket.on("room:ended", (payload) => {
      clearMembership();
      prevPhaseRef.current = null;
      setDealBatch(null);
      setView(null);
      showError(payload.reason);
    });
    return () => {
      socket.off("state:sync");
      socket.off("error");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room:ended");
    };
  }, []);

  useEffect(() => {
    if (!view) return;
    const prev = prevPhaseRef.current;
    const fromTrumpOrDare = prev === "AWAIT_TRUMP_CALL" || prev === "AWAIT_DARE_CHALLENGE" || prev === "AWAIT_DARE_RESPONSE";
    if (prev === "AWAIT_CUT" && view.phase === "AWAIT_TRUMP_CALL") {
      setDealBatch(1);
    } else if (fromTrumpOrDare && view.phase === "TRICK_PLAY") {
      setDealBatch(2);
    }
    prevPhaseRef.current = view.phase;
  }, [view?.phase]);

  // Tab title pings whenever it's this player's turn to act, so a backgrounded
  // tab is noticeable instead of silently running out the auto-play timer.
  useEffect(() => {
    if (!view) {
      document.title = "Omi";
      return;
    }
    const awaitingMe =
      (view.phase === "TRICK_PLAY" && view.currentTurnSeat === view.mySeat) ||
      (view.phase === "AWAIT_TRUMP_CALL" && view.trumpCallerSeat === view.mySeat) ||
      (view.phase === "AWAIT_CUT" && view.cutSeat === view.mySeat);
    document.title = awaitingMe ? "🎯 Your turn! · Omi" : "Omi";
  }, [view?.phase, view?.currentTurnSeat, view?.mySeat, view?.cutSeat, view?.trumpCallerSeat]);

  // Sound + haptic feedback for card plays, trick wins, and the start of this
  // player's turn — detected by diffing against the previous snapshot since
  // these should fire once on the transition, not continuously.
  useEffect(() => {
    if (!view) {
      prevSnapshotRef.current = null;
      return;
    }
    const isMyTurn = view.phase === "TRICK_PLAY" && view.currentTurnSeat === view.mySeat;
    const prev = prevSnapshotRef.current;
    if (prev) {
      if (view.currentTrick.length > prev.trickLen) playCardSound();
      if (prev.phase !== "TRICK_RESOLVED" && view.phase === "TRICK_RESOLVED") playTrickWonSound();
      if (!prev.isMyTurn && isMyTurn) {
        playYourTurnSound();
        vibrate(60);
      }
    }
    prevSnapshotRef.current = { trickLen: view.currentTrick.length, phase: view.phase, isMyTurn };
  }, [view]);

  function showError(msg: string) {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  }

  /** Create a room and immediately mark ready — bots fill remaining seats and game starts. */
  function playVsBots(name: string, dareMode: boolean, password: string, dareStake: number) {
    setError(null);
    socket.emit("room:create", { name, rules: { dareMode, dareBaseStake: dareStake }, password: password || undefined }, (res) => {
      if (!res.ok) { showError(res.error); return; }
      saveMembership({ roomId: res.roomId, seat: res.seat, rejoinToken: res.rejoinToken });
      socket.emit("seat:ready", { ready: true });
    });
  }

  /** Create a room WITHOUT auto-readying — stays in LOBBY so friends can join via code. */
  function createRoom(name: string, dareMode: boolean, password: string, dareStake: number) {
    setError(null);
    socket.emit("room:create", { name, rules: { dareMode, dareBaseStake: dareStake }, password: password || undefined }, (res) => {
      if (!res.ok) { showError(res.error); return; }
      saveMembership({ roomId: res.roomId, seat: res.seat, rejoinToken: res.rejoinToken });
      // No seat:ready — show lobby and wait for humans
    });
  }

  function joinRoom(name: string, joinCode: string, password: string) {
    setError(null);
    socket.emit("room:join", { joinCode, name, password: password || undefined }, (res) => {
      if (!res.ok) { showError(res.error); return; }
      saveMembership({ roomId: res.roomId, seat: res.seat, rejoinToken: res.rejoinToken });
      // state:sync fires next — if phase is LOBBY we show the lobby and let the
      // player choose when to ready; if the game is already in progress we go
      // straight to Table and ready state is irrelevant past LOBBY.
    });
  }

  function toggleReady(ready: boolean) {
    socket.emit("seat:ready", { ready });
  }

  function goHome() {
    socket.emit("room:leave", {});
    clearMembership();
    prevPhaseRef.current = null;
    setDealBatch(null);
    setView(null);
  }

  /** Host-only: ends the game for everyone. The actual navigation back to
      Home happens uniformly for all players (including the host) via the
      room:ended broadcast handler above, not here. */
  function endSession() {
    socket.emit("room:end", {}, (res) => {
      if (!res.ok) showError(res.error);
    });
  }

  function playCard(card: Card) {
    socket.emit("game:playCard", { card }, (res) => {
      if (!res.ok && res.error) showError(res.error);
    });
  }

  function callTrump(suit: Suit) {
    socket.emit("game:callTrump", { suit }, (res) => {
      if (!res.ok && res.error) showError(res.error);
    });
  }

  function cutDeck(cutPosition: number) {
    socket.emit("game:cutDeck", { cutPosition }, (res) => {
      if (!res.ok && res.error) showError(res.error);
    });
  }

  function declareSlam() {
    socket.emit("game:declareSlam", {}, (res) => {
      if (!res.ok && res.error) showError(res.error);
    });
  }

  function continueRound() {
    socket.emit("game:continue", {});
  }

  function declareDare(action: "pass" | "dare" | "allin") {
    socket.emit("game:declareDare", { action }, (res) => {
      if (!res.ok && res.error) showError(res.error);
    });
  }

  function respondToDare(action: "accept" | "safe" | "redare") {
    socket.emit("game:respondToDare", { action }, (res) => {
      if (!res.ok && res.error) showError(res.error);
    });
  }

  function raiseFlag(targetSeat: Seat) {
    socket.emit("game:raiseFlag", { targetSeat }, (res) => {
      if (!res.ok) { showError(res.error); return; }
      setNotice(res.correct ? "🚩 Flag confirmed!" : "Flag rejected — that play was legal.");
      setTimeout(() => setNotice(null), 4000);
    });
  }

  const reconnectBanner = serverDisconnected && (
    <div className="fixed top-0 inset-x-0 z-[60] bg-ruby-700 text-white text-sm font-semibold text-center py-2 shadow-lg animate-pulse">
      Reconnecting to server…
    </div>
  );

  if (!view) {
    return (
      <>
        {reconnectBanner}
        <Home onPlayBots={playVsBots} onCreateRoom={createRoom} onJoin={joinRoom} error={error} />
      </>
    );
  }

  // Lobby: waiting for players to join and ready up
  if (view.phase === "LOBBY") {
    return (
      <>
        {reconnectBanner}
        <Lobby view={view} onReady={toggleReady} onLeave={goHome} onEndSession={endSession} />
      </>
    );
  }

  const isTrumpCaller = view.mySeat === view.trumpCallerSeat;
  const isCutter = view.mySeat === view.cutSeat;
  const myTeam = (view.mySeat % 2) as 0 | 1;
  const trumpTeam = (view.trumpCallerSeat % 2) as 0 | 1;
  const isOpponentOfTrump = myTeam !== trumpTeam;
  const partner = ((view.mySeat + 2) % 4) as Seat;
  const left = ((view.mySeat + 1) % 4) as Seat;
  const right = ((view.mySeat + 3) % 4) as Seat;

  return (
    <div className="relative">
      <Table view={view} onPlayCard={playCard} onDeclareSlam={declareSlam} onContinue={continueRound} onRaiseFlag={raiseFlag} onLeave={goHome} onEndSession={endSession} />

      {view.phase === "AWAIT_CUT" && isCutter && <CutDeckModal onCut={cutDeck} />}

      {view.phase === "AWAIT_TRUMP_CALL" && isTrumpCaller && !dealBatch && <TrumpModal cards={view.myHand} onChoose={callTrump} />}

      {view.phase === "AWAIT_DARE_CHALLENGE" && isOpponentOfTrump && !dealBatch && (
        <DareChallengeModal
          seconds={view.rules.dareTimeoutSeconds}
          allInAvailable={!view.allInUsed[myTeam]}
          onAction={declareDare}
        />
      )}

      {view.phase === "AWAIT_DARE_RESPONSE" && myTeam === trumpTeam && !dealBatch && (
        <DareResponseModal seconds={view.rules.dareTimeoutSeconds} dareLevel={view.dare.level} onAction={respondToDare} />
      )}

      {dealBatch && (
        <DealingOverlay
          mySeat={view.mySeat}
          partner={partner}
          left={left}
          right={right}
          dealerSeat={view.dealerSeat}
          onDone={() => setDealBatch(null)}
        />
      )}

      {view.phase === "HAND_SCORING" && view.lastHandResult && (
        <HandResultOverlay result={view.lastHandResult} onContinue={continueRound} />
      )}

      {view.phase === "GAME_OVER" && view.winningTeam !== null && (
        <GameOverScreen
          winningTeam={view.winningTeam}
          tokens={view.tokens}
          onRematch={() => socket.emit("game:rematchVote", { vote: true })}
          onHome={goHome}
        />
      )}

      {reconnectBanner}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
        {notice && (
          <div className="bg-gradient-to-r from-gold-300 to-gold-500 backdrop-blur-sm text-felt-950 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg">
            {notice}
          </div>
        )}
        {error && (
          <div className="bg-ruby-700/90 backdrop-blur-sm text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg border border-ruby-500/30">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
