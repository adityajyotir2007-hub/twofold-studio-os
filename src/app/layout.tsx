import type { Metadata } from "next";
import "./globals.css";
import { AgencyProvider } from "@/context/AgencyContext";

export const metadata: Metadata = {
  title: "Twofold Studio OS",
  description: "Internal agency operating system for Twofold Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AgencyProvider>{children}</AgencyProvider>
      </body>
    </html>
  );
}
