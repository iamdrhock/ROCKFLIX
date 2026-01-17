"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Youtube, Loader2, Film, X, ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface Movie {
  id: number
  title: string
  poster_url: string
  type: string
  release_date: string
}

export function CreatePostCard() {
  const [content, setContent] = useState("")
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [showYoutube, setShowYoutube] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMovieSearch, setShowMovieSearch] = useState(false)
  const [movieSearch, setMovieSearch] = useState("")
  const [movieResults, setMovieResults] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const router = useRouter()

  const containsUrl = (text: string): boolean => {
    const urlPattern = /(?:https?:\/\/|www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/gi
    return urlPattern.test(text)
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)

    if (error && !containsUrl(newContent)) {
      setError(null)
    }

    if (containsUrl(newContent)) {
      setError("Links are not allowed in posts. Share your thoughts instead!")
    }
  }

  const handleMovieSearch = async (query: string) => {
    setMovieSearch(query)
    if (!query.trim()) {
      setMovieResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/community/search-content?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setMovieResults(data.results || [])
      }
    } catch (error) {
      console.error("Error searching movies:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const selectMovie = (movie: Movie) => {
    setSelectedMovie(movie)
    setMovieSearch("")
    setMovieResults([])
    setShowMovieSearch(false)
  }

  const removeMovie = () => {
    setSelectedMovie(null)
  }

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = document.createElement("img")
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          // Calculate new dimensions maintaining aspect ratio
          let width = img.width
          let height = img.height
          const maxDimension = 1200 // Max width or height

          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width
            width = maxDimension
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height
            height = maxDimension
          }

          canvas.width = width
          canvas.height = height
          ctx?.drawImage(img, 0, 0, width, height)

          // Start with quality 0.8 and adjust if needed
          let quality = 0.8
          const compress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("Failed to compress image"))
                  return
                }

                const targetSize = 200 * 1024 // 200KB

                // If blob is larger than 200KB and quality can be reduced
                if (blob.size > targetSize && quality > 0.5) {
                  quality -= 0.1
                  compress()
                  return
                }

                // Create new file with compressed blob
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                })

                console.log("[v0] Image compressed:", {
                  original: `${(file.size / 1024).toFixed(2)}KB`,
                  compressed: `${(compressedFile.size / 1024).toFixed(2)}KB`,
                  quality: quality.toFixed(2),
                })

                resolve(compressedFile)
              },
              "image/jpeg",
              quality,
            )
          }

          compress()
        }
        img.onerror = reject
      }
      reader.onerror = reject
    })
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file")
      return
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size too large. Maximum 10MB allowed.")
      return
    }

    try {
      setIsUploadingImage(true)

      // Compress image if over 200KB
      let finalFile = file
      if (file.size > 200 * 1024) {
        console.log("[v0] Compressing image...")
        finalFile = await compressImage(file)
      }

      setImageFile(finalFile)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(finalFile)

      setError(null)
    } catch (error) {
      console.error("[v0] Image compression error:", error)
      setError("Failed to process image. Please try again.")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("Please write something before posting")
      return
    }

    if (containsUrl(content)) {
      setError("Links are not allowed in posts. Share your thoughts instead!")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let imageUrl: string | null = null
      if (imageFile) {
        const formData = new FormData()
        formData.append("file", imageFile)

        const uploadResponse = await fetch("/api/community/upload-image", {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image")
        }

        const uploadData = await uploadResponse.json()
        imageUrl = uploadData.url
      }

      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          youtube_url: youtubeUrl || null,
          movie_id: selectedMovie?.id || null,
          image_url: imageUrl,
        }),
      })

      if (response.status === 401) {
        if (confirm("You need to sign in to post. Would you like to sign in now?")) {
          router.push("/community/auth/login")
        }
        setIsSubmitting(false)
        return
      }

      if (response.ok) {
        setContent("")
        setYoutubeUrl("")
        setShowYoutube(false)
        setSelectedMovie(null)
        setImageFile(null)
        setImagePreview(null)
        setError(null)
        router.refresh()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to create post")
      }
    } catch (error) {
      console.error("Error creating post:", error)
      setError("Failed to create post. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={handleContentChange}
            className="min-h-[100px] resize-none"
            maxLength={500}
          />

          <div className="text-xs text-muted-foreground text-right">{content.length}/500</div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {imagePreview && (
            <div className="relative rounded-lg overflow-hidden">
              <Image
                src={imagePreview || "/placeholder.svg"}
                alt="Preview"
                width={600}
                height={400}
                className="w-full h-auto object-cover max-h-96 rounded-lg"
              />
              <Button variant="destructive" size="sm" onClick={removeImage} className="absolute top-2 right-2">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {selectedMovie && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Image
                src={selectedMovie.poster_url || "/placeholder.svg"}
                alt={selectedMovie.title}
                width={40}
                height={60}
                className="rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{selectedMovie.title}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedMovie.type} • {selectedMovie.release_date}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={removeMovie}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {showYoutube && (
            <div className="space-y-2">
              <Label htmlFor="youtube-url">YouTube URL (Optional)</Label>
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
            </div>
          )}

          {showMovieSearch && (
            <div className="space-y-2">
              <Label htmlFor="movie-search">Tag a Movie/Series</Label>
              <Input
                id="movie-search"
                type="text"
                placeholder="Search for a movie or series..."
                value={movieSearch}
                onChange={(e) => handleMovieSearch(e.target.value)}
              />
              {movieResults.length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  {movieResults.map((movie) => (
                    <button
                      key={movie.id}
                      onClick={() => selectMovie(movie)}
                      className="flex items-center gap-3 w-full p-3 hover:bg-muted transition-colors text-left"
                    >
                      <Image
                        src={movie.poster_url || "/placeholder.svg"}
                        alt={movie.title}
                        width={32}
                        height={48}
                        className="rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{movie.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {movie.type} • {movie.release_date}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {isSearching && <p className="text-sm text-muted-foreground">Searching...</p>}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-2 flex-wrap">
              {!imagePreview && (
                <label className="cursor-pointer">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={isUploadingImage}
                    asChild
                  >
                    <span>
                      {isUploadingImage ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4 mr-2" />
                      )}
                      Add Image
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                </label>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowYoutube(!showYoutube)}
                className="text-muted-foreground"
              >
                <Youtube className="h-4 w-4 mr-2" />
                {showYoutube ? "Remove" : "Add"} YouTube
              </Button>

              {!selectedMovie && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMovieSearch(!showMovieSearch)}
                  className="text-muted-foreground"
                >
                  <Film className="h-4 w-4 mr-2" />
                  {showMovieSearch ? "Cancel" : "Tag"} Movie
                </Button>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting || containsUrl(content)}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Post
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
