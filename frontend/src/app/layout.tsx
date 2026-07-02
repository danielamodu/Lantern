import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader } from "next/font/google";
import { WalletProvider } from "@/lib/WalletContext";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Lantern — Private RWA ZK Settlement",
  description: "Verify face-value compliance of tokenized RWAs on Stellar privately on-chain.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/icon.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}

