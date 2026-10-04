"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, Images, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

// Stable filenames let us replace the broker photos with the originals later.
// Keep the full frame visible, including the photographer's watermark.
const photos = [
  { id: "office", src: "/spaces/aufeld21-buero.webp", title: "Helles Büro", alt: "Helles Büro im AUFELD21 mit zwei Schreibtischen und großen Fenstern", height: 799 },
  { id: "meeting", src: "/spaces/aufeld21-meetingraum.webp", title: "Unser Meetingraum", alt: "Meetingraum im AUFELD21 mit Besprechungstisch, Bildschirm und Flipchart", height: 800 },
  { id: "hallway", src: "/spaces/aufeld21-einblicke.webp", title: "Einblicke in den Space", alt: "Heller Flur im AUFELD21 mit Pflanze und Blick in die angrenzenden Räume", height: 800 },
  { id: "office-detail", src: "/spaces/aufeld21-buero-weitere-ansicht.webp", title: "Büro · weitere Ansicht", alt: "Weitere Perspektive auf ein möbliertes Büro im AUFELD21", height: 800 },
  { id: "meeting-detail", src: "/spaces/aufeld21-meetingraum-weitere-ansicht.webp", title: "Meetingraum · weitere Ansicht", alt: "Weitere Ansicht des AUFELD21-Meetingraums mit Tisch und Bildschirm", height: 799 },
] as const;

type SpacePhotoProps = {
  photo: "office" | "meeting" | "hallway";
  sizes: string;
  priority?: boolean;
  caption?: boolean;
  className?: string;
};

export function SpacePhoto({ photo, sizes, priority = false, caption = false, className = "" }: SpacePhotoProps) {
  const initialIndex = photos.findIndex((item) => item.id === photo);
  const preview = photos[initialIndex];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const active = activeIndex === null ? null : photos[activeIndex];
  const isOpen = activeIndex !== null;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  function move(direction: number) {
    setActiveIndex((current) => current === null ? null : (current + direction + photos.length) % photos.length);
  }

  function openGallery() {
    setActiveIndex(initialIndex);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <figure className={className}>
        <button type="button" onClick={openGallery} aria-label={`Foto vergrößern: ${preview.title}`} aria-haspopup="dialog"
          className="group relative block w-full overflow-hidden rounded-[inherit] bg-stone-100 text-[#162119] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-emerald-700">
          <Image src={preview.src} alt={preview.alt} width={1200} height={preview.height} sizes={sizes} preload={priority} className="block h-auto w-full" />
          <span aria-hidden="true" className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/90 shadow-sm transition group-hover:bg-[#c9ff70]">
            <Expand size={18} />
          </span>
        </button>
        {caption && <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 text-sm text-[#162119]">
          <span className="font-semibold">{preview.title}</span>
          <button type="button" onClick={openGallery} aria-haspopup="dialog" className="flex min-h-11 items-center gap-2 font-semibold text-emerald-800 underline-offset-4 hover:underline">
            <Images size={17} aria-hidden="true" /> Alle {photos.length} Fotos ansehen
          </button>
        </figcaption>}
      </figure>

      <dialog ref={dialogRef} aria-labelledby={titleId} onClose={() => setActiveIndex(null)}
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        className="fixed inset-0 m-auto max-h-[94dvh] w-[94vw] max-w-6xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-[#162119] shadow-2xl backdrop:bg-[#0b120e]/85 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">AUFELD21 · Raumeinblicke</p>
            <h2 id={titleId} className="mt-1 text-base font-semibold sm:text-xl">{active?.title ?? "Unsere Räume"}</h2>
          </div>
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label="Fotogalerie schließen" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-stone-200 hover:bg-stone-100">
            <X size={22} />
          </button>
        </div>
        {active && <div className="flex justify-center bg-stone-100">
          <Image src={active.src} alt={active.alt} width={1200} height={active.height} sizes="(max-width: 768px) 94vw, 1152px" className="h-auto max-h-[calc(94dvh-12rem)] w-full object-contain" />
        </div>}
        <div className="px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => move(-1)} aria-label="Vorheriges Foto" className="grid h-12 w-12 place-items-center rounded-full border border-stone-200 hover:bg-emerald-50"><ChevronLeft size={22} /></button>
            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-semibold">Foto {activeIndex === null ? 1 : activeIndex + 1} von {photos.length}</p>
            <button type="button" onClick={() => move(1)} aria-label="Nächstes Foto" className="grid h-12 w-12 place-items-center rounded-full border border-stone-200 hover:bg-emerald-50"><ChevronRight size={22} /></button>
          </div>
          <p className="mt-2 text-center text-xs text-stone-500">Fotos: Reisinger Immobilien</p>
        </div>
      </dialog>
    </>
  );
}
