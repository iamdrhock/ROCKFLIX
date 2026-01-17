"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { uploadProfilePicture } from "@/app/actions/upload-profile-picture"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

interface UpdateProfileFormProps {
  profile: {
    username: string
    profile_picture_url: string | null
    country: string | null
    about: string | null
  }
  userId: string
}

export function UpdateProfileForm({ profile, userId }: UpdateProfileFormProps) {
  const [username, setUsername] = useState(profile.username)
  const [country, setCountry] = useState(profile.country || "")
  const [about, setAbout] = useState(profile.about || "")
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      let profilePictureUrl = profile.profile_picture_url

      if (profilePicture) {
        const formData = new FormData()
        formData.append("file", profilePicture)
        formData.append("userId", userId)

        const result = await uploadProfilePicture(formData)

        if (result.error) {
          throw new Error(result.error)
        }

        profilePictureUrl = result.url
      }

      // Update profile via API route
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          country,
          about,
          profile_picture_url: profilePictureUrl,
        }),
      })

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type")
      let data
      
      if (!contentType || !contentType.includes("application/json")) {
        // Response is not JSON - likely an HTML error page
        const text = await response.text()
        console.error("[UpdateProfile] Non-JSON response:", text.substring(0, 200))
        throw new Error("Server returned an invalid response. Please check if you're logged in and try again.")
      } else {
        // Response is JSON - parse it
        data = await response.json()
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile")
      }

      setSuccess(true)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="country">Country</Label>
        <select
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={isLoading}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select your country</option>
          <option value="United States">United States</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="Canada">Canada</option>
          <option value="Australia">Australia</option>
          <option value="Germany">Germany</option>
          <option value="France">France</option>
          <option value="Spain">Spain</option>
          <option value="Italy">Italy</option>
          <option value="Netherlands">Netherlands</option>
          <option value="Belgium">Belgium</option>
          <option value="Switzerland">Switzerland</option>
          <option value="Austria">Austria</option>
          <option value="Sweden">Sweden</option>
          <option value="Norway">Norway</option>
          <option value="Denmark">Denmark</option>
          <option value="Finland">Finland</option>
          <option value="Poland">Poland</option>
          <option value="Czech Republic">Czech Republic</option>
          <option value="Ireland">Ireland</option>
          <option value="Portugal">Portugal</option>
          <option value="Greece">Greece</option>
          <option value="Japan">Japan</option>
          <option value="South Korea">South Korea</option>
          <option value="China">China</option>
          <option value="India">India</option>
          <option value="Singapore">Singapore</option>
          <option value="Malaysia">Malaysia</option>
          <option value="Thailand">Thailand</option>
          <option value="Indonesia">Indonesia</option>
          <option value="Philippines">Philippines</option>
          <option value="Vietnam">Vietnam</option>
          <option value="New Zealand">New Zealand</option>
          <option value="Brazil">Brazil</option>
          <option value="Mexico">Mexico</option>
          <option value="Argentina">Argentina</option>
          <option value="Chile">Chile</option>
          <option value="Colombia">Colombia</option>
          <option value="South Africa">South Africa</option>
          <option value="Nigeria">Nigeria</option>
          <option value="Kenya">Kenya</option>
          <option value="Egypt">Egypt</option>
          <option value="United Arab Emirates">United Arab Emirates</option>
          <option value="Saudi Arabia">Saudi Arabia</option>
          <option value="Israel">Israel</option>
          <option value="Turkey">Turkey</option>
          <option value="Russia">Russia</option>
          <option value="Ukraine">Ukraine</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="about">About / Bio</Label>
        <Textarea
          id="about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          disabled={isLoading}
          placeholder="Tell us about yourself..."
          maxLength={500}
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">{about.length}/500 characters</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="profile-picture">Profile Picture</Label>
        {profile.profile_picture_url && !profilePicture && (
          <div className="mb-2">
            <Image
              src={profile.profile_picture_url || "/placeholder.svg"}
              alt="Current profile"
              width={100}
              height={100}
              className="rounded-full object-cover"
            />
          </div>
        )}
        <Input
          id="profile-picture"
          type="file"
          accept="image/*"
          onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
          disabled={isLoading}
        />
      </div>

      {/* Added note about password changes */}
      <div className="rounded-md bg-muted p-3 text-sm">
        <p className="font-medium">Need to change your password?</p>
        <p className="mt-1 text-muted-foreground">
          Password changes are handled separately for security.{" "}
          <Link href="#change-password" className="text-primary underline">
            Scroll down to the Change Password section
          </Link>{" "}
          below.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-500">Profile updated successfully!</p>}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Updating..." : "Update Profile"}
      </Button>
    </form>
  )
}

