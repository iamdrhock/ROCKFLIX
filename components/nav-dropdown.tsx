"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

interface NavDropdownProps {
  label: string
  items: { label: string; url: string }[]
  columns?: number
}

export function NavDropdown({ label, items, columns = 4 }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[600px] max-h-[400px] overflow-y-auto">
          <div
            className="grid gap-2 p-4"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {items.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                onClick={() => setIsOpen(false)}
                className="text-sm hover:text-primary transition-colors py-1 px-2 rounded hover:bg-muted"
              >
                ▸ {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
