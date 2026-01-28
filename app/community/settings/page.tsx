"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { uploadProfilePicture } from "@/app/actions/upload-profile-picture"
import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function TalkFlixSettingsPage() {
  const [username, setUsername] = useState("")
  const [country, setCountry] = useState("")
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [currentProfilePicture, setCurrentProfilePicture] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/community/auth/login")
        return
      }

      setUserId(user.id)

      // Load profile via API route (uses Contabo when enabled)
      try {
        const response = await fetch("/api/community/profile")
        const data = await response.json()
        if (data.profile) {
          setUsername(data.profile.username || "")
          setCountry(data.profile.country || "")
          setCurrentProfilePicture(data.profile.profile_picture_url || null)
        }
      } catch (error) {
        console.error("Error loading profile:", error)
      }
    }

    loadProfile()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      let profilePictureUrl = currentProfilePicture
      if (profilePicture) {
        const formData = new FormData()
        formData.append("file", profilePicture)
        formData.append("userId", userId!)

        const result = await uploadProfilePicture(formData)

        if (result.error) {
          throw new Error(result.error)
        }

        const uploadedUrl: string | null = result.url ?? null
        profilePictureUrl = uploadedUrl
      }

      // Update profile via API route (uses Contabo when enabled)
      const response = await fetch("/api/community/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          country: country || null,
          profile_picture_url: profilePictureUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile")
      }

      setSuccess("Profile updated successfully!")
      setCurrentProfilePicture(profilePictureUrl)
      setProfilePicture(null)

      setTimeout(() => {
        router.push("/community")
        router.refresh()
      }, 1500)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-black">
        <TalkFlixHeader />
        <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center p-6">
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <TalkFlixHeader />
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Edit TalkFlix Profile</CardTitle>
              <CardDescription className="text-gray-400">Update your profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={currentProfilePicture || undefined} alt={username} />
                      <AvatarFallback className="bg-red-500 text-white text-2xl">
                        {username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Label htmlFor="profile-picture" className="text-gray-300 cursor-pointer">
                      <span className="text-red-500 hover:text-red-400 underline">Change Profile Picture</span>
                    </Label>
                    <Input
                      id="profile-picture"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
                      disabled={isLoading}
                      className="hidden"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="username" className="text-gray-300">
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Your username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="country" className="text-gray-300">
                      Country
                    </Label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled={isLoading}
                      required
                      className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="" className="bg-zinc-800">
                        Select your country
                      </option>
                      <option value="United States" className="bg-zinc-800">
                        United States
                      </option>
                      <option value="United Kingdom" className="bg-zinc-800">
                        United Kingdom
                      </option>
                      <option value="Canada" className="bg-zinc-800">
                        Canada
                      </option>
                      <option value="Australia" className="bg-zinc-800">
                        Australia
                      </option>
                      <option value="Germany" className="bg-zinc-800">
                        Germany
                      </option>
                      <option value="France" className="bg-zinc-800">
                        France
                      </option>
                      <option value="Spain" className="bg-zinc-800">
                        Spain
                      </option>
                      <option value="Italy" className="bg-zinc-800">
                        Italy
                      </option>
                      <option value="Netherlands" className="bg-zinc-800">
                        Netherlands
                      </option>
                      <option value="Other" className="bg-zinc-800">
                        Other
                      </option>
                    </select>
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}
                  {success && <p className="text-sm text-green-500">{success}</p>}

                  <Button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
