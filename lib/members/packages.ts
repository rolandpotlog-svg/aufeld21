// Public list prices and standard allowances. Negotiated rents stay in the
// billing profile; choosing a package must never overwrite a negotiated price.
export const packages = {
  pro: { name: 'Bestehende Vereinbarung', hours: 12, net: null },
  flex: { name: 'Flex', hours: 12, net: 180 },
  fix: { name: 'Fix', hours: 12, net: 250 },
  office: { name: 'Privates Büro', hours: 12, net: 590 },
  post: { name: 'Postservice', hours: 0, net: 39 },
  business: { name: 'Business-Standort', hours: 1, net: 69 },
  custom: { name: 'Individuelles Kontingent', hours: 12, net: null },
  shared: { name: 'Gemeinsames Kontingent', hours: 0, net: null },
} as const;
export type PackageId = keyof typeof packages;
export const isPackageId = (value: unknown): value is PackageId => typeof value === 'string' && Object.hasOwn(packages, value);
export const extraMeetingHourNet = 12;
export const officeArea = '24,78 m²';
export type MeetingUsage = {
  member_id: string; account_id: string; package: PackageId;
  included_hours: number; used_hours: number; bonus_hours: number;
  billable: boolean; account_name: string;
};
