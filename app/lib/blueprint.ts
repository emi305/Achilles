import {
  CLINICAL_PRESENTATION_WEIGHTS,
  COMPETENCY_DOMAIN_WEIGHTS,
  DISCIPLINE_WEIGHTS,
} from "./comlexWeights";
import {
  STEP2_DISCIPLINE_WEIGHTS,
  STEP2_PHYSICIAN_TASK_WEIGHTS,
  STEP2_SYSTEM_WEIGHTS,
} from "./step2Weights";
import type { CategoryType, TestType } from "./types";

const COMLEX_CATEGORY_ORDER: CategoryType[] = ["discipline", "competency_domain", "clinical_presentation"];
const STEP2_CATEGORY_ORDER: CategoryType[] = ["discipline", "system", "physician_task"];

export const CATEGORY_ORDER_BY_TEST: Record<TestType, CategoryType[]> = {
  comlex2: COMLEX_CATEGORY_ORDER,
  usmle_step2: STEP2_CATEGORY_ORDER,
};

export const CATEGORY_LABEL_BY_TYPE: Record<CategoryType, string> = {
  discipline: "Discipline",
  competency_domain: "Competency Domain",
  clinical_presentation: "Clinical Presentation",
  system: "Systems",
  physician_task: "Physician Tasks",
};

export const EXAM_LABEL: Record<TestType, string> = {
  comlex2: "Comlex 2",
  usmle_step2: "USMLE Step 2",
};

function getComlexWeights(categoryType: CategoryType): Record<string, number> {
  if (categoryType === "discipline") {
    return DISCIPLINE_WEIGHTS;
  }
  if (categoryType === "competency_domain") {
    return COMPETENCY_DOMAIN_WEIGHTS;
  }
  if (categoryType === "clinical_presentation") {
    return CLINICAL_PRESENTATION_WEIGHTS;
  }
  return {};
}

function getStep2Weights(categoryType: CategoryType): Record<string, number> {
  if (categoryType === "discipline") {
    return STEP2_DISCIPLINE_WEIGHTS;
  }
  if (categoryType === "system") {
    return STEP2_SYSTEM_WEIGHTS;
  }
  if (categoryType === "physician_task") {
    return STEP2_PHYSICIAN_TASK_WEIGHTS;
  }
  return {};
}

export function getWeightMap(categoryType: CategoryType, testType: TestType): Record<string, number> {
  return testType === "usmle_step2" ? getStep2Weights(categoryType) : getComlexWeights(categoryType);
}

export function getWeightForCategory(categoryType: CategoryType, name: string, testType: TestType): number | null {
  const map = getWeightMap(categoryType, testType);
  return map[name] ?? null;
}

export function getCategoryOrderForTest(testType: TestType): CategoryType[] {
  return CATEGORY_ORDER_BY_TEST[testType];
}

export function getAllowedCategoryTypes(testType: TestType): CategoryType[] {
  return CATEGORY_ORDER_BY_TEST[testType];
}

export function getCategoryCandidates(categoryType: CategoryType, testType: TestType): string[] {
  return Object.keys(getWeightMap(categoryType, testType));
}
