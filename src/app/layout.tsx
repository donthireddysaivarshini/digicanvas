import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DigiCanvas - Client Content Management & Approval Portal",
  description: "Enterprise content approval and multi-tenant portal for digital marketing agencies and clients.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-zinc-50 dark:bg-zinc-950 font-sans antialiased text-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
