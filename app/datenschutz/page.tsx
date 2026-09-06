export { default } from "../homepage-preview/datenschutz/page";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
export const metadata: Metadata = { title: "Datenschutz", description: "Informationen zur Verarbeitung personenbezogener Daten bei AUFELD21.", alternates: { canonical: siteUrl + "/datenschutz" } };
