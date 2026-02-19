import assert from "node:assert/strict";
import { computeAccuracy, computeAvgPercentCorrect, parseIntSafe } from "../avgCorrect";
import { normalizeExtractRows } from "../normalizeExtract";
import { parseUworldQbankText } from "../parseUworldQbankText";
import {
  canonicalizeSubjectLabel,
  canonicalizeSystemLabel,
  STEP2_SYSTEM_CANONICAL,
  STEP2_SUBJECT_CANONICAL,
  STEP2_SYSTEM_WEIGHTS,
  STEP2_SUBJECT_WEIGHTS,
  STEP2_SUBJECT_WEIGHT_DETAILS,
  getSubjectWeights,
  getSystemWeights,
} from "../usmleStep2Canonical";

function round1(value: number | null): number | null {
  if (value == null) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

function run() {
  const parsed = parseUworldQbankText(
    "Medicine Usage 78/1775 Correct Q 24 (40%) Incorrect Q 36 (60%) Omitted Q 0 (0%)",
  );
  const med = parsed.find((row) => row.name === "Medicine");
  assert.ok(med, "Medicine row should be parsed");
  assert.equal(med?.correct, 24);
  assert.equal(med?.incorrectCount, 36);
  assert.equal(med?.omittedCount, 0);
  assert.equal(round1(computeAvgPercentCorrect(med?.correct, med?.incorrectCount)), 40.0);
  assert.equal(computeAccuracy(24, 36), 0.4);
  assert.equal(computeAccuracy(24, 0), 1);
  assert.equal(round1(computeAvgPercentCorrect(24, 0)), 100);
  assert.equal(parseIntSafe(0), 0);
  assert.equal(parseIntSafe("0"), 0);
  assert.equal(parseIntSafe(""), null);
  assert.equal(parseIntSafe("—"), null);

  assert.equal(round1(computeAvgPercentCorrect(51, 45)), 53.1);

  const missingIncorrect = normalizeExtractRows(
    [
      {
        categoryType: "uworld_system",
        name: "Cardiovascular System",
        correct: 20,
        total: 40,
        confidence: 1,
      },
    ],
    "usmle_step2",
    "uworld",
    "uworld_qbank",
  );
  const missingRow = missingIncorrect.parsedRows[0];
  assert.ok(missingRow, "Row should still normalize");
  assert.equal(missingRow.correct, 20);
  assert.equal(missingRow.incorrectCount, 20);
  assert.equal(round1(computeAvgPercentCorrect(missingRow.correct, missingRow.incorrectCount)), 50.0);

  const derivedFromPercent = normalizeExtractRows(
    [
      {
        categoryType: "uworld_subject",
        name: "Medicine",
        correct: 24,
        percentCorrect: 0.4,
        confidence: 1,
      },
      {
        categoryType: "uworld_subject",
        name: "Surgery",
        correct: 107,
        percentCorrect: 0.5,
        confidence: 1,
      },
      {
        categoryType: "uworld_system",
        name: "Cardiovascular",
        correct: 12,
        percentCorrect: 1,
        confidence: 1,
      },
      {
        categoryType: "uworld_system",
        name: "Respiratory",
        correct: 10,
        percentCorrect: 0,
        confidence: 1,
      },
      {
        categoryType: "uworld_system",
        name: "Neurology",
        correct: 10,
        confidence: 1,
      },
    ],
    "usmle_step2",
    "uworld",
    "uworld_qbank",
  );

  const derivedMedicine = derivedFromPercent.parsedRows[0];
  assert.ok(derivedMedicine, "Derived medicine row should exist");
  assert.equal(derivedMedicine.correct, 24);
  assert.equal(derivedMedicine.incorrectCount, 36);
  assert.equal(derivedMedicine.total, 60);
  assert.equal(round1(computeAvgPercentCorrect(derivedMedicine.correct, derivedMedicine.incorrectCount)), 40.0);

  const derivedSurgery = derivedFromPercent.parsedRows[1];
  assert.ok(derivedSurgery, "Derived surgery row should exist");
  assert.equal(derivedSurgery.correct, 107);
  assert.equal(derivedSurgery.incorrectCount, 107);
  assert.equal(derivedSurgery.total, 214);
  assert.equal(round1(computeAvgPercentCorrect(derivedSurgery.correct, derivedSurgery.incorrectCount)), 50.0);

  const derivedPerfect = derivedFromPercent.parsedRows[2];
  assert.ok(derivedPerfect, "Derived perfect row should exist");
  assert.equal(derivedPerfect.correct, 12);
  assert.equal(derivedPerfect.incorrectCount, 0);
  assert.equal(round1(computeAvgPercentCorrect(derivedPerfect.correct, derivedPerfect.incorrectCount)), 100.0);

  const percentZeroRow = derivedFromPercent.parsedRows[3];
  assert.ok(percentZeroRow, "Percent zero row should exist");
  assert.equal(percentZeroRow.incorrectCount, undefined);

  const percentMissingRow = derivedFromPercent.parsedRows[4];
  assert.ok(percentMissingRow, "Percent missing row should exist");
  assert.equal(percentMissingRow.incorrectCount, undefined);

  const pregnancyParsed = parseUworldQbankText(
    "Pregnancy, Childbirth & Puerperium Usage 96/1775 Correct Q 51 (53%) Incorrect Q 45 (47%) Omitted Q 0 (0%)",
  );
  const pregnancy = pregnancyParsed.find((row) => row.name === "Pregnancy/Childbirth & the Puerperium");
  assert.ok(pregnancy, "Pregnancy row should be parsed");
  assert.equal(round1(computeAvgPercentCorrect(pregnancy?.correct, pregnancy?.incorrectCount)), 53.1);

  const systemVsSubjectParsed = parseUworldQbankText(
    [
      "Systems",
      "Allergy & Immunology Usage 20/1775 Correct Q 10 (50%) Incorrect Q 10 (50%) Omitted Q 0 (0%)",
      "Female Reproductive System & Breast Usage 30/1775 Correct Q 12 (40%) Incorrect Q 18 (60%) Omitted Q 0 (0%)",
      "Subjects",
      "Medicine Usage 78/1775 Correct Q 24 (40%) Incorrect Q 36 (60%) Omitted Q 0 (0%)",
    ].join("\n"),
  );
  const allergy = systemVsSubjectParsed.find((row) => row.correct === 10 && row.incorrectCount === 10);
  assert.ok(allergy, "Allergy row should be parsed");
  assert.equal(allergy.categoryType, "uworld_system");
  const femaleRepro = systemVsSubjectParsed.find((row) => row.correct === 12 && row.incorrectCount === 18);
  assert.ok(femaleRepro, "Female reproductive row should be parsed");
  assert.equal(femaleRepro.categoryType, "uworld_system");
  const medicineFromMixed = systemVsSubjectParsed.find((row) => row.name === "Medicine");
  assert.ok(medicineFromMixed, "Medicine row should be parsed from mixed input");
  assert.equal(medicineFromMixed.categoryType, "uworld_subject");

  assert.equal(canonicalizeSystemLabel("Allergy & Immunology").canonical, "Immune");
  assert.equal(canonicalizeSystemLabel("Female Reproductive System & Breast").canonical, "Renal/Urinary & Reproductive");
  assert.equal(canonicalizeSystemLabel("ENT").canonical, "Nervous System & Special Senses");
  assert.equal(canonicalizeSystemLabel("General Principles").canonical, "Multisystem Processes & Disorders");
  assert.equal(canonicalizeSystemLabel("Infectious Diseases").canonical, "Immune");
  assert.equal(canonicalizeSubjectLabel("Female Reproductive System & Breast").canonical, "Obstetrics & Gynecology");
  assert.equal(canonicalizeSubjectLabel("Psychiatric/Behavioral & Substance Use Disorder").canonical, "Psychiatry");
  assert.equal(canonicalizeSubjectLabel("Dermatology").canonical, "Medicine");

  const subjectWeightSum = Object.values(STEP2_SUBJECT_WEIGHTS).reduce((sum, value) => sum + value, 0);
  const systemWeightSum = Object.values(STEP2_SYSTEM_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(STEP2_SUBJECT_CANONICAL.length, 5);
  assert.equal(STEP2_SYSTEM_CANONICAL.length, 14);
  assert.ok(Math.abs(subjectWeightSum - 1) > 1e-3);
  assert.ok(Math.abs(systemWeightSum - 1) < 1e-6);
  assert.ok(Math.abs(STEP2_SUBJECT_WEIGHTS.Medicine - 0.6) < 1e-6);
  assert.equal(STEP2_SUBJECT_WEIGHT_DETAILS.Medicine.midpointPct, 60);
  assert.equal(STEP2_SUBJECT_WEIGHT_DETAILS.Medicine.range.min, 55);
  assert.equal(STEP2_SUBJECT_WEIGHT_DETAILS.Medicine.range.max, 65);
  assert.ok(Math.abs(getSubjectWeights().Medicine.weight - 0.6) < 1e-6);
  assert.ok(Math.abs(Object.values(getSystemWeights()).reduce((sum, detail) => sum + detail.weight, 0) - 1) < 1e-6);

  const knownAccuracy = computeAccuracy(24, 36);
  assert.equal(knownAccuracy, 0.4);
  const knownRoi = knownAccuracy == null ? null : (1 - knownAccuracy) * 0.1;
  assert.equal(round1(knownRoi == null ? null : knownRoi * 1000), 60);
}

run();
console.log("avgCorrect tests passed");
