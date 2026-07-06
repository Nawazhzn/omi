import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Rank, Suit } from "@omi/engine";
import { makeCardTexture, makeGlowTexture, makeSpeedLinesTexture } from "../three/suitVisual.js";

const DURATION_MS = 1650;
const CARD_W = 2.3;
const CARD_H = 3.2;
const CUT_ANGLE = -0.32; // radians — tilts the vertical split so it reads as a diagonal slash

/** Builds one half of the card: a half-width plane whose UVs sample either the
    left or right half of the full card texture, so the two halves reconstruct
    the whole card when placed side by side. */
function buildHalf(tex: THREE.Texture, side: "left" | "right"): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(CARD_W / 2, CARD_H);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  if (side === "left") {
    uv.setX(1, 0.5);
    uv.setX(3, 0.5);
  } else {
    uv.setX(0, 0.5);
    uv.setX(2, 0.5);
  }
  uv.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.x = side === "left" ? -CARD_W / 4 : CARD_W / 4;
  return mesh;
}

/** A Three.js flourish with a Mortal-Kombat / anime edge: a blade slashes a
    playing card in two along a diagonal, with a bright slash flash, a radial
    impact burst, and a screen flash — shown when a player wins a trick by
    trumping in (a "cut"). Decorative and self-disposing. */
export function TrumpCutOverlay({ rank, suit, onDone }: { rank: Rank; suit: Suit; onDone: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [showCaption, setShowCaption] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-3, 4, 5);
    scene.add(key);

    // --- Radial impact speed lines (anime hit burst) ---
    const linesTex = makeSpeedLinesTexture("rgba(255,255,255,0.8)");
    const linesMat = new THREE.MeshBasicMaterial({ map: linesTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const speedLines = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), linesMat);
    speedLines.position.z = -1;
    scene.add(speedLines);

    // --- Impact glow behind the cut point ---
    const glowTex = makeGlowTexture("rgba(255,240,220,0.95)");
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowMat);
    glow.position.z = -0.4;
    scene.add(glow);

    // --- Card (two halves) inside a tilted group so the split reads diagonal ---
    const cardTex = makeCardTexture(rank, suit);
    const cardGroup = new THREE.Group();
    cardGroup.rotation.z = CUT_ANGLE;
    const leftHalf = buildHalf(cardTex, "left");
    const rightHalf = buildHalf(cardTex, "right");
    cardGroup.add(leftHalf, rightHalf);
    scene.add(cardGroup);

    // --- Sword (blade + guard + grip) sliding straight down the cut line ---
    const swordGroup = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 3.8, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xeef2f8, metalness: 0.98, roughness: 0.12, transparent: true })
    );
    blade.position.y = 0.95;
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.15, 0.13),
      new THREE.MeshStandardMaterial({ color: 0xc99a34, metalness: 0.85, roughness: 0.3, transparent: true })
    );
    guard.position.y = -1.0;
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.66, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, metalness: 0.3, roughness: 0.7, transparent: true })
    );
    grip.position.y = -1.42;
    swordGroup.add(blade, guard, grip);
    cardGroup.add(swordGroup);

    // --- Bright slash streak along the cut ---
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 5.2),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    cardGroup.add(streak);

    const swordMats = [blade.material, guard.material, grip.material] as THREE.MeshStandardMaterial[];
    const leftMat = leftHalf.material as THREE.MeshBasicMaterial;
    const rightMat = rightHalf.material as THREE.MeshBasicMaterial;
    const streakMat = streak.material as THREE.MeshBasicMaterial;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const start = performance.now();
    let raf = 0;
    let captionFired = false;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);

      cardGroup.scale.setScalar(t < 0.1 ? easeOut(t / 0.1) : 1);

      // Sword slides from above, straight down the cut line, then fades.
      const swordT = Math.min(1, t / 0.5);
      swordGroup.position.y = 3.8 - easeOut(swordT) * 7.6;
      const swordFade = t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.3);
      swordMats.forEach((m) => (m.opacity = swordFade));

      if (t >= 0.24) {
        if (!captionFired) {
          captionFired = true;
          setShowCaption(true);
          if (flashRef.current) flashRef.current.style.animation = "screen-flash 260ms ease-out";
        }
        const p = (t - 0.24) / 0.76;

        // Slash flash.
        streakMat.opacity = p < 0.1 ? p / 0.1 : Math.max(0, 1 - (p - 0.1) / 0.35);

        // Radial burst + glow that snap out on impact.
        speedLines.rotation.z = p * 0.5;
        linesMat.opacity = p < 0.14 ? p / 0.14 : Math.max(0, 0.85 - (p - 0.14) / 0.5);
        glowMat.opacity = p < 0.12 ? p / 0.12 : Math.max(0, 1 - (p - 0.12) / 0.45);
        glow.scale.setScalar(0.6 + easeOut(Math.min(1, p * 2)) * 0.9);

        // Halves fly apart, rotate, drift, and fade.
        const sep = easeOut(Math.min(1, p * 1.3));
        leftHalf.position.x = -CARD_W / 4 - sep * 1.6;
        rightHalf.position.x = CARD_W / 4 + sep * 1.6;
        leftHalf.position.y = -sep * sep * 2.6;
        rightHalf.position.y = -sep * sep * 2.6;
        leftHalf.rotation.z = sep * 0.55;
        rightHalf.rotation.z = -sep * 0.55;
        const halfFade = Math.max(0, 1 - Math.max(0, (p - 0.5) / 0.5));
        leftMat.opacity = halfFade;
        rightMat.opacity = halfFade;
      }

      renderer.render(scene, camera);
      if (t < 1) raf = requestAnimationFrame(tick);
      else onDoneRef.current();
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
      cardTex.dispose();
      linesTex.dispose();
      glowTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [rank, suit]);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center" aria-hidden="true">
      <div ref={flashRef} className="fixed inset-0 bg-white opacity-0 pointer-events-none" />
      <div ref={mountRef} className="w-[min(86vw,34rem)] h-[min(86vw,34rem)]" />
      {showCaption && (
        <div className="absolute inset-x-0 top-[60%] text-center animate-impact-pop">
          <span
            className="font-display font-extrabold text-5xl sm:text-7xl italic tracking-tight"
            style={{ color: "#ff3b5c", textShadow: "0 0 18px rgba(255,59,92,0.6), 3px 3px 0 rgba(0,0,0,0.55)" }}
          >
            CUT!
          </span>
        </div>
      )}
    </div>
  );
}
