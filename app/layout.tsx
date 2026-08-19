// Root layout — Section 8 (Next.js App Router). Loads the design system
// (globals.css) and the persistent app nav (hidden on marketing/auth pages).
import type { ReactNode } from "react";
import "./globals.css";
import { AppNav } from "@/components/AppNav";

export const metadata = {
  title: "Loyalty & Cashback Optimizer",
  description: "Scan receipts; learn whether you used the optimal card.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
