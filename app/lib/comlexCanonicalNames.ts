export const COMLEX_COMPETENCY_DOMAIN_CANONICAL = [
  "Osteopathic Principles, Practice, and Manipulative Treatment",
  "Osteopathic Patient Care and Procedural Skills",
  "Application of Knowledge for Osteopathic Medical Practice",
  "Practice-Based Learning and Improvement in Osteopathic Medical Practice",
  "Interpersonal and Communication Skills in the Practice of Osteopathic Medicine",
  "Professionalism in the Practice of Osteopathic Medicine",
  "Systems-Based Practice in Osteopathic Medicine",
] as const;

export type ComlexCompetencyDomainCanonical = (typeof COMLEX_COMPETENCY_DOMAIN_CANONICAL)[number];
