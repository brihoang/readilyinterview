export type UserRole = "compliance_officer" | "admin";

export interface DemoUser {
  id: "sarah" | "marcus" | "priya";
  displayName: string;
  title: string;
  role: UserRole;
  initials: string;
  color: string; // tailwind bg class
  email: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "sarah",
    displayName: "Sarah Chen",
    title: "Compliance Officer",
    role: "compliance_officer",
    initials: "SC",
    color: "bg-violet-600",
    email: "s.chen@lakewood-medical.org",
  },
  {
    id: "marcus",
    displayName: "Marcus Williams",
    title: "Compliance Officer",
    role: "compliance_officer",
    initials: "MW",
    color: "bg-sky-600",
    email: "m.williams@lakewood-medical.org",
  },
  {
    id: "priya",
    displayName: "Dr. Priya Nair",
    title: "Administrator",
    role: "admin",
    initials: "PN",
    color: "bg-rose-600",
    email: "p.nair@lakewood-medical.org",
  },
];

export function getDemoUser(displayName: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.displayName === displayName);
}
