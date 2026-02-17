import { USMLE2_UWORLD_SUBJECTS, USMLE2_UWORLD_SYSTEMS } from "./usmleStep2UworldCatalog";

export const STEP2_DISCIPLINE_WEIGHTS: Record<string, number> = {
  Medicine: 0.447761194,
  Surgery: 0.186567164,
  Pediatrics: 0.164179104,
  "Obstetrics & Gynecology": 0.111940299,
  Psychiatry: 0.089552239,
};

export const STEP2_SYSTEM_WEIGHTS: Record<string, number> = {
  "Social Sciences (Ethics/Safety/Legal)": 0.225225225,
  "Renal/Urinary & Reproductive": 0.18018018,
  "Cardiovascular System": 0.162162162,
  "Musculoskeletal System & Skin": 0.162162162,
  "Gastrointestinal System": 0.135135135,
  "Respiratory System": 0.135135135,
};

export const STEP2_PHYSICIAN_TASK_WEIGHTS: Record<string, number> = {
  "Patient Care: Management": 0.484848485,
  "Patient Care: Diagnosis": 0.424242424,
  "Health Maintenance & Disease Prevention": 0.090909091,
};

function buildEqualWeightMap(values: readonly string[]): Record<string, number> {
  if (values.length === 0) {
    return {};
  }
  const weight = 1 / values.length;
  return Object.fromEntries(values.map((value) => [value, weight]));
}

export const STEP2_UWORLD_SUBJECT_WEIGHTS: Record<string, number> = buildEqualWeightMap(USMLE2_UWORLD_SUBJECTS);
export const STEP2_UWORLD_SYSTEM_WEIGHTS: Record<string, number> = buildEqualWeightMap(USMLE2_UWORLD_SYSTEMS);
