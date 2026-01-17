"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MovieCard } from "@/components/movie-card"
import { ContentFilters, type FilterState } from "@/components/content-filters"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination"
import type { Movie } from "@/lib/api"

interface MoviesClientProps {
  initialMovies: Movie[]
  total: number
  totalPages: number
  currentPage: number
  genres: string[]
  countries: string[]
  years: number[]
}

export function MoviesClient({
  initialMovies,
  total,
  totalPages,
  currentPage,
  genres,
  countries,
  years,
}: MoviesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<FilterState>(() => {
    const genre = searchParams.get("genre") || null
    const country = searchParams.get("country") || null
    const yearParam = searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : null
    return { genre, country, year }
  })

  // Sync filters with URL params when they change
  useEffect(() => {
    const genre = searchParams.get("genre") || null
    const country = searchParams.get("country") || null
    const yearParam = searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : null
    
    // Only update if values actually changed to prevent unnecessary re-renders
    setFilters(prevFilters => {
      if (prevFilters.genre === genre && prevFilters.country === country && prevFilters.year === year) {
        return prevFilters // No change, return previous state
      }
      return { genre, country, year }
    })
  }, [searchParams])

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    // Build URL with filters and reset to page 1
    const params = new URLSearchParams()
    params.set("page", "1")
    if (newFilters.genre) params.set("genre", newFilters.genre)
    if (newFilters.country) params.set("country", newFilters.country)
    if (newFilters.year) params.set("year", newFilters.year.toString())
    
    // Use hard navigation to ensure server component re-renders
    window.location.href = `/movies?${params.toString()}`
  }, [])

  const handlePageChange = useCallback((page: number) => {
    if (page === currentPage) return // Don't navigate if already on that page
    const params = new URLSearchParams()
    params.set("page", page.toString())
    // Preserve filters in URL
    if (filters.genre) params.set("genre", filters.genre)
    if (filters.country) params.set("country", filters.country)
    if (filters.year) params.set("year", filters.year.toString())
    
    // Use hard navigation to ensure server component re-renders
    window.location.href = `/movies?${params.toString()}`
  }, [currentPage, filters])

  // Generate page numbers for pagination
  const getPageNumbers = useCallback(() => {
    const pages: (number | "ellipsis")[] = []
    const maxVisible = 7

    if (totalPages <= maxVisible) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push("ellipsis")
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis")
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }, [currentPage, totalPages])

  return (
    <>
      <ContentFilters onFilterChange={handleFilterChange} genres={genres} countries={countries} years={years} initialFilters={filters} />

      {initialMovies.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            {initialMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={`/movies?page=${currentPage > 1 ? currentPage - 1 : 1}`}
                    onClick={(e) => {
                      e.preventDefault()
                      if (currentPage > 1) {
                        handlePageChange(currentPage - 1)
                      }
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>

                {getPageNumbers().map((page, index) => {
                  if (page === "ellipsis") {
                    return (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  }

                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href={`/movies?page=${page}`}
                        onClick={(e) => {
                          e.preventDefault()
                          handlePageChange(page)
                        }}
                        isActive={currentPage === page}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

                <PaginationItem>
                  <PaginationNext
                    href={`/movies?page=${currentPage < totalPages ? currentPage + 1 : totalPages}`}
                    onClick={(e) => {
                      e.preventDefault()
                      if (currentPage < totalPages) {
                        handlePageChange(currentPage + 1)
                      }
                    }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No movies found matching your filters.</p>
        </div>
      )}
    </>
  )
}
