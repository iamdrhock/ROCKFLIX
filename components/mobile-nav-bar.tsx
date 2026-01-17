"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { GENRES, COUNTRIES } from "@/lib/navigation-data"

interface MenuItem {
  label: string
  url: string
}

interface MobileNavBarProps {
  menuItems: MenuItem[]
}

export function MobileNavBar({ menuItems }: MobileNavBarProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="bg-background relative">
      {/* Main navigation - horizontal scroll */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 px-4 py-2 min-w-max">
          {menuItems.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className="px-3 py-1.5 text-sm font-medium whitespace-nowrap hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}

          {/* Genre dropdown button */}
          <button
            onClick={() => toggleSection("genre")}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium whitespace-nowrap hover:text-primary transition-colors"
          >
            Genre
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expandedSection === "genre" ? "rotate-180" : ""}`}
            />
          </button>

          {/* Country dropdown button */}
          <button
            onClick={() => toggleSection("country")}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium whitespace-nowrap hover:text-primary transition-colors"
          >
            Country
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expandedSection === "country" ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Expandable sections */}
      {expandedSection === "genre" && (
        <div className="border-t border-border/40 bg-background/95 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 p-4">
            {GENRES.map((genre) => (
              <Link
                key={genre.url}
                href={genre.url}
                onClick={() => setExpandedSection(null)}
                className="text-sm py-2 px-3 rounded hover:bg-accent transition-colors"
              >
                {genre.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {expandedSection === "country" && (
        <div className="border-t border-border/40 bg-background/95 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 p-4">
            {COUNTRIES.map((country) => (
              <Link
                key={country.url}
                href={country.url}
                onClick={() => setExpandedSection(null)}
                className="text-sm py-2 px-3 rounded hover:bg-accent transition-colors"
              >
                {country.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
