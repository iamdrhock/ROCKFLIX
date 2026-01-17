"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

interface MobileNavSectionProps {
  label: string
  items: { label: string; url: string }[]
  columns?: number
  onItemClick?: () => void
}

export function MobileNavSection({ label, items, columns = 2, onItemClick }: MobileNavSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-border pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-xl font-bold py-3 text-foreground hover:text-primary"
      >
        <span>{label}</span>
        <ChevronDown className={`h-6 w-6 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="grid gap-3 mt-4 pl-2"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              onClick={onItemClick}
              className="text-base font-medium text-foreground hover:text-primary transition-colors py-2 px-2 rounded hover:bg-accent"
            >
              ▸ {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
