import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

/** 供 OG／Twitter 絕對網址；本機與 Preview 會自動用 VERCEL_URL */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://card-calc.vercel.app')

const defaultTitle = '日本旅遊刷卡試算 | 最強刷卡組合計算機'
const defaultDescription =
  '輸入旅遊消費金額，自動計算最優信用卡組合，扣除海外手續費後顯示最高淨回饋。支援富邦J卡、國泰CUBE、玉山熊本熊、台新FlyGo。'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: defaultTitle,
  description: defaultDescription,
  generator: 'v0.app',
  /** 社群縮圖：與 Referral_Source_ID／UTM 分開追蹤；分享連結帶參數時仍指向同一張 OG 圖 */
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: 'website',
    locale: 'zh_TW',
    images: [
      {
        url: '/japan_creditcard_calculator.jpeg',
        width: 1200,
        height: 630,
        alt: '日本旅遊刷卡試算 — 聰明規劃刷卡消費、估算旅遊回饋',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/japan_creditcard_calculator.jpeg'],
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
