import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { logServerError } from "../../../lib/supabase/errors";
import type { CategoryType, TestType } from "../../../lib/types";
import type {
  RehabCategorySnapshotInput,
  RehabSnapshotSaveRequest,
  RehabSnapshotsResponse,
} from "../../../lib/rehab";

export const runtime = "nodejs";

type SupabaseRouteErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

function isTestType(value: unknown): value is TestType {
  return value === "comlex2" || value === "usmle_step2";
}

function isCategoryType(value: unknown): value is CategoryType {
  return (
    value === "competency_domain" ||
    value === "clinical_presentation" ||
    value === "discipline" ||
    value === "system" ||
    value === "physician_task" ||
    value === "uworld_subject" ||
    value === "uworld_system"
  );
}

function asNullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isMissingRehabTableError(error: unknown): boolean {
  const err = error as SupabaseRouteErrorLike | null;
  if (!err) {
    return false;
  }
  if (err.code === "42P01") {
    return true;
  }
  const text = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
  return (
    text.includes("rehab_analysis_runs") ||
    text.includes("rehab_analysis_categories") ||
    text.includes("relation") && text.includes("does not exist")
  );
}

function normalizeCategoryInput(value: unknown): RehabCategorySnapshotInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.categoryName !== "string" || !raw.categoryName.trim()) {
    return null;
  }
  if (!isCategoryType(raw.categoryType)) {
    return null;
  }

  return {
    categoryName: raw.categoryName.trim(),
    categoryType: raw.categoryType,
    weight: asNullableFiniteNumber(raw.weight),
    roi: asNullableFiniteNumber(raw.roi),
    hasRoi: raw.hasRoi === true,
    proi: asNullableFiniteNumber(raw.proi),
    hasProi: raw.hasProi === true,
    avgPercentCorrect: asNullableFiniteNumber(raw.avgPercentCorrect),
    attemptedCount: asNullableInteger(raw.attemptedCount),
  };
}

function normalizeSnapshotRequest(body: unknown): RehabSnapshotSaveRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const raw = body as Record<string, unknown>;
  if (typeof raw.clientSnapshotKey !== "string" || !raw.clientSnapshotKey.trim()) {
    return null;
  }
  if (!isTestType(raw.examMode)) {
    return null;
  }
  if (typeof raw.snapshotAt !== "string" || Number.isNaN(Date.parse(raw.snapshotAt))) {
    return null;
  }
  if (!Array.isArray(raw.categories)) {
    return null;
  }

  const categories = raw.categories.map(normalizeCategoryInput).filter((item): item is RehabCategorySnapshotInput => item != null);

  return {
    clientSnapshotKey: raw.clientSnapshotKey.trim(),
    examMode: raw.examMode,
    snapshotAt: raw.snapshotAt,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : null,
    hasQbankData: raw.hasQbankData === true,
    hasScoreReportData: raw.hasScoreReportData === true,
    overallRoi: asNullableFiniteNumber(raw.overallRoi),
    overallProi: asNullableFiniteNumber(raw.overallProi),
    overallAvgPercentCorrect: asNullableFiniteNumber(raw.overallAvgPercentCorrect),
    overallAttemptedCount: asNullableInteger(raw.overallAttemptedCount),
    categories,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = normalizeSnapshotRequest(body);
    if (!payload) {
      return NextResponse.json({ message: "Invalid Rehab snapshot payload." }, { status: 400 });
    }

    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const runRow = {
      user_id: user.id,
      client_snapshot_key: payload.clientSnapshotKey,
      exam_mode: payload.examMode,
      snapshot_at: payload.snapshotAt,
      label: payload.label ?? null,
      has_qbank_data: payload.hasQbankData,
      has_score_report_data: payload.hasScoreReportData,
      overall_roi: payload.overallRoi,
      overall_proi: payload.overallProi,
      overall_avg_percent_correct: payload.overallAvgPercentCorrect,
      overall_attempted_count: payload.overallAttemptedCount,
    };

    const { data: upsertedRun, error: runError } = await supabase
      .from("rehab_analysis_runs")
      .upsert(runRow, { onConflict: "user_id,client_snapshot_key" })
      .select("id")
      .single();

    if (runError || !upsertedRun?.id) {
      if (isMissingRehabTableError(runError)) {
        return NextResponse.json(
          { message: "Rehab database tables are not set up yet. Run the Rehab Supabase migration first." },
          { status: 503 },
        );
      }
      logServerError("rehab snapshot run upsert failed", runError);
      return NextResponse.json({ message: "Failed to save Rehab snapshot." }, { status: 500 });
    }

    const runId = String(upsertedRun.id);

    const { error: deleteCategoriesError } = await supabase
      .from("rehab_analysis_categories")
      .delete()
      .eq("run_id", runId)
      .eq("user_id", user.id);

    if (deleteCategoriesError) {
      logServerError("rehab snapshot category delete failed", deleteCategoriesError);
      return NextResponse.json({ message: "Failed to save Rehab snapshot categories." }, { status: 500 });
    }

    if (payload.categories.length > 0) {
      const categoryRows = payload.categories.map((category) => ({
        run_id: runId,
        user_id: user.id,
        exam_mode: payload.examMode,
        category_name: category.categoryName,
        category_type: category.categoryType,
        weight: category.weight,
        roi: category.roi,
        has_roi: category.hasRoi,
        proi: category.proi,
        has_proi: category.hasProi,
        avg_percent_correct: category.avgPercentCorrect,
        attempted_count: category.attemptedCount,
      }));

      const { error: insertCategoriesError } = await supabase.from("rehab_analysis_categories").insert(categoryRows);
      if (insertCategoriesError) {
        logServerError("rehab snapshot category insert failed", insertCategoriesError);
        return NextResponse.json({ message: "Failed to save Rehab snapshot categories." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    logServerError("rehab snapshot POST failed", error);
    return NextResponse.json({ message: "Failed to save Rehab snapshot." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const examMode = url.searchParams.get("examMode");
    if (!isTestType(examMode)) {
      return NextResponse.json({ message: "Invalid exam mode." }, { status: 400 });
    }

    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { data: runRows, error: runsError } = await supabase
      .from("rehab_analysis_runs")
      .select(
        "id, exam_mode, snapshot_at, label, has_qbank_data, has_score_report_data, overall_roi, overall_proi, overall_avg_percent_correct, overall_attempted_count",
      )
      .eq("user_id", user.id)
      .eq("exam_mode", examMode)
      .order("snapshot_at", { ascending: true });

    if (runsError) {
      if (isMissingRehabTableError(runsError)) {
        const setupResponse: RehabSnapshotsResponse = {
          runs: [],
          categories: [],
          setupRequired: true,
          message: "Rehab needs a database migration before snapshots can load.",
        };
        return NextResponse.json(setupResponse, { status: 200 });
      }
      logServerError("rehab snapshot GET runs failed", runsError);
      return NextResponse.json({ message: "Failed to load Rehab snapshots." }, { status: 500 });
    }

    const runs = (Array.isArray(runRows) ? runRows : []).map((row) => ({
      id: String(row.id),
      examMode: row.exam_mode as TestType,
      snapshotAt: String(row.snapshot_at),
      label: typeof row.label === "string" ? row.label : null,
      hasQbankData: row.has_qbank_data === true,
      hasScoreReportData: row.has_score_report_data === true,
      overallRoi: asNullableFiniteNumber(row.overall_roi),
      overallProi: asNullableFiniteNumber(row.overall_proi),
      overallAvgPercentCorrect: asNullableFiniteNumber(row.overall_avg_percent_correct),
      overallAttemptedCount: asNullableInteger(row.overall_attempted_count),
    }));

    if (runs.length === 0) {
      const empty: RehabSnapshotsResponse = { runs: [], categories: [] };
      return NextResponse.json(empty);
    }

    const runIds = runs.map((run) => run.id);
    const { data: categoryRows, error: categoriesError } = await supabase
      .from("rehab_analysis_categories")
      .select(
        "run_id, exam_mode, category_name, category_type, weight, roi, has_roi, proi, has_proi, avg_percent_correct, attempted_count",
      )
      .eq("user_id", user.id)
      .eq("exam_mode", examMode)
      .in("run_id", runIds);

    if (categoriesError) {
      if (isMissingRehabTableError(categoriesError)) {
        const setupResponse: RehabSnapshotsResponse = {
          runs: [],
          categories: [],
          setupRequired: true,
          message: "Rehab needs a database migration before category snapshots can load.",
        };
        return NextResponse.json(setupResponse, { status: 200 });
      }
      logServerError("rehab snapshot GET categories failed", categoriesError);
      return NextResponse.json({ message: "Failed to load Rehab categories." }, { status: 500 });
    }

    const categories = (Array.isArray(categoryRows) ? categoryRows : []).map((row) => ({
      runId: String(row.run_id),
      examMode: row.exam_mode as TestType,
      categoryName: String(row.category_name),
      categoryType: row.category_type as CategoryType,
      weight: asNullableFiniteNumber(row.weight),
      roi: asNullableFiniteNumber(row.roi),
      hasRoi: row.has_roi === true,
      proi: asNullableFiniteNumber(row.proi),
      hasProi: row.has_proi === true,
      avgPercentCorrect: asNullableFiniteNumber(row.avg_percent_correct),
      attemptedCount: asNullableInteger(row.attempted_count),
    }));

    const response: RehabSnapshotsResponse = { runs, categories };
    return NextResponse.json(response);
  } catch (error) {
    logServerError("rehab snapshot GET failed", error);
    return NextResponse.json({ message: "Failed to load Rehab snapshots." }, { status: 500 });
  }
}
