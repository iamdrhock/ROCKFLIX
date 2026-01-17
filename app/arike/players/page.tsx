"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ArrowUp, ArrowDown, Save, RefreshCw, Loader2 } from "lucide-react"
import Link from "next/link"
import { getAuthHeaders } from "@/lib/utils/csrf"

interface Player {
  id: string
  name: string
  displayName: string
  url: string
  order: number
}

export default function PlayersPage() {
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch("/api/admin/players", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized - Please log in")
        }
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Failed to load: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.players || !Array.isArray(data.players)) {
        throw new Error("Invalid response format")
      }

      // Sort by order
      const sortedPlayers = [...data.players].sort((a, b) => a.order - b.order)
      setPlayers(sortedPlayers)
    } catch (err: any) {
      console.error("[players] Load error:", err)
      setError(err.message || "Failed to load players")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  const movePlayer = (index: number, direction: "up" | "down") => {
    const newPlayers = [...players]
    
    if (direction === "up" && index > 0) {
      [newPlayers[index - 1], newPlayers[index]] = [newPlayers[index], newPlayers[index - 1]]
    } else if (direction === "down" && index < newPlayers.length - 1) {
      [newPlayers[index], newPlayers[index + 1]] = [newPlayers[index + 1], newPlayers[index]]
    }
    
    // Update order numbers
    const updatedPlayers = newPlayers.map((player, idx) => ({
      ...player,
      order: idx + 1,
      displayName: `PLAYER ${String(idx + 1).padStart(2, "0")}`,
    }))
    
    setPlayers(updatedPlayers)
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const headers = await getAuthHeaders()
      const order = players.map(p => p.id)
      
      const response = await fetch("/api/admin/players", {
        method: "PUT",
        credentials: "include",
        headers,
        body: JSON.stringify({ order }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Save failed: ${response.status}`)
      }

      setSuccess(true)
      await loadPlayers()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error("[players] Save error:", err)
      setError(err.message || "Failed to save player order")
    } finally {
      setSaving(false)
    }
  }, [players, loadPlayers])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/arike/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Player Management</h1>
            <p className="text-muted-foreground">Reorder video players - change player numbers</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadPlayers}
              disabled={loading || saving}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || loading}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? "Saving..." : "Save Order"}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="mb-6 border-green-500">
            <CardContent className="pt-6">
              <p className="text-green-600 dark:text-green-400">Player order saved successfully!</p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">Loading players...</div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Player Order</CardTitle>
              <CardDescription>
                Use the arrows to move players up or down. The order determines player numbers (PLAYER 01, PLAYER 02, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => movePlayer(index, "up")}
                        disabled={index === 0 || saving}
                        className="h-8 w-8"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => movePlayer(index, "down")}
                        disabled={index === players.length - 1 || saving}
                        className="h-8 w-8"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-primary">{player.displayName}</span>
                        <span className="text-sm font-medium text-muted-foreground">{player.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-md">
                        {player.url}
                      </div>
                    </div>
                    
                    <div className="text-sm font-mono text-muted-foreground">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>Player order determines the player numbers (PLAYER 01, PLAYER 02, etc.)</li>
              <li>Use the up/down arrows to reorder players</li>
              <li>Click "Save Order" to apply changes</li>
              <li>Changes take effect immediately on watch pages</li>
              <li>No database required - configuration is file-based</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

