import "./globals.css";
import { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { Toaster } from "sonner";
import { Banner } from "@/components/Banner";
import { AuthProvider } from "@/lib/auth";
import { BraveBrowserNotice } from "@/components/BraveBrowserNotice";

export const metadata = {
  title: "Rare Bridge AI",
  description: "AI tools and community for rare disorders",
  other: {
    "X-UA-Compatible": "IE=edge",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Help prevent wallet extension interference */}
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Banner />
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster richColors />
          <BraveBrowserNotice />
        </AuthProvider>
      </body>
    </html>
  );
}
