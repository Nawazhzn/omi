import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Suit } from "@omi/engine";
import { makeGlowTexture, makeMedallionTexture, makeSpeedLinesTexture, suitGlyph, suitInk, suitName } from "../three/suitVisual.js";

const DURATION_MS = 2300;
const RED_SUITS = new Set<Suit>(["H", "D"]);

/** A Three.js flourish with an anime kick: manga speed lines burst, a gold
    trump-suit medallion punches in with a shockwave, holds, then recedes.
    Purely decorative (pointer-events-none) and self-disposing. */
export function TrumpRevealOverlay({ suit, onDone }: { suit: Suit; onDone: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const accent = RED_SUITS.has(suit) ? "rgba(224,62,92,0.85)" : "rgba(243,215,138,0.85)";

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 6);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const keyLight = new THREE.DirectionalLight(0xfff1cf, 1.3);
    keyLight.position.set(2.5, 3.5, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xe3bd5d, 0.6);
    rimLight.position.set(-3, -1, 2);
    scene.add(rimLight);

    // --- Anime speed lines behind everything ---
    const linesTex = makeSpeedLinesTexture(accent);
    const linesMat = new THREE.MeshBasicMaterial({ map: linesTex, transparent: true, depthWrite: false, opacity: 0 });
    const speedLines = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), linesMat);
    speedLines.position.z = -1.5;
    scene.add(speedLines);

    // --- Shockwave ring that snaps out on the punch-in ---
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.65, 1.9, 64), ringMat);
    scene.add(ring);

    // --- Central impact glow ---
    const glowTex = makeGlowTexture("rgba(255,244,207,0.9)");
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowMat);
    glow.position.z = -0.5;
    scene.add(glow);

    // --- The coin: an open-ended gold rim with an upright medallion on each
    //     flat face (flat CircleGeometry keeps the suit glyph correctly upright,
    //     unlike a cylinder cap whose radial UVs skew the texture). ---
    const faceTex = makeMedallionTexture(suit);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xc99a34, metalness: 0.8, roughness: 0.3, transparent: true, side: THREE.DoubleSide });
    const faceMatFront = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.25, roughness: 0.5, transparent: true });
    const faceMatBack = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.25, roughness: 0.5, transparent: true });

    const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.28, 64, 1, true), edgeMat);
    rimMesh.rotation.x = Math.PI / 2; // axis along Z so the rim faces sideways
    const frontFace = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), faceMatFront);
    frontFace.position.z = 0.145;
    const backFace = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), faceMatBack);
    backFace.position.z = -0.145;
    backFace.rotation.y = Math.PI;

    const coin = new THREE.Group();
    coin.add(rimMesh, frontFace, backFace);
    const group = new THREE.Group();
    group.add(coin);
    scene.add(group);

    const easeOutBack = (t: number) => {
      const c1 = 2.2;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    const easeInCubic = (t: number) => t * t * t;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const coinMats = [edgeMat, faceMatFront, faceMatBack];
    const start = performance.now();
    let raf = 0;
    let flashed = false;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);

      // Speed lines: spin steadily, brighten during the hold.
      speedLines.rotation.z = t * 1.4;
      linesMat.opacity = t < 0.5 ? easeOutCubic(t / 0.5) * 0.7 : Math.max(0, 0.7 - (t - 0.5) / 0.5);

      if (t < 0.4) {
        // Punch-in: spin + scale overshoot.
        const p = t / 0.4;
        group.rotation.y = -Math.PI * 3.5 * (1 - easeOutBack(p));
        group.scale.setScalar(Math.max(0.001, 1.15 * easeOutBack(p)));
        coinMats.forEach((m) => (m.opacity = Math.min(1, p * 1.8)));
        // Shockwave + glow snap at the landing instant.
        if (p > 0.72) {
          const q = (p - 0.72) / 0.28;
          ring.scale.setScalar(1 + q * 1.6);
          ringMat.opacity = (1 - q) * 0.9;
          glowMat.opacity = (1 - q) * 0.8;
          if (!flashed && flashRef.current) {
            flashed = true;
            flashRef.current.style.animation = "screen-flash 320ms ease-out";
          }
        }
      } else if (t < 0.72) {
        // Hold with a gentle bob.
        const p = (t - 0.4) / 0.32;
        group.rotation.y = Math.sin(p * Math.PI * 2) * 0.12;
        group.scale.setScalar(1.15 + Math.sin(p * Math.PI) * 0.04);
        coinMats.forEach((m) => (m.opacity = 1));
        ringMat.opacity = 0;
        glowMat.opacity = 0.12 + Math.sin(p * Math.PI) * 0.1;
      } else {
        // Recede + fade.
        const p = (t - 0.72) / 0.28;
        group.rotation.y = -easeInCubic(p) * Math.PI * 1.5;
        group.scale.setScalar(1.15 + easeInCubic(p) * 0.9);
        coinMats.forEach((m) => (m.opacity = 1 - easeInCubic(p)));
        glowMat.opacity = (1 - p) * 0.12;
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
      faceTex.dispose();
      linesTex.dispose();
      glowTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [suit]);

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-center animate-round-intro"
      style={{ background: "radial-gradient(ellipse at center, rgba(3,15,11,0.6) 0%, rgba(3,15,11,0.2) 45%, rgba(3,15,11,0) 72%)" }}
      aria-hidden="true"
    >
      <div ref={flashRef} className="fixed inset-0 bg-white opacity-0 pointer-events-none" />
      <div ref={mountRef} className="w-[min(78vw,30rem)] h-[min(78vw,30rem)]" />
      <div className="-mt-6 text-center">
        <div className="text-gold-300/80 text-xs sm:text-sm font-semibold uppercase tracking-[0.4em]">Trump is</div>
        <div className="mt-1 text-3xl sm:text-4xl font-display font-semibold" style={{ color: RED_SUITS.has(suit) ? "#e39ab0" : "#f4ecd8" }}>
          {suitGlyph(suit)} {suitName(suit)}
        </div>
      </div>
    </div>
  );
}
