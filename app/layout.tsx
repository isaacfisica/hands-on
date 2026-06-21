import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import '@/design-system/globals.css';
import './fx.css';
import Navbar from '@/design-system/navbar';
import { ThemeProvider } from '@/lib/theme-context';
import Footer from '@/design-system/footer';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  title: '이삭 ISAAC',
  description: '이탈리아 물리학과 대학원생; 실험 핵·입자물리학; 국제공동연구',
  openGraph: {
    title: '이삭 ISAAC',
    description: '이탈리아 물리학과 대학원생; 실험 핵·입자물리학; 국제공동연구 ',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAF8F3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 한글(Noto Sans KR)은 unicode-range로 안전하게 로드 — CJK 서브셋 이슈 회피 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <Navbar />
          {children}
          <Footer />
        </ThemeProvider>
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}
      </body>
    </html>
  );
}
