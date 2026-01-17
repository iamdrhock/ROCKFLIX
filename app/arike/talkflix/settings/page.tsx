"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface HeaderMenuItem {
  label: string
  url: string
}

interface FooterLink {
  label: string
  url: string
}

interface SettingsData {
  logo_url: string
  header_menu: HeaderMenuItem[]
  footer_links: FooterLink[]
  footer_text: string
}

export default function TalkFlixSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    logo_url: "",
    header_menu: [],
    footer_links: [],
    footer_text: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const response = await fetch("/api/admin/talkflix/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings({
          logo_url: data.site_logo_url || "",
          header_menu: data.header_menu || [],
          footer_links: data.footer_links || [],
          footer_text: data.footer_text || "",
        })
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/admin/talkflix/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_logo_url: settings.logo_url,
          header_menu: settings.header_menu,
          footer_links: settings.footer_links,
          footer_text: settings.footer_text,
        }),
      })

      if (response.ok) {
        setMessage("Settings saved successfully!")
      } else {
        setMessage("Failed to save settings")
      }
    } catch (error) {
      setMessage("An error occurred")
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  function addHeaderItem() {
    setSettings({
      ...settings,
      header_menu: [...settings.header_menu, { label: "", url: "" }],
    })
  }

  function removeHeaderItem(index: number) {
    setSettings({
      ...settings,
      header_menu: settings.header_menu.filter((_, i) => i !== index),
    })
  }

  function updateHeaderItem(index: number, field: "label" | "url", value: string) {
    const updated = [...settings.header_menu]
    updated[index][field] = value
    setSettings({ ...settings, header_menu: updated })
  }

  function addFooterLink() {
    setSettings({
      ...settings,
      footer_links: [...settings.footer_links, { label: "", url: "" }],
    })
  }

  function removeFooterLink(index: number) {
    setSettings({
      ...settings,
      footer_links: settings.footer_links.filter((_, i) => i !== index),
    })
  }

  function updateFooterLink(index: number, field: "label" | "url", value: string) {
    const updated = [...settings.footer_links]
    updated[index][field] = value
    setSettings({ ...settings, footer_links: updated })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/arike/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">TalkFlix Settings</h1>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.includes("success") ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            }`}
          >
            {message}
          </div>
        )}

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Logo Settings</CardTitle>
            <CardDescription>Set the TalkFlix logo (leave empty for default text logo)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                value={settings.logo_url}
                onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            {settings.logo_url && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">Preview:</span>
                <img
                  src={settings.logo_url || "/placeholder.svg"}
                  alt="Logo preview"
                  className="h-8 w-auto object-contain"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Header Menu Items</CardTitle>
            <CardDescription>Add custom navigation links to the header</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.header_menu.map((item, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Label</Label>
                  <Input
                    value={item.label}
                    onChange={(e) => updateHeaderItem(index, "label", e.target.value)}
                    placeholder="About"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="flex-1">
                  <Label>URL</Label>
                  <Input
                    value={item.url}
                    onChange={(e) => updateHeaderItem(index, "url", e.target.value)}
                    placeholder="/about"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <Button variant="destructive" size="icon" onClick={() => removeHeaderItem(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addHeaderItem} variant="outline" className="w-full bg-transparent">
              <Plus className="h-4 w-4 mr-2" />
              Add Header Link
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Footer Settings</CardTitle>
            <CardDescription>Customize footer text and links</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="footer-text">Footer Text</Label>
              <Textarea
                id="footer-text"
                value={settings.footer_text}
                onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
                placeholder="Your description here..."
                className="bg-gray-800 border-gray-700"
                rows={3}
              />
            </div>

            <div className="space-y-4 mt-6">
              <Label>Footer Links</Label>
              {settings.footer_links.map((link, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      value={link.label}
                      onChange={(e) => updateFooterLink(index, "label", e.target.value)}
                      placeholder="Privacy Policy"
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={link.url}
                      onChange={(e) => updateFooterLink(index, "url", e.target.value)}
                      placeholder="/privacy"
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => removeFooterLink(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button onClick={addFooterLink} variant="outline" className="w-full bg-transparent">
                <Plus className="h-4 w-4 mr-2" />
                Add Footer Link
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button onClick={saveSettings} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  )
}
