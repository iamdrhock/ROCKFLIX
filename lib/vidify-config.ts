/**
 * Vidify Player Configuration
 * Customizable system for Vidify player parameters
 */

export interface VidifyConfig {
  // Logo
  logourl: string | null
  
  // Player Features
  autoplay: boolean
  poster: boolean
  chromecast: boolean
  servericon: boolean
  setting: boolean
  pip: boolean
  download: boolean
  
  // Appearance
  font: string
  fontcolor: string
  fontsize: string
  opacity: string
  primarycolor: string
  secondarycolor: string
  iconcolor: string
}

export const DEFAULT_VIDIFY_CONFIG: VidifyConfig = {
  logourl: null,
  autoplay: true,
  poster: true,
  chromecast: true,
  servericon: true,
  setting: true,
  pip: true,
  download: true,
  font: 'Roboto',
  fontcolor: '6f63ff',
  fontsize: '20',
  opacity: '0.5',
  primarycolor: '3b82f6',
  secondarycolor: '1f2937',
  iconcolor: 'ffffff',
}

/**
 * Build Vidify embed URL with custom configuration
 */
export function buildVidifyUrl(
  tmdbId: string | number,
  type: 'movie' | 'series',
  config: Partial<VidifyConfig>,
  season?: number,
  episode?: number
): string {
  const baseUrl = 'https://player.vidify.top/embed'
  const fullConfig = { ...DEFAULT_VIDIFY_CONFIG, ...config }
  
  // Build the embed path
  let embedPath = ''
  if (type === 'movie') {
    embedPath = `/movie/${tmdbId}`
  } else {
    embedPath = `/tv/${tmdbId}/${season || 1}/${episode || 1}`
  }
  
  // Build query parameters
  const params = new URLSearchParams()
  
  // Boolean parameters
  if (fullConfig.autoplay) params.set('autoplay', 'true')
  if (fullConfig.poster) params.set('poster', 'true')
  if (fullConfig.chromecast) params.set('chromecast', 'true')
  if (fullConfig.servericon) params.set('servericon', 'true')
  if (fullConfig.setting) params.set('setting', 'true')
  if (fullConfig.pip) params.set('pip', 'true')
  if (fullConfig.download) params.set('download', 'true')
  
  // Logo URL (must be absolute URL with protocol)
  // Build exactly as shown in documentation: logourl=http%3A%2F%2Fexample.com%2Flogo.png
  // Always include logourl parameter - use site logo from settings or fallback
  let logoUrl = fullConfig.logourl?.trim() || null
  
  if (!logoUrl) {
    // If no logo URL in config, try to get it from window location or env
    const siteUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://rockflix.tv')
    // Use a placeholder or site default logo
    logoUrl = `${siteUrl}/placeholder.svg`
    console.warn("[Vidify] No logo URL in config, using fallback:", logoUrl)
  } else {
    // Ensure it's an absolute URL
    if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
      const siteUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : (process.env.NEXT_PUBLIC_SITE_URL || 'https://rockflix.tv')
      logoUrl = logoUrl.startsWith('/') 
        ? `${siteUrl}${logoUrl}` 
        : `${siteUrl}/${logoUrl}`
    }
  }
  
  // URLSearchParams.set() automatically encodes the URL - this matches documentation format
  // The result will be: logourl=http%3A%2F%2Fexample.com%2Flogo.png
  params.set('logourl', logoUrl)
  console.log("[Vidify] Setting logourl parameter:", logoUrl)
  
  // Appearance parameters
  params.set('font', fullConfig.font)
  params.set('fontcolor', fullConfig.fontcolor)
  params.set('fontsize', fullConfig.fontsize)
  params.set('opacity', fullConfig.opacity)
  params.set('primarycolor', fullConfig.primarycolor)
  params.set('secondarycolor', fullConfig.secondarycolor)
  params.set('iconcolor', fullConfig.iconcolor)
  
  return `${baseUrl}${embedPath}?${params.toString()}`
}

