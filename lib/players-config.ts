// Player configuration helper
// Reads player order from config file

const DEFAULT_PLAYER_ORDER = [
  "vidify",
  "vidplus",
  "vidsrc",
  "vidlink",
  "mapple",
  "primesrc",
  "superembed",
  "autoembed",
  "videasy",
]

const DEFAULT_PLAYERS = [
  { id: "vidify", name: "Vidify", url: "https://player.vidify.top/embed" },
  { id: "vidplus", name: "Vidplus", url: "https://player.vidplus.to/embed" },
  { id: "vidsrc", name: "VidSrc", url: "https://vidsrc-embed.ru" },
  { id: "vidlink", name: "VidLink", url: "https://vidlink.pro" },
  { id: "mapple", name: "Mapple", url: "https://mapple.uk/watch" },
  { id: "primesrc", name: "PrimeSrc", url: "https://primesrc.me/embed" },
  { id: "superembed", name: "SuperEmbed", url: process.env.NEXT_PUBLIC_EMBED_SUPEREMBED || "https://multiembed.mov/directstream.php" },
  { id: "autoembed", name: "AutoEmbed", url: "https://player.autoembed.cc/embed" },
  { id: "videasy", name: "Videasy", url: "https://player.videasy.net" },
]

export interface Player {
  id: string
  name: string
  displayName: string
  url: string
  order: number
}

export async function getPlayersConfig(): Promise<Player[]> {
  try {
    // On server: read from file
    if (typeof window === "undefined") {
      const fs = await import("fs/promises")
      const path = await import("path")
      
      const configPath = path.join(process.cwd(), "data", "players.json")
      
      let playerOrder: string[] = DEFAULT_PLAYER_ORDER
      
      try {
        const fileContent = await fs.readFile(configPath, "utf-8")
        playerOrder = JSON.parse(fileContent)
        
        if (!Array.isArray(playerOrder)) {
          playerOrder = DEFAULT_PLAYER_ORDER
        }
      } catch {
        // File doesn't exist or invalid, use default
        playerOrder = DEFAULT_PLAYER_ORDER
      }

      return playerOrder.map((playerId, index) => {
        const playerDef = DEFAULT_PLAYERS.find(p => p.id === playerId)
        if (!playerDef) {
          // Fallback for unknown players
          return {
            id: playerId,
            name: playerId,
            displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
            url: "",
            order: index + 1,
          }
        }
        return {
          id: playerDef.id,
          name: playerDef.name,
          displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
          url: playerDef.url,
          order: index + 1,
        }
      })
    } else {
      // On client: fetch from API
      const response = await fetch("/api/admin/players", {
        credentials: "include",
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.players || []
      }
      
      // Fallback to default if API fails
      return DEFAULT_PLAYER_ORDER.map((playerId, index) => {
        const playerDef = DEFAULT_PLAYERS.find(p => p.id === playerId)
        return {
          id: playerDef?.id || playerId,
          name: playerDef?.name || playerId,
          displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
          url: playerDef?.url || "",
          order: index + 1,
        }
      })
    }
  } catch (error) {
    console.error("[players-config] Error loading players:", error)
    // Fallback to default
    return DEFAULT_PLAYER_ORDER.map((playerId, index) => {
      const playerDef = DEFAULT_PLAYERS.find(p => p.id === playerId)
      return {
        id: playerDef?.id || playerId,
        name: playerDef?.name || playerId,
        displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
        url: playerDef?.url || "",
        order: index + 1,
      }
    })
  }
}

// Public API route for players (no auth needed - used by watch page)
export async function getPublicPlayersConfig(): Promise<Player[]> {
  try {
    const fs = await import("fs/promises")
    const path = await import("path")
    
    const configPath = path.join(process.cwd(), "data", "players.json")
    
    let playerOrder: string[] = DEFAULT_PLAYER_ORDER
    
    try {
      const fileContent = await fs.readFile(configPath, "utf-8")
      playerOrder = JSON.parse(fileContent)
      
      if (!Array.isArray(playerOrder)) {
        playerOrder = DEFAULT_PLAYER_ORDER
      }
    } catch {
      // File doesn't exist, use default
      playerOrder = DEFAULT_PLAYER_ORDER
    }

    return playerOrder.map((playerId, index) => {
      const playerDef = DEFAULT_PLAYERS.find(p => p.id === playerId)
      if (!playerDef) {
        return {
          id: playerId,
          name: playerId,
          displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
          url: "",
          order: index + 1,
        }
      }
      return {
        id: playerDef.id,
        name: playerDef.name,
        displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
        url: playerDef.url,
        order: index + 1,
      }
    })
  } catch (error) {
    console.error("[players-config] Error loading players:", error)
    return DEFAULT_PLAYER_ORDER.map((playerId, index) => {
      const playerDef = DEFAULT_PLAYERS.find(p => p.id === playerId)
      return {
        id: playerDef?.id || playerId,
        name: playerDef?.name || playerId,
        displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
        url: playerDef?.url || "",
        order: index + 1,
      }
    })
  }
}

