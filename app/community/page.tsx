export { default } from "../homepage-preview/community/page";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
export const metadata: Metadata = { title: "Unsere Community", description: "Lerne die Unternehmen und Menschen im AUFELD21 kennen.", alternates: { canonical: siteUrl + "/community" } };
