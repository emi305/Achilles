import type { CategoryType } from "./types";
import {
  COMLEX_COMPETENCY_DOMAIN_CANONICAL,
  type ComlexCompetencyDomainCanonical,
} from "./comlexCanonicalNames";

const RAW_COMPETENCY_DOMAIN_WEIGHTS_PERCENT: Record<ComlexCompetencyDomainCanonical, number> = {
  "Osteopathic Principles, Practice, and Manipulative Treatment": 0.1,
  "Osteopathic Patient Care and Procedural Skills": 0.3,
  "Application of Knowledge for Osteopathic Medical Practice": 0.26,
  "Practice-Based Learning and Improvement in Osteopathic Medical Practice": 0.07,
  "Interpersonal and Communication Skills in the Practice of Osteopathic Medicine": 0.05,
  "Professionalism in the Practice of Osteopathic Medicine": 0.07,
  "Systems-Based Practice in Osteopathic Medicine": 0.05,
};

function normalizeWeightMap(
  weights: Record<ComlexCompetencyDomainCanonical, number>,
): Record<ComlexCompetencyDomainCanonical, number> {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    throw new Error("Invalid COMLEX competency domain weights: sum must be > 0.");
  }

  return Object.fromEntries(
    Object.entries(weights).map(([name, value]) => [name, value / total]),
  ) as Record<ComlexCompetencyDomainCanonical, number>;
}

export const COMPETENCY_DOMAIN_WEIGHTS: Record<string, number> = normalizeWeightMap(
  RAW_COMPETENCY_DOMAIN_WEIGHTS_PERCENT,
);

function assertComlexCompetencyDomainWeightInvariant() {
  const weightKeys = Object.keys(COMPETENCY_DOMAIN_WEIGHTS).sort();
  const canonicalKeys = [...COMLEX_COMPETENCY_DOMAIN_CANONICAL].sort();

  if (weightKeys.length !== canonicalKeys.length) {
    throw new Error(
      `COMLEX competency domain map must contain ${canonicalKeys.length} domains; found ${weightKeys.length}.`,
    );
  }

  for (let index = 0; index < canonicalKeys.length; index += 1) {
    if (weightKeys[index] !== canonicalKeys[index]) {
      throw new Error(`COMLEX competency domain canonical mismatch at "${canonicalKeys[index]}".`);
    }
  }

  const weightSum = Object.values(COMPETENCY_DOMAIN_WEIGHTS).reduce((sum, value) => sum + value, 0);
  if (Math.abs(weightSum - 1) > 1e-6) {
    throw new Error(`COMLEX competency domain weights must sum to 1.0 (100%). Found ${weightSum}.`);
  }
}

assertComlexCompetencyDomainWeightInvariant();

export const CLINICAL_PRESENTATION_WEIGHTS: Record<string, number> = {
  "Community Health and Patient Presentations Related to Wellness": 0.12,
  "Patient Presentations Related to Human Development, Reproduction, and Sexuality": 0.05,
  "Patient Presentations Related to the Endocrine System and Metabolism": 0.05,
  "Patient Presentations Related to the Nervous System and Mental Health": 0.1,
  "Patient Presentations Related to the Musculoskeletal System": 0.13,
  "Patient Presentations Related to the Genitourinary System": 0.05,
  "Patient Presentations Related to the Gastrointestinal System and Nutritional Health": 0.1,
  "Patient Presentations Related to the Circulatory and Hematologic Systems": 0.1,
  "Patient Presentations Related to the Respiratory System": 0.1,
  "Patient Presentations Related to the Integumentary System": 0.05,
};

export const DISCIPLINE_WEIGHTS: Record<string, number> = {
  "Internal Medicine": 0.232,
  "Family Medicine": 0.158,
  Surgery: 0.126,
  "Obstetrics/Gynecology": 0.105,
  Pediatrics: 0.105,
  "Osteopathic Principles and Practice": 0.105,
  Psychiatry: 0.084,
  "Emergency Medicine": 0.084,
};

export function getWeightForCategory(categoryType: CategoryType, name: string): number {
  if (categoryType === "competency_domain") {
    return COMPETENCY_DOMAIN_WEIGHTS[name] ?? 0;
  }

  if (categoryType === "clinical_presentation") {
    return CLINICAL_PRESENTATION_WEIGHTS[name] ?? 0;
  }

  return DISCIPLINE_WEIGHTS[name] ?? 0;
}
