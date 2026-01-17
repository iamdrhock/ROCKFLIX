"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { TalkFlixHeader } from "@/components/community/talkflix-header"

export default function TalkFlixLoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const router = useRouter()

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    setIsGoogleLoading(true)
    setError(null)

    try {
      const siteUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "https://talkflix.org"
      const redirectUrl = `${siteUrl}/auth/callback?next=/community`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      })
      if (error) throw error
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsGoogleLoading(false)
    }
  }

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", username)
        .single()

      if (profileError || !profile || !profile.email) {
        throw new Error("Invalid username or password")
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      })

      if (signInError) throw new Error("Invalid username or password")

      router.push("/community")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <TalkFlixHeader />
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Welcome to TalkFlix</CardTitle>
              <CardDescription className="text-gray-400">Sign in to join the conversation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                <Button
                  onClick={handleGoogleLogin}
                  className="w-full bg-white hover:bg-gray-100 text-black"
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? (
                    "Signing in..."
                  ) : (
                    <>
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-zinc-900 px-2 text-gray-500">Or</span>
                  </div>
                </div>

                <form onSubmit={handleUsernameLogin}>
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="username" className="text-gray-300">
                        Username
                      </Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="Enter your username"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading || isGoogleLoading}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password" className="text-gray-300">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading || isGoogleLoading}
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full bg-red-500 hover:bg-red-600 text-white"
                      disabled={isLoading || isGoogleLoading}
                    >
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>
                  </div>
                </form>

                <div className="mt-4 text-center text-sm text-gray-400">
                  Don't have an account?{" "}
                  <Link
                    href="/community/auth/sign-up"
                    className="text-red-500 hover:text-red-400 underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
