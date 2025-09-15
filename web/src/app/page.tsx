"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "classnames";

type ContentType = "image" | "text" | "feature";

type RevealedItem =
  | { type: "image"; value: string }
  | { type: "text"; value: string }
  | { type: "feature"; value: string };

type GameState = "selecting" | "revealed" | "reset";

function useAssets() {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadAll() {
      try {
        const [p, f, i] = await Promise.all([
          fetch("/api/prompts").then((r) => r.json()),
          fetch("/api/features").then((r) => r.json()),
          fetch("/api/images").then((r) => r.json()),
        ]);
        if (!isMounted) return;
        setPrompts(p.prompts ?? []);
        setFeatures(f.features ?? []);
        setImages(i.images ?? []);
      } catch (e) {
        // ignore
      }
    }
    loadAll();
    return () => {
      isMounted = false;
    };
  }, []);

  return { prompts, features, images };
}

function chooseRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(list: T[]): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Home() {
  const { prompts, features, images } = useAssets();
  const [selected, setSelected] = useState<number[]>([]);
  const [gameState, setGameState] = useState<GameState>("selecting");
  const [revealedMap, setRevealedMap] = useState<Record<number, RevealedItem | null>>({});
  const [showModal, setShowModal] = useState(false);
  const [modalNaturalSize, setModalNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const modalCaptureRef = useRef<HTMLDivElement | null>(null);

  // Force dark mode by default
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("dark");
  }, []);

  // Card sizing responsive to viewport with user scale
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const gapPx = 16; // spacing between cards
  const controlsOverheadPx = 150; // rough space for controls paddings
  const cardWidthPx = useMemo(() => {
    if (!viewport.w || !viewport.h) return 120;
    const columns = 3;
    const rows = 3;
    const availableWidth = Math.max(0, viewport.w - 2 * 24); // page padding
    const availableHeight = Math.max(0, viewport.h - controlsOverheadPx);
    const maxFromWidth = (availableWidth - (columns - 1) * gapPx) / columns;
    const maxFromHeight = ((availableHeight - (rows - 1) * gapPx) / rows) * (2 / 3);
    const base = Math.min(maxFromWidth, maxFromHeight);
    return Math.max(90, Math.floor(base));
  }, [viewport.w, viewport.h]);
  const gridWidthPx = useMemo(() => 3 * cardWidthPx + 2 * gapPx, [cardWidthPx]);
  const modalImageDisplaySize = useMemo(() => {
    const maxHeightAllowed = Math.max(0, viewport.h * 0.75);
    const maxWidthAllowed = Math.max(0, viewport.w * 0.95);
    const widthLimitByViewport = Math.min(maxWidthAllowed, maxHeightAllowed * (2 / 3));
    if (modalNaturalSize.w > 0 && modalNaturalSize.h > 0) {
      const widthNoUpscale = Math.min(modalNaturalSize.w, modalNaturalSize.h * (2 / 3));
      const displayW = Math.floor(Math.max(120, Math.min(widthLimitByViewport, widthNoUpscale)));
      const displayH = Math.floor(displayW * 1.5);
      return { w: displayW, h: displayH };
    }
    const fallbackW = Math.floor(Math.max(200, widthLimitByViewport));
    return { w: fallbackW, h: Math.floor(fallbackW * 1.5) };
  }, [viewport.w, viewport.h, modalNaturalSize.w, modalNaturalSize.h]);

  const canReveal = selected.length === 3 && gameState === "selecting";

  const cards = useMemo(() => Array.from({ length: 9 }, (_, i) => i), []);

  function handleSelect(index: number) {
    if (gameState !== "selecting") return;
    setSelected((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 3) return prev;
      return [...prev, index];
    });
  }

  function handleReveal() {
    if (!canReveal) return;
    // Generate exactly one image, one text, one feature in random positions
    const newMap: Record<number, RevealedItem | null> = {};
    const indices = shuffle(selected);
    const typeOrder: ContentType[] = shuffle(["image", "text", "feature"]);
    for (let k = 0; k < indices.length; k += 1) {
      const idx = indices[k];
      const t = typeOrder[k];
      if (t === "image") {
        const img = chooseRandom(images) ?? "/images/image%20693.png";
        newMap[idx] = { type: "image", value: img };
      } else if (t === "text") {
        const prompt = chooseRandom(prompts) ?? "Imagine a world where...";
        newMap[idx] = { type: "text", value: prompt };
      } else {
        const feature = chooseRandom(features) ?? "Offline-first sync";
        newMap[idx] = { type: "feature", value: feature };
      }
    }
    setRevealedMap(newMap);
    setGameState("revealed");
    setShowModal(true);
  }

  function handleReset() {
    setSelected([]);
    setRevealedMap({});
    setGameState("selecting");
    setShowModal(false);
  }

  function buttonLabel(): string {
    if (gameState === "revealed") return "Again";
    const remaining = 3 - selected.length;
    if (remaining === 3) return "Choose 3";
    if (remaining === 2) return "Choose 2";
    if (remaining === 1) return "Choose 1";
    return "Reveal";
  }

  const gradientBackBase = "bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600";
  const gradientBackSelected = "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-4">

        <div className="grid" style={{ gap: `${gapPx}px`, gridTemplateColumns: `repeat(3, ${cardWidthPx}px)` }}>
          {cards.map((idx) => {
            const isSelected = selected.includes(idx);
            const revealed = revealedMap[idx];
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05, transition: { duration: 0.1 } }}
                whileTap={{ scale: 0.95, transition: { duration: 0.08 } }}
                onClick={() => handleSelect(idx)}
                className={clsx(
                  "relative rounded-xl overflow-hidden border",
                  "border-black/10 dark:border-white/10",
                  "transition-shadow",
                  "hover:ring-4 hover:ring-fuchsia-400 hover:shadow-[0_0_60px_rgba(232,121,249,0.5)]",
                  isSelected && "ring-4 ring-fuchsia-400 shadow-[0_0_90px_rgba(232,121,249,0.9)]",
                )}
                style={{ width: cardWidthPx, height: Math.floor(cardWidthPx * 1.5) }}
                disabled={gameState !== "selecting"}
              >
                <div className="absolute inset-0 [perspective:1000px]">
                  <motion.div
                    className="w-full h-full"
                    animate={{ rotateY: revealed ? 180 : 0 }}
                    transition={{ duration: 0.42 }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      className={clsx(
                        "absolute inset-0 backface-hidden",
                        isSelected ? gradientBackSelected : gradientBackBase,
                        "flex items-center justify-center",
                      )}
                    >
                      <img
                        src="/logo/daisylogo.svg"
                        alt="Logo"
                        className="w-1/2 max-w-[160px] opacity-90 drop-shadow"
                      />
                    </div>
                    <div
                      className={clsx(
                        "absolute inset-0 backface-hidden rotate-y-180",
                        "bg-black/5 dark:bg-white/5 flex items-center justify-center p-3",
                      )}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {revealed && revealed.type === "image" && (
                          <motion.img
                            key="img"
                            src={revealed.value}
                            alt="Revealed"
                            className="w-full h-full object-cover"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                          />
                        )}
                        {revealed && revealed.type === "text" && (
                          <motion.div
                            key="text"
                            className="text-center text-sm sm:text-base px-2"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.18 }}
                          >
                            {revealed.value}
                          </motion.div>
                        )}
                        {revealed && revealed.type === "feature" && (
                          <motion.div
                            key="feature"
                            className="text-center text-xs sm:text-sm px-2"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.18 }}
                          >
                            <span className="inline-block rounded-full bg-fuchsia-500/15 text-fuchsia-300 px-2 py-1 border border-fuchsia-400/30">
                              Feature
                            </span>
                            <div className="mt-2 text-foreground/80">{revealed.value}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Bottom action: wide reveal/again button */}
        {(gameState === "selecting" || (gameState === "revealed" && !showModal)) && (
          <div style={{ width: gridWidthPx }} className="mt-2">
            {gameState === "selecting" ? (
              <button
                disabled={!canReveal}
                onClick={handleReveal}
                className={clsx(
                  "w-full py-4 rounded-2xl text-lg font-medium shadow-lg active:translate-y-[1px]",
                  canReveal
                    ? "bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-fuchsia-500/30"
                    : "bg-fuchsia-600/50 text-white/70 cursor-not-allowed",
                )}
              >
                {canReveal ? "Reveal" : (() => {
                  const remaining = 3 - selected.length;
                  if (remaining === 3) return "Choose 3";
                  if (remaining === 2) return "Choose 2";
                  if (remaining === 1) return "Choose 1";
                  return "Reveal";
                })()}
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="w-full py-4 rounded-2xl text-lg font-medium bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black hover:opacity-90 shadow-lg shadow-black/30 active:translate-y-[1px]"
              >
                Again
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && gameState === "revealed" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div
              className="relative z-10 w-[95%] max-w-3xl rounded-xl bg-black/80 dark:bg-black/80 border border-white/10 p-2 sm:p-3 shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              {(() => {
                const items = selected.map((i) => revealedMap[i]).filter(Boolean) as RevealedItem[];
                const img = items.find((x) => x.type === "image");
                const prompt = items.find((x) => x.type === "text");
                const feature = items.find((x) => x.type === "feature");
                return (
                  <div ref={modalCaptureRef} className="w-full flex flex-col items-center">
                    <div
                      className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
                      style={{ width: modalImageDisplaySize.w, height: modalImageDisplaySize.h, maxWidth: "100%" }}
                    >
                      {img ? (
                        <img
                          src={img.value}
                          alt="Selected"
                          className="w-full h-full object-contain"
                          onLoad={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            setModalNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700" />
                      )}
                    </div>

                    {feature && (
                      <div className="mt-3 text-center">
                        <span className="inline-block rounded-full bg-fuchsia-600 text-white px-4 py-2 text-sm sm:text-base md:text-lg border border-white/10">
                          {feature.value}
                        </span>
                      </div>
                    )}

                    {prompt && (
                      <div className="mt-3 max-w-2xl text-center text-lg sm:text-xl md:text-2xl leading-snug text-white/95">
                        {prompt.value}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="mt-4 sm:mt-5 flex flex-col items-center gap-3">
                <button
                  onClick={async () => {
                    if (!modalCaptureRef.current) return;
                    try {
                      const dataUrl = await toPng(modalCaptureRef.current, {
                        cacheBust: true,
                        pixelRatio: 2,
                        backgroundColor: "#000000",
                      });
                      const link = document.createElement("a");
                      link.download = "card-reveal.png";
                      link.href = dataUrl;
                      link.click();
                    } catch (e) {
                      // noop
                    }
                  }}
                  className="px-6 py-3 rounded-lg text-base font-medium bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/30 active:translate-y-[1px]"
                >
                  Save Image
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-4 rounded-xl text-base font-medium bg-neutral-100/10 text-white hover:bg-neutral-100/20 border border-white/20 shadow-lg shadow-black/30 active:translate-y-[1px]"
                >
                  Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
