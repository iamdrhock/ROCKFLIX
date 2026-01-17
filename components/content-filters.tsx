"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ContentFiltersProps {
  onFilterChange: (filters: FilterState) => void
  genres: string[]
  countries: string[]
  years: number[]
  initialFilters?: FilterState
}

export interface FilterState {
  genre: string | null
  country: string | null
  year: number | null
}

export function ContentFilters({ onFilterChange, genres, countries, years, initialFilters }: ContentFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(
    initialFilters || {
      genre: null,
      country: null,
      year: null,
    }
  )
  
  // Track if component has mounted to avoid calling onFilterChange on initial mount
  const [isMounted, setIsMounted] = useState(false)
  const previousFiltersRef = useRef<FilterState>(filters)

  // Sync filters when initialFilters change (from URL)
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters)
      previousFiltersRef.current = initialFilters
    }
    setIsMounted(true)
  }, [initialFilters])

  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    // Only call onFilterChange after mount and when filters actually change from user interaction
    if (!isMounted) return
    
    // Check if filters actually changed
    const hasChanged =
      previousFiltersRef.current.genre !== filters.genre ||
      previousFiltersRef.current.country !== filters.country ||
      previousFiltersRef.current.year !== filters.year
    
    if (hasChanged) {
      previousFiltersRef.current = filters
      onFilterChange(filters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isMounted]) // Only depend on filters and isMounted, not onFilterChange

  const handleGenreChange = (genre: string) => {
    setFilters((prev) => ({
      ...prev,
      genre: prev.genre === genre ? null : genre,
    }))
  }

  const handleCountryChange = (country: string) => {
    setFilters((prev) => ({
      ...prev,
      country: prev.country === country ? null : country,
    }))
  }

  const handleYearChange = (year: number) => {
    setFilters((prev) => ({
      ...prev,
      year: prev.year === year ? null : year,
    }))
  }

  const clearFilters = () => {
    setFilters({
      genre: null,
      country: null,
      year: null,
    })
  }

  const hasActiveFilters = filters.genre || filters.country || filters.year

  return (
    <div className="mb-6">
      {/* Mobile Filter Toggle */}
      <div className="md:hidden mb-4">
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="w-full justify-start gap-2">
          <Filter className="h-4 w-4" />
          Filter
          <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Filter Bar */}
      <div className={`flex flex-wrap gap-3 ${showFilters ? "block" : "hidden md:flex"}`}>
        {/* Genre Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              {filters.genre || "Genre"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-[400px] overflow-y-auto">
            {genres.map((genre) => (
              <DropdownMenuCheckboxItem
                key={genre}
                checked={filters.genre === genre}
                onCheckedChange={() => handleGenreChange(genre)}
              >
                {genre}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Year Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              {filters.year || "Year"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-[400px] overflow-y-auto">
            {years.map((year) => (
              <DropdownMenuCheckboxItem
                key={year}
                checked={filters.year === year}
                onCheckedChange={() => handleYearChange(year)}
              >
                {year}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Country Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              {filters.country || "Country"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-[400px] overflow-y-auto">
            {countries.map((country) => (
              <DropdownMenuCheckboxItem
                key={country}
                checked={filters.country === country}
                onCheckedChange={() => handleCountryChange(country)}
              >
                {country}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button variant="secondary" onClick={clearFilters} className="gap-2">
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  )
}
