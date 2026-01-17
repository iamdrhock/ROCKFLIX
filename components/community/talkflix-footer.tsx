"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface FooterLink {
  label: string
  url: string
}

interface FooterData {
  links: FooterLink[]
  text: string
}

export function TalkFlixFooter() {
  const [footerData, setFooterData] = useState<FooterData>({
    links: [],
    text: "",
  })
  const supabase = createClient()

  useEffect(() => {
    async function loadFooterData() {
      const { data, error } = await supabase.from("site_settings").select("footer_links, footer_text").single()

      if (data && !error) {
        setFooterData({
          links: (data.footer_links as FooterLink[]) || [],
          text: data.footer_text || "",
        })
      }
    }

    loadFooterData()
  }, [supabase])

  return (
    <footer className="border-t border-border/40 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60 mt-auto">
      <div className="container py-8 px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <Link href="/community" className="inline-flex items-center gap-2 mb-2">
              <div className="text-xl font-bold">
                <span className="text-red-500">Talk</span>
                <span className="text-white">Flix</span>
              </div>
            </Link>
            {footerData.text && <p className="text-sm text-gray-400 max-w-md">{footerData.text}</p>}
          </div>

          {footerData.links.length > 0 && (
            <nav className="flex flex-wrap items-center justify-center gap-4">
              {footerData.links.map((link, index) => (
                <Link key={index} href={link.url} className="text-sm text-gray-400 hover:text-white transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-border/40 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} TalkFlix. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
