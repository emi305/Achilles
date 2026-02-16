import { canonicalizeCategoryName } from "./nameMatching";
import { getWeightForCategory } from "./blueprint";
import type { QbankSource } from "./mappingCatalog";
import type { CategoryType, TestType } from "./types";

export type MappingAuditInput = {
  testType: TestType;
  categoryType: CategoryType;
  rawName: string;
  source?: QbankSource;
};

type MappingAuditOutput = {
  input: MappingAuditInput;
  canonicalName: string | null;
  matchType: "exact" | "alias" | "regex" | "fuzzy" | "none";
  matchScore: number;
};

export function runMappingAudit(inputs: MappingAuditInput[]) {
  const mapped: MappingAuditOutput[] = [];
  const unmapped: MappingAuditOutput[] = [];

  for (const input of inputs) {
    const result = canonicalizeCategoryName(
      input.categoryType,
      input.rawName,
      input.testType,
      input.source ?? "unknown",
    );
    const output: MappingAuditOutput = {
      input,
      canonicalName: result.canonicalName,
      matchType: result.matchType,
      matchScore: result.matchScore,
    };
    if (result.matchType === "none" || !result.canonicalName) {
      unmapped.push(output);
    } else {
      mapped.push(output);
    }
  }

  const coverage = inputs.length === 0 ? 1 : mapped.length / inputs.length;
  const groupedUnmapped = new Map<string, string[]>();
  for (const entry of unmapped) {
    const key = `${entry.input.testType}::${entry.input.categoryType}::${entry.input.source ?? "unknown"}`;
    const list = groupedUnmapped.get(key) ?? [];
    list.push(entry.input.rawName);
    groupedUnmapped.set(key, list);
  }

  return {
    mapped,
    unmapped,
    coverage,
    groupedUnmapped,
  };
}

const SAMPLE_INPUTS: MappingAuditInput[] = [
  { testType: "comlex2", categoryType: "discipline", rawName: "IM", source: "truelearn" },
  { testType: "comlex2", categoryType: "discipline", rawName: "OB/GYN", source: "truelearn" },
  { testType: "comlex2", categoryType: "discipline", rawName: "OMM", source: "truelearn" },
  { testType: "comlex2", categoryType: "clinical_presentation", rawName: "MSK", source: "truelearn" },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Osteopathic Principles, Practice, and Manipulative Treatment",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Osteopathic Patient Care and Procedural Skills",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Application of Knowledge for Osteopathic Medical Practice",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Practice-Based Learning and Improvement in Osteopathic Medical Practice",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Interpersonal and Communication Skills in the Practice of Osteopathic Medicine",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Professionalism in the Practice of Osteopathic Medicine",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Systems-Based Practice in Osteopathic Medicine",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Community Health and Patient Presentations Related to Wellness",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to Human Development, Reproduction, and Sexuality",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Endocrine System and Metabolism",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Nervous System and Mental Health",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Musculoskeletal System",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Genitourinary System",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Gastrointestinal System and Nutritional Health",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Circulatory and Hematologic Systems",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Respiratory System",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Patient Presentations Related to the Integumentary System",
    source: "unknown",
  },
  { testType: "usmle_step2", categoryType: "discipline", rawName: "Internal Medicine", source: "uworld" },
  { testType: "usmle_step2", categoryType: "system", rawName: "Ethics", source: "uworld" },
  { testType: "usmle_step2", categoryType: "system", rawName: "Renal/GU", source: "uworld" },
  { testType: "usmle_step2", categoryType: "physician_task", rawName: "Management", source: "amboss" },
  { testType: "usmle_step2", categoryType: "physician_task", rawName: "Diagnosis", source: "amboss" },
  { testType: "usmle_step2", categoryType: "physician_task", rawName: "Prevention", source: "amboss" },
];

if (process.argv.includes("--run")) {
  const report = runMappingAudit(SAMPLE_INPUTS);
  const requiredComlexRows = SAMPLE_INPUTS.filter((input) => input.testType === "comlex2");
  const failedWeightChecks = requiredComlexRows.filter((input) => {
    const result = canonicalizeCategoryName(
      input.categoryType,
      input.rawName,
      input.testType,
      input.source ?? "unknown",
    );
    if (!result.canonicalName) {
      return true;
    }
    return getWeightForCategory(input.categoryType, result.canonicalName, input.testType) == null;
  });

  console.log(`Coverage: ${(report.coverage * 100).toFixed(1)}% (${report.mapped.length}/${SAMPLE_INPUTS.length})`);
  if (failedWeightChecks.length > 0) {
    console.error("Weight resolution failed for required COMLEX labels:");
    for (const failed of failedWeightChecks) {
      console.error(`- ${failed.categoryType}: ${failed.rawName}`);
    }
    process.exitCode = 1;
  }

  if (report.unmapped.length === 0) {
    console.log("No unmapped labels.");
  } else {
    console.log("Unmapped labels:");
    for (const [group, names] of report.groupedUnmapped.entries()) {
      console.log(`- ${group}: ${names.join(", ")}`);
    }
  }
}
