export const USMLE2_UWORLD_SUBJECTS = [
  "Medicine",
  "Obstetrics & Gynecology",
  "Pediatrics",
  "Psychiatry",
  "Surgery",
] as const;

export const USMLE2_UWORLD_SYSTEMS = [
  "Allergy & Immunology",
  "Biostatistics & Epidemiology",
  "Cardiovascular System",
  "Dermatology",
  "Ear, Nose & Throat (ENT)",
  "Endocrine, Diabetes & Metabolism",
  "Female Reproductive System & Breast",
  "Gastrointestinal & Nutrition",
  "General Principles",
  "Hematology & Oncology",
  "Infectious Diseases",
  "Male Reproductive System",
  "Miscellaneous (Multisystem)",
  "Nervous System",
  "Ophthalmology",
  "Poisoning & Environmental Exposure",
  "Pregnancy, Childbirth & Puerperium",
  "Psychiatric/Behavioral & Substance Use Disorder",
  "Pulmonary & Critical Care",
  "Renal, Urinary Systems & Electrolytes",
  "Rheumatology/Orthopedics & Sports",
  "Social Sciences (Ethics/Legal/Professional)",
] as const;

export const USMLE2_UWORLD_SUBJECTS_SET = new Set<string>(USMLE2_UWORLD_SUBJECTS);
export const USMLE2_UWORLD_SYSTEMS_SET = new Set<string>(USMLE2_UWORLD_SYSTEMS);
