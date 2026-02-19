export const STEP2_SUBJECT_CANONICAL = [
  "Medicine",
  "Surgery",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Psychiatry",
] as const;

export const STEP2_SYSTEM_CANONICAL = [
  "Renal/Urinary & Reproductive",
  "Cardiovascular",
  "MSK / Skin & Subcutaneous",
  "Behavioral Health",
  "Gastrointestinal",
  "Nervous System & Special Senses",
  "Respiratory",
  "Multisystem Processes & Disorders",
  "Endocrine",
  "Pregnancy/Childbirth & the Puerperium",
  "Blood & Lymphoreticular",
  "Immune",
  "Biostatistics/Epi/Population Health/Med Lit",
  "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)",
] as const;

export type Step2SubjectCanonical = (typeof STEP2_SUBJECT_CANONICAL)[number];
export type Step2SystemCanonical = (typeof STEP2_SYSTEM_CANONICAL)[number];

type WeightRange = {
  min: number;
  max: number;
};

export const STEP2_SUBJECT_WEIGHT_RANGES: Record<Step2SubjectCanonical, WeightRange> = {
  Medicine: { min: 55, max: 65 },
  Surgery: { min: 20, max: 30 },
  Pediatrics: { min: 17, max: 27 },
  "Obstetrics & Gynecology": { min: 10, max: 20 },
  Psychiatry: { min: 10, max: 15 },
};

export const STEP2_SYSTEM_WEIGHT_RANGES: Record<Step2SystemCanonical, WeightRange> = {
  "Renal/Urinary & Reproductive": { min: 7, max: 13 },
  Cardiovascular: { min: 6, max: 12 },
  "MSK / Skin & Subcutaneous": { min: 6, max: 12 },
  "Behavioral Health": { min: 5, max: 10 },
  Gastrointestinal: { min: 5, max: 10 },
  "Nervous System & Special Senses": { min: 5, max: 10 },
  Respiratory: { min: 5, max: 10 },
  "Multisystem Processes & Disorders": { min: 4, max: 8 },
  Endocrine: { min: 3, max: 7 },
  "Pregnancy/Childbirth & the Puerperium": { min: 3, max: 7 },
  "Blood & Lymphoreticular": { min: 3, max: 6 },
  Immune: { min: 3, max: 5 },
  "Biostatistics/Epi/Population Health/Med Lit": { min: 3, max: 5 },
  "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)": { min: 10, max: 15 },
};

function normalizeLabelForStep2(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFromRanges<T extends string>(ranges: Record<T, WeightRange>): Record<T, number> {
  const midpointEntries = Object.entries(ranges).map(([name, range]) => [name as T, (range.min + range.max) / 2] as const);
  const total = midpointEntries.reduce((sum, [, midpoint]) => sum + midpoint, 0);
  return Object.fromEntries(midpointEntries.map(([name, midpoint]) => [name, midpoint / total])) as Record<T, number>;
}

function midpointAsFraction(range: WeightRange): number {
  return (range.min + range.max) / 2 / 100;
}

export function getSubjectWeights(): Record<Step2SubjectCanonical, { range: WeightRange; midpointPct: number; weight: number }> {
  return Object.fromEntries(
    Object.entries(STEP2_SUBJECT_WEIGHT_RANGES).map(([name, range]) => [
      name as Step2SubjectCanonical,
      {
        range,
        midpointPct: (range.min + range.max) / 2,
        weight: midpointAsFraction(range),
      },
    ]),
  ) as Record<Step2SubjectCanonical, { range: WeightRange; midpointPct: number; weight: number }>;
}

export function getSystemWeights(): Record<Step2SystemCanonical, { range: WeightRange; midpointPct: number; weight: number }> {
  const normalized = normalizeFromRanges(STEP2_SYSTEM_WEIGHT_RANGES);
  return Object.fromEntries(
    Object.entries(STEP2_SYSTEM_WEIGHT_RANGES).map(([name, range]) => [
      name as Step2SystemCanonical,
      {
        range,
        midpointPct: (range.min + range.max) / 2,
        weight: normalized[name as Step2SystemCanonical],
      },
    ]),
  ) as Record<Step2SystemCanonical, { range: WeightRange; midpointPct: number; weight: number }>;
}

export const STEP2_SUBJECT_WEIGHT_DETAILS = getSubjectWeights();
export const STEP2_SYSTEM_WEIGHT_DETAILS = getSystemWeights();
export const STEP2_SUBJECT_WEIGHTS = Object.fromEntries(
  Object.entries(STEP2_SUBJECT_WEIGHT_DETAILS).map(([name, detail]) => [name, detail.weight]),
) as Record<Step2SubjectCanonical, number>;
export const STEP2_SYSTEM_WEIGHTS = Object.fromEntries(
  Object.entries(STEP2_SYSTEM_WEIGHT_DETAILS).map(([name, detail]) => [name, detail.weight]),
) as Record<Step2SystemCanonical, number>;

export const STEP2_SUBJECT_WEIGHT_SUM = Object.values(STEP2_SUBJECT_WEIGHTS).reduce((sum, value) => sum + value, 0);
export const STEP2_SYSTEM_WEIGHT_SUM = Object.values(STEP2_SYSTEM_WEIGHTS).reduce((sum, value) => sum + value, 0);

const SUBJECT_EXPLICIT_ALIAS: Array<{ canonical: Step2SubjectCanonical; aliases: string[] }> = [
  { canonical: "Medicine", aliases: ["medicine", "internal medicine", "medicine im", "medicine internal"] },
  { canonical: "Surgery", aliases: ["surgery", "surgical", "general surgery", "ent", "ear nose and throat", "ophthalmology", "orthopedics"] },
  { canonical: "Pediatrics", aliases: ["pediatrics", "peds", "paediatrics"] },
  {
    canonical: "Obstetrics & Gynecology",
    aliases: [
      "ob gyn",
      "obgyn",
      "obstetrics and gynecology",
      "obstetrics gynecology",
      "womens health",
      "pregnancy childbirth puerperium",
      "female reproductive system breast",
    ],
  },
  { canonical: "Psychiatry", aliases: ["psychiatry", "psych", "behavioral", "substance use disorder"] },
];

const SYSTEM_EXPLICIT_ALIAS: Array<{ canonical: Step2SystemCanonical; aliases: string[] }> = [
  {
    canonical: "Immune",
    aliases: ["allergy immunology", "infectious diseases", "infectious disease", "immunology"],
  },
  {
    canonical: "MSK / Skin & Subcutaneous",
    aliases: ["dermatology", "rheumatology orthopedics sports", "musculoskeletal", "skin", "derm"],
  },
  {
    canonical: "Nervous System & Special Senses",
    aliases: ["ophthalmology", "ear nose throat ent", "ent", "nervous system", "special senses"],
  },
  { canonical: "Cardiovascular", aliases: ["cardiovascular system", "cardiovascular", "cardio"] },
  { canonical: "Endocrine", aliases: ["endocrine diabetes metabolism", "endocrine"] },
  { canonical: "Gastrointestinal", aliases: ["gastrointestinal nutrition", "gastrointestinal", "gi"] },
  { canonical: "Respiratory", aliases: ["pulmonary critical care", "respiratory", "pulmonary"] },
  {
    canonical: "Renal/Urinary & Reproductive",
    aliases: [
      "renal urinary systems electrolytes",
      "female reproductive system breast",
      "male reproductive system",
      "renal urinary reproductive",
      "genitourinary",
      "urology",
    ],
  },
  {
    canonical: "Pregnancy/Childbirth & the Puerperium",
    aliases: ["pregnancy childbirth puerperium", "pregnancy childbirth and puerperium"],
  },
  { canonical: "Blood & Lymphoreticular", aliases: ["hematology oncology", "blood lymphoreticular", "heme onc"] },
  {
    canonical: "Biostatistics/Epi/Population Health/Med Lit",
    aliases: ["biostatistics epidemiology", "biostats epidemiology", "population health", "medical literature"],
  },
  {
    canonical: "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)",
    aliases: ["social sciences ethics legal professional", "social sciences", "ethics legal professional", "patient safety"],
  },
  {
    canonical: "Multisystem Processes & Disorders",
    aliases: ["miscellaneous multisystem", "multisystem", "general principles", "poisoning environmental exposure"],
  },
  { canonical: "Behavioral Health", aliases: ["psychiatric behavioral substance use disorder", "behavioral health"] },
];

const SUBJECT_LOOKUP = new Map<string, Step2SubjectCanonical>();
const SYSTEM_LOOKUP = new Map<string, Step2SystemCanonical>();

for (const item of SUBJECT_EXPLICIT_ALIAS) {
  for (const alias of item.aliases) {
    SUBJECT_LOOKUP.set(normalizeLabelForStep2(alias), item.canonical);
  }
}
for (const canonical of STEP2_SUBJECT_CANONICAL) {
  SUBJECT_LOOKUP.set(normalizeLabelForStep2(canonical), canonical);
}
for (const item of SYSTEM_EXPLICIT_ALIAS) {
  for (const alias of item.aliases) {
    SYSTEM_LOOKUP.set(normalizeLabelForStep2(alias), item.canonical);
  }
}
for (const canonical of STEP2_SYSTEM_CANONICAL) {
  SYSTEM_LOOKUP.set(normalizeLabelForStep2(canonical), canonical);
}

export type CanonicalizationResult<T extends string> = {
  canonical: T;
  unmapped: boolean;
  reason: string;
  normalizedInput: string;
};

export function canonicalizeSystemLabel(raw: string): CanonicalizationResult<Step2SystemCanonical> {
  const normalized = normalizeLabelForStep2(raw);
  const hasAll = (...tokens: string[]) => tokens.every((token) => normalized.includes(token));
  const direct = SYSTEM_LOOKUP.get(normalized);
  if (direct) {
    return { canonical: direct, unmapped: false, reason: "direct_alias_match", normalizedInput: normalized };
  }

  if (hasAll("allergy", "immunology") || hasAll("infectious", "disease")) {
    return { canonical: "Immune", unmapped: false, reason: "contains_immune_terms", normalizedInput: normalized };
  }
  if (hasAll("female", "reproductive") || hasAll("male", "reproductive") || hasAll("renal", "urinary")) {
    return {
      canonical: "Renal/Urinary & Reproductive",
      unmapped: false,
      reason: "contains_gu_repro_terms",
      normalizedInput: normalized,
    };
  }
  if (hasAll("cardio") || hasAll("cardiovascular")) {
    return { canonical: "Cardiovascular", unmapped: false, reason: "contains_cardiovascular_terms", normalizedInput: normalized };
  }
  if (hasAll("endocrine")) {
    return { canonical: "Endocrine", unmapped: false, reason: "contains_endocrine_terms", normalizedInput: normalized };
  }
  if (hasAll("gastro")) {
    return { canonical: "Gastrointestinal", unmapped: false, reason: "contains_gi_terms", normalizedInput: normalized };
  }
  if (hasAll("pulmonary") || hasAll("respirat")) {
    return { canonical: "Respiratory", unmapped: false, reason: "contains_respiratory_terms", normalizedInput: normalized };
  }
  if (hasAll("dermatolog") || hasAll("rheumatolog") || hasAll("orthoped") || hasAll("musculoskeletal")) {
    return {
      canonical: "MSK / Skin & Subcutaneous",
      unmapped: false,
      reason: "contains_msk_skin_terms",
      normalizedInput: normalized,
    };
  }
  if (/\bent\b/.test(normalized) || hasAll("ophthalm") || hasAll("ear", "nose", "throat") || hasAll("nervous")) {
    return {
      canonical: "Nervous System & Special Senses",
      unmapped: false,
      reason: "contains_neuro_special_sense_terms",
      normalizedInput: normalized,
    };
  }
  if (hasAll("psychiatr") || hasAll("behavioral")) {
    return {
      canonical: "Behavioral Health",
      unmapped: false,
      reason: "contains_behavioral_terms",
      normalizedInput: normalized,
    };
  }
  if (hasAll("hematolog") || hasAll("oncolog") || hasAll("lymph")) {
    return {
      canonical: "Blood & Lymphoreticular",
      unmapped: false,
      reason: "contains_blood_lymph_terms",
      normalizedInput: normalized,
    };
  }

  if (normalized.includes("biostat") || normalized.includes("epidemiolog") || normalized.includes("population health")) {
    return {
      canonical: "Biostatistics/Epi/Population Health/Med Lit",
      unmapped: false,
      reason: "contains_biostats_terms",
      normalizedInput: normalized,
    };
  }
  if (normalized.includes("social science") || normalized.includes("ethic") || normalized.includes("patient safety")) {
    return {
      canonical: "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)",
      unmapped: false,
      reason: "contains_social_science_terms",
      normalizedInput: normalized,
    };
  }
  if (normalized.includes("pregnan") || normalized.includes("puerper")) {
    return {
      canonical: "Pregnancy/Childbirth & the Puerperium",
      unmapped: false,
      reason: "contains_pregnancy_terms",
      normalizedInput: normalized,
    };
  }

  return {
    canonical: "Multisystem Processes & Disorders",
    unmapped: true,
    reason: "fallback_multisystem_for_unmapped",
    normalizedInput: normalized,
  };
}

export function canonicalizeSubjectLabel(
  raw: string,
  options?: { systemCanonical?: Step2SystemCanonical },
): CanonicalizationResult<Step2SubjectCanonical> {
  const normalized = normalizeLabelForStep2(raw);
  const hasAll = (...tokens: string[]) => tokens.every((token) => normalized.includes(token));
  const direct = SUBJECT_LOOKUP.get(normalized);
  if (direct) {
    return { canonical: direct, unmapped: false, reason: "direct_alias_match", normalizedInput: normalized };
  }

  const systemCanonical = options?.systemCanonical;
  if (systemCanonical === "Pregnancy/Childbirth & the Puerperium" || hasAll("female", "reproductive") || normalized.includes("pregnan")) {
    return {
      canonical: "Obstetrics & Gynecology",
      unmapped: false,
      reason: "derived_from_obgyn_system",
      normalizedInput: normalized,
    };
  }
  if (systemCanonical === "Behavioral Health" || normalized.includes("psychiatr") || normalized.includes("behavioral")) {
    return {
      canonical: "Psychiatry",
      unmapped: false,
      reason: "derived_from_behavioral_system",
      normalizedInput: normalized,
    };
  }
  if (normalized.includes("pediatr")) {
    return {
      canonical: "Pediatrics",
      unmapped: false,
      reason: "contains_pediatrics_terms",
      normalizedInput: normalized,
    };
  }
  if (normalized.includes("surg") || normalized.includes("orthoped") || /\bent\b/.test(normalized) || normalized.includes("ophthalm")) {
    return {
      canonical: "Surgery",
      unmapped: false,
      reason: "contains_surgery_terms",
      normalizedInput: normalized,
    };
  }

  return {
    canonical: "Medicine",
    unmapped: true,
    reason: "fallback_medicine_for_unmapped",
    normalizedInput: normalized,
  };
}

export function assertStep2CanonicalWeights(epsilon = 1e-6): {
  subjectsNotNormalized: boolean;
  medicineMidpointOk: boolean;
  systemsOk: boolean;
  subjectSum: number;
  systemSum: number;
} {
  const medicineWeight = STEP2_SUBJECT_WEIGHTS.Medicine;
  return {
    subjectsNotNormalized: Math.abs(STEP2_SUBJECT_WEIGHT_SUM - 1) > epsilon,
    medicineMidpointOk: Math.abs(medicineWeight - 0.6) <= epsilon,
    systemsOk: Math.abs(STEP2_SYSTEM_WEIGHT_SUM - 1) <= epsilon,
    subjectSum: STEP2_SUBJECT_WEIGHT_SUM,
    systemSum: STEP2_SYSTEM_WEIGHT_SUM,
  };
}
