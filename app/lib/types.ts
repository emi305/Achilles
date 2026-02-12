export type CategoryType = "competency_domain" | "clinical_presentation" | "discipline";

export type ParsedRow = {
  categoryType: CategoryType;
  name: string;
  correct: number;
  total: number;
  accuracy: number;
  weight: number;
  roi: number;
};