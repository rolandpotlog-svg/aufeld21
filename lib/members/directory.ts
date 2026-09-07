import { extraMeetingHourNet, type PackageId } from './packages.ts';

export type Member = {
  id: string;
  email: string;
  name: string;
  role: "member" | "partner" | "employee" | "admin";
  plan: "pro";
  active: boolean;
};

export type ManagedMember = Member & {
  usedHours: number;
  bonusHours: number;
  includedHours?: number;
  meetingPackage?: PackageId;
  meetingAccountId?: string;
  office_name?: string | null;
  billing_name?: string | null;
  billing_address?: string | null;
  billing_uid?: string | null;
  monthly_rent_net?: number | null;
  contract_start?: string | null;
  contract_end?: string | null;
};

export type MemberFilter = "all" | "tenants" | "team" | "inactive";

export function isTeamMember(member: ManagedMember) {
  return member.role === "employee" || (member.role === "admin" && member.monthly_rent_net == null);
}

export function memberRoleLabel(member: ManagedMember) {
  if (member.role === "admin") return isTeamMember(member) ? "Admin · Team" : "Admin · Mieter";
  if (member.role === "employee") return "Mitarbeiter";
  return member.role === "partner" ? "Nutzungspartner" : "Mieter";
}

export function filterMembers(members: ManagedMember[], query: string, filter: MemberFilter) {
  const search = query.trim().toLocaleLowerCase("de-AT");
  return members.filter((member) => {
    if (filter === "team" && !isTeamMember(member)) return false;
    if (filter === "tenants" && isTeamMember(member)) return false;
    if (filter === "inactive" && member.active) return false;
    return [member.name, member.billing_name, member.email, member.office_name]
      .some((value) => value?.toLocaleLowerCase("de-AT").includes(search));
  });
}

// Display only: the database remains authoritative for quotas and invoicing.
export function meetingSummary(member: ManagedMember) {
  const allowance = (member.includedHours ?? 12) + member.bonusHours;
  const extraHours = Math.max(member.usedHours - allowance, 0);
  return {
    allowance,
    extraHours,
    extraNet: isTeamMember(member) ? null : extraHours * extraMeetingHourNet,
    progress: allowance > 0 ? Math.min(Math.max(member.usedHours / allowance * 100, 0), 100) : member.usedHours > 0 ? 100 : 0,
  };
}
