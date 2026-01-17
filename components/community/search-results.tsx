"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostCard } from "./post-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import Link from "next/link"

interface SearchResult {
  posts: any[]
  users: any[]
  hashtags: any[]
}

export function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [results, setResults] = useState<SearchResult>({ posts: [], users: [], hashtags: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults({ posts: [], users: [], hashtags: [] })
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/community/search?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        setResults(data)
      } catch (error) {
        console.error("Error searching:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query])

  if (!query.trim()) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Enter a search query to find posts, users, and hashtags</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    )
  }

  const totalResults = results.posts.length + results.users.length + results.hashtags.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Search results for "{query}"</h1>
        <p className="text-gray-400">{totalResults} results found</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-900 border border-gray-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-red-600">
            All ({totalResults})
          </TabsTrigger>
          <TabsTrigger value="posts" className="data-[state=active]:bg-red-600">
            Posts ({results.posts.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-red-600">
            Users ({results.users.length})
          </TabsTrigger>
          <TabsTrigger value="hashtags" className="data-[state=active]:bg-red-600">
            Hashtags ({results.hashtags.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-6">
          {results.users.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
              <div className="space-y-2">
                {results.users.slice(0, 3).map((user: any) => (
                  <Link
                    key={user.id}
                    href={`/community/profile/${user.username}`}
                    className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-red-600 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.profile_picture_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-red-600 text-white">
                        {user.username?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{user.username}</p>
                      {user.about && <p className="text-sm text-gray-400 line-clamp-1">{user.about}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.hashtags.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Hashtags</h2>
              <div className="grid grid-cols-2 gap-2">
                {results.hashtags.slice(0, 6).map((hashtag: any) => (
                  <Link
                    key={hashtag.id}
                    href={`/community?hashtag=${hashtag.name}`}
                    className="p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-red-600 transition-colors"
                  >
                    <p className="font-medium text-red-600">#{hashtag.name}</p>
                    <p className="text-sm text-gray-400">{hashtag.post_count} posts</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.posts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Posts</h2>
              <div className="space-y-4">
                {results.posts.slice(0, 5).map((post: any) => (
                  <PostCard key={post.id} post={post} onUpdate={() => {}} />
                ))}
              </div>
            </div>
          )}

          {totalResults === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No results found for "{query}"</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts" className="mt-6 space-y-4">
          {results.posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No posts found</p>
            </div>
          ) : (
            results.posts.map((post: any) => <PostCard key={post.id} post={post} onUpdate={() => {}} />)
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-6 space-y-2">
          {results.users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No users found</p>
            </div>
          ) : (
            results.users.map((user: any) => (
              <Link
                key={user.id}
                href={`/community/profile/${user.username}`}
                className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-red-600 transition-colors"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user.profile_picture_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-red-600 text-white">
                    {user.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-white">{user.username}</p>
                  {user.about && <p className="text-sm text-gray-400 line-clamp-2">{user.about}</p>}
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="hashtags" className="mt-6">
          {results.hashtags.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No hashtags found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {results.hashtags.map((hashtag: any) => (
                <Link
                  key={hashtag.id}
                  href={`/community?hashtag=${hashtag.name}`}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-red-600 transition-colors"
                >
                  <p className="font-medium text-red-600 text-lg">#{hashtag.name}</p>
                  <p className="text-sm text-gray-400">{hashtag.post_count} posts</p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
