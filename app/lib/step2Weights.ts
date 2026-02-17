import { USMLE_STEP2_SUBJECT_WEIGHTS, USMLE_STEP2_SYSTEM_WEIGHTS } from "./usmleStep2Weights";

// Step 2 ROI/PROI uses midpoint-normalized subject/system weights.
export const STEP2_DISCIPLINE_WEIGHTS: Record<string, number> = USMLE_STEP2_SUBJECT_WEIGHTS;
export const STEP2_SYSTEM_WEIGHTS: Record<string, number> = USMLE_STEP2_SYSTEM_WEIGHTS;
export const STEP2_UWORLD_SUBJECT_WEIGHTS: Record<string, number> = USMLE_STEP2_SUBJECT_WEIGHTS;
export const STEP2_UWORLD_SYSTEM_WEIGHTS: Record<string, number> = USMLE_STEP2_SYSTEM_WEIGHTS;

// Kept for compatibility with existing score-report paths.
export const STEP2_PHYSICIAN_TASK_WEIGHTS: Record<string, number> = {
  "Patient Care: Management": 0.484848485,
  "Patient Care: Diagnosis": 0.424242424,
  "Health Maintenance & Disease Prevention": 0.090909091,
};
