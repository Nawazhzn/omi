import { useState, type ReactNode } from "react";

type Tab = "howto" | "rules";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-gold-300 font-bold text-sm uppercase tracking-wide mb-2">{title}</h3>
      <div className="text-ink-dim/90 text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function HowToPlay() {
  return (
    <>
      <Section title="The basics">
        <p>4 players, 2 teams of 2. Partners always sit across the table from each other.</p>
        <p>The deck has 32 cards — 7 through Ace in each suit. Ranking: A, K, Q, J, 10, 9, 8, 7.</p>
      </Section>
      <Section title="Each hand">
        <ol className="list-decimal list-inside space-y-1">
          <li>The player to the dealer's left cuts the deck.</li>
          <li>Everyone gets 4 cards.</li>
          <li>The player to the dealer's right looks at only those 4 cards and picks the trump suit — blind, with no help.</li>
          <li>Everyone gets 4 more cards (8 total).</li>
          <li>The trump caller leads the first trick. Play 8 tricks total.</li>
        </ol>
      </Section>
      <Section title="Playing a trick">
        <p>Follow the suit that was led if you can. If you can't, play anything — including trump.</p>
        <p>Highest trump wins the trick; if no trump was played, the highest card of the led suit wins.</p>
        <p>Whoever wins a trick leads the next one.</p>
      </Section>
      <Section title="Flags">
        <p>Nobody's forced to follow suit by the app — if you think an opponent dodged the led suit while still holding it, raise a 🚩 flag on their card. Get it right and your team scores big; get it wrong and you just lose a flag chance. Each team has 3 for the whole game.</p>
      </Section>
      <Section title="🎲 Omi Dare Mode (optional)">
        <p>
          Right after trump is called, the opposing team can <b>Dare</b> the trump team for x2 virtual coins. The
          trump team can accept, play it safe to cancel, or <b>Redare</b> to x4. A rare <b>All-In Dare</b> (x6, once
          per team per game) skips straight to the maximum stake. Whoever wins the most tricks wins the dare — a
          4-4 tie refunds it. Kapothi wins pay +50%, win streaks and comebacks pay bonus coins. Pure fun money —
          your real token score is never affected.
        </p>
      </Section>
      <Section title="Winning">
        <p>After 8 tricks, your team scores tokens based on how many tricks you won (see the Rules tab for the exact scoring). First team to 10 tokens wins the game.</p>
      </Section>
    </>
  );
}

function FullRules() {
  return (
    <>
      <Section title="Setup">
        <ul className="list-disc list-inside space-y-1">
          <li>4 players in 2 fixed partnerships, partners seated opposite each other.</li>
          <li>32-card deck: A, K, Q, J, 10, 9, 8, 7 of each suit (2–6 removed).</li>
          <li>Card rank, high to low: A, K, Q, J, 10, 9, 8, 7.</li>
          <li>Play proceeds counter-clockwise.</li>
        </ul>
      </Section>
      <Section title="Dealing">
        <ul className="list-disc list-inside space-y-1">
          <li>The player to the dealer's left cuts the shuffled deck.</li>
          <li>Dealer gives 4 cards to each player.</li>
          <li>The player to the dealer's right calls trump based only on those 4 cards — no help from anyone, and it can't be changed afterward.</li>
          <li>Dealer gives 4 more cards to each player (8 each, 32 total).</li>
        </ul>
      </Section>
      <Section title="Trick play">
        <ul className="list-disc list-inside space-y-1">
          <li>Should follow the led suit if able. If void in that suit, any card — including trump — may be played.</li>
          <li>Highest trump wins the trick; with no trump played, highest card of the led suit wins.</li>
          <li>The trick winner leads the next trick. 8 tricks make up a hand.</li>
        </ul>
      </Section>
      <Section title="Flag / challenge rule">
        <ul className="list-disc list-inside space-y-1">
          <li>The app doesn't block a player from dodging the led suit — instead, the opposing team may raise a flag on that specific play.</li>
          <li>If the flagged player truly held the led suit, their team is penalized and the flagging team gets 3 tokens; the hand ends immediately.</li>
          <li>If the flagged player was actually void in that suit, the flag is rejected — no penalty, but the flag chance is still spent.</li>
          <li>Each team gets only 3 flag chances for the entire game.</li>
        </ul>
      </Section>
      <Section title="Scoring (per hand)">
        <table className="w-full text-xs border-collapse">
          <tbody className="divide-y divide-white/10">
            <tr>
              <td className="py-1.5 pr-2">Trump-calling team wins 5–7 tricks</td>
              <td className="py-1.5 text-right font-semibold text-gold-300">1 token</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2">Other team wins 5–7 tricks</td>
              <td className="py-1.5 text-right font-semibold text-gold-300">2 tokens</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2">A team sweeps all 8 tricks (Kapothi)</td>
              <td className="py-1.5 text-right font-semibold text-gold-300">3 tokens</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2">4–4 tie</td>
              <td className="py-1.5 text-right font-semibold text-gold-300">0, +1 carries forward</td>
            </tr>
          </tbody>
        </table>
        <p className="text-ink-dim/70 text-xs mt-2">
          A 4-4 tie carries a bonus token to whichever team wins the next decisive hand. Consecutive ties stack the bonus.
        </p>
      </Section>
      <Section title="Winning the game">
        <p>First team to reach 10 tokens wins (reaching or passing 10 ends it immediately).</p>
      </Section>
    </>
  );
}

export function RulesModal({ initialTab, onClose }: { initialTab: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="ring-foil bg-felt-800/95 rounded-[1.75rem] shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gold-400/10">
          <div className="flex gap-1 bg-black/25 rounded-full p-1">
            <button
              onClick={() => setTab("howto")}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150",
                tab === "howto" ? "bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950" : "text-ink-dim hover:text-ink",
              ].join(" ")}
            >
              How to Play
            </button>
            <button
              onClick={() => setTab("rules")}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150",
                tab === "rules" ? "bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950" : "text-ink-dim hover:text-ink",
              ].join(" ")}
            >
              Full Rules
            </button>
          </div>
          <button onClick={onClose} className="text-ink-dim/70 hover:text-ink text-xl leading-none px-1 transition-colors duration-150">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">{tab === "howto" ? <HowToPlay /> : <FullRules />}</div>
      </div>
    </div>
  );
}
