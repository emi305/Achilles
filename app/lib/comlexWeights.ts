import type { CategoryType } from "./types";

export const COMPETENCY_DOMAIN_WEIGHTS: Record<string, number> = {
  "Osteopathic Principles, Practice, and Manipulative Treatment": 0.1,
  "Osteopathic Patient Care and Procedural Skills": 0.3,
  "Application of Knowledge for Osteopathic Medical Practice": 0.26,
  "Practice-Based Learning and Improvement in Osteopathic Medical Practice": 0.07,
  "Interpersonal and Communication Skills in the Practice of Osteopathic Medicine": 0.05,
  "Professionalism in the Practice of Osteopathic Medicine": 0.07,
  "Systems-Based Practice in Osteopathic Medicine": 0.05,
};

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