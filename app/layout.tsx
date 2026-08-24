import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import SessionProvider from "@/components/providers/SessionProvider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter"
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  title: "MirrorSite AI - Clone Any Website with AI",
  description: "Transform any website into your own with AI-powered design cloning. Built by ATAI Enterprises.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} font-sans`}>
        <SessionProvider>
          {children}
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
