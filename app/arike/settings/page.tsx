"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, Trash2, Upload, Sparkles, Palette, Mail } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"

interface MenuItem {
  label: string
  url: string
}

interface FooterLink {
  label: string
  url: string
}

interface QuickLinksColumn {
  title: string
  links: { label: string; url: string }[]
}

interface SocialLink {
  platform: string
  url: string
}

interface Settings {
  site_title: string
  site_description: string
  site_logo_url: string | null
  site_favicon_url: string | null
  theme_color: string
  header_menu: MenuItem[]
  footer_links: FooterLink[]
  quick_links: QuickLinksColumn[]
  social_links: SocialLink[]
  footer_text: string
  meta_home_title: string
  meta_movies_list_title: string
  meta_series_list_title: string
  meta_blog_list_title: string
  meta_movie_detail_title: string
  meta_series_detail_title: string
  meta_blog_post_title: string
  meta_page_title: string
  meta_movie_watch_title: string
  meta_series_watch_title: string
  watch_page_custom_html: string
  watch_page_middle_custom_html: string
  header_custom_code: string
  footer_custom_code: string
  enable_cache: boolean
  cache_ttl_minutes: number
  enable_image_optimization: boolean
  max_movies_per_page: number
  enable_lazy_loading: boolean
  database_query_timeout: number
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  smtp_password: string
  email_from: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [generatingLogo, setGeneratingLogo] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchCsrfToken().catch(console.error)
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings")
      const data = await response.json()
      
      if (response.ok && data && !data.error) {
        // Ensure all required fields have defaults
        const settingsWithDefaults: Settings = {
          site_title: data.site_title || "",
          site_description: data.site_description || "",
          site_logo_url: data.site_logo_url || null,
          site_favicon_url: data.site_favicon_url || null,
          theme_color: data.theme_color || "green",
          header_menu: Array.isArray(data.header_menu) ? data.header_menu : [],
          footer_links: Array.isArray(data.footer_links) ? data.footer_links : [],
          quick_links: Array.isArray(data.quick_links) ? data.quick_links : [],
          social_links: Array.isArray(data.social_links) ? data.social_links : [],
          footer_text: data.footer_text || "",
          meta_home_title: data.meta_home_title || "",
          meta_movies_list_title: data.meta_movies_list_title || "",
          meta_series_list_title: data.meta_series_list_title || "",
          meta_blog_list_title: data.meta_blog_list_title || "",
          meta_movie_detail_title: data.meta_movie_detail_title || "",
          meta_series_detail_title: data.meta_series_detail_title || "",
          meta_blog_post_title: data.meta_blog_post_title || "",
          meta_page_title: data.meta_page_title || "",
          meta_movie_watch_title: data.meta_movie_watch_title || "",
          meta_series_watch_title: data.meta_series_watch_title || "",
          watch_page_custom_html: data.watch_page_custom_html || "",
          watch_page_middle_custom_html: data.watch_page_middle_custom_html || "",
          header_custom_code: data.header_custom_code || "",
          footer_custom_code: data.footer_custom_code || "",
          enable_cache: data.enable_cache ?? true,
          cache_ttl_minutes: data.cache_ttl_minutes ?? 5,
          enable_image_optimization: data.enable_image_optimization ?? true,
          max_movies_per_page: data.max_movies_per_page ?? 20,
          enable_lazy_loading: data.enable_lazy_loading ?? true,
          database_query_timeout: data.database_query_timeout ?? 10,
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port ?? 587,
          smtp_secure: data.smtp_secure ?? false,
          smtp_user: data.smtp_user || "",
          smtp_password: data.smtp_password || "",
          email_from: data.email_from || "",
        }
        setSettings(settingsWithDefaults)
      } else {
        console.error("Error in settings response:", data.error || "Unknown error")
        setSettings(null)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers,
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        alert("Settings saved successfully!")
        router.refresh()
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("Save error:", errorData)
        alert(`Failed to save settings: ${errorData.details || errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (file: File, type: "logo" | "favicon") => {
    const setUploading = type === "logo" ? setUploadingLogo : setUploadingFavicon

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const { url } = await response.json()
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                [type === "logo" ? "site_logo_url" : "site_favicon_url"]: url,
              }
            : null,
        )
      } else {
        alert("Failed to upload image")
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  const handleGenerateLogo = async () => {
    if (!settings?.site_title) {
      alert("Please enter a site title first")
      return
    }

    setGeneratingLogo(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/generate-logo", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: settings.site_title }),
      })

      if (response.ok) {
        const { url } = await response.json()
        setSettings((prev) => (prev ? { ...prev, site_logo_url: url } : null))
        alert("Logo generated successfully!")
      } else {
        alert("Failed to generate logo")
      }
    } catch (error) {
      console.error("Error generating logo:", error)
      alert("Failed to generate logo")
    } finally {
      setGeneratingLogo(false)
    }
  }

  const addMenuItem = () => {
    if (!settings) return
    setSettings({
      ...settings,
      header_menu: [...settings.header_menu, { label: "", url: "" }],
    })
  }

  const removeMenuItem = (index: number) => {
    if (!settings) return
    setSettings({
      ...settings,
      header_menu: settings.header_menu.filter((_, i) => i !== index),
    })
  }

  const updateMenuItem = (index: number, field: "label" | "url", value: string) => {
    if (!settings) return
    const newMenu = [...settings.header_menu]
    newMenu[index][field] = value
    setSettings({ ...settings, header_menu: newMenu })
  }

  const addFooterLink = () => {
    if (!settings) return
    setSettings({
      ...settings,
      footer_links: [...settings.footer_links, { label: "", url: "" }],
    })
  }

  const removeFooterLink = (index: number) => {
    if (!settings) return
    setSettings({
      ...settings,
      footer_links: settings.footer_links.filter((_, i) => i !== index),
    })
  }

  const updateFooterLink = (index: number, field: "label" | "url", value: string) => {
    if (!settings) return
    const newLinks = [...settings.footer_links]
    newLinks[index][field] = value
    setSettings({ ...settings, footer_links: newLinks })
  }

  const addQuickLinksColumn = () => {
    if (!settings) return
    setSettings({
      ...settings,
      quick_links: [...settings.quick_links, { title: "", links: [] }],
    })
  }

  const removeQuickLinksColumn = (columnIndex: number) => {
    if (!settings) return
    setSettings({
      ...settings,
      quick_links: settings.quick_links.filter((_, i) => i !== columnIndex),
    })
  }

  const updateQuickLinksColumnTitle = (columnIndex: number, title: string) => {
    if (!settings) return
    const newQuickLinks = [...settings.quick_links]
    newQuickLinks[columnIndex].title = title
    setSettings({ ...settings, quick_links: newQuickLinks })
  }

  const addQuickLink = (columnIndex: number) => {
    if (!settings) return
    const newQuickLinks = [...settings.quick_links]
    newQuickLinks[columnIndex].links.push({ label: "", url: "" })
    setSettings({ ...settings, quick_links: newQuickLinks })
  }

  const removeQuickLink = (columnIndex: number, linkIndex: number) => {
    if (!settings) return
    const newQuickLinks = [...settings.quick_links]
    newQuickLinks[columnIndex].links = newQuickLinks[columnIndex].links.filter((_, i) => i !== linkIndex)
    setSettings({ ...settings, quick_links: newQuickLinks })
  }

  const updateQuickLink = (columnIndex: number, linkIndex: number, field: "label" | "url", value: string) => {
    if (!settings) return
    const newQuickLinks = [...settings.quick_links]
    newQuickLinks[columnIndex].links[linkIndex][field] = value
    setSettings({ ...settings, quick_links: newQuickLinks })
  }

  const updateSocialLink = (index: number, url: string) => {
    if (!settings) return
    const newLinks = [...settings.social_links]
    newLinks[index].url = url
    setSettings({ ...settings, social_links: newLinks })
  }

  const addSocialLink = () => {
    if (!settings) return
    setSettings({
      ...settings,
      social_links: [...settings.social_links, { platform: "facebook", url: "" }],
    })
  }

  const removeSocialLink = (index: number) => {
    if (!settings) return
    setSettings({
      ...settings,
      social_links: settings.social_links.filter((_, i) => i !== index),
    })
  }

  const updateSocialPlatform = (index: number, platform: string) => {
    if (!settings) return
    const newLinks = [...settings.social_links]
    newLinks[index].platform = platform
    setSettings({ ...settings, social_links: newLinks })
  }

  const updateHeaderCode = (value: string) => {
    if (!settings) return
    setSettings({ ...settings, header_custom_code: value })
  }

  const updateFooterCode = (value: string) => {
    if (!settings) return
    setSettings({ ...settings, footer_custom_code: value })
  }

  const updateEnableCache = (value: boolean) => {
    if (!settings) return
    setSettings({ ...settings, enable_cache: value })
  }

  const updateCacheTTLMinutes = (value: number) => {
    if (!settings) return
    setSettings({ ...settings, cache_ttl_minutes: value })
  }

  const updateEnableImageOptimization = (value: boolean) => {
    if (!settings) return
    setSettings({ ...settings, enable_image_optimization: value })
  }

  const updateMaxMoviesPerPage = (value: number) => {
    if (!settings) return
    setSettings({ ...settings, max_movies_per_page: value })
  }

  const updateEnableLazyLoading = (value: boolean) => {
    if (!settings) return
    setSettings({ ...settings, enable_lazy_loading: value })
  }

  const updateDatabaseQueryTimeout = (value: number) => {
    if (!settings) return
    setSettings({ ...settings, database_query_timeout: value })
  }

  const handleTestEmail = async () => {
    setTestingEmail(true)
    setEmailTestResult(null)
    try {
      const response = await fetch("/api/email/test")
      const data = await response.json()
      setEmailTestResult({
        success: data.success,
        message: data.success ? `Test email sent to ${data.recipient}` : data.error,
      })
    } catch (error) {
      setEmailTestResult({
        success: false,
        message: "Failed to send test email",
      })
    } finally {
      setTestingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading settings...</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Failed to load settings</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/arike/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Site Settings</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="header">Header Menu</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="seo">SEO Meta</TabsTrigger>
          <TabsTrigger value="watch">Watch Page</TabsTrigger>
          <TabsTrigger value="custom-code">Custom Code</TabsTrigger>
          <TabsTrigger value="optimization">Performance</TabsTrigger>
          <TabsTrigger value="email">Email Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure your site's basic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme_color" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Site Theme Color
                </Label>
                <Select
                  value={settings?.theme_color || "green"}
                  onValueChange={(value) => setSettings(settings ? { ...settings, theme_color: value } : null)}
                >
                  <SelectTrigger id="theme_color">
                    <SelectValue placeholder="Select a theme color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[oklch(0.92_0.18_127)]" />
                        <span>Green (Default)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="red">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[oklch(0.72_0.24_25)]" />
                        <span>Red</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="blue">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[oklch(0.72_0.18_245)]" />
                        <span>Blue</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gold">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[oklch(0.82_0.15_75)]" />
                        <span>Gold</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose a theme color for your site. This will change the accent colors throughout the entire website.
                  Save settings and refresh the page to see changes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_title">Site Title</Label>
                <div className="flex gap-2">
                  <Input
                    id="site_title"
                    value={settings.site_title}
                    onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
                    placeholder="M4UHDTV"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleGenerateLogo}
                    disabled={generatingLogo || !settings.site_title}
                    variant="outline"
                    className="gap-2 bg-transparent"
                  >
                    <Sparkles className="h-4 w-4" />
                    {generatingLogo ? "Generating..." : "Generate Logo"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click "Generate Logo" to create a logo with your site title in the signature lime green style
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_description">Site Description</Label>
                <Textarea
                  id="site_description"
                  value={settings.site_description}
                  onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
                  placeholder="Stream the latest movies and TV shows..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Site Logo</Label>
                <div className="flex items-center gap-4">
                  {settings.site_logo_url && (
                    <img
                      src={settings.site_logo_url || "/placeholder.svg"}
                      alt="Logo"
                      className="h-12 w-auto object-contain"
                    />
                  )}
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file, "logo")
                      }}
                      disabled={uploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Label htmlFor="logo-upload">
                      <Button variant="outline" size="sm" disabled={uploadingLogo} asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingLogo ? "Uploading..." : "Upload Logo"}
                        </span>
                      </Button>
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Site Favicon</Label>
                <div className="flex items-center gap-4">
                  {settings.site_favicon_url && (
                    <img
                      src={settings.site_favicon_url || "/placeholder.svg"}
                      alt="Favicon"
                      className="h-8 w-8 object-contain"
                    />
                  )}
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file, "favicon")
                      }}
                      disabled={uploadingFavicon}
                      className="hidden"
                      id="favicon-upload"
                    />
                    <Label htmlFor="favicon-upload">
                      <Button variant="outline" size="sm" disabled={uploadingFavicon} asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingFavicon ? "Uploading..." : "Upload Favicon"}
                        </span>
                      </Button>
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="header">
          <Card>
            <CardHeader>
              <CardTitle>Header Menu</CardTitle>
              <CardDescription>Configure your site's navigation menu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.header_menu.map((item, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={item.label}
                      onChange={(e) => updateMenuItem(index, "label", e.target.value)}
                      placeholder="Home"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>URL</Label>
                    <Input
                      value={item.url}
                      onChange={(e) => updateMenuItem(index, "url", e.target.value)}
                      placeholder="/"
                    />
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => removeMenuItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button onClick={addMenuItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Menu Item
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Footer Text</CardTitle>
                <CardDescription>The tagline displayed in your footer</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={settings.footer_text}
                  onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
                  placeholder="YOUR FAVORITE MOVIES ON M4UHDTV"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Links (3 Column Section)</CardTitle>
                <CardDescription>
                  Configure the three-column quick links section in the footer. Each column can have a title and
                  multiple links.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings.quick_links && settings.quick_links.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {settings.quick_links.map((column, columnIndex) => (
                      <div key={columnIndex} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Column {columnIndex + 1}</Label>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeQuickLinksColumn(columnIndex)}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label>Column Title</Label>
                          <Input
                            value={column.title}
                            onChange={(e) => updateQuickLinksColumnTitle(columnIndex, e.target.value)}
                            placeholder="Browse"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label className="text-sm">Links</Label>
                          {column.links.map((link, linkIndex) => (
                            <div key={linkIndex} className="space-y-2 p-3 bg-muted rounded-md">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Link {linkIndex + 1}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeQuickLink(columnIndex, linkIndex)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input
                                value={link.label}
                                onChange={(e) => updateQuickLink(columnIndex, linkIndex, "label", e.target.value)}
                                placeholder="Movies"
                                className="text-sm"
                              />
                              <Input
                                value={link.url}
                                onChange={(e) => updateQuickLink(columnIndex, linkIndex, "url", e.target.value)}
                                placeholder="/movies"
                                className="text-sm"
                              />
                            </div>
                          ))}
                          <Button
                            onClick={() => addQuickLink(columnIndex)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            Add Link to Column
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No quick links columns yet. Add your first column to get started.
                  </p>
                )}
                <Button
                  onClick={addQuickLinksColumn}
                  variant="outline"
                  size="sm"
                  disabled={settings.quick_links?.length >= 3}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Column{" "}
                  {settings.quick_links?.length < 3 && `(${3 - settings.quick_links?.length} more available)`}
                </Button>
                {settings.quick_links?.length >= 3 && (
                  <p className="text-xs text-muted-foreground">Maximum of 3 columns reached</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Footer Links</CardTitle>
                <CardDescription>Configure your footer navigation links (bottom row)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.footer_links.map((link, index) => (
                  <div key={index} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Label</Label>
                      <Input
                        value={link.label}
                        onChange={(e) => updateFooterLink(index, "label", e.target.value)}
                        placeholder="DMCA"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>URL</Label>
                      <Input
                        value={link.url}
                        onChange={(e) => updateFooterLink(index, "url", e.target.value)}
                        placeholder="/dmca"
                      />
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => removeFooterLink(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addFooterLink} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Footer Link
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <CardDescription>Configure your social media profiles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.social_links.map((link, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <div className="w-32">
                      <Select
                        value={link.platform}
                        onValueChange={(value) => updateSocialPlatform(index, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="twitter">Twitter</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="pinterest">Pinterest</SelectItem>
                          <SelectItem value="reddit">Reddit</SelectItem>
                          <SelectItem value="discord">Discord</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={link.url}
                      onChange={(e) => updateSocialLink(index, e.target.value)}
                      placeholder={`https://${link.platform}.com/...`}
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeSocialLink(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addSocialLink} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Social Media Link
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seo">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SEO Meta Title Patterns</CardTitle>
                <CardDescription>
                  Customize the title patterns for different page types. Use {"{site_name}"} for the site name and{" "}
                  {"{title}"} for the page/post/movie/series title.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="meta_home_title">Homepage Title</Label>
                  <Input
                    id="meta_home_title"
                    value={settings.meta_home_title}
                    onChange={(e) => setSettings({ ...settings, meta_home_title: e.target.value })}
                    placeholder="{site_name} - Watch/Download Movies & TV Shows HD Free"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: ROCKFLIX - Watch/Download Movies & TV Shows HD Free
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_movies_list_title">Movies Listing Page Title</Label>
                  <Input
                    id="meta_movies_list_title"
                    value={settings.meta_movies_list_title}
                    onChange={(e) => setSettings({ ...settings, meta_movies_list_title: e.target.value })}
                    placeholder="Movies - Watch/Download Full Movies HD Free | {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: Movies - Watch/Download Full Movies HD Free | ROCKFLIX
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_series_list_title">TV Shows Listing Page Title</Label>
                  <Input
                    id="meta_series_list_title"
                    value={settings.meta_series_list_title}
                    onChange={(e) => setSettings({ ...settings, meta_series_list_title: e.target.value })}
                    placeholder="TV Shows - Watch/Download Full Seasons HD Free | {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: TV Shows - Watch/Download Full Seasons HD Free | ROCKFLIX
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_blog_list_title">Blog Listing Page Title</Label>
                  <Input
                    id="meta_blog_list_title"
                    value={settings.meta_blog_list_title}
                    onChange={(e) => setSettings({ ...settings, meta_blog_list_title: e.target.value })}
                    placeholder="Blog - Latest News & Updates | {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">Example: Blog - Latest News & Updates | ROCKFLIX</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_movie_detail_title">Individual Movie Page Title</Label>
                  <Input
                    id="meta_movie_detail_title"
                    value={settings.meta_movie_detail_title}
                    onChange={(e) => setSettings({ ...settings, meta_movie_detail_title: e.target.value })}
                    placeholder="{title} | Watch/Download Full Movie HD Free - {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: Inception | Watch/Download Full Movie HD Free - ROCKFLIX
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_series_detail_title">Individual Series Page Title</Label>
                  <Input
                    id="meta_series_detail_title"
                    value={settings.meta_series_detail_title}
                    onChange={(e) => setSettings({ ...settings, meta_series_detail_title: e.target.value })}
                    placeholder="{title} | Watch/Download Full Seasons HD Free - {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: Breaking Bad | Watch/Download Full Seasons HD Free - ROCKFLIX
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_movie_watch_title">Movie Watch Page Title</Label>
                  <Input
                    id="meta_movie_watch_title"
                    value={settings.meta_movie_watch_title}
                    onChange={(e) => setSettings({ ...settings, meta_movie_watch_title: e.target.value })}
                    placeholder="Watch {title} Online Free HD - {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">Example: Watch Inception Online Free HD - ROCKFLIX</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_series_watch_title">Series Watch Page Title</Label>
                  <Input
                    id="meta_series_watch_title"
                    value={settings.meta_series_watch_title}
                    onChange={(e) => setSettings({ ...settings, meta_series_watch_title: e.target.value })}
                    placeholder="Watch {title} Online Free HD - {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">Example: Watch Breaking Bad Online Free HD - ROCKFLIX</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_blog_post_title">Individual Blog Post Title</Label>
                  <Input
                    id="meta_blog_post_title"
                    value={settings.meta_blog_post_title}
                    onChange={(e) => setSettings({ ...settings, meta_blog_post_title: e.target.value })}
                    placeholder="{title} - {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">Example: Latest Updates - ROCKFLIX</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_page_title">Custom Page Title</Label>
                  <Input
                    id="meta_page_title"
                    value={settings.meta_page_title}
                    onChange={(e) => setSettings({ ...settings, meta_page_title: e.target.value })}
                    placeholder="{title} - {site_name}"
                  />
                  <p className="text-xs text-muted-foreground">Example: About Us - ROCKFLIX</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="watch">
          <Card>
            <CardHeader>
              <CardTitle>Watch Page Custom Content</CardTitle>
              <CardDescription>
                Add custom text or HTML code that will be displayed on watch pages. You can use these sections for
                announcements, notices, ads, or any custom content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="watch_page_middle_custom_html">Custom Content (Between Back Button & Title)</Label>
                <Textarea
                  id="watch_page_middle_custom_html"
                  value={settings?.watch_page_middle_custom_html || ""}
                  onChange={(e) =>
                    setSettings(settings ? { ...settings, watch_page_middle_custom_html: e.target.value } : null)
                  }
                  placeholder="Enter custom HTML or text here..."
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This content appears between the "Back to details" button and the movie/series title. Perfect for
                  announcements or banner ads.
                </p>
              </div>

              {settings?.watch_page_middle_custom_html && (
                <div className="space-y-2">
                  <Label>Preview (Middle Position)</Label>
                  <div
                    className="p-4 border rounded-lg bg-card"
                    dangerouslySetInnerHTML={{ __html: settings.watch_page_middle_custom_html }}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="watch_page_custom_html">Custom Content (Below Video Player)</Label>
                <Textarea
                  id="watch_page_custom_html"
                  value={settings?.watch_page_custom_html || ""}
                  onChange={(e) =>
                    setSettings(settings ? { ...settings, watch_page_custom_html: e.target.value } : null)
                  }
                  placeholder="Enter custom HTML or text here..."
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This content appears between the player selection buttons and the ad box below the player.
                </p>
              </div>

              {settings?.watch_page_custom_html && (
                <div className="space-y-2">
                  <Label>Preview (Below Player)</Label>
                  <div
                    className="p-4 border rounded-lg bg-card"
                    dangerouslySetInnerHTML={{ __html: settings.watch_page_custom_html }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-code">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Header Custom Code</CardTitle>
                <CardDescription>
                  Add custom HTML or JavaScript code that will be injected into the site header (before closing
                  &lt;/head&gt; tag). Perfect for analytics, tracking pixels, or custom meta tags.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="header_custom_code">Header Code</Label>
                  <Textarea
                    id="header_custom_code"
                    value={settings.header_custom_code || ""}
                    onChange={(e) => updateHeaderCode(e.target.value)}
                    placeholder="<!-- Google Analytics, Meta Tags, etc. -->"
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: &lt;script&gt;console.log('Header loaded');&lt;/script&gt; or &lt;meta name="custom"
                    content="value"&gt;
                  </p>
                </div>

                {settings.header_custom_code && (
                  <div className="space-y-2">
                    <Label>Preview (Code)</Label>
                    <pre className="p-4 border rounded-lg bg-muted text-xs overflow-x-auto">
                      {settings.header_custom_code}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Footer Custom Code</CardTitle>
                <CardDescription>
                  Add custom HTML or JavaScript code that will be injected at the end of the site footer (before closing
                  &lt;/body&gt; tag). Perfect for chat widgets, analytics, or custom scripts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="footer_custom_code">Footer Code</Label>
                  <Textarea
                    id="footer_custom_code"
                    value={settings.footer_custom_code || ""}
                    onChange={(e) => updateFooterCode(e.target.value)}
                    placeholder="<!-- Chat widgets, Analytics, etc. -->"
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: &lt;script src="https://example.com/widget.js"&gt;&lt;/script&gt;
                  </p>
                </div>

                {settings.footer_custom_code && (
                  <div className="space-y-2">
                    <Label>Preview (Code)</Label>
                    <pre className="p-4 border rounded-lg bg-muted text-xs overflow-x-auto">
                      {settings.footer_custom_code}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization">
          <Card>
            <CardHeader>
              <CardTitle>Performance & Optimization Settings</CardTitle>
              <CardDescription>
                Configure caching, database settings, and performance optimizations to handle higher traffic efficiently
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_cache">Enable Redis Caching</Label>
                    <p className="text-sm text-muted-foreground">
                      Cache frequently accessed data to reduce database load (Requires Upstash Redis setup)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="enable_cache"
                    checked={settings?.enable_cache ?? true}
                    onChange={(e) => updateEnableCache(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache_ttl_minutes">Cache Duration (minutes)</Label>
                  <Input
                    id="cache_ttl_minutes"
                    type="number"
                    min="1"
                    max="60"
                    value={settings?.cache_ttl_minutes ?? 5}
                    onChange={(e) => updateCacheTTLMinutes(Number.parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">
                    How long to cache data before refreshing (5-15 minutes recommended)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_image_optimization">Enable Image Optimization</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically optimize and compress images for faster loading
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="enable_image_optimization"
                    checked={settings?.enable_image_optimization ?? true}
                    onChange={(e) => updateEnableImageOptimization(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_lazy_loading">Enable Lazy Loading</Label>
                    <p className="text-sm text-muted-foreground">
                      Load images and content only when they come into view (improves initial page load)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="enable_lazy_loading"
                    checked={settings?.enable_lazy_loading ?? true}
                    onChange={(e) => updateEnableLazyLoading(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_movies_per_page">Movies Per Page</Label>
                  <Input
                    id="max_movies_per_page"
                    type="number"
                    min="10"
                    max="50"
                    value={settings?.max_movies_per_page ?? 20}
                    onChange={(e) => updateMaxMoviesPerPage(Number.parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of movies to display per page (20 recommended for best performance)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="database_query_timeout">Database Query Timeout (seconds)</Label>
                  <Input
                    id="database_query_timeout"
                    type="number"
                    min="5"
                    max="30"
                    value={settings?.database_query_timeout ?? 10}
                    onChange={(e) => updateDatabaseQueryTimeout(Number.parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum time to wait for database queries (10 seconds recommended)
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">Performance Tips:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Enable caching to reduce database load by 60-70%</li>
                    <li>Lower cache TTL during high traffic periods</li>
                    <li>Keep movies per page at 20 for optimal loading times</li>
                    <li>Enable lazy loading to improve initial page loads</li>
                    <li>Monitor database performance and adjust timeouts as needed</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP Email Configuration
              </CardTitle>
              <CardDescription>
                Configure your SMTP email settings for sending notifications, password resets, and system emails. Use
                your webmaster@rockflix.org credentials from Namecheap Private Email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    value={settings?.smtp_host || ""}
                    onChange={(e) => setSettings(settings ? { ...settings, smtp_host: e.target.value } : null)}
                    placeholder="mail.privateemail.com"
                  />
                  <p className="text-xs text-muted-foreground">For Namecheap: mail.privateemail.com</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Select
                    value={settings?.smtp_port?.toString() || "587"}
                    onValueChange={(value) =>
                      setSettings(settings ? { ...settings, smtp_port: Number.parseInt(value) } : null)
                    }
                  >
                    <SelectTrigger id="smtp_port">
                      <SelectValue placeholder="Select port" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="587">587 (TLS - Recommended)</SelectItem>
                      <SelectItem value="465">465 (SSL)</SelectItem>
                      <SelectItem value="25">25 (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Use 587 for TLS encryption</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="smtp_secure">Use SSL/TLS Encryption</Label>
                  <p className="text-sm text-muted-foreground">Enable secure connection (Required for port 465)</p>
                </div>
                <input
                  type="checkbox"
                  id="smtp_secure"
                  checked={settings?.smtp_secure ?? false}
                  onChange={(e) => setSettings(settings ? { ...settings, smtp_secure: e.target.checked } : null)}
                  className="h-4 w-4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_user">SMTP Username (Email Address)</Label>
                <Input
                  id="smtp_user"
                  value={settings?.smtp_user || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, smtp_user: e.target.value } : null)}
                  placeholder="webmaster@rockflix.org"
                  type="email"
                />
                <p className="text-xs text-muted-foreground">Your full email address</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <Input
                  id="smtp_password"
                  value={settings?.smtp_password || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, smtp_password: e.target.value } : null)}
                  placeholder="????????????????????????????????????"
                  type="password"
                />
                <p className="text-xs text-muted-foreground">Your email account password</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_from">From Email Address</Label>
                <Input
                  id="email_from"
                  value={settings?.email_from || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, email_from: e.target.value } : null)}
                  placeholder="webmaster@rockflix.org"
                  type="email"
                />
                <p className="text-xs text-muted-foreground">
                  The email address that will appear as the sender on all outgoing emails
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Namecheap Private Email Setup Guide:
                </h4>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>
                    <strong>SMTP Host:</strong> mail.privateemail.com
                  </li>
                  <li>
                    <strong>SMTP Port:</strong> 587 (TLS) or 465 (SSL)
                  </li>
                  <li>
                    <strong>Username:</strong> Your full email (webmaster@rockflix.org)
                  </li>
                  <li>
                    <strong>Password:</strong> Your email account password
                  </li>
                  <li>
                    <strong>Important:</strong> Complete DNS setup (MX, SPF, DKIM records) before testing
                  </li>
                  <li>
                    <strong>Wait Time:</strong> Allow 4 hours for DNS propagation after setup
                  </li>
                </ol>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  variant="outline"
                  className="gap-2 bg-transparent"
                >
                  <Mail className="h-4 w-4" />
                  {testingEmail ? "Testing..." : "Send Test Email"}
                </Button>

                {emailTestResult && (
                  <div
                    className={`flex-1 p-3 rounded-lg ${
                      emailTestResult.success
                        ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <p className="text-sm font-medium">{emailTestResult.message}</p>
                  </div>
                )}
              </div>

              <div className="p-4 yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Note:</strong> After saving these settings, environment variables will be automatically
                  updated. Make sure to complete your DNS configuration (MX records, SPF, DKIM) in Namecheap before
                  testing email functionality.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
