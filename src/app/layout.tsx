import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wapix Todo — WhatsApp OTP Authentication & Task Manager",
  description:
    "Functional To-Do app with WhatsApp OTP authentication powered by Wapix API and localStorage persistence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0b0f14] text-slate-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-400 font-['Plus_Jakarta_Sans',sans-serif]">
        {children}
      </body>
    </html>
  );
}
