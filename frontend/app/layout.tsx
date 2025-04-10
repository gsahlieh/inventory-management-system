import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { ThemeProvider } from "next-themes";
import { Geist } from "next/font/google";
import Image from "next/image"; // <-- Import the Image component
import Link from "next/link";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Inventory Management System",
  description: "Manage your inventory efficiently.",  // Add icons configuration
  icons: {
    icon: "/logo.png", // Path relative to public folder for favicon/browser tab
  },
  openGraph: {
    title: "Inventory Management System", // OG Title
    description: "Manage your inventory efficiently.", // OG Description
    images: [
      {
        url: `${defaultUrl}/logo.png`, // MUST be an absolute URL for OG
        width: 1200, // Optional: Specify width
        height: 630, // Optional: Specify height
        alt: "Inventory Management System Logo", // Optional: Alt text
      },
    ],
  },
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="text-foreground relative overflow-auto">
        <div className="gradient-background"></div>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-10 md:gap-20 items-center">
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-5xl flex flex-row justify-between items-center p-2 px-3 md:p-3 md:px-5 text-sm">
                  {/* --- Nav Icon Update --- */}
                  <div className="flex items-center font-semibold">
                    {/* Wrap Image and Text in Link for combined click area */}
                    <Link href={"/"} className="flex items-center gap-2">
                      <div className="bg-black rounded-lg p-1">
                        <Image
                          src="/logo.png" // Path relative to public folder
                          alt="App Logo"
                          width={24} // Adjust size as needed
                          height={24} // Adjust size as needed
                          priority // Optional: Load icon faster as it's in the initial view
                        />
                      </div>

                      <span className="hidden sm:inline">Inventory Management System</span>
                    </Link>
                  </div>
                  {/* --- End Nav Icon Update --- */}
                  <div className="flex-shrink-0">
                    {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                  </div>
                </div>
              </nav>
              <div className="flex flex-col gap-10 md:gap-20 w-full max-w-5xl px-4 sm:px-5 md:p-5">
                {children}
              </div>

              <footer className="w-full flex flex-col sm:flex-row items-center justify-center border-t mx-auto text-center text-xs gap-4 sm:gap-8 py-8 sm:py-16 px-4">
                <p>
                  Made By{" "}
                  <a
                    href="https://www.gabrielsahlieh.com/"
                    target="_blank"
                    className="font-bold hover:underline"
                    rel="noreferrer"
                  >
                    Gabriel Sahlieh
                  </a>
                </p>
                <ThemeSwitcher />
              </footer>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
