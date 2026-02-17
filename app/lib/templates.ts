export type TemplateId =
  | "achilles_simple"
  | "category_performance"
  | "percent_correct"
  | "uworld_subject_performance"
  | "uworld_system_performance";

export type TemplateChoice = "auto" | TemplateId;

export const TEST_TYPE_OPTIONS: Array<{ id: "comlex2" | "usmle_step2"; label: string }> = [
  { id: "comlex2", label: "Comlex 2" },
  { id: "usmle_step2", label: "USMLE Step 2" },
];

export const TEMPLATE_OPTIONS: Array<{ id: TemplateChoice; label: string }> = [
  { id: "auto", label: "Auto-detect" },
  { id: "achilles_simple", label: "Achilles Simple" },
  { id: "category_performance", label: "Category Performance (Category/Correct/Incorrect/Total)" },
  { id: "percent_correct", label: "Percent Correct (Category/PercentCorrect/Total)" },
  { id: "uworld_subject_performance", label: "UWorld Step 2 Subject Performance" },
  { id: "uworld_system_performance", label: "UWorld Step 2 System Performance" },
];
