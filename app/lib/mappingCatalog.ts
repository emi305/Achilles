import type { CategoryType, TestType } from "./types";

export type QbankSource = "truelearn" | "uworld" | "amboss" | "unknown";

type CanonicalEntry = {
  aliases: string[];
  bySource?: Partial<Record<QbankSource, string[]>>;
  regex?: string[];
};

type CategoryCatalog = Partial<Record<string, CanonicalEntry>>;

export const MAPPING_CATALOG: {
  [testType in TestType]: {
    [categoryType in CategoryType]?: CategoryCatalog;
  };
} = {
  comlex2: {
    discipline: {
      "Internal Medicine": {
        aliases: ["im", "internal med", "internal medicine"],
      },
      "Family Medicine": {
        aliases: ["fm", "family med", "family medicine"],
      },
      Surgery: {
        aliases: ["surg", "general surgery"],
      },
      "Obstetrics/Gynecology": {
        aliases: ["obgyn", "ob gyn", "ob/gyn", "obstetrics and gynecology", "women's health", "womens health"],
      },
      Pediatrics: {
        aliases: ["peds", "paediatrics"],
      },
      Psychiatry: {
        aliases: ["psych", "behavioral health"],
      },
      "Emergency Medicine": {
        aliases: ["em", "ed", "er", "emergency med"],
      },
      "Osteopathic Principles and Practice": {
        aliases: [
          "opp",
          "omm",
          "omt",
          "osteopathic principles",
          "osteopathic manipulative medicine",
          "osteopathic manipulative treatment",
        ],
      },
    },
    competency_domain: {
      "Osteopathic Principles, Practice, and Manipulative Treatment": {
        aliases: [
          "opp",
          "omm",
          "omt",
          "osteopathic principles practice and manipulative treatment",
          "osteopathic principles",
          "osteopathic principles practice and manipulative treatment",
          "osteopathic principles practice manipulative treatment",
          "osteopathic principles practice manipulative treatment opp omt",
        ],
        bySource: {
          truelearn: ["opp", "omm/omt"],
        },
      },
      "Osteopathic Patient Care and Procedural Skills": {
        aliases: [
          "patient care procedural skills",
          "procedural skills",
          "osteopathic patient care",
          "osteopathic patient care and procedural skills",
        ],
      },
      "Application of Knowledge for Osteopathic Medical Practice": {
        aliases: [
          "application of knowledge",
          "medical knowledge",
          "knowledge application",
          "application of knowledge for osteopathic medical practice",
        ],
      },
      "Practice-Based Learning and Improvement in Osteopathic Medical Practice": {
        aliases: [
          "practice based learning",
          "practice based learning improvement",
          "practice based learning and improvement in osteopathic medical practice",
          "practice-based learning and improvement in osteopathic medical practice",
          "quality improvement",
          "qi",
          "pbli",
        ],
      },
      "Interpersonal and Communication Skills in the Practice of Osteopathic Medicine": {
        aliases: [
          "communication",
          "interpersonal skills",
          "ics",
          "interpersonal and communication skills",
          "interpersonal and communication skills in the practice of osteopathic medicine",
          "interpersonal communication skills in the practice of osteopathic medicine",
          "interpersonal communication skills in the practice of osteopathic medicine",
        ],
      },
      "Professionalism in the Practice of Osteopathic Medicine": {
        aliases: [
          "professionalism",
          "professionalism in the practice of osteopathic medicine",
          "professionalism in osteopathic medicine",
        ],
      },
      "Systems-Based Practice in Osteopathic Medicine": {
        aliases: [
          "systems based practice",
          "systems-based practice",
          "systems based practice in osteopathic medicine",
          "systems-based practice in osteopathic medicine",
          "systems practice",
          "sbp",
        ],
      },
    },
    clinical_presentation: {
      "Community Health and Patient Presentations Related to Wellness": {
        aliases: [
          "community health",
          "community health and patient presentations related to wellness",
          "community health and presentations related to wellness",
          "wellness",
          "preventive health",
        ],
        regex: ["^community health( and.*wellness)?$"],
      },
      "Patient Presentations Related to Human Development, Reproduction, and Sexuality": {
        aliases: [
          "patient presentations related to human development reproduction and sexuality",
          "patient presentations related to human development reproduction sexuality",
          "human development reproduction and sexuality",
          "human development and reproduction",
          "human development reproduction sexuality",
          "human development reproduction sex",
          "human development reproductive sexuality",
          "human development reproduction",
          "reproduction",
          "sexuality",
          "human development",
          "breast",
          "breasts",
        ],
        regex: ["^human development.*reproduction.*(sexuality)?$"],
      },
      "Patient Presentations Related to the Endocrine System and Metabolism": {
        aliases: [
          "endocrine",
          "endocrine system and metabolism",
          "patient presentations related to endocrine system and metabolism",
          "metabolism",
        ],
        regex: ["^endocrine( system)?( and metabolism)?$"],
      },
      "Patient Presentations Related to the Nervous System and Mental Health": {
        aliases: [
          "nervous system",
          "nervous system and mental health",
          "patient presentations related to nervous system and mental health",
          "mental health",
          "neuro",
          "neurology",
        ],
        regex: ["^(nervous system|mental health).*$"],
      },
      "Patient Presentations Related to the Musculoskeletal System": {
        aliases: [
          "msk",
          "musculoskeletal",
          "musculoskeletal system",
          "patient presentations related to musculoskeletal system",
          "msk system",
        ],
        regex: ["^musculoskeletal( system)?$"],
      },
      "Patient Presentations Related to the Genitourinary System": {
        aliases: [
          "gu",
          "genitourinary",
          "genitourinary system",
          "patient presentations related to genitourinary system",
          "renal",
          "urinary",
          "urology",
        ],
        regex: ["^(genitourinary|renal|urinary).*$"],
      },
      "Patient Presentations Related to the Gastrointestinal System and Nutritional Health": {
        aliases: [
          "gi",
          "gastrointestinal",
          "gastrointestinal system",
          "patient presentations related to gastrointestinal system and nutritional health",
          "gastrointestinal and nutritional health",
          "nutrition",
          "nutritional health",
        ],
        regex: ["^gastrointestinal( system)?( and nutritional health)?$"],
      },
      "Patient Presentations Related to the Circulatory and Hematologic Systems": {
        aliases: [
          "patient presentations related to circulatory and hematologic systems",
          "patient presentations related to the circulatory and hematologic system",
          "circulatory and hematologic",
          "circulatory and hematologic systems",
          "circulatory and hematologic system",
          "circulatory",
          "hematologic",
          "heme",
          "heme onc",
          "cardio hematology",
        ],
        regex: ["^(circulatory|hematologic).*$"],
      },
      "Patient Presentations Related to the Respiratory System": {
        aliases: [
          "resp",
          "pulm",
          "pulmonary",
          "respiratory",
          "respiratory system",
          "patient presentations related to respiratory system",
        ],
        regex: ["^respiratory( system)?$"],
      },
      "Patient Presentations Related to the Integumentary System": {
        aliases: [
          "integumentary",
          "integument",
          "integumentary system",
          "patient presentations related to integumentary system",
          "skin",
        ],
        regex: ["^integumentary( system)?$"],
      },
    },
  },
  usmle_step2: {
    discipline: {
      Medicine: {
        aliases: ["internal medicine", "im", "medicine internal", "adult medicine", "medicine (internal)"],
      },
      Surgery: {
        aliases: ["surg", "general surgery"],
      },
      Pediatrics: {
        aliases: ["peds", "paediatrics"],
      },
      "Obstetrics & Gynecology": {
        aliases: [
          "obgyn",
          "ob/gyn",
          "ob gyn",
          "obstetrics",
          "gynecology",
          "obstetrics and gynecology",
          "women's health",
          "womens health",
        ],
      },
      Psychiatry: {
        aliases: ["psych", "behavioral health"],
      },
    },
    system: {
      "Social Sciences (Ethics/Safety/Legal)": {
        aliases: [
          "ethics",
          "patient safety",
          "legal",
          "legal ethical",
          "quality & safety",
          "quality improvement",
          "qi",
          "social science",
          "social sciences",
          "communication",
          "professionalism",
        ],
      },
      "Renal/Urinary & Reproductive": {
        aliases: ["renal", "gu", "genitourinary", "urology", "urinary", "reproductive", "repro", "renal/gu", "gu/repro"],
      },
      "Cardiovascular System": {
        aliases: ["cardio", "cardiovascular", "cv"],
      },
      "Musculoskeletal System & Skin": {
        aliases: ["msk", "musculoskeletal", "msk & skin", "msk/skin", "musculoskeletal and skin", "msk/derm", "derm", "dermatology", "skin"],
      },
      "Gastrointestinal System": {
        aliases: ["gi", "gastrointestinal"],
      },
      "Respiratory System": {
        aliases: ["resp", "pulm", "pulmonary", "respiratory"],
      },
    },
    physician_task: {
      "Patient Care: Management": {
        aliases: ["management", "treatment", "therapy", "intervention", "patient care management"],
      },
      "Patient Care: Diagnosis": {
        aliases: ["diagnosis", "diagnostic", "workup", "evaluation", "patient care diagnosis"],
      },
      "Health Maintenance & Disease Prevention": {
        aliases: ["prevention", "health maintenance", "screening", "counseling"],
      },
    },
  },
};
