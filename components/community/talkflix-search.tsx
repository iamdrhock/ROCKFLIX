"use client"

import type React from "react"

import { useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

export function TalkFlixSearch() {
  const [query, setQuery] = useState("")
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/community/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const clearSearch = () => {
    setQuery("")
  }

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search TalkFlix..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10 pr-10 bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-red-600"
      />
      {query && (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
