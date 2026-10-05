import type { Metadata } from "next";
import { WorkspaceOffer } from "@/app/homepage-preview/workspace-offer";
import { siteUrl } from "@/lib/site";
const title = "Büro mieten in Traun – möblierte Büros bei AUFELD21";
const description = "Eigenes Büro in Traun Oedt: 17 m² ab 490 € oder 24,78 m² ab 590 € netto/Monat. Internet und Meetingraum-Kontingent inklusive. Besichtigung anfragen.";
export const metadata: Metadata = { title, description, alternates: { canonical: `${siteUrl}/buero-mieten-traun` }, openGraph: { title, description, url: `${siteUrl}/buero-mieten-traun`, images: ["/spaces/aufeld21-buero.webp"] } };
export default function Page() { return <WorkspaceOffer office />; }
