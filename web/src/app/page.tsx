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
    const isSmall = viewport.w <= 640;
    const maxHeightAllowed = Math.max(0, viewport.h * (isSmall ? 0.46 : 0.5));
    const maxWidthAllowed = Math.max(0, viewport.w * (isSmall ? 0.92 : 0.9));
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

  // When exactly three cards are selected, automatically show the modal
  useEffect(() => {
    if (gameState === "selecting" && selected.length === 3) {
      setGameState("revealed");
      setShowModal(true);
    }
  }, [selected, gameState]);

  const cards = useMemo(() => Array.from({ length: 9 }, (_, i) => i), []);

  function handleSelect(index: number) {
    if (gameState !== "selecting") return;
    setSelected((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 3) return prev;
      return [...prev, index];
    });
  }

  // While selecting, immediately assign random content to selected cards.
  // Preserve prior assignments for still-selected cards, and aim for unique
  // types across up to three selections. Uses a functional state update to
  // avoid dependency loops and unnecessary renders.
  useEffect(() => {
    if (gameState !== "selecting") return;
    setRevealedMap((prev) => {
      const allTypes: ContentType[] = ["image", "text", "feature"];
      const nextMap: Record<number, RevealedItem | null> = {};

      // Keep previous assignments for still-selected indices
      const assignedTypes = new Set<ContentType>();
      for (const idx of selected) {
        const existing = prev[idx];
        if (existing) {
          nextMap[idx] = existing;
          assignedTypes.add(existing.type);
        }
      }

      // Determine remaining types to assign uniquely
      const remainingTypes = allTypes.filter((t) => !assignedTypes.has(t));

      function assignValueByType(t: ContentType): RevealedItem {
        if (t === "image") {
          const img = chooseRandom(images) ?? "/images/image%20693.png";
          return { type: "image", value: img };
        }
        if (t === "text") {
          const prompt = chooseRandom(prompts) ?? "Imagine a world where...";
          return { type: "text", value: prompt };
        }
        const feature = chooseRandom(features) ?? "Offline-first sync";
        return { type: "feature", value: feature };
      }

      // Assign for any selected index that doesn't yet have content
      for (const idx of selected) {
        if (nextMap[idx]) continue;
        const t = remainingTypes.length > 0 ? remainingTypes.shift()! : shuffle(allTypes)[0];
        nextMap[idx] = assignValueByType(t);
      }

      // If nothing changed, return previous to avoid re-render storm
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextMap);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((k) => {
          const a = prev[Number(k)];
          const b = nextMap[Number(k)];
          return a?.type === b?.type && a?.value === b?.value;
        })
      ) {
        return prev;
      }
      return nextMap;
    });
  }, [selected, images, prompts, features, gameState]);

  // Reveal is now automatic after three selections

  function handleReset() {
    setSelected([]);
    setRevealedMap({});
    setGameState("selecting");
    setShowModal(false);
  }

  async function captureCardImageBlob(): Promise<Blob | null> {
    if (!modalCaptureRef.current) return null;
    try {
      const dataUrl = await toPng(modalCaptureRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#000000",
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch {
      return null;
    }
  }

  async function uploadImageAndGetUrl(blob: Blob): Promise<string | null> {
    try {
      const form = new FormData();
      form.append("file", blob, "card.png");
      const r = await fetch("/api/upload", { method: "POST", body: form });
      if (!r.ok) return null;
      const data = await r.json();
      return typeof data.url === "string" ? data.url : null;
    } catch {
      return null;
    }
  }

  async function shareImageWithText(platform: "x" | "facebook" | "telegram") {
    const shareText = "Getting inspired using the prompt generator, try it out and use the prompts on daisy.so";
    const blob = await captureCardImageBlob();

    // Upload to get a public URL for consistent sharing
    let imageUrl: string | null = null;
    if (blob) {
      imageUrl = await uploadImageAndGetUrl(blob);
    }

    // Use a dedicated share page with OG tags for reliable previews
    const base = window.location.origin;
    const sharePage = imageUrl ? `${base}/share/${encodeURIComponent(imageUrl)}` : "https://app.daisy.so/create";
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(sharePage);

    let url = "";
    if (platform === "x") {
      url = `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    } else if (platform === "facebook") {
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    } else {
      // Telegram: include the link inside the text for better reliability
      const fullText = encodeURIComponent(`${shareText} ${sharePage}`);
      url = `https://t.me/share/url?text=${fullText}`;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Button label no longer used (auto reveal)

  const gradientBackBase = "bg-[#2B7FFF]";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 pb-40">
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
                  "hover:ring-4 hover:ring-[#FF3B30] hover:shadow-[0_0_60px_rgba(255,59,48,0.5)]",
                  isSelected && "ring-4 ring-[#FF3B30] shadow-[0_0_90px_rgba(255,59,48,0.9)]",
                )}
                style={{ width: cardWidthPx, height: Math.floor(cardWidthPx * 1.5) }}
                disabled={gameState !== "selecting"}
              >
                <div className="absolute inset-0 [perspective:1000px]">
                  <motion.div
                    className="w-full h-full"
                    animate={{ rotateY: (revealed || isSelected) ? 180 : 0 }}
                    transition={{ duration: 0.42 }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      className={clsx(
                        "absolute inset-0 backface-hidden",
                        gradientBackBase,
                        "flex items-center justify-center",
                      )}
                    >
                      <img
                        src="/logo/daisylogo.svg"
                        alt="Logo"
                        className="w-1/2 max-w-[160px] opacity-90 drop-shadow brightness-0 invert"
                      />
                    </div>
                    <div
                      className={clsx(
                        "absolute inset-0 backface-hidden rotate-y-180",
                        "bg-black/5 dark:bg-white/5 flex items-center justify-center p-3",
                      )}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {!revealed && isSelected && (
                          <motion.div
                            key="selected"
                            className="text-center text-xs sm:text-sm px-2"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.18 }}
                          >
                            <span className="inline-block rounded-full bg-[#FF3B30] text-white px-3 py-1 border border-white/20">
                              Selected
                            </span>
                          </motion.div>
                        )}
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

        {/* Bottom action: only show Again when revealed and modal closed */}
        {gameState === "revealed" && !showModal && (
          <div style={{ width: gridWidthPx }} className="mt-2 mb-24 sm:mb-28">
            <button
              onClick={handleReset}
              className="w-full py-4 rounded-2xl text-lg font-medium bg-[#2B7FFF] text-white hover:opacity-90 shadow-lg shadow-[0_0_40px_rgba(43,127,255,0.3)] active:translate-y-[1px]"
            >
              Again
            </button>
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
              className="relative z-10 w-[95%] max-w-3xl max-h-[92vh] overflow-hidden rounded-xl bg-black/80 dark:bg-black/80 border border-white/10 p-2 sm:p-3 shadow-xl"
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
                  <div
                    ref={modalCaptureRef}
                    className="w-full flex flex-col items-center rounded-2xl border border-white/30 md:border-[3px] bg-black/20 p-2 sm:p-4"
                  >
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

                    <div className="mt-2 sm:mt-3 w-full flex flex-col items-center gap-2 sm:gap-2.5">
                      {feature && (
                        <a
                          href="https://app.daisy.so/create"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded-full bg-[#2B7FFF] text-white px-4 py-2 text-sm sm:text-base md:text-lg border border-white/10 shadow-md hover:opacity-90"
                        >
                          {feature.value}
                        </a>
                      )}

                      {prompt && (
                        <div className="w-full max-w-xl text-center text-base sm:text-xl md:text-2xl leading-snug text-white/95 border border-white/30 md:border-[3px] bg-white/10/50 rounded-xl px-3 py-2 sm:px-4 sm:py-3">
                          {prompt.value}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 sm:mt-3 w-full flex flex-row items-center justify-center gap-2 sm:gap-3">
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
                        className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium bg-[#2B7FFF] text-white hover:opacity-90 shadow-lg shadow-[0_0_40px_rgba(43,127,255,0.3)] active:translate-y-[1px]"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium bg-neutral-600 text-white hover:bg-neutral-500 shadow-lg shadow-black/30 active:translate-y-[1px]"
                      >
                        Again
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 sm:mt-4 w-full max-w-xl mx-auto pb-2">
                <div className="text-white/90 font-semibold mb-2 text-center">Quick share:</div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    onClick={() => shareImageWithText("x")}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-black text-white border border-white/10 hover:opacity-90 text-sm sm:text-base"
                  >
                    X
                  </button>
                  <button
                    onClick={() => shareImageWithText("facebook")}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[#1877F2] text-white border border-white/10 hover:opacity-90 text-sm sm:text-base"
                  >
                    Facebook
                  </button>
                  <button
                    onClick={() => shareImageWithText("telegram")}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[#229ED9] text-white border border-white/10 hover:opacity-90 text-sm sm:text-base"
                  >
                    Telegram
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
