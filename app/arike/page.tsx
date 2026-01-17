"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminLoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [siteSettings, setSiteSettings] = useState<{ site_title: string; site_logo_url: string | null } | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchSiteSettings()
    checkExistingSession()
  }, [])

  async function fetchSiteSettings() {
    try {
      const response = await fetch("/api/settings")
      if (response.ok) {
        const data = await response.json()
        setSiteSettings(data)
      }
    } catch (err) {
      console.error("[v0] Error fetching site settings:", err)
    }
  }

  async function checkExistingSession() {
    try {
      const response = await fetch("/api/admin/session", { 
        credentials: "include",
        cache: "no-store",
      })
      if (response.ok) {
        // Only redirect if we're not coming from a logout
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get("logout") !== "true") {
          router.replace("/arike/dashboard")
        }
      }
    } catch (error) {
      console.error("[admin] Failed to verify existing session", error)
      // Don't redirect on error - let user login manually
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        router.replace("/arike/dashboard")
      } else {
        setError(data.error || "Login failed")
      }
    } catch (err) {
      console.error("[admin] Admin login error:", err)
      setError("Unable to reach the server. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            {siteSettings?.site_logo_url ? (
              <Image
                src={siteSettings.site_logo_url || "/placeholder.svg"}
                alt={siteSettings.site_title || "Site Logo"}
                width={200}
                height={56}
                className="h-14 w-auto max-w-full"
                priority
              />
            ) : (
              <div className="text-3xl font-bold">
                <span className="text-primary">ROCK</span>
                <span className="text-foreground">FLIX</span>
              </div>
            )}
          </div>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Enter your credentials to access the admin panel</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
