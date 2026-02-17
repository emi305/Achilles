export type TestType = "comlex2" | "usmle_step2";

export type InputSource =
  | "uworld_qbank"
  | "usmle_score_report"
  | "nbme"
  | "free120"
  | "qbank"
  | "unknown";

export type CategoryType =
  | "competency_domain"
  | "clinical_presentation"
  | "discipline"
  | "system"
  | "physician_task"
  | "uworld_subject"
  | "uworld_system";

export type ParsedRow = {
  testType?: TestType;
  inputSource?: InputSource;
  categoryType: CategoryType;
  name: string;
  correct?: number;
  total?: number;
  accuracy?: number;
  weight: number | null;
  roi: number;
  proxyWeakness?: number;
  proi?: number;
  source?: import("./mappingCatalog").QbankSource;
  originalName?: string;
  canonicalName?: string | null;
  matchType?: "exact" | "alias" | "regex" | "fuzzy" | "none";
  matchScore?: number;
  unmapped?: boolean;
};

export type ExtractedRow = {
  categoryType: CategoryType;
  name: string;
  mappedCanonicalName?: string;
  correct?: number;
  total?: number;
  percentCorrect?: number;
  proxyWeakness?: number;
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

export type ZeusContextRow = {
  name: string;
  categoryType: CategoryType;
  weight: number;
  roi: number;
  proi: number;
  avgCorrect: number | null;
};

export type ZeusRankedItem = {
  rank: number;
  name: string;
  categoryType: CategoryType;
  score: number;
};

export type ZeusContext = {
  exam: TestType;
  rows: ZeusContextRow[];
  topFive: ZeusContextRow[];
  roiRanking: ZeusRankedItem[];
  avgCorrectRanking: ZeusRankedItem[];
  proiRanking: ZeusRankedItem[];
  combinedRanking: ZeusRankedItem[];
};
