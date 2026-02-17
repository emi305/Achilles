import { canonicalizeCategoryName, recoverCategoryTypeForComlex2 } from "./nameMatching";
import { getWeightForCategory } from "./blueprint";
import { COMLEX_COMPETENCY_DOMAIN_CANONICAL } from "./comlexCanonicalNames";
import { COMPETENCY_DOMAIN_WEIGHTS } from "./comlexWeights";
import { normalizeRowForMapping } from "./normalizeRowForMapping";
import { USMLE2_UWORLD_SUBJECTS, USMLE2_UWORLD_SYSTEMS } from "./usmleStep2UworldCatalog";
import type { QbankSource } from "./mappingCatalog";
import type { CategoryType, TestType } from "./types";

export type MappingAuditInput = {
  testType: TestType;
  categoryType: CategoryType | string;
  rawName: string;
  source?: QbankSource;
};

type MappingAuditOutput = {
  input: MappingAuditInput;
  recoveredCategoryType: string;
  canonicalName: string | null;
  matchType: "exact" | "alias" | "regex" | "fuzzy" | "none";
  matchScore: number;
};

export function runMappingAudit(inputs: MappingAuditInput[]) {
  const mapped: MappingAuditOutput[] = [];
  const unmapped: MappingAuditOutput[] = [];

  for (const input of inputs) {
    const recoveredCategoryType = recoverCategoryTypeForComlex2(
      input.testType,
      String(input.categoryType),
      input.rawName,
    );
    const result = canonicalizeCategoryName(
      recoveredCategoryType,
      input.rawName,
      input.testType,
      input.source ?? "unknown",
    );
    const output: MappingAuditOutput = {
      input,
      recoveredCategoryType,
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
    categoryType: "competency_domain_unknown1",
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
    categoryType: "competency_domain_unknown1",
    rawName: "Osteopathic Patient Care and Procedural Skills",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "competency_domain",
    rawName: "Osteopathic\u00A0Patient Care and Procedural Skills",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Human Development, Reproduction, and Sexuality",
    source: "unknown",
  },
  {
    testType: "comlex2",
    categoryType: "clinical_presentation",
    rawName: "Human Development,\u200B Reproduction, and Sexuality",
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
    rawName: "Practice–Based Learning and Improvement in Osteopathic Medical Practice",
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
  { testType: "usmle_step2", categoryType: "uworld_subject", rawName: "Obstetrics and Gynecology", source: "uworld" },
  { testType: "usmle_step2", categoryType: "uworld_system", rawName: "ENT", source: "uworld" },
  { testType: "usmle_step2", categoryType: "uworld_system", rawName: "Social Sciences", source: "uworld" },
  { testType: "usmle_step2", categoryType: "uworld_system", rawName: "Biostats & Epidemiology", source: "uworld" },
];

if (process.argv.includes("--run")) {
  const report = runMappingAudit(SAMPLE_INPUTS);
  const requiredComlexRows = SAMPLE_INPUTS.filter((input) => input.testType === "comlex2");
  const failedWeightChecks = requiredComlexRows.filter((input) => {
    const recoveredCategoryType = recoverCategoryTypeForComlex2(
      input.testType,
      String(input.categoryType),
      input.rawName,
    );
    const result = canonicalizeCategoryName(
      recoveredCategoryType,
      input.rawName,
      input.testType,
      input.source ?? "unknown",
    );
    if (!result.canonicalName) {
      return true;
    }
    if (
      recoveredCategoryType !== "competency_domain" &&
      recoveredCategoryType !== "clinical_presentation" &&
      recoveredCategoryType !== "discipline" &&
      recoveredCategoryType !== "system" &&
      recoveredCategoryType !== "physician_task"
    ) {
      return true;
    }
    return getWeightForCategory(recoveredCategoryType, result.canonicalName, input.testType) == null;
  });

  console.log(`Coverage: ${(report.coverage * 100).toFixed(1)}% (${report.mapped.length}/${SAMPLE_INPUTS.length})`);
  if (failedWeightChecks.length > 0) {
    console.error("Weight resolution failed for required COMLEX labels:");
    for (const failed of failedWeightChecks) {
      console.error(`- ${failed.categoryType}: ${failed.rawName}`);
    }
    process.exitCode = 1;
  }

  const unknownBucketRow = report.mapped.find(
    (entry) =>
      entry.input.testType === "comlex2" &&
      String(entry.input.categoryType) === "competency_domain_unknown1" &&
      entry.input.rawName === "Osteopathic Patient Care and Procedural Skills",
  );
  if (!unknownBucketRow || unknownBucketRow.recoveredCategoryType !== "competency_domain") {
    console.error(
      'Unknown-bucket recovery failed for "Osteopathic Patient Care and Procedural Skills" -> competency_domain.',
    );
    process.exitCode = 1;
  }

  const unknownBucketOppRow = report.mapped.find(
    (entry) =>
      entry.input.testType === "comlex2" &&
      String(entry.input.categoryType) === "competency_domain_unknown1" &&
      entry.input.rawName === "Osteopathic Principles, Practice, and Manipulative Treatment",
  );
  if (!unknownBucketOppRow || unknownBucketOppRow.recoveredCategoryType !== "competency_domain") {
    console.error(
      'Unknown-bucket recovery failed for "Osteopathic Principles, Practice, and Manipulative Treatment" -> competency_domain.',
    );
    process.exitCode = 1;
  }

  const normalizedUnknownRows = [
    {
      name: "Osteopathic Patient Care and Procedural Skills",
      categoryType: "competency_domain_unknown1",
    },
    {
      name: "Osteopathic Principles, Practice, and Manipulative Treatment",
      categoryType: "competency_domain_unknown1",
    },
  ].map((row) =>
    normalizeRowForMapping("comlex2", {
      testType: "comlex2",
      categoryType: row.categoryType as CategoryType,
      name: row.name,
      originalName: row.name,
      source: "unknown",
      weight: null,
      roi: 0,
    }),
  );

  for (const row of normalizedUnknownRows) {
    if (row.categoryType !== "competency_domain" || row.weight == null || row.unmapped) {
      console.error(`normalizeRowForMapping regression for unknown bucket row: ${row.originalName ?? row.name}`);
      process.exitCode = 1;
    }
  }

  const missingCanonicalMappings = COMLEX_COMPETENCY_DOMAIN_CANONICAL.filter((canonicalName) => {
    const result = canonicalizeCategoryName("competency_domain", canonicalName, "comlex2", "unknown");
    if (!result.canonicalName) {
      return true;
    }
    return getWeightForCategory("competency_domain", result.canonicalName, "comlex2") == null;
  });

  const comlexCompetencyWeightSum = COMLEX_COMPETENCY_DOMAIN_CANONICAL.reduce(
    (sum, canonicalName) => sum + (COMPETENCY_DOMAIN_WEIGHTS[canonicalName] ?? 0),
    0,
  );

  console.log("COMLEX2 competency-domain weight map:");
  for (const canonicalName of COMLEX_COMPETENCY_DOMAIN_CANONICAL) {
    const weight = COMPETENCY_DOMAIN_WEIGHTS[canonicalName] ?? 0;
    console.log(`- ${canonicalName}: ${(weight * 100).toFixed(2)}%`);
  }
  console.log(`COMLEX2 competency-domain total: ${(comlexCompetencyWeightSum * 100).toFixed(2)}%`);

  if (missingCanonicalMappings.length > 0) {
    console.error("Canonical COMLEX competency domains missing mapping/weight:");
    for (const missing of missingCanonicalMappings) {
      console.error(`- ${missing}`);
    }
    process.exitCode = 1;
  }

  if (Math.abs(comlexCompetencyWeightSum - 1) > 1e-6) {
    console.error(
      `COMLEX competency weights must sum to 1.0 (100%). Found ${comlexCompetencyWeightSum.toFixed(6)}.`,
    );
    process.exitCode = 1;
  }

  const failedUworldSubjects = USMLE2_UWORLD_SUBJECTS.filter((label) => {
    const result = canonicalizeCategoryName("uworld_subject", label, "usmle_step2", "uworld");
    if (!result.canonicalName) {
      return true;
    }
    return getWeightForCategory("uworld_subject", result.canonicalName, "usmle_step2") == null;
  });
  const failedUworldSystems = USMLE2_UWORLD_SYSTEMS.filter((label) => {
    const result = canonicalizeCategoryName("uworld_system", label, "usmle_step2", "uworld");
    if (!result.canonicalName) {
      return true;
    }
    return getWeightForCategory("uworld_system", result.canonicalName, "usmle_step2") == null;
  });

  const uworldVariantChecks: Array<{
    raw: string;
    type: "uworld_subject" | "uworld_system";
    expected: string;
  }> = [
    { raw: "Obstetrics and Gynecology", type: "uworld_subject", expected: "Obstetrics & Gynecology" },
    { raw: "ENT", type: "uworld_system", expected: "Ear, Nose & Throat (ENT)" },
    {
      raw: "Social Sciences",
      type: "uworld_system",
      expected: "Social Sciences (Ethics/Legal/Professional)",
    },
    { raw: "Biostats & Epidemiology", type: "uworld_system", expected: "Biostatistics & Epidemiology" },
  ];
  const failedUworldVariants = uworldVariantChecks.filter((check) => {
    const result = canonicalizeCategoryName(check.type, check.raw, "usmle_step2", "uworld");
    return result.canonicalName !== check.expected;
  });

  if (failedUworldSubjects.length > 0) {
    console.error("USMLE Step 2 UWorld subject coverage failed:");
    for (const failed of failedUworldSubjects) {
      console.error(`- ${failed}`);
    }
    process.exitCode = 1;
  }
  if (failedUworldSystems.length > 0) {
    console.error("USMLE Step 2 UWorld system coverage failed:");
    for (const failed of failedUworldSystems) {
      console.error(`- ${failed}`);
    }
    process.exitCode = 1;
  }
  if (failedUworldVariants.length > 0) {
    console.error("USMLE Step 2 UWorld variant canonicalization failed:");
    for (const failed of failedUworldVariants) {
      console.error(`- ${failed.type}: "${failed.raw}" expected "${failed.expected}"`);
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
