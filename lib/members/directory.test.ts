import assert from "node:assert/strict";
import test from "node:test";
import { filterMembers, meetingSummary, memberRoleLabel, type ManagedMember } from "./directory.ts";

const tenant: ManagedMember = { id: "tenant", name: "Buchhandlung Neugebauer", billing_name: "Neugebauer GmbH", email: "kevin@example.test", office_name: "Büro 1", role: "member", plan: "pro", active: true, usedHours: 14.5, bonusHours: 2, monthly_rent_net: 400 };
const rentingAdmin: ManagedMember = { ...tenant, id: "admin-tenant", name: "Roland", role: "admin", monthly_rent_net: 250 };
const teamAdmin: ManagedMember = { ...tenant, id: "admin-team", name: "Julia", role: "admin", monthly_rent_net: null };
const employee: ManagedMember = { ...tenant, id: "employee", role: "employee", monthly_rent_net: null, active: false };

test("directory filters distinguish a renting admin from team without losing inactive users", () => {
  const members = [tenant, rentingAdmin, teamAdmin, employee];
  assert.deepEqual(filterMembers(members, "", "tenants").map((m) => m.id), ["tenant", "admin-tenant"]);
  assert.deepEqual(filterMembers(members, "", "team").map((m) => m.id), ["admin-team", "employee"]);
  assert.deepEqual(filterMembers(members, "", "inactive").map((m) => m.id), ["employee"]);
  assert.equal(filterMembers(members, "", "all").length, 4);
  assert.equal(memberRoleLabel(rentingAdmin), "Admin · Mieter");
  assert.equal(memberRoleLabel(teamAdmin), "Admin · Team");
});

test("directory search finds names, billing company, login address and office", () => {
  for (const query of ["buchhandlung", "  NEUGEBAUER GMBH  ", "kevin@", "BÜRO 1"]) {
    assert.equal(filterMembers([tenant], query, "all").length, 1);
  }
  assert.equal(filterMembers([tenant], "missing", "all").length, 0);
});

test("meeting display includes bonus, caps the bar and does not invoice staff", () => {
  assert.deepEqual(meetingSummary(tenant), { allowance: 14, extraHours: 0.5, extraNet: 6, progress: 100 });
  assert.equal(meetingSummary({ ...tenant, usedHours: 0 }).progress, 0);
  assert.equal(meetingSummary({ ...tenant, usedHours: 0 }).extraNet, 0);
  assert.equal(meetingSummary(employee).extraNet, null);
  assert.equal(meetingSummary(teamAdmin).extraNet, null);
  assert.equal(meetingSummary(rentingAdmin).extraNet, 6);
});
