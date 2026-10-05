import type { Metadata } from "next";
import { WorkspaceOffer } from "@/app/homepage-preview/workspace-offer";
import { siteUrl } from "@/lib/site";
const title = "Coworking in Traun – Flex-Platz & fester Schreibtisch";
const description = "Coworking bei AUFELD21 in Traun Oedt: Flex ab 180 € netto/Monat, fixer Schreibtisch ab 250 €. Internet, Kaffee und Meetingraum-Kontingent inklusive.";
export const metadata: Metadata = { title, description, alternates: { canonical: `${siteUrl}/coworking-traun` }, openGraph: { title, description, url: `${siteUrl}/coworking-traun`, images: ["/spaces/aufeld21-einblicke.webp"] } };
export default function Page() { return <WorkspaceOffer />; }
