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

export default function TalkFlixCompleteProfilePage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [country, setCountry] = useState("")
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/community/auth/sign-up")
        return
      }

      setUserId(user.id)
      setUserEmail(user.email || null)

      // Check if profile exists via API route (uses Contabo when enabled)
      try {
        const response = await fetch("/api/community/complete-profile")
        const data = await response.json()
        if (data.exists) {
          router.push("/community")
        }
      } catch (error) {
        console.error("Error checking profile:", error)
      }
    }

    checkUser()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      // Update password via Supabase auth (this is fine - auth operations stay with Supabase)
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
      })

      if (passwordError) throw passwordError

      // Upload profile picture if provided
      let profilePictureUrl = null
      if (profilePicture) {
        const formData = new FormData()
        formData.append("file", profilePicture)
        formData.append("userId", userId!)

        const result = await uploadProfilePicture(formData)

        if (result.error) {
          throw new Error(result.error)
        }

        profilePictureUrl = result.url
      }

      // Complete profile via API route (uses Contabo when enabled)
      const response = await fetch("/api/community/complete-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password, // API route will hash it if provided
          country: country || null,
          profilePictureUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete profile")
      }

      router.push("/community")
      router.refresh()
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
        <div className="w-full max-w-sm">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Complete Your TalkFlix Profile</CardTitle>
              <CardDescription className="text-gray-400">
                Set up your profile to start sharing your thoughts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username" className="text-gray-300">
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Choose a username"
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
                      <option value="Afghanistan" className="bg-zinc-800">
                        Afghanistan
                      </option>
                      <option value="Albania" className="bg-zinc-800">
                        Albania
                      </option>
                      <option value="Algeria" className="bg-zinc-800">
                        Algeria
                      </option>
                      <option value="Andorra" className="bg-zinc-800">
                        Andorra
                      </option>
                      <option value="Angola" className="bg-zinc-800">
                        Angola
                      </option>
                      <option value="Antigua and Barbuda" className="bg-zinc-800">
                        Antigua and Barbuda
                      </option>
                      <option value="Argentina" className="bg-zinc-800">
                        Argentina
                      </option>
                      <option value="Armenia" className="bg-zinc-800">
                        Armenia
                      </option>
                      <option value="Australia" className="bg-zinc-800">
                        Australia
                      </option>
                      <option value="Austria" className="bg-zinc-800">
                        Austria
                      </option>
                      <option value="Azerbaijan" className="bg-zinc-800">
                        Azerbaijan
                      </option>
                      <option value="Bahamas" className="bg-zinc-800">
                        Bahamas
                      </option>
                      <option value="Bahrain" className="bg-zinc-800">
                        Bahrain
                      </option>
                      <option value="Bangladesh" className="bg-zinc-800">
                        Bangladesh
                      </option>
                      <option value="Barbados" className="bg-zinc-800">
                        Barbados
                      </option>
                      <option value="Belarus" className="bg-zinc-800">
                        Belarus
                      </option>
                      <option value="Belgium" className="bg-zinc-800">
                        Belgium
                      </option>
                      <option value="Belize" className="bg-zinc-800">
                        Belize
                      </option>
                      <option value="Benin" className="bg-zinc-800">
                        Benin
                      </option>
                      <option value="Bhutan" className="bg-zinc-800">
                        Bhutan
                      </option>
                      <option value="Bolivia" className="bg-zinc-800">
                        Bolivia
                      </option>
                      <option value="Bosnia and Herzegovina" className="bg-zinc-800">
                        Bosnia and Herzegovina
                      </option>
                      <option value="Botswana" className="bg-zinc-800">
                        Botswana
                      </option>
                      <option value="Brazil" className="bg-zinc-800">
                        Brazil
                      </option>
                      <option value="Brunei" className="bg-zinc-800">
                        Brunei
                      </option>
                      <option value="Bulgaria" className="bg-zinc-800">
                        Bulgaria
                      </option>
                      <option value="Burkina Faso" className="bg-zinc-800">
                        Burkina Faso
                      </option>
                      <option value="Burundi" className="bg-zinc-800">
                        Burundi
                      </option>
                      <option value="Cambodia" className="bg-zinc-800">
                        Cambodia
                      </option>
                      <option value="Cameroon" className="bg-zinc-800">
                        Cameroon
                      </option>
                      <option value="Canada" className="bg-zinc-800">
                        Canada
                      </option>
                      <option value="Cape Verde" className="bg-zinc-800">
                        Cape Verde
                      </option>
                      <option value="Central African Republic" className="bg-zinc-800">
                        Central African Republic
                      </option>
                      <option value="Chad" className="bg-zinc-800">
                        Chad
                      </option>
                      <option value="Chile" className="bg-zinc-800">
                        Chile
                      </option>
                      <option value="China" className="bg-zinc-800">
                        China
                      </option>
                      <option value="Colombia" className="bg-zinc-800">
                        Colombia
                      </option>
                      <option value="Comoros" className="bg-zinc-800">
                        Comoros
                      </option>
                      <option value="Congo" className="bg-zinc-800">
                        Congo
                      </option>
                      <option value="Costa Rica" className="bg-zinc-800">
                        Costa Rica
                      </option>
                      <option value="Croatia" className="bg-zinc-800">
                        Croatia
                      </option>
                      <option value="Cuba" className="bg-zinc-800">
                        Cuba
                      </option>
                      <option value="Cyprus" className="bg-zinc-800">
                        Cyprus
                      </option>
                      <option value="Czech Republic" className="bg-zinc-800">
                        Czech Republic
                      </option>
                      <option value="Democratic Republic of the Congo" className="bg-zinc-800">
                        Democratic Republic of the Congo
                      </option>
                      <option value="Denmark" className="bg-zinc-800">
                        Denmark
                      </option>
                      <option value="Djibouti" className="bg-zinc-800">
                        Djibouti
                      </option>
                      <option value="Dominica" className="bg-zinc-800">
                        Dominica
                      </option>
                      <option value="Dominican Republic" className="bg-zinc-800">
                        Dominican Republic
                      </option>
                      <option value="East Timor" className="bg-zinc-800">
                        East Timor
                      </option>
                      <option value="Ecuador" className="bg-zinc-800">
                        Ecuador
                      </option>
                      <option value="Egypt" className="bg-zinc-800">
                        Egypt
                      </option>
                      <option value="El Salvador" className="bg-zinc-800">
                        El Salvador
                      </option>
                      <option value="Equatorial Guinea" className="bg-zinc-800">
                        Equatorial Guinea
                      </option>
                      <option value="Eritrea" className="bg-zinc-800">
                        Eritrea
                      </option>
                      <option value="Estonia" className="bg-zinc-800">
                        Estonia
                      </option>
                      <option value="Ethiopia" className="bg-zinc-800">
                        Ethiopia
                      </option>
                      <option value="Fiji" className="bg-zinc-800">
                        Fiji
                      </option>
                      <option value="Finland" className="bg-zinc-800">
                        Finland
                      </option>
                      <option value="France" className="bg-zinc-800">
                        France
                      </option>
                      <option value="Gabon" className="bg-zinc-800">
                        Gabon
                      </option>
                      <option value="Gambia" className="bg-zinc-800">
                        Gambia
                      </option>
                      <option value="Georgia" className="bg-zinc-800">
                        Georgia
                      </option>
                      <option value="Germany" className="bg-zinc-800">
                        Germany
                      </option>
                      <option value="Ghana" className="bg-zinc-800">
                        Ghana
                      </option>
                      <option value="Greece" className="bg-zinc-800">
                        Greece
                      </option>
                      <option value="Grenada" className="bg-zinc-800">
                        Grenada
                      </option>
                      <option value="Guatemala" className="bg-zinc-800">
                        Guatemala
                      </option>
                      <option value="Guinea" className="bg-zinc-800">
                        Guinea
                      </option>
                      <option value="Guinea-Bissau" className="bg-zinc-800">
                        Guinea-Bissau
                      </option>
                      <option value="Guyana" className="bg-zinc-800">
                        Guyana
                      </option>
                      <option value="Haiti" className="bg-zinc-800">
                        Haiti
                      </option>
                      <option value="Honduras" className="bg-zinc-800">
                        Honduras
                      </option>
                      <option value="Hungary" className="bg-zinc-800">
                        Hungary
                      </option>
                      <option value="Iceland" className="bg-zinc-800">
                        Iceland
                      </option>
                      <option value="India" className="bg-zinc-800">
                        India
                      </option>
                      <option value="Indonesia" className="bg-zinc-800">
                        Indonesia
                      </option>
                      <option value="Iran" className="bg-zinc-800">
                        Iran
                      </option>
                      <option value="Iraq" className="bg-zinc-800">
                        Iraq
                      </option>
                      <option value="Ireland" className="bg-zinc-800">
                        Ireland
                      </option>
                      <option value="Israel" className="bg-zinc-800">
                        Israel
                      </option>
                      <option value="Italy" className="bg-zinc-800">
                        Italy
                      </option>
                      <option value="Ivory Coast" className="bg-zinc-800">
                        Ivory Coast
                      </option>
                      <option value="Jamaica" className="bg-zinc-800">
                        Jamaica
                      </option>
                      <option value="Japan" className="bg-zinc-800">
                        Japan
                      </option>
                      <option value="Jordan" className="bg-zinc-800">
                        Jordan
                      </option>
                      <option value="Kazakhstan" className="bg-zinc-800">
                        Kazakhstan
                      </option>
                      <option value="Kenya" className="bg-zinc-800">
                        Kenya
                      </option>
                      <option value="Kiribati" className="bg-zinc-800">
                        Kiribati
                      </option>
                      <option value="Kuwait" className="bg-zinc-800">
                        Kuwait
                      </option>
                      <option value="Kyrgyzstan" className="bg-zinc-800">
                        Kyrgyzstan
                      </option>
                      <option value="Laos" className="bg-zinc-800">
                        Laos
                      </option>
                      <option value="Latvia" className="bg-zinc-800">
                        Latvia
                      </option>
                      <option value="Lebanon" className="bg-zinc-800">
                        Lebanon
                      </option>
                      <option value="Lesotho" className="bg-zinc-800">
                        Lesotho
                      </option>
                      <option value="Liberia" className="bg-zinc-800">
                        Liberia
                      </option>
                      <option value="Libya" className="bg-zinc-800">
                        Libya
                      </option>
                      <option value="Liechtenstein" className="bg-zinc-800">
                        Liechtenstein
                      </option>
                      <option value="Lithuania" className="bg-zinc-800">
                        Lithuania
                      </option>
                      <option value="Luxembourg" className="bg-zinc-800">
                        Luxembourg
                      </option>
                      <option value="Macedonia" className="bg-zinc-800">
                        Macedonia
                      </option>
                      <option value="Madagascar" className="bg-zinc-800">
                        Madagascar
                      </option>
                      <option value="Malawi" className="bg-zinc-800">
                        Malawi
                      </option>
                      <option value="Malaysia" className="bg-zinc-800">
                        Malaysia
                      </option>
                      <option value="Maldives" className="bg-zinc-800">
                        Maldives
                      </option>
                      <option value="Mali" className="bg-zinc-800">
                        Mali
                      </option>
                      <option value="Malta" className="bg-zinc-800">
                        Malta
                      </option>
                      <option value="Marshall Islands" className="bg-zinc-800">
                        Marshall Islands
                      </option>
                      <option value="Mauritania" className="bg-zinc-800">
                        Mauritania
                      </option>
                      <option value="Mauritius" className="bg-zinc-800">
                        Mauritius
                      </option>
                      <option value="Mexico" className="bg-zinc-800">
                        Mexico
                      </option>
                      <option value="Micronesia" className="bg-zinc-800">
                        Micronesia
                      </option>
                      <option value="Moldova" className="bg-zinc-800">
                        Moldova
                      </option>
                      <option value="Monaco" className="bg-zinc-800">
                        Monaco
                      </option>
                      <option value="Mongolia" className="bg-zinc-800">
                        Mongolia
                      </option>
                      <option value="Montenegro" className="bg-zinc-800">
                        Montenegro
                      </option>
                      <option value="Morocco" className="bg-zinc-800">
                        Morocco
                      </option>
                      <option value="Mozambique" className="bg-zinc-800">
                        Mozambique
                      </option>
                      <option value="Myanmar" className="bg-zinc-800">
                        Myanmar
                      </option>
                      <option value="Namibia" className="bg-zinc-800">
                        Namibia
                      </option>
                      <option value="Nauru" className="bg-zinc-800">
                        Nauru
                      </option>
                      <option value="Nepal" className="bg-zinc-800">
                        Nepal
                      </option>
                      <option value="Netherlands" className="bg-zinc-800">
                        Netherlands
                      </option>
                      <option value="New Zealand" className="bg-zinc-800">
                        New Zealand
                      </option>
                      <option value="Nicaragua" className="bg-zinc-800">
                        Nicaragua
                      </option>
                      <option value="Niger" className="bg-zinc-800">
                        Niger
                      </option>
                      <option value="Nigeria" className="bg-zinc-800">
                        Nigeria
                      </option>
                      <option value="North Korea" className="bg-zinc-800">
                        North Korea
                      </option>
                      <option value="Norway" className="bg-zinc-800">
                        Norway
                      </option>
                      <option value="Oman" className="bg-zinc-800">
                        Oman
                      </option>
                      <option value="Pakistan" className="bg-zinc-800">
                        Pakistan
                      </option>
                      <option value="Palau" className="bg-zinc-800">
                        Palau
                      </option>
                      <option value="Palestine" className="bg-zinc-800">
                        Palestine
                      </option>
                      <option value="Panama" className="bg-zinc-800">
                        Panama
                      </option>
                      <option value="Papua New Guinea" className="bg-zinc-800">
                        Papua New Guinea
                      </option>
                      <option value="Paraguay" className="bg-zinc-800">
                        Paraguay
                      </option>
                      <option value="Peru" className="bg-zinc-800">
                        Peru
                      </option>
                      <option value="Philippines" className="bg-zinc-800">
                        Philippines
                      </option>
                      <option value="Poland" className="bg-zinc-800">
                        Poland
                      </option>
                      <option value="Portugal" className="bg-zinc-800">
                        Portugal
                      </option>
                      <option value="Qatar" className="bg-zinc-800">
                        Qatar
                      </option>
                      <option value="Romania" className="bg-zinc-800">
                        Romania
                      </option>
                      <option value="Russia" className="bg-zinc-800">
                        Russia
                      </option>
                      <option value="Rwanda" className="bg-zinc-800">
                        Rwanda
                      </option>
                      <option value="Saint Kitts and Nevis" className="bg-zinc-800">
                        Saint Kitts and Nevis
                      </option>
                      <option value="Saint Lucia" className="bg-zinc-800">
                        Saint Lucia
                      </option>
                      <option value="Saint Vincent and the Grenadines" className="bg-zinc-800">
                        Saint Vincent and the Grenadines
                      </option>
                      <option value="Samoa" className="bg-zinc-800">
                        Samoa
                      </option>
                      <option value="San Marino" className="bg-zinc-800">
                        San Marino
                      </option>
                      <option value="Sao Tome and Principe" className="bg-zinc-800">
                        Sao Tome and Principe
                      </option>
                      <option value="Saudi Arabia" className="bg-zinc-800">
                        Saudi Arabia
                      </option>
                      <option value="Senegal" className="bg-zinc-800">
                        Senegal
                      </option>
                      <option value="Serbia" className="bg-zinc-800">
                        Serbia
                      </option>
                      <option value="Seychelles" className="bg-zinc-800">
                        Seychelles
                      </option>
                      <option value="Sierra Leone" className="bg-zinc-800">
                        Sierra Leone
                      </option>
                      <option value="Singapore" className="bg-zinc-800">
                        Singapore
                      </option>
                      <option value="Slovakia" className="bg-zinc-800">
                        Slovakia
                      </option>
                      <option value="Slovenia" className="bg-zinc-800">
                        Slovenia
                      </option>
                      <option value="Solomon Islands" className="bg-zinc-800">
                        Solomon Islands
                      </option>
                      <option value="Somalia" className="bg-zinc-800">
                        Somalia
                      </option>
                      <option value="South Africa" className="bg-zinc-800">
                        South Africa
                      </option>
                      <option value="South Korea" className="bg-zinc-800">
                        South Korea
                      </option>
                      <option value="South Sudan" className="bg-zinc-800">
                        South Sudan
                      </option>
                      <option value="Spain" className="bg-zinc-800">
                        Spain
                      </option>
                      <option value="Sri Lanka" className="bg-zinc-800">
                        Sri Lanka
                      </option>
                      <option value="Sudan" className="bg-zinc-800">
                        Sudan
                      </option>
                      <option value="Suriname" className="bg-zinc-800">
                        Suriname
                      </option>
                      <option value="Swaziland" className="bg-zinc-800">
                        Swaziland
                      </option>
                      <option value="Sweden" className="bg-zinc-800">
                        Sweden
                      </option>
                      <option value="Switzerland" className="bg-zinc-800">
                        Switzerland
                      </option>
                      <option value="Syria" className="bg-zinc-800">
                        Syria
                      </option>
                      <option value="Taiwan" className="bg-zinc-800">
                        Taiwan
                      </option>
                      <option value="Tajikistan" className="bg-zinc-800">
                        Tajikistan
                      </option>
                      <option value="Tanzania" className="bg-zinc-800">
                        Tanzania
                      </option>
                      <option value="Thailand" className="bg-zinc-800">
                        Thailand
                      </option>
                      <option value="Togo" className="bg-zinc-800">
                        Togo
                      </option>
                      <option value="Tonga" className="bg-zinc-800">
                        Tonga
                      </option>
                      <option value="Trinidad and Tobago" className="bg-zinc-800">
                        Trinidad and Tobago
                      </option>
                      <option value="Tunisia" className="bg-zinc-800">
                        Tunisia
                      </option>
                      <option value="Turkey" className="bg-zinc-800">
                        Turkey
                      </option>
                      <option value="Turkmenistan" className="bg-zinc-800">
                        Turkmenistan
                      </option>
                      <option value="Tuvalu" className="bg-zinc-800">
                        Tuvalu
                      </option>
                      <option value="Uganda" className="bg-zinc-800">
                        Uganda
                      </option>
                      <option value="Ukraine" className="bg-zinc-800">
                        Ukraine
                      </option>
                      <option value="United Arab Emirates" className="bg-zinc-800">
                        United Arab Emirates
                      </option>
                      <option value="United Kingdom" className="bg-zinc-800">
                        United Kingdom
                      </option>
                      <option value="United States" className="bg-zinc-800">
                        United States
                      </option>
                      <option value="Uruguay" className="bg-zinc-800">
                        Uruguay
                      </option>
                      <option value="Uzbekistan" className="bg-zinc-800">
                        Uzbekistan
                      </option>
                      <option value="Vanuatu" className="bg-zinc-800">
                        Vanuatu
                      </option>
                      <option value="Vatican City" className="bg-zinc-800">
                        Vatican City
                      </option>
                      <option value="Venezuela" className="bg-zinc-800">
                        Venezuela
                      </option>
                      <option value="Vietnam" className="bg-zinc-800">
                        Vietnam
                      </option>
                      <option value="Yemen" className="bg-zinc-800">
                        Yemen
                      </option>
                      <option value="Zambia" className="bg-zinc-800">
                        Zambia
                      </option>
                      <option value="Zimbabwe" className="bg-zinc-800">
                        Zimbabwe
                      </option>
                      <option value="Other" className="bg-zinc-800">
                        Other
                      </option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-gray-300">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Create a password (min 6 characters)"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password" className="text-gray-300">
                      Confirm Password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-picture" className="text-gray-300">
                      Profile Picture (Optional)
                    </Label>
                    <Input
                      id="profile-picture"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
                      disabled={isLoading}
                      className="bg-zinc-800 border-zinc-700 text-white file:text-white"
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white" disabled={isLoading}>
                    {isLoading ? "Creating profile..." : "Complete Profile"}
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
