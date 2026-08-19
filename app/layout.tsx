// Root layout — Section 8 (Next.js App Router). Frontend is scaffolded per
// Section 7 build order step 8 (auth pages -> card mgmt -> upload/review -> dashboard).
// Pages themselves are placeholders; the backend HTTP layer is stubbed (501).
import type { ReactNode } from "react";

export const metadata = {
  title: "Loyalty & Cashback Optimizer",
  description: "Scan receipts; learn whether you used the optimal card.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
