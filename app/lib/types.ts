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

export type ExtractedRow = {
  categoryType: CategoryType;
  name: string;
  correct?: number;
  total?: number;
  percentCorrect?: number;
  confidence: number;
};

export type ExtractResponse = {
  rows: ExtractedRow[];
  overallConfidence: number;
  warnings: string[];
};

export type NormalizedExtractResult = {
  parsedRows: ParsedRow[];
  warnings: string[];
  hasMissingRequired: boolean;
};

export type ReviewSessionData = {
  rawText: string;
  extracted: ExtractResponse;
  parsedRows: ParsedRow[];
  savedAt: string;
};
