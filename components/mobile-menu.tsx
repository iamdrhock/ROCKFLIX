"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileNavSection } from "@/components/mobile-nav-section"
import { GENRES, COUNTRIES } from "@/lib/navigation-data"

interface MenuItem {
  label: string
  url: string
}

interface MobileMenuProps {
  menuItems: MenuItem[]
}

export function MobileMenu({ menuItems }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleToggle = () => {
    const newState = !isOpen
    console.log("[v0] Mobile menu toggled:", newState)
    console.log("[v0] Menu items count:", menuItems?.length || 0)
    setIsOpen(newState)
  }

  const handleClose = () => {
    console.log("[v0] Mobile menu closed")
    setIsOpen(false)
  }

  return (
    <>
      {/* Hamburger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className="text-foreground hover:text-primary"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-background">
          {/* Header spacer to account for fixed header */}
          <div className="h-20" />

          {/* Scrollable menu content */}
          <div className="h-[calc(100vh-5rem)] overflow-y-auto">
            <nav className="container px-6 py-6">
              <div className="flex flex-col gap-6">
                {/* Main Menu Items */}
                {menuItems && menuItems.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {menuItems.map((item) => (
                      <Link
                        key={item.url}
                        href={item.url}
                        onClick={handleClose}
                        className="text-xl font-bold text-foreground hover:text-primary transition-colors py-4 px-4 rounded-lg hover:bg-accent border-b border-border"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-4">No menu items available</div>
                )}

                {/* Genre Section */}
                <div className="pt-4">
                  <MobileNavSection label="Genre" items={GENRES} columns={2} onItemClick={handleClose} />
                </div>

                {/* Country Section */}
                <div className="pt-4">
                  <MobileNavSection label="Country" items={COUNTRIES} columns={2} onItemClick={handleClose} />
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
