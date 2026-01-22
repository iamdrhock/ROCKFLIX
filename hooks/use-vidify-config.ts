"use client"

import { useState, useEffect } from "react"
import { VidifyConfig, DEFAULT_VIDIFY_CONFIG } from "@/lib/vidify-config"

export function useVidifyConfig() {
    const [config, setConfig] = useState<VidifyConfig>(DEFAULT_VIDIFY_CONFIG)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchConfig() {
            try {
                const response = await fetch("/api/settings")
                if (response.ok) {
                    const data = await response.json()

                    if (data && data.site_logo_url) {
                        setConfig(prev => ({
                            ...prev,
                            logourl: data.site_logo_url
                        }))
                    }
                }
            } catch (error) {
                console.error("Error fetching settings for vidify config:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchConfig()
    }, [])

    return { config, loading }
}
