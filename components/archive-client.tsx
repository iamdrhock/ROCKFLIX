"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MovieCard } from "@/components/movie-card"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination"
import type { Movie } from "@/lib/api"

interface ArchiveClientProps {
  movies: Movie[]
  total: number
  totalPages: number
  currentPage: number
  basePath: string
}

export function ArchiveClient({
  movies,
  total,
  totalPages,
  currentPage,
  basePath,
}: ArchiveClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = useCallback((page: number) => {
    if (page === currentPage) return // Don't navigate if already on that page
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    router.replace(`${basePath}?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [router, searchParams, currentPage, basePath])

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
      {movies.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={`${basePath}?page=${currentPage > 1 ? currentPage - 1 : 1}`}
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
                        href={`${basePath}?page=${page}`}
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
                    href={`${basePath}?page=${currentPage < totalPages ? currentPage + 1 : totalPages}`}
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
          <p className="text-muted-foreground">No movies or TV shows found.</p>
        </div>
      )}
    </>
  )
}

