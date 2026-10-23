"use client"

import { useRef } from "react"

export function ImageSlider({ urls }: { urls: string[] }): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollBy = (delta: number) => {
    const el = containerRef.current
    if (!el) return
    el.scrollBy({ left: delta, behavior: "smooth" })
  }
  if (!urls || urls.length === 0) return null
  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="flex overflow-x-auto no-scrollbar space-x-2 snap-x snap-mandatory w-full max-w-xs sm:max-w-sm"
      >
        {urls.slice(0, 4).map((url, idx) => (
          <img
            key={idx}
            src={url || "/placeholder.svg"}
            alt={`image ${idx + 1}`}
            className="snap-center shrink-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover rounded border border-gray-200 bg-white"
            onError={(e) => {
              ; (e.currentTarget as HTMLImageElement).src = "/placeholder.svg?thumb=1"
            }}
          />
        ))}
      </div>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-120)}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 border border-gray-200 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow text-sm"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollBy(120)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 border border-gray-200 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow text-sm"
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
