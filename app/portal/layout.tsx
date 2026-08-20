import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mitgliederportal",
  description: "Meetingraum buchen und AUFELD21-Unterlagen verwalten.",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
