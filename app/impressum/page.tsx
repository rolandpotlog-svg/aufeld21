export { default } from "../homepage-preview/impressum/page";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
export const metadata: Metadata = { title: "Impressum", description: "Anbieterinformationen der POTLOG Immobilien KG.", alternates: { canonical: siteUrl + "/impressum" } };
