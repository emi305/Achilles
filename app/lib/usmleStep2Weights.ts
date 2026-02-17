export const USMLE_STEP2_SUBJECT_CANONICAL = [
  "Medicine (IM)",
  "Surgery",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Psychiatry",
] as const;

export const USMLE_STEP2_SYSTEM_CANONICAL = [
  "Renal/Urinary & Reproductive",
  "Cardiovascular",
  "MSK / Skin & Subcutaneous",
  "Behavioral Health",
  "Gastrointestinal",
  "Nervous System & Special Senses",
  "Respiratory",
  "Multisystem Processes & Disorders",
  "Endocrine",
  "Pregnancy/Childbirth & Puerperium",
  "Blood & Lymphoreticular",
  "Immune",
  "Biostatistics/Epi/Population Health/Med Lit",
  "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)",
] as const;

export function getNormalizedWeights(rawWeights: Record<string, number>): Record<string, number> {
  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return {};
  }

  return Object.fromEntries(Object.entries(rawWeights).map(([key, value]) => [key, value / total]));
}

const SUBJECT_MIDPOINT_WEIGHTS_RAW: Record<(typeof USMLE_STEP2_SUBJECT_CANONICAL)[number], number> = {
  "Medicine (IM)": 60,
  Surgery: 25,
  Pediatrics: 22,
  "Obstetrics & Gynecology": 15,
  Psychiatry: 12.5,
};

const SYSTEM_MIDPOINT_WEIGHTS_RAW: Record<(typeof USMLE_STEP2_SYSTEM_CANONICAL)[number], number> = {
  "Renal/Urinary & Reproductive": 10,
  Cardiovascular: 9,
  "MSK / Skin & Subcutaneous": 9,
  "Behavioral Health": 7.5,
  Gastrointestinal: 7.5,
  "Nervous System & Special Senses": 7.5,
  Respiratory: 7.5,
  "Multisystem Processes & Disorders": 6,
  Endocrine: 5,
  "Pregnancy/Childbirth & Puerperium": 5,
  "Blood & Lymphoreticular": 4.5,
  Immune: 4,
  "Biostatistics/Epi/Population Health/Med Lit": 4,
  "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)": 12.5,
};

export const USMLE_STEP2_SUBJECT_WEIGHTS = getNormalizedWeights(SUBJECT_MIDPOINT_WEIGHTS_RAW);
export const USMLE_STEP2_SYSTEM_WEIGHTS = getNormalizedWeights(SYSTEM_MIDPOINT_WEIGHTS_RAW);

export const USMLE_STEP2_SUBJECT_WEIGHT_SUM = Object.values(USMLE_STEP2_SUBJECT_WEIGHTS).reduce(
  (sum, value) => sum + value,
  0,
);
export const USMLE_STEP2_SYSTEM_WEIGHT_SUM = Object.values(USMLE_STEP2_SYSTEM_WEIGHTS).reduce(
  (sum, value) => sum + value,
  0,
);

