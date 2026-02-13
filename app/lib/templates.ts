export type TemplateId = "achilles_simple" | "category_performance" | "percent_correct";

export type TemplateChoice = "auto" | TemplateId;

export const TEMPLATE_OPTIONS: Array<{ id: TemplateChoice; label: string }> = [
  { id: "auto", label: "Auto-detect" },
  { id: "achilles_simple", label: "Achilles Simple" },
  { id: "category_performance", label: "Category Performance (Category/Correct/Incorrect/Total)" },
  { id: "percent_correct", label: "Percent Correct (Category/PercentCorrect/Total)" },
];