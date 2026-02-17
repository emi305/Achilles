import type { CategoryType, TestType } from "./types";
import { COMLEX_COMPETENCY_DOMAIN_CANONICAL } from "./comlexCanonicalNames";

export type QbankSource = "truelearn" | "uworld" | "amboss" | "unknown";

type CanonicalEntry = {
  aliases: string[];
  bySource?: Partial<Record<QbankSource, string[]>>;
  regex?: string[];
};

type CategoryCatalog = Partial<Record<string, CanonicalEntry>>;

const [
  COMLEX_CD_OPP,
  COMLEX_CD_PATIENT_CARE,
  COMLEX_CD_APP_KNOWLEDGE,
  COMLEX_CD_PBLI,
  COMLEX_CD_ICS,
  COMLEX_CD_PROFESSIONALISM,
  COMLEX_CD_SBP,
] = COMLEX_COMPETENCY_DOMAIN_CANONICAL;

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
      [COMLEX_CD_OPP]: {
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
      [COMLEX_CD_PATIENT_CARE]: {
        aliases: [
          "osteopathic patient care and procedural skills",
          "patient care procedural skills",
          "procedural skills",
          "osteopathic patient care",
          "osteopathic patient care and procedural skills",
        ],
      },
      [COMLEX_CD_APP_KNOWLEDGE]: {
        aliases: [
          "application of knowledge",
          "medical knowledge",
          "knowledge application",
          "application of knowledge for osteopathic medical practice",
        ],
      },
      [COMLEX_CD_PBLI]: {
        aliases: [
          "practice-based learning and improvement in osteopathic medical practice",
          "practice–based learning and improvement in osteopathic medical practice",
          "practice—based learning and improvement in osteopathic medical practice",
          "practice based learning",
          "practice based learning improvement",
          "practice based learning and improvement in osteopathic medical practice",
          "practice-based learning and improvement in osteopathic medical practice",
          "quality improvement",
          "qi",
          "pbli",
        ],
      },
      [COMLEX_CD_ICS]: {
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
      [COMLEX_CD_PROFESSIONALISM]: {
        aliases: [
          "professionalism",
          "professionalism in the practice of osteopathic medicine",
          "professionalism in osteopathic medicine",
        ],
      },
      [COMLEX_CD_SBP]: {
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
          "human development, reproduction, and sexuality",
          "human development reproduction and sexuality",
          "human development, reproduction and sexuality",
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
      "Medicine (IM)": {
        aliases: ["medicine", "internal medicine", "im", "medicine internal", "adult medicine", "medicine (internal)"],
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
      "Renal/Urinary & Reproductive": {
        aliases: [
          "renal",
          "gu",
          "genitourinary",
          "urology",
          "urinary",
          "reproductive",
          "repro",
          "renal/gu",
          "gu/repro",
          "renal, urinary systems and electrolytes",
          "renal urinary systems and electrolytes",
          "renal urinary systems and electrolytes",
          "male reproductive system",
          "female reproductive system and breast",
          "female reproductive system",
        ],
      },
      Cardiovascular: {
        aliases: ["cardiovascular system", "cardiovascular", "cardio", "cv"],
      },
      "MSK / Skin & Subcutaneous": {
        aliases: [
          "musculoskeletal system and skin",
          "musculoskeletal sys/skin and subcutaneous tissue",
          "musculoskeletal sys skin and subcutaneous tissue",
          "musculoskeletal and skin",
          "msk",
          "musculoskeletal",
          "msk and skin",
          "msk/skin",
          "msk/derm",
          "rheumatology/orthopedics and sports",
          "rheumatology orthopedics and sports",
          "dermatology",
          "derm",
          "skin",
        ],
      },
      "Behavioral Health": {
        aliases: [
          "behavioral health",
          "psychiatric/behavioral and substance use disorder",
          "psychiatric/behavioral & substance use disorder",
          "psychiatric behavioral and substance use disorder",
          "behavioral and substance use disorder",
        ],
      },
      Gastrointestinal: {
        aliases: ["gastrointestinal system", "gastrointestinal", "gi", "gastrointestinal and nutrition"],
      },
      "Nervous System & Special Senses": {
        aliases: [
          "nervous system and special senses",
          "nervous system",
          "neuro",
          "ophthalmology",
          "ophtho",
          "ear nose and throat",
          "ent",
          "special senses",
        ],
      },
      Respiratory: {
        aliases: ["resp", "pulm", "pulmonary", "respiratory", "respiratory system", "pulmonary and critical care"],
      },
      "Multisystem Processes & Disorders": {
        aliases: [
          "multisystem processes and disorders",
          "miscellaneous multisystem",
          "miscellaneous (multisystem)",
          "multisystem",
          "infectious diseases",
          "infectious disease",
          "general principles",
          "poisoning and environmental exposure",
        ],
      },
      Endocrine: {
        aliases: ["endocrine", "endocrine diabetes and metabolism", "endocrine, diabetes and metabolism"],
      },
      "Pregnancy/Childbirth & Puerperium": {
        aliases: ["pregnancy childbirth and puerperium", "pregnancy, childbirth and puerperium"],
      },
      "Blood & Lymphoreticular": {
        aliases: ["blood and lymphoreticular", "hematology and oncology", "heme onc", "hematology & oncology"],
      },
      Immune: {
        aliases: ["immune", "allergy and immunology", "allergy & immunology"],
      },
      "Biostatistics/Epi/Population Health/Med Lit": {
        aliases: [
          "biostatistics and epidemiology",
          "biostats and epidemiology",
          "biostats & epidemiology",
          "biostatistics & epidemiology",
          "population health",
          "medical literature",
        ],
      },
      "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)": {
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
          "social sciences (ethics/legal/professional)",
          "social sciences ethics/legal/professional",
          "social sciences ethics legal professional",
          "communication",
          "professionalism",
        ],
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
    uworld_subject: {
      "Medicine (IM)": {
        aliases: ["medicine", "internal medicine", "im"],
      },
      "Obstetrics & Gynecology": {
        aliases: ["obstetrics and gynecology", "ob gyn", "ob/gyn", "obgyn"],
      },
      Pediatrics: {
        aliases: ["pediatrics", "peds"],
      },
      Psychiatry: {
        aliases: ["psychiatry", "psych"],
      },
      Surgery: {
        aliases: ["surgery", "surg"],
      },
    },
    uworld_system: {
      "Renal/Urinary & Reproductive": {
        aliases: [
          "renal, urinary systems and electrolytes",
          "renal urinary systems and electrolytes",
          "renal urinary and electrolytes",
          "male reproductive system",
          "female reproductive system and breast",
          "female reproductive system",
          "renal",
          "urinary",
          "repro",
          "gu",
        ],
      },
      Cardiovascular: { aliases: ["cardiovascular system", "cardiovascular", "cardio"] },
      "MSK / Skin & Subcutaneous": {
        aliases: [
          "rheumatology/orthopedics and sports",
          "rheumatology orthopedics sports",
          "musculoskeletal sys/skin and subcutaneous tissue",
          "musculoskeletal sys skin and subcutaneous tissue",
          "dermatology",
          "derm",
          "skin",
          "msk",
        ],
      },
      "Behavioral Health": {
        aliases: [
          "psychiatric/behavioral and substance use disorder",
          "psychiatric/behavioral & substance use disorder",
          "psychiatric behavioral and substance use disorder",
          "behavioral and substance use disorder",
        ],
      },
      Gastrointestinal: { aliases: ["gastrointestinal and nutrition", "gi and nutrition", "gastrointestinal"] },
      "Nervous System & Special Senses": { aliases: ["nervous system", "ophthalmology", "ophtho", "ear nose and throat", "ent"] },
      Respiratory: { aliases: ["pulmonary and critical care", "pulm critical care", "respiratory"] },
      "Multisystem Processes & Disorders": {
        aliases: [
          "miscellaneous multisystem",
          "miscellaneous (multisystem)",
          "multisystem",
          "infectious diseases",
          "infectious disease",
          "general principles",
          "poisoning and environmental exposure",
        ],
      },
      Endocrine: { aliases: ["endocrine, diabetes and metabolism", "endocrine diabetes and metabolism", "endocrine", "metabolism"] },
      "Pregnancy/Childbirth & Puerperium": { aliases: ["pregnancy childbirth and puerperium", "pregnancy, childbirth and puerperium"] },
      "Blood & Lymphoreticular": { aliases: ["hematology and oncology", "heme onc", "hematology oncology"] },
      Immune: { aliases: ["allergy and immunology", "allergy & immunology", "immunology"] },
      "Biostatistics/Epi/Population Health/Med Lit": {
        aliases: ["biostats & epidemiology", "biostatistics and epidemiology", "biostatistics & epidemiology", "population health"],
      },
      "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)": {
        aliases: [
          "social sciences",
          "social science",
          "social sciences (ethics/legal/professional)",
          "social sciences ethics/legal/professional",
          "social sciences ethics legal professional",
          "ethics legal professional",
          "ethics",
          "patient safety",
          "legal",
          "professionalism",
        ],
      },
    },
  },
};
