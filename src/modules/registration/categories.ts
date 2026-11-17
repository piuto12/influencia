/** Participant categories (no dependencies, so client components can import it without pulling in zod). */
export const CATEGORIES = [
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "corporate_professional", label: "Corporate professional" },
  { value: "college_faculty", label: "College faculty" },
  { value: "student", label: "Student" },
  { value: "business_owner", label: "Business owner" },
  { value: "manager_leader", label: "Manager / leader" },
  { value: "general_public", label: "General public" },
] as const;
