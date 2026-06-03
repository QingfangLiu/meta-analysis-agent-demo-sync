(function () {
  const data = window.DEMO_DATA;
  const app = document.getElementById("app");
  const heroPanel = document.getElementById("hero-panel");
  const stepper = document.getElementById("stepper");

  if (!data || !app || !heroPanel || !stepper) {
    return;
  }

  const steps = [
    { id: "step-1", label: "Review setup", title: "Stage 1: Review setup" },
    { id: "step-2", label: "Search", title: "Stage 2: Search and retrieval" },
    { id: "step-3", label: "Screening", title: "Stage 3: Eligibility criteria and screening" },
    { id: "step-4", label: "Planning", title: "Stage 4: Planning" },
    { id: "step-5", label: "Extraction/RoB", title: "Stage 5: Extraction and risk of bias" },
    { id: "step-6", label: "Synthesis", title: "Stage 6: Final synthesis and reporting" },
    { id: "evaluation-summary", label: "Evaluation", title: "Benchmark evaluation summary", kind: "evaluation", indexLabel: "Eval" },
  ];

  const fmt = new Intl.NumberFormat("en-US");
  const runs = Array.isArray(data.runs) ? data.runs : [data];
  const LINKAGE_COLORS = ["#0f766e", "#d97706", "#1d4ed8", "#9333ea", "#b42318", "#64748b", "#166534", "#9a6700"];
  const COCHRANE_REFERENCE_STATUS_META = {
    matched_analysis: {
      label: "Matched analysis",
      detail: "Used in the matched Cochrane forest plot.",
      color: "#15803d",
    },
    included_review_not_matched_analysis: {
      label: "Included elsewhere",
      detail: "Included by Cochrane, but not in this analysis.",
      color: "#2563eb",
    },
    excluded_review: {
      label: "Excluded reference",
      detail: "Listed in Cochrane excluded studies.",
      color: "#b91c1c",
    },
    not_in_cochrane_reference_sets: {
      label: "Not in refs",
      detail: "Absent from curated included/excluded Cochrane references.",
      color: "#475569",
    },
    no_pmid: {
      label: "No PMID",
      detail: "No PMID available for reference lookup.",
      color: "#6d28d9",
    },
  };
  const EXTRACTION_DISPLAY_FIELD_EXCLUDE = new Set([
    "field_evidence_json",
    "multimodal_asset_ids",
    "multimodal_assets_count",
    "multimodal_attempted",
    "multimodal_reason",
    "multimodal_status",
    "multimodal_statuses",
    "multimodal_used",
    "visual_evidence_asset_ids",
    "visual_evidence_notes",
    "synthesis_effect_size_source",
    "synthesis_effect_size_source_note",
    "rob_attempted",
    "assessment_status",
    "rob_status_reason",
    "study_design_type",
    "study_design_subtype",
    "recommended_rob_tool_id",
    "implemented_rob_tool_id",
    "administered_rob_tool_id",
    "rob_routing_status",
    "overall_risk_of_bias",
    "overall_reason",
  ]);
  const VARIANCE_FALLBACK_SOURCES = new Set(["arm_mean_sd_n", "arm_event_counts"]);
  const RUN_TIMING_STAGE_LABELS = {
    review_setup: "Review setup",
    search_retrieval: "Search and retrieval",
    screening: "Eligibility criteria and screening",
    post_screening: "Planning",
    extraction_rob: "Extraction and RoB",
    synthesis_reporting: "Synthesis and reporting",
  };

  function readSessionJson(key) {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeSessionJson(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Session storage can be unavailable in some private browsing contexts.
    }
  }

  function demoGlobalStateKey() {
    return `meta-analysis-demo-state:${window.location.pathname}`;
  }

  function initialRunId() {
    const savedRunId = readSessionJson(demoGlobalStateKey())?.currentRunId;
    if (savedRunId && runs.some((run) => run.run_id === savedRunId)) {
      return savedRunId;
    }
    return data.selected_run_id || runs[0]?.run_id;
  }

  let currentRunId = initialRunId();
  let currentScreeningLimit = 20;
  let currentScreeningDecisions = ["include", "exclude", "not enough info"];
  let currentScreeningBenchmarkOnly = false;
  let currentNonExtractableLimit = 5;
  let currentExtractableOpen = false;
  let currentNonExtractableOpen = false;
  let currentTemplateOpen = false;
  let currentEvaluationVisible = false;
  let currentOutcomeBenchmarkView = "off";
  let currentCochraneReferenceStatusPlots = new Set();
  let currentCochraneForestPlotViews = new Map();
  let currentCochraneStudySelections = new Map();
  let currentOpenSynthesisOutcomeKeys = new Set();
  let currentStepObserver = null;
  let currentStepLockUntil = 0;
  let currentStepScrollHandler = null;
  let jumpOutlineClearHandlerAttached = false;
  let rowStatusDismissHandlerAttached = false;
  let initialScrollRestorePending = true;
  let scrollSaveFrame = null;

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  function demoUiStateKey() {
    return `meta-analysis-demo-ui:${window.location.pathname}:${currentRunId || "default"}`;
  }

  function demoScrollStateKey() {
    return `meta-analysis-demo-scroll:${window.location.pathname}:${currentRunId || "default"}`;
  }

  function saveDemoScrollState() {
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    writeSessionJson(demoScrollStateKey(), {
      x: window.scrollX,
      y: window.scrollY,
      maxScrollY,
      savedAt: Date.now(),
    });
  }

  function readDemoScrollState() {
    return readSessionJson(demoScrollStateKey());
  }

  function saveDemoUiState() {
    writeSessionJson(demoGlobalStateKey(), {
      currentRunId,
      savedAt: Date.now(),
    });
    writeSessionJson(demoUiStateKey(), {
      currentScreeningLimit,
      currentScreeningDecisions,
      currentScreeningBenchmarkOnly,
      currentNonExtractableLimit,
      currentExtractableOpen,
      currentNonExtractableOpen,
      currentTemplateOpen,
      currentEvaluationVisible,
      currentOutcomeBenchmarkView,
      currentCochraneReferenceStatusPlots: Array.from(currentCochraneReferenceStatusPlots),
      currentCochraneForestPlotViews: Object.fromEntries(currentCochraneForestPlotViews),
      currentCochraneStudySelections: Object.fromEntries(currentCochraneStudySelections),
      currentOpenSynthesisOutcomeKeys: Array.from(currentOpenSynthesisOutcomeKeys),
      savedAt: Date.now(),
    });
  }

  function restoreDemoUiState() {
    const saved = readSessionJson(demoUiStateKey());
    if (!saved || typeof saved !== "object") {
      return;
    }
    currentScreeningLimit = saved.currentScreeningLimit ?? currentScreeningLimit;
    currentScreeningDecisions = Array.isArray(saved.currentScreeningDecisions) && saved.currentScreeningDecisions.length
      ? saved.currentScreeningDecisions
      : currentScreeningDecisions;
    currentScreeningBenchmarkOnly = Boolean(saved.currentScreeningBenchmarkOnly);
    currentNonExtractableLimit = saved.currentNonExtractableLimit ?? currentNonExtractableLimit;
    currentExtractableOpen = Boolean(saved.currentExtractableOpen);
    currentNonExtractableOpen = Boolean(saved.currentNonExtractableOpen);
    currentTemplateOpen = Boolean(saved.currentTemplateOpen);
    currentEvaluationVisible = false;
    currentOutcomeBenchmarkView = "off";
    currentCochraneReferenceStatusPlots = new Set();
    currentCochraneForestPlotViews = new Map();
    currentCochraneStudySelections = new Map();
    currentOpenSynthesisOutcomeKeys = new Set(
      Array.isArray(saved.currentOpenSynthesisOutcomeKeys) ? saved.currentOpenSynthesisOutcomeKeys : []
    );
  }

  function resetRunUiState() {
    currentScreeningLimit = 20;
    currentScreeningDecisions = ["include", "exclude", "not enough info"];
    currentScreeningBenchmarkOnly = false;
    currentNonExtractableLimit = 5;
    currentExtractableOpen = false;
    currentNonExtractableOpen = false;
    currentTemplateOpen = false;
    currentEvaluationVisible = false;
    currentOutcomeBenchmarkView = "off";
    currentCochraneReferenceStatusPlots = new Set();
    currentCochraneForestPlotViews = new Map();
    currentCochraneStudySelections = new Map();
    currentOpenSynthesisOutcomeKeys = new Set();
    restoreDemoUiState();
  }

  function scheduleDemoScrollSave() {
    if (scrollSaveFrame !== null) {
      return;
    }
    scrollSaveFrame = window.requestAnimationFrame(() => {
      scrollSaveFrame = null;
      saveDemoScrollState();
    });
  }

  function restoreInitialScrollPosition() {
    if (!initialScrollRestorePending) {
      return;
    }
    initialScrollRestorePending = false;
    const hashTarget = window.location.hash
      ? document.getElementById(window.location.hash.slice(1))
      : null;
    const saved = readDemoScrollState();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (hashTarget) {
          hashTarget.scrollIntoView({ block: "start" });
          return;
        }
        if (!saved || !Number.isFinite(Number(saved.y))) {
          return;
        }
        const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo(Number(saved.x) || 0, Math.min(Number(saved.y), maxScrollY));
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function sentence(value) {
    return escapeHtml(value || "No detail available.");
  }

  function yesNo(value) {
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    const text = String(value || "").trim().toLowerCase();
    if (["true", "yes", "1"].includes(text)) {
      return "Yes";
    }
    if (["false", "no", "0"].includes(text)) {
      return "No";
    }
    return value === null || value === undefined || String(value).trim() === "" ? "—" : sentence(value);
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function nonEmptyArray(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => cleanText(item))
        .filter(Boolean);
    }
    const text = cleanText(value);
    return text ? [text] : [];
  }

  function uniqueTextList(values) {
    const seen = new Set();
    return nonEmptyArray(values).filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function limitedTextList(values, limit = 4) {
    const items = uniqueTextList(values);
    if (!items.length) {
      return "—";
    }
    const visible = items.slice(0, limit).map(escapeHtml).join("<br>");
    const remaining = items.length - limit;
    return remaining > 0
      ? `${visible}<br><span class="muted">+${number(remaining)} more</span>`
      : visible;
  }

  function hasBooleanBoundary(text, start, tokenLength) {
    const before = start > 0 ? text[start - 1] : "";
    const after = start + tokenLength < text.length ? text[start + tokenLength] : "";
    return (!before || !/[A-Za-z0-9_]/.test(before)) && (!after || !/[A-Za-z0-9_]/.test(after));
  }

  function splitTopLevelBooleanBlocks(query, operatorToken) {
    const text = String(query || "").trim();
    if (!text) return [];
    const token = String(operatorToken || "").toUpperCase();
    const blocks = [];
    let depth = 0;
    let inQuote = false;
    let start = 0;
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      if (char === '"') {
        inQuote = !inQuote;
        index += 1;
        continue;
      }
      if (inQuote) {
        index += 1;
        continue;
      }
      if (char === "(") {
        depth += 1;
        index += 1;
        continue;
      }
      if (char === ")") {
        depth -= 1;
        if (depth < 0) return [text];
        index += 1;
        continue;
      }
      if (
        depth === 0 &&
        text.slice(index, index + token.length).toUpperCase() === token &&
        hasBooleanBoundary(text, index, token.length)
      ) {
        const block = text.slice(start, index).trim();
        if (block) blocks.push(block);
        start = index + token.length;
        index += token.length;
        continue;
      }
      index += 1;
    }
    if (depth !== 0 || inQuote) return [text];
    const tail = text.slice(start).trim();
    if (tail) blocks.push(tail);
    return blocks.length ? blocks : [text];
  }

  function splitTopLevelAndBlocks(query) {
    return splitTopLevelBooleanBlocks(query, "AND");
  }

  function splitTopLevelOrBlocks(query) {
    return splitTopLevelBooleanBlocks(query, "OR");
  }

  function stripBalancedOuterParens(text) {
    let value = String(text || "").trim();
    while (value.startsWith("(") && value.endsWith(")")) {
      let depth = 0;
      let inQuote = false;
      let wraps = true;
      for (let index = 0; index < value.length; index += 1) {
        if (value[index] === '"') {
          inQuote = !inQuote;
          continue;
        }
        if (inQuote) continue;
        if (value[index] === "(") depth += 1;
        if (value[index] === ")") {
          depth -= 1;
          if (depth < 0) return value;
        }
        if (depth === 0 && index < value.length - 1) {
          wraps = false;
          break;
        }
      }
      if (depth !== 0 || inQuote || !wraps) break;
      value = value.slice(1, -1).trim();
    }
    return value;
  }

  function flattenMandatoryAndBlocks(query) {
    const text = stripBalancedOuterParens(query);
    if (!text) return [];

    const andBlocks = splitTopLevelAndBlocks(text);
    if (andBlocks.length > 1) {
      return andBlocks.flatMap((block) => flattenMandatoryAndBlocks(block)).filter(Boolean);
    }

    // ANDs inside an OR alternative are not mandatory for every retrieved record.
    if (splitTopLevelOrBlocks(text).length > 1) {
      return [text];
    }

    return [text];
  }

  function simplifyPubMedFields(text) {
    return String(text || "")
      .replace(/\[Title\/Abstract\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderQueryBlocks(query) {
    const text = String(query || "").trim();
    if (!text) {
      return `<p class="query-text">No query found</p>`;
    }
    const blocks = flattenMandatoryAndBlocks(text);
    if (blocks.length <= 1) {
      return `<p class="query-text">${sentence(text)}</p>`;
    }
    return `
      <div class="query-block-list">
        ${blocks.map((block, index) => `
          ${index ? `<div class="query-and">AND</div>` : ""}
          <pre class="query-block"><code>${escapeHtml(stripBalancedOuterParens(simplifyPubMedFields(block)))}</code></pre>
        `).join("")}
      </div>
    `;
  }

  function queryResultCount(item) {
    const values = [
      item?.n_results,
      item?.retrieval_audit?.pubmed_total_count,
      item?.retrieval_audit?.n_pmids,
      item?.quality?.pubmed_total_count,
      Array.isArray(item?.pmids) ? item.pmids.length : null,
    ];
    return values.find((value) => value !== null && value !== undefined && value !== "");
  }

  function normalizedQueryText(query) {
    return String(query || "").replace(/\s+/g, " ").trim();
  }

  const QUERY_AUDIT_REASON_PREFIXES = [
    "Retrieved-record audit found too many mandatory PubMed query blocks.",
    "Retrieved-record audit found the query too large for feasible screening.",
    "Retrieved-record audit found too few PubMed records for recall.",
    "Retrieved-record audit found a subtype-bound population block missing the parent disease/problem term.",
    "Retrieved-record audit found a phrase-bound intervention block missing the standalone drug/class/agent term.",
  ];

  function llmQueryQualityReason(reason) {
    let text = String(reason || "").replace(/\s+/g, " ").trim();
    QUERY_AUDIT_REASON_PREFIXES.forEach((prefix) => {
      if (text.startsWith(prefix)) {
        text = text.slice(prefix.length).trim();
      }
    });
    return text;
  }

  function postScreeningQueryTransitionReason(iteration, skippedSameQuery) {
    if (skippedSameQuery) {
      return "After initial title/abstract screening, the agent checked screening-derived term variants. They were already covered by the final pre-screening query, so the post-screening step reused the same query.";
    }
    return String(iteration?.notes || "").replace(/\s+/g, " ").trim()
      || "After initial title/abstract screening, the agent reviewed focused term variants and reran PubMed retrieval when they added useful query coverage.";
  }

  function queryHistoryEntries(queryReview, screeningQueryUpdate) {
    const finalInitialQuery = normalizedQueryText(queryReview?.final_query || queryReview?.current_query || "");
    const entries = [];
    const iterations = Array.isArray(queryReview?.query_iterations) ? queryReview.query_iterations : [];
    iterations.forEach((iteration, index) => {
      const query = iteration?.query || "";
      if (!String(query).trim()) return;
      const isFinal = finalInitialQuery && normalizedQueryText(query) === finalInitialQuery;
      entries.push({
        key: `pre-${index}`,
        kind: "pre",
        stage: "Pre-screening query audit",
        title: `Pre-screening iteration ${index + 1}`,
        badge: isFinal ? "Final query for initial screening" : (index === 0 ? "Initial query" : "Revised query"),
        query,
        retrieved: queryResultCount(iteration),
        detail: llmQueryQualityReason(iteration?.quality?.reason),
      });
    });
    if (finalInitialQuery && !entries.some((entry) => normalizedQueryText(entry.query) === finalInitialQuery)) {
      entries.push({
        key: "pre-final",
        kind: "pre",
        stage: "Pre-screening query audit",
        title: "Pre-screening final query",
        badge: "Final query for initial screening",
        query: queryReview?.final_query || queryReview?.current_query || "",
        retrieved: queryReview?.n_pmids || queryReview?.final_quality?.pubmed_total_count,
        detail: llmQueryQualityReason(queryReview?.final_quality?.reason),
      });
    }

    const updateIterations = Array.isArray(screeningQueryUpdate?.iterations)
      ? screeningQueryUpdate.iterations
      : [];
    updateIterations.forEach((iteration, index) => {
      const query = iteration?.updated_query || "";
      if (!String(query).trim()) return;
      const normalizedQuery = normalizedQueryText(query);
      const sameAsInitialFinal = finalInitialQuery && normalizedQuery === finalInitialQuery;
      const skippedSameQuery = String(iteration?.status || "").trim() === "skipped_same_query";
      const iterationRetrieved = queryResultCount(iteration);
      const finalRetrieved = queryReview?.n_pmids
        || queryReview?.final_quality?.pubmed_total_count
        || (Array.isArray(queryReview?.final_pmids) ? queryReview.final_pmids.length : null);
      const retrieved = (skippedSameQuery || (sameAsInitialFinal && !Number(iterationRetrieved || 0)))
        ? finalRetrieved
        : iterationRetrieved;
      const newPmids = iteration?.n_new_pmids ?? (skippedSameQuery ? screeningQueryUpdate?.n_new_pmids : undefined);
      entries.push({
        key: `post-${index}`,
        kind: "post",
        stage: "Screening-driven query update",
        title: `Post-screening iteration ${iteration?.iteration || index + 1}`,
        badge: skippedSameQuery ? "Same as final screening query" : "Generated after term audit",
        query,
        retrieved,
        detail: "",
        transitionDetail: postScreeningQueryTransitionReason(iteration, skippedSameQuery),
      });
    });
    return entries;
  }

  function retrievalEvaluationForQueryEntry(entry, searchMetrics) {
    const rows = Array.isArray(searchMetrics?.retrieval_queries) ? searchMetrics.retrieval_queries : [];
    if (!rows.length) {
      return null;
    }
    const entryKey = String(entry?.key || "").trim();
    const entryQuery = normalizedQueryText(entry?.query || "");
    return rows.find((row) => String(row?.key || "").trim() === entryKey)
      || rows.find((row) => normalizedQueryText(row?.query || "") === entryQuery)
      || rows.find((row) => String(row?.label || "").trim() === String(entry?.title || "").trim())
      || null;
  }

  function numericRetrievalCount(row) {
    const value = row?.retrieved_count ?? row?.unique_pmids;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function correctedSameQueryRetrievalRow(row, rows) {
    if (!row) {
      return row;
    }
    const normalizedQuery = normalizedQueryText(row?.query || "");
    const status = String(row?.status || "").trim();
    const source = String(row?.retrieval_set_source || "").trim();
    const needsFallback = (
      status === "skipped_same_query"
      || source === "final_initial_screening_query"
      || (
        String(row?.stage || "").trim() === "post_screening_query_update"
        && !numericRetrievalCount(row)
      )
    );
    if (!needsFallback || !normalizedQuery) {
      return row;
    }
    const fallback = (rows || []).find((candidate) => (
      candidate !== row
      && normalizedQueryText(candidate?.query || "") === normalizedQuery
      && String(candidate?.stage || "").trim() !== "post_screening_query_update"
      && numericRetrievalCount(candidate) > 0
    ));
    if (!fallback) {
      return row;
    }
    return {
      ...row,
      retrieved_count: fallback.retrieved_count,
      unique_pmids: fallback.unique_pmids,
      tp: fallback.tp,
      fn: fallback.fn,
      recall: fallback.recall,
      tp_pmids: fallback.tp_pmids,
      fn_pmids: fallback.fn_pmids,
      retrieval_set_source: source || "same_as_final_pre_screening_query",
    };
  }

  function renderQueryRetrievalEvaluation(entry, searchMetrics) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((searchMetrics || {}).status !== "completed") {
      return "";
    }
    const rows = Array.isArray(searchMetrics?.retrieval_queries) ? searchMetrics.retrieval_queries : [];
    const row = correctedSameQueryRetrievalRow(
      retrievalEvaluationForQueryEntry(entry, searchMetrics),
      rows,
    );
    if (!row) {
      return "";
    }
	    return `
		      <aside class="query-evaluation-panel" aria-label="Retrieval evaluation for ${escapeHtml(entry.title || "query")}">
		        <div class="query-evaluation-card query-evaluation-card-compact">
		          <div class="query-evaluation-metrics">
		            <div>
		              <div class="stat-label">Found</div>
		              <div class="query-evaluation-value">${number(row.tp)}</div>
		            </div>
		            <div>
		              <div class="stat-label">Missed</div>
		              <div class="query-evaluation-value">${number(row.fn)}</div>
		            </div>
		            <div>
		              <div class="stat-label">Recall</div>
		              <div class="query-evaluation-value">${formatPercent(row.recall)}</div>
		            </div>
		          </div>
		          <div class="stat-detail">Cochrane included-reference PMIDs</div>
	        </div>
	      </aside>
	    `;
  }

  function renderQueryHistoryCard(entry, searchMetrics, options = {}) {
    const showDetail = options.showDetail !== false;
    return `
      <article class="query-history-card ${options.className || ""}">
        <div class="query-history-header">
          <div>
            <h3>${escapeHtml(entry.title)}</h3>
          </div>
          <div class="query-meta">
            ${entry.badge ? `<span class="query-badge">${escapeHtml(entry.badge)}</span>` : ""}
            <span class="query-count">Retrieved ${number(entry.retrieved)} PubMed records</span>
          </div>
        </div>
        <div class="query-content-grid">
          <div>${renderQueryBlocks(entry.query)}</div>
          ${renderQueryRetrievalEvaluation(entry, searchMetrics)}
        </div>
        ${showDetail && entry.detail ? `<p class="query-detail">${escapeHtml(entry.detail)}</p>` : ""}
      </article>
    `;
  }

  function renderPreScreeningQuerySequence(entries, searchMetrics) {
    if (!entries.length) {
      return "";
    }
    return `
      <div class="query-pre-screening-sequence">
        ${entries.map((entry, index) => `
          ${renderQueryHistoryCard(entry, searchMetrics, {
            showDetail: false,
            className: "query-history-card-pre",
          })}
          ${index < entries.length - 1 ? `
            <div class="query-transition" aria-label="Reason for next pre-screening query iteration">
              <div class="query-transition-arrow" aria-hidden="true"></div>
              ${entry.detail ? `
                <div class="query-transition-note">
                  <span>Agent query audit and revision</span>
                  <p>${escapeHtml(entry.detail)}</p>
                </div>
              ` : ""}
            </div>
          ` : ""}
        `).join("")}
      </div>
    `;
  }

  function renderScreeningQueryUpdateTransition(entry) {
    if (!entry) {
      return "";
    }
    return `
      <div class="query-transition query-transition-post" aria-label="Reason for post-screening query update">
        <div class="query-transition-arrow" aria-hidden="true"></div>
        <div class="query-transition-note">
          <span>Agent screening-driven query update</span>
          <p>${escapeHtml(entry.transitionDetail || "After initial title/abstract screening, the agent reviewed focused term variants and reran PubMed retrieval when they added useful query coverage.")}</p>
        </div>
      </div>
    `;
  }

  function renderQueryHistory(queryReview, screeningQueryUpdate, searchMetrics = {}) {
    const entries = queryHistoryEntries(queryReview || {}, screeningQueryUpdate || {});
    if (!entries.length) {
      return `<div class="panel" id="search-query-history">${renderQueryBlocks("")}</div>`;
    }
    const preEntries = entries.filter((entry) => entry.kind === "pre");
    const postEntries = entries.filter((entry) => entry.kind !== "pre");
    return `
      <div class="query-history-list" id="search-query-history">
        ${renderPreScreeningQuerySequence(preEntries, searchMetrics)}
        ${preEntries.length && postEntries.length ? renderScreeningQueryUpdateTransition(postEntries[0]) : ""}
        ${postEntries.map((entry) => renderQueryHistoryCard(entry, searchMetrics)).join("")}
      </div>
    `;
  }

  function formatPercent(value, digits = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return "—";
    }
    return `${(parsed * 100).toFixed(digits).replace(/\.0$/, "")}%`;
  }

  function renderEvaluationMetricGrid(items, className = "") {
    const validItems = (items || []).filter(Boolean);
    if (!validItems.length) {
      return "";
    }
    return `
      <div class="evaluation-metric-grid ${className}">
        ${validItems.map((item) => `
          <div class="evaluation-metric-card">
            <div class="stat-label">${escapeHtml(item.label || "")}</div>
            <div class="evaluation-metric-value">${escapeHtml(item.value || "—")}</div>
            ${item.detail ? `<div class="stat-detail">${escapeHtml(item.detail)}</div>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderEvaluationVisibilityControl() {
    return `
      <div class="evaluation-visibility-control" role="group" aria-label="Show benchmark evaluation">
        ${["on", "off"].map((value) => {
          const isActive = currentEvaluationVisible === (value === "on");
          const label = value === "on" ? "On" : "Off";
          return `
            <button
              class="evaluation-visibility-option ${isActive ? "is-active" : ""}"
              type="button"
              data-evaluation-visibility-toggle
              data-evaluation-visibility-value="${value}"
              aria-pressed="${isActive ? "true" : "false"}"
            >
              ${label}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderEvaluationVisibilityBanner() {
    return `
      <div class="evaluation-visibility-banner">
        <div class="evaluation-visibility-title">Show benchmark evaluation</div>
        ${renderEvaluationVisibilityControl()}
      </div>
    `;
  }

  function hasBenchmarkEvaluationArtifacts(...artifacts) {
    return artifacts.some((artifact) => (artifact || {}).status === "completed");
  }

  function pmidListFromValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    const text = String(value || "").trim();
    return text ? [text] : [];
  }

  function firstListValue(value) {
    const values = pmidListFromValue(value);
    return values.length ? values[0] : "";
  }

  function screeningBenchmarkPmidSet(searchMetrics = {}) {
    const benchmark = searchMetrics?.benchmark || {};
    return new Set([
      ...pmidListFromValue(benchmark.pmids),
      ...pmidListFromValue(benchmark.excluded_pmids),
    ]);
  }

  function cochraneSynthesisMembershipKey(membership) {
    return [
      membership?.analysis_id,
      membership?.outcome,
      membership?.effect_measure,
      membership?.comparison,
    ].map((value) => String(value || "").trim().toLowerCase()).join("|");
  }

  function uniqueCochraneSynthesisMemberships(values) {
    const seen = new Set();
    return (values || []).filter((membership) => {
      const key = cochraneSynthesisMembershipKey(membership);
      if (!key.replace(/\|/g, "") || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function mergeStudyLookupRecord(existing, incoming) {
    return Object.entries(incoming || {}).reduce((merged, [key, value]) => {
      if (key === "cochrane_synthesis_memberships") {
        merged[key] = uniqueCochraneSynthesisMemberships([
          ...(Array.isArray(merged[key]) ? merged[key] : []),
          ...(Array.isArray(value) ? value : []),
        ]);
        return merged;
      }
      const text = String(value || "").trim();
      if (text && !String(merged[key] || "").trim()) {
        merged[key] = value;
      }
      return merged;
    }, { ...(existing || {}) });
  }

  function cochraneSynthesisMembership(match, alignment) {
    if (!match?.analysis_id) {
      return null;
    }
    return {
      analysis_id: match.analysis_id,
      outcome: match.outcome || alignment?.best_match?.outcome || alignment?.outcome_name || "",
      effect_measure: match.effect_measure || alignment?.effect_measure || "",
      comparison: match.comparison || "",
    };
  }

  function cochraneStudyLookupFromSynthesis(ciOverlapArtifact) {
    const lookup = new Map();
    const addRecord = (pmid, record) => {
      const key = String(pmid || "").trim();
      if (!key) {
        return;
      }
      lookup.set(key, mergeStudyLookupRecord(lookup.get(key), record));
    };
    const addCochraneStudy = (study, membership = null) => {
      const pmids = pmidListFromValue(study?.pmids || study?.pmid);
      const pmcid = firstListValue(study?.pmcids || study?.pmcid);
      pmids.forEach((pmid) => addRecord(pmid, {
        pmid,
        study_label: study?.study_label || study?.label,
        pmcid,
        in_pmc: pmcid ? "yes" : "",
        title: study?.title,
        year: study?.year,
        journal: study?.journal,
        cochrane_synthesis_memberships: membership ? [membership] : [],
      }));
    };
    const addOverlapRow = (row, membership = null) => {
      const cochraneStudy = row?.cochrane_study || {};
      const pmid = String(row?.pmid || firstListValue(cochraneStudy.pmids)).trim();
      const pmcid = firstListValue(row?.pmcids || cochraneStudy.pmcids);
      addRecord(pmid, {
        pmid,
        study_label: row?.label || cochraneStudy.study_label,
        pmcid,
        in_pmc: pmcid || row?.pmcid_available ? "yes" : "",
        cochrane_synthesis_memberships: membership ? [membership] : [],
      });
    };

    (ciOverlapArtifact?.plot_alignments || []).forEach((alignment) => {
      const matchObjects = [alignment?.best_match, alignment?.related_cochrane_analysis].filter(Boolean);
      matchObjects.forEach((match) => {
        const membership = cochraneSynthesisMembership(match, alignment);
        (match.cochrane_studies || []).forEach((study) => addCochraneStudy(study, membership));
        (match.cochrane_study_pmids || []).forEach((pmid) => addRecord(pmid, {
          pmid,
          cochrane_synthesis_memberships: membership ? [membership] : [],
        }));
        (match.cochrane_forest_plot_versions || []).forEach((version) => {
          ((version.plot_data || {}).rows || []).forEach((row) => {
            if (row?.type === "pooled") {
              return;
            }
            addRecord(row?.pmid, {
              pmid: row?.pmid,
              study_label: row?.label,
              pmcid: firstListValue(row?.pmcids || row?.pmcid),
              title: row?.title,
              year: row?.year,
              journal: row?.journal,
              cochrane_synthesis_memberships: membership ? [membership] : [],
            });
          });
        });
      });
      (alignment?.agent_study_reference_statuses || []).forEach((item) => {
        const reference = item?.cochrane_reference || {};
        addRecord(reference.pmid || item?.pmid, {
          pmid: reference.pmid || item?.pmid,
          study_label: reference.study_label || item?.label,
          title: reference.title,
          year: reference.year,
          journal: reference.journal,
        });
      });
      const overlap = alignment?.study_row_overlap || {};
      [
        ...(overlap.true_positive_rows || []),
        ...(overlap.false_negative_rows || []),
        ...(overlap.false_positive_rows || []),
      ].forEach((row) => addOverlapRow(row, cochraneSynthesisMembership(alignment?.best_match || {}, alignment)));
    });
    return lookup;
  }

  function retrievalMissedStudyRows(searchMetrics, retrievalRows, ciOverlapArtifact) {
    const rows = Array.isArray(retrievalRows) ? retrievalRows : [];
    const finalRound = finalRetrievalRoundForDisplay(searchMetrics, rows);
    const fallbackRow = rows.length ? rows[rows.length - 1] : {};
    const missedCount = Number(finalRound.cochrane_pmids_missed ?? finalRound.fn ?? fallbackRow.fn ?? 0);
    if (Number.isFinite(missedCount) && missedCount <= 0) {
      return [];
    }
    const missedStudies = Array.isArray(finalRound.missed_studies) ? finalRound.missed_studies : [];
    const missedPmids = Array.isArray(finalRound.missed_pmids) ? finalRound.missed_pmids : null;
    const fallbackMissedPmids = Array.isArray(missedPmids)
      ? missedPmids
      : (Array.isArray(fallbackRow.fn_pmids) ? fallbackRow.fn_pmids : []);
    const lookup = cochraneStudyLookupFromSynthesis(ciOverlapArtifact);
    const baseRows = missedStudies.length
      ? missedStudies
      : fallbackMissedPmids.map((pmid) => ({ pmid }));
    return baseRows.map((study) => {
      const pmid = String(study?.pmid || "").trim();
      const lookupRecord = lookup.get(pmid) || {};
      const merged = mergeStudyLookupRecord(study, lookupRecord);
      if ((!merged.study_label || String(merged.study_label).trim() === pmid) && lookupRecord.study_label) {
        merged.study_label = lookupRecord.study_label;
      }
      return merged;
    });
  }

  function renderRetrievalMissedStudyCell(study) {
    const pmid = String(study?.pmid || "").trim();
    const rawLabel = String(study?.study_label || study?.label || "").trim();
    const label = rawLabel && rawLabel !== pmid ? rawLabel : "Study not labeled";
    return `
      <div class="retrieval-missed-study-cell">
        <div class="retrieval-missed-study-label">${escapeHtml(cleanStudyRowLabel(label))}</div>
        ${pmid ? `<div class="retrieval-missed-study-pmid mono">PMID ${renderPmidLink({ pmid, metadata: { url: study.pubmed_url } })}</div>` : ""}
      </div>
    `;
  }

  function finalRetrievalRoundForDisplay(searchMetrics, retrievalRows) {
    const rows = Array.isArray(retrievalRows) ? retrievalRows : [];
    const finalRound = (searchMetrics || {}).final_retrieval_round || {};
    const fallbackRow = rows.length ? rows[rows.length - 1] : {};
    const finalKey = String(finalRound.query_key || "").trim();
    const matchedRow = (finalKey && rows.find((row) => String(row?.key || "").trim() === finalKey))
      || fallbackRow;
    const correctedRow = correctedSameQueryRetrievalRow(matchedRow, rows) || {};
    if (!Object.keys(finalRound).length && !Object.keys(correctedRow).length) {
      return {};
    }
    const missedCount = correctedRow.fn ?? finalRound.cochrane_pmids_missed ?? finalRound.fn;
    return {
      ...finalRound,
      query_key: finalRound.query_key || correctedRow.key,
      query_label: finalRound.query_label || correctedRow.label || "Final retrieval query",
      query_stage: finalRound.query_stage || correctedRow.stage,
      retrieved_count: correctedRow.retrieved_count ?? finalRound.retrieved_count,
      unique_pmids: correctedRow.unique_pmids ?? finalRound.unique_pmids,
      cochrane_pmids_retrieved: correctedRow.tp ?? finalRound.cochrane_pmids_retrieved,
      cochrane_pmids_missed: missedCount,
      recall: correctedRow.recall ?? finalRound.recall,
      missed_pmids: Array.isArray(correctedRow.fn_pmids) ? correctedRow.fn_pmids : finalRound.missed_pmids,
      missed_studies: Number(missedCount || 0) === 0 ? [] : (finalRound.missed_studies || []),
    };
  }

  function renderRetrievalMissedSynthesisCell(study) {
    const memberships = uniqueCochraneSynthesisMemberships(study?.cochrane_synthesis_memberships || []);
    if (!memberships.length) {
      return `<div class="retrieval-missed-synthesis-empty">Not found in reproduced Cochrane synthesis rows.</div>`;
    }
    return `
      <div class="retrieval-missed-synthesis-cell">
        <div class="retrieval-missed-synthesis-status">Included</div>
        ${memberships.map((membership) => `
          <div class="retrieval-missed-synthesis-item">
            ${membership.analysis_id ? `<span class="mono">Analysis ${escapeHtml(membership.analysis_id)}</span>` : ""}
            <span>${escapeHtml(membership.outcome || "Outcome not labeled")}</span>
            ${membership.effect_measure ? `<span class="screen-study-secondary">${escapeHtml(effectMeasureLabel(membership.effect_measure))}</span>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderFinalRetrievalMissedStudies(searchMetrics, retrievalRows, ciOverlapArtifact = {}) {
    const rows = Array.isArray(retrievalRows) ? retrievalRows : [];
    const finalRound = finalRetrievalRoundForDisplay(searchMetrics, rows);
    const fallbackRow = rows.length ? rows[rows.length - 1] : {};
    const missedCountValue = finalRound.cochrane_pmids_missed ?? finalRound.fn ?? fallbackRow.fn;
    const missedRows = retrievalMissedStudyRows(searchMetrics, retrievalRows, ciOverlapArtifact);
    const missedCount = missedCountValue ?? missedRows.length;
    const finalLabel = finalRound.query_label || fallbackRow.label || "Final retrieval query";

    if (!Number(missedCount) && !missedRows.length) {
      return `
        <div class="retrieval-missed-panel">
          <div class="retrieval-missed-head">
            <div>
              <div class="stat-label">Missed by final retrieval round</div>
              <div class="retrieval-missed-count">0 studies</div>
            </div>
            <div class="note">Counted from ${escapeHtml(finalLabel)} only.</div>
          </div>
          <p class="note">No Cochrane included-reference PMIDs were missed by the final retrieval round.</p>
        </div>
      `;
    }

    return `
      <div class="retrieval-missed-panel">
        <div class="retrieval-missed-head">
          <div>
            <div class="stat-label">Missed by final retrieval round</div>
            <div class="retrieval-missed-count">${number(missedCount)} ${Number(missedCount) === 1 ? "study" : "studies"}</div>
          </div>
          <div class="note">Counted from ${escapeHtml(finalLabel)} only.</div>
        </div>
        <div class="table-wrap retrieval-missed-wrap">
          <table class="screening-table retrieval-missed-table">
            <thead>
              <tr>
                <th>Study</th>
                <th>PMC full text</th>
                <th>Cochrane synthesis</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              ${missedRows.map((study) => `
                <tr>
                  <td>${renderRetrievalMissedStudyCell(study)}</td>
                  <td>${escapeHtml(study.pmcid || study.in_pmc || "—")}</td>
                  <td>${renderRetrievalMissedSynthesisCell(study)}</td>
                  <td>
                    <div class="screen-study-title">${escapeHtml(study.title || "—")}</div>
                    ${study.journal ? `<div class="screen-study-secondary">${escapeHtml(study.journal)}</div>` : ""}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderFinalRetrievalMetricGrid(searchMetrics, retrievalRows) {
    const rows = Array.isArray(retrievalRows) ? retrievalRows : [];
    const finalRound = finalRetrievalRoundForDisplay(searchMetrics, rows);
    const fallbackRow = rows.length ? rows[rows.length - 1] : {};
    if (!Object.keys(finalRound).length && !Object.keys(fallbackRow).length) {
      return "";
    }
    const finalLabel = finalRound.query_label || fallbackRow.label || "Final retrieval query";
    return renderEvaluationMetricGrid([
      {
        label: "Final retrieval round",
        value: finalLabel,
        detail: "Only this round is summarized here",
      },
      {
        label: "Cochrane PMIDs retrieved",
        value: number(finalRound.cochrane_pmids_retrieved ?? fallbackRow.tp),
        detail: "Included-reference PMIDs found",
      },
      {
        label: "Cochrane PMIDs missed",
        value: number(finalRound.cochrane_pmids_missed ?? fallbackRow.fn),
        detail: "Included-reference PMIDs not retrieved",
      },
      {
        label: "Final recall",
        value: formatPercent(finalRound.recall ?? fallbackRow.recall),
        detail: "Retrieved Cochrane included PMIDs / all Cochrane included PMIDs",
      },
    ], "retrieval-final-metric-grid");
  }

  function renderSearchEvaluation(searchMetrics, ciOverlapArtifact = {}, options = {}) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((searchMetrics || {}).status !== "completed") {
      return "";
    }
    const rows = Array.isArray(searchMetrics.retrieval_queries) ? searchMetrics.retrieval_queries : [];
    if (!rows.length) {
      return "";
    }
    const benchmark = searchMetrics.benchmark || {};
    const benchmarkCount = number(benchmark.n_cochrane_pubmed_ids);
    const note = `Retrieval is evaluated against Cochrane included-reference PubMed IDs as positive ground truth only (${benchmarkCount} PMIDs). Excluded-reference PMIDs are not counted as retrieval negatives because Cochrane also retrieved them before excluding them after eligibility assessment.`;
    const summaryOnly = options.summaryOnly === true;
    return `
      <div class="detail-card evaluation-card" style="margin-top:14px;">
        <h3>Retrieval Evaluation</h3>
        <p class="note">${escapeHtml(note)}</p>
        ${summaryOnly ? renderFinalRetrievalMetricGrid(searchMetrics, rows) : `
          <div class="table-wrap screening-wrap">
            <table class="screening-table evaluation-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Cochrane PMIDs retrieved</th>
                  <th>Cochrane PMIDs missed</th>
                  <th>Recall</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    <td>
                      <div class="screen-study-primary">${escapeHtml(row.label || row.key || "Query")}</div>
                      ${row.stage ? `<div class="screen-study-secondary">${escapeHtml(String(row.stage).replaceAll("_", " "))}</div>` : ""}
                    </td>
                    <td>${number(row.tp)}</td>
                    <td>${number(row.fn)}</td>
                    <td>${formatPercent(row.recall)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `}
        ${renderFinalRetrievalMissedStudies(searchMetrics, rows, ciOverlapArtifact)}
      </div>
    `;
  }

  function renderScreeningEvaluation(searchMetrics) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((searchMetrics || {}).status !== "completed") {
      return "";
    }
    const screening = searchMetrics.screening || {};
    const metrics = screening.within_screened || {};
    if (!Object.keys(metrics).length) {
      return "";
    }
    const fulltextScreening = searchMetrics.fulltext_screening || {};
    const fulltextMetrics = fulltextScreening.within_fulltext_screened || {};
    const showFulltextScreening = (
      Object.keys(fulltextScreening).length
      && fulltextScreening.status !== "missing_extraction_source_summary"
    );
    const endToEndGate = searchMetrics.end_to_end_screening_after_fulltext_gate || {};
    const endToEndGateMetrics = endToEndGate.within_screened || {};
	    const showEndToEndGate = (
      Object.keys(endToEndGate).length
      && endToEndGate.status !== "missing_extraction_source_summary"
    );
    const benchmark = searchMetrics.benchmark || {};
    const hasExcludedBenchmark = Boolean(benchmark.has_excluded_screening_negative_benchmark ?? benchmark.has_excluded_negative_benchmark);
    return `
      <div class="detail-card evaluation-card" style="margin-top:14px;">
        <h3>Title/Abstract Screening Evaluation</h3>
        <p class="note">Candidate-positive means include or not enough info at title/abstract screening. ${hasExcludedBenchmark ? "Metrics use screened Cochrane included-reference PMIDs as positives and screened excluded-reference PMIDs as observable negatives." : "No screened excluded-reference PMIDs are available for this review, so only screening recall is shown."}</p>
	        ${renderEvaluationMetricGrid([
	          hasExcludedBenchmark ? {
	            label: "TP",
	            value: number(metrics.tp),
	            detail: "Cochrane-included kept",
	          } : null,
	          hasExcludedBenchmark ? {
	            label: "TN",
	            value: number(metrics.tn),
	            detail: "Cochrane-excluded removed",
	          } : null,
	          hasExcludedBenchmark ? {
	            label: "FP",
	            value: number(metrics.fp),
	            detail: "Cochrane-excluded kept",
	          } : null,
	          hasExcludedBenchmark ? {
	            label: "FN",
	            value: number(metrics.fn),
	            detail: "Cochrane-included removed",
	          } : null,
	          {
	            label: "Recall",
	            value: formatPercent(metrics.recall),
	            detail: `${number(metrics.tp)} kept; ${number(metrics.fn)} missed`,
	          },
	          hasExcludedBenchmark ? {
	            label: "Precision",
	            value: formatPercent(metrics.precision),
	            detail: `${number(metrics.tp)} TP; ${number(metrics.fp)} FP`,
	          } : null,
	          hasExcludedBenchmark ? {
	            label: "Accuracy",
	            value: formatPercent(metrics.accuracy),
	            detail: "Correct / labeled screened",
	          } : null,
	        ], "screening-evaluation-grid screening-evaluation-grid-compact")}
      </div>
      ${showFulltextScreening ? `
        <div class="detail-card evaluation-card" style="margin-top:14px;">
          <h3>Full-Text Screening Evaluation</h3>
          <p class="note">The full-text eligibility gate is binary: include is positive and exclude is negative. Blank full-text eligibility decisions are counted as not full-text screened.</p>
          ${renderEvaluationMetricGrid([
            {
              label: "Full-text screened",
              value: number(fulltextScreening.fulltext_screened_pmids),
              detail: `${number(fulltextScreening.fulltext_positive_pmids)} included; ${number(fulltextScreening.fulltext_negative_pmids)} excluded`,
            },
            {
              label: "Recall",
              value: formatPercent(fulltextMetrics.recall),
              detail: `${number(fulltextMetrics.tp)} Cochrane PMIDs kept; ${number(fulltextMetrics.fn)} missed among full-text-screened records`,
            },
            hasExcludedBenchmark ? {
              label: "Precision",
              value: formatPercent(fulltextMetrics.precision),
              detail: `${number(fulltextMetrics.tp)} included-study PMIDs kept; ${number(fulltextMetrics.fp)} excluded-study PMIDs kept`,
            } : null,
            hasExcludedBenchmark ? {
              label: "Accuracy",
              value: formatPercent(fulltextMetrics.accuracy),
              detail: "Correct full-text decisions divided by labeled benchmark PMIDs full-text screened",
            } : null,
            {
              label: "Not full-text screened",
              value: number(fulltextScreening.not_fulltext_screened_pmids),
              detail: "Candidate PMIDs without a full-text eligibility decision",
            },
          ], "screening-evaluation-grid")}
        </div>
      ` : ""}
      ${showEndToEndGate ? `
        <div class="detail-card evaluation-card" style="margin-top:14px;">
          <h3>End-to-End Screening After Full Text</h3>
          <p class="note">Final screen-positive PMIDs are title/abstract positives minus full-text excludes. Candidates without full text remain positive for this calculation.</p>
          ${renderEvaluationMetricGrid([
            {
              label: "Final candidates",
              value: number(endToEndGate.final_screen_positive_pmids),
              detail: `${number(endToEndGate.fulltext_excluded_pmids)} full-text excludes removed`,
            },
            {
              label: "Recall",
              value: formatPercent(endToEndGateMetrics.recall),
              detail: `${number(endToEndGateMetrics.tp)} Cochrane PMIDs kept; ${number(endToEndGateMetrics.fn)} missed among screened records`,
            },
            hasExcludedBenchmark ? {
              label: "Precision",
              value: formatPercent(endToEndGateMetrics.precision),
              detail: `${number(endToEndGateMetrics.tp)} included-study PMIDs kept; ${number(endToEndGateMetrics.fp)} excluded-study PMIDs kept`,
            } : null,
            hasExcludedBenchmark ? {
              label: "Accuracy",
              value: formatPercent(endToEndGateMetrics.accuracy),
              detail: "Correct final decisions divided by labeled benchmark PMIDs screened",
            } : null,
	            {
	              label: "End-to-end recall",
	              value: formatPercent((endToEndGate.end_to_end_candidate_recall_after_fulltext_gate || {}).recall),
              detail: "Final screen-positive Cochrane PMIDs divided by all Cochrane PMIDs",
            },
          ], "screening-evaluation-grid")}
        </div>
      ` : ""}
    `;
  }

  function renderOutcomeIdentificationEvaluationSummary(outcomeAlignment) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((outcomeAlignment || {}).status !== "completed") {
      return "";
    }
    const counts = outcomeAlignment.counts || {};
    return `
      <div class="detail-card evaluation-card" style="margin-top:14px;">
        <h3>Outcome Identification Recall</h3>
        <p class="note">Recall is the percentage of locally curated Cochrane outcomes that have a retained match among the agent's final outcome decisions.</p>
        ${renderEvaluationMetricGrid([
          {
            label: "Cochrane analyzed outcomes",
            value: formatPercent(counts.cochrane_analyzed_outcome_coverage),
            detail: `${number(counts.cochrane_analyzed_outcomes_matched)} of ${number(counts.cochrane_analyzed_outcomes)} analyzed outcomes recalled`,
          },
          {
            label: "Cochrane planned outcomes",
            value: formatPercent(counts.cochrane_planned_outcome_coverage),
            detail: `${number(counts.cochrane_planned_outcomes_matched)} of ${number(counts.cochrane_planned_outcomes)} planned outcomes recalled`,
          },
        ])}
      </div>
    `;
  }

  function renderComparisonIdentificationEvaluationSummary(comparisonAlignment) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((comparisonAlignment || {}).status !== "completed") {
      return "";
    }
    const counts = comparisonAlignment.counts || {};
    const denominator = Number(counts.cochrane_analysis_comparisons) || 0;
    const retainedMatches = Array.isArray(comparisonAlignment.matches) ? comparisonAlignment.matches : [];
    const retainedAnalysisMatches = retainedMatches.filter((match) => (
      String(match?.comparison_type || "").toLowerCase() === "analysis_comparison"
    ));
    const best = comparisonAlignment.best_match || {};
    const fallbackNumerator = String(best.comparison_type || "").toLowerCase() === "analysis_comparison"
      ? 1
      : 0;
    const numerator = retainedMatches.length
      ? retainedAnalysisMatches.length
      : fallbackNumerator;
    const recall = denominator ? numerator / denominator : null;
    const displayMatches = retainedAnalysisMatches.length
      ? retainedAnalysisMatches
      : (fallbackNumerator ? [best] : []);

    return `
      <div class="detail-card evaluation-card" style="margin-top:14px;">
        <h3>Comparison Identification Recall</h3>
        <p class="note">Recall is the percentage of locally curated Cochrane analysis-comparison labels that have a retained match among the agent's final comparison decision. Sensitivity or subgroup comparison labels are counted separately and are not included in this recall denominator.</p>
        ${renderEvaluationMetricGrid([
          {
            label: "Cochrane analysis comparisons",
            value: formatPercent(recall),
            detail: `${number(numerator)} of ${number(denominator)} analysis comparison labels recalled`,
          },
          {
            label: "Sensitivity/subgroup labels",
            value: number(counts.cochrane_sensitivity_or_subgroup_comparisons),
            detail: "Tracked for audit, excluded from the comparison-recall denominator",
          },
        ])}
        ${displayMatches.length ? `
          <div class="table-wrap screening-wrap evaluation-summary-table-wrap">
            <table class="screening-table evaluation-table evaluation-summary-table synthesis-evaluation-table">
              <thead>
                <tr>
                  <th>Cochrane comparison</th>
                  <th>Agent comparison</th>
                  <th>Match strength</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                ${displayMatches.map((match) => `
                  <tr>
                    <td>${sentence(match.cochrane_label_clean || match.cochrane_label || "Cochrane comparison")}</td>
                    <td>${sentence(match.agent_label || (comparisonAlignment.agent_comparison || {}).comparison_label_canonical || (comparisonAlignment.agent_comparison || {}).comparison_label || "Agent comparison")}</td>
                    <td>${escapeHtml(cochraneStrengthLabel(String(match.match_strength || "none").toLowerCase()))}</td>
                    <td>${formatEffect(match.score)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="note evaluation-empty-note">No Cochrane analysis comparison label was recalled by the agent comparison decision.</p>`}
      </div>
    `;
  }

  function formatCi(lower, upper) {
    if (lower === null || lower === undefined || upper === null || upper === undefined) {
      return "—";
    }
    return `${formatEffect(lower)} to ${formatEffect(upper)}`;
  }

  function displayAgentPlotKey(value) {
    return String(value || "")
      .replace(/:all_eligible\b/g, "")
      .replace(/^(primary|secondary)_\d+:/, "");
  }

  function displayAgentPlotSubset(value) {
    const key = String(value || "").trim();
    if (key === "all_eligible") {
      return "all eligible";
    }
    if (key === "study_design_randomized_trial") {
      return "randomized-trial branch";
    }
    if (key.startsWith("study_design_")) {
      return `${key.replace(/^study_design_/, "").replace(/_/g, " ")} branch`;
    }
    return key.replace(/_/g, " ");
  }

  function synthesisConfusionBadge(classification) {
    const key = String(classification || "").toUpperCase();
    const label = key || "—";
    return `<span class="synthesis-confusion-badge synthesis-confusion-${escapeHtml(key.toLowerCase())}">${escapeHtml(label)}</span>`;
  }

  function synthesisConfusionRows(ciOverlapArtifact) {
    const rows = Array.isArray(ciOverlapArtifact?.confusion_rows)
      ? ciOverlapArtifact.confusion_rows
      : [];
    if (rows.length) {
      return rows;
    }
    const fallback = Array.isArray(ciOverlapArtifact?.plot_alignments)
      ? ciOverlapArtifact.plot_alignments
      : [];
    return fallback.map((row) => {
      const match = row.best_match || {};
      const isMatched = row.status === "matched" && match.analysis_id;
      return {
        classification: isMatched ? "TP" : "FP",
        classification_label: isMatched
          ? "Matched agent and Cochrane analysis"
          : "Agent forest plot without a matched Cochrane analysis",
        reason: isMatched
          ? "Agent forest plot matched a Cochrane analysis by outcome label and effect measure."
          : "Agent created an evaluated forest plot, but no Cochrane main analysis matched the outcome label and effect measure.",
        cochrane_analysis: isMatched ? {
          analysis_id: match.analysis_id,
          outcome: match.outcome,
          effect_measure: match.effect_measure,
          ci_lower: (match.ci_overlap_by_subset?.all_studies || match).cochrane_ci_lower,
          ci_upper: (match.ci_overlap_by_subset?.all_studies || match).cochrane_ci_upper,
        } : {},
        agent_forest_plot: {
          agent_plot_key: row.agent_plot_key,
          outcome_name: row.outcome_name,
          outcome_key: row.outcome_key,
          effect_measure: row.effect_measure,
          agent_plot_subset: row.agent_plot_subset,
          agent_plot_selection_reason: row.agent_plot_selection_reason,
          ci_lower: row.agent_ci_lower,
          ci_upper: row.agent_ci_upper,
        },
        all_studies_iou: match.ci_overlap_by_subset?.all_studies || null,
        pmcid_only_iou: match.ci_overlap_by_subset?.pmcid_only || null,
      };
    });
  }

  function cleanStudyRowLabel(value) {
    return String(value || "Study")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();
  }

  function studyOverlapLine(label, rows, formatter) {
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      return "";
    }
    const text = items.map(formatter).filter(Boolean).join("; ");
    return `<div class="screen-study-secondary synthesis-study-overlap-line"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</div>`;
  }

  function groupedStudyOverlapLine(label, rows, groupKeyFn) {
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      return "";
    }
    const groups = new Map();
    items.forEach((row) => {
      const key = String(groupKeyFn(row) || "").trim();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(cleanStudyRowLabel(row.label));
    });
    const text = Array.from(groups.entries())
      .map(([key, labels]) => {
        const names = labels.filter(Boolean).join(", ");
        return key ? `${names} (${key})` : names;
      })
      .filter(Boolean)
      .join("; ");
    return `<div class="screen-study-secondary synthesis-study-overlap-line"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</div>`;
  }

  function renderStudyRowOverlap(overlap) {
    if (!overlap) {
      return `<div class="screen-study-secondary">Not evaluated without a matched Cochrane analysis.</div>`;
    }
    const counts = overlap.counts || {};
    const tp = counts.tp ?? 0;
    const fp = counts.fp ?? 0;
    const fn = counts.fn ?? 0;
    return `
      <div class="screen-study-primary">TP ${number(tp)} / FP ${number(fp)} / FN ${number(fn)}</div>
      <div class="screen-study-secondary">Precision ${formatPercent(counts.precision)}; recall ${formatPercent(counts.recall)}</div>
      ${studyOverlapLine("TP", overlap.true_positive_rows, (row) => cleanStudyRowLabel(row.label))}
      ${groupedStudyOverlapLine("FP", overlap.false_positive_rows, (row) => row.cochrane_reference_status_label || "not in matched Cochrane analysis")}
      ${groupedStudyOverlapLine("FN", overlap.false_negative_rows, (row) => row.pmcid_available ? "PMCID available" : "no PMCID")}
    `;
  }

  function ciOverlapSubset(match, subset) {
    const subsets = match?.ci_overlap_by_subset || {};
    return subsets[subset] || null;
  }

  function ciOverlapSubsetValue(match, subset) {
    const subsetOverlap = ciOverlapSubset(match, subset);
    if (subsetOverlap && subsetOverlap.overlap_ratio !== undefined) {
      return subsetOverlap.overlap_ratio;
    }
    if (subset === "all_studies") {
      return match?.overlap_ratio;
    }
    return null;
  }

  function ciOverlapSubsetCi(match, subset) {
    const subsetOverlap = ciOverlapSubset(match, subset);
    if (subsetOverlap) {
      return formatCi(subsetOverlap.cochrane_ci_lower, subsetOverlap.cochrane_ci_upper);
    }
    if (subset === "all_studies") {
      return formatCi(match?.cochrane_ci_lower, match?.cochrane_ci_upper);
    }
    return "—";
  }

  function clampRatio(value) {
    const parsed = finiteNumber(value);
    if (parsed === null) {
      return null;
    }
    return Math.max(0, Math.min(1, parsed));
  }

  function renderSingleStudyCiOverlapVisualization(distributions, selectedSubset = "all_studies") {
    const subsetLabels = [
      ["all_studies", "All-estimable"],
      ["pmcid_only", "PMCID-only"],
    ];
    const rows = subsetLabels
      .map(([key, label]) => ({
        key,
        label,
        distribution: distributions?.[key] || null,
      }))
      .filter((row) => row.key === selectedSubset)
      .filter((row) => row.distribution && Array.isArray(row.distribution.values) && row.distribution.values.length);
    if (!rows.length) {
      return "";
    }

    const width = 760;
    const left = 36;
    const right = 36;
    const plotWidth = width - left - right;
    const top = 28;
    const rowHeight = 166;
    const bottom = 14;
    const height = top + rows.length * rowHeight + bottom;
    const x = (value) => {
      const clamped = clampRatio(value);
      return clamped === null ? null : left + clamped * plotWidth;
    };
    const tickMarks = [0, 0.25, 0.5, 0.75, 1];
    const rowSvg = rows.map((row, rowIndex) => {
      const distribution = row.distribution;
      const y = top + rowIndex * rowHeight + 40;
      const summary = distribution.summary || {};
      const aggregate = clampRatio(distribution.aggregate_overlap_ratio);
      const median = x(summary.median);
      const min = x(summary.min);
      const max = x(summary.max);
      const aggregateX = x(aggregate);
      const values = distribution.values || [];
      const dots = values.map((item, index) => {
        const valueX = x(item.overlap_ratio);
        if (valueX === null) {
          return "";
        }
        const jitter = ((index % 5) - 2) * 3.2;
        const label = item.label || item.pmid || "Study";
        const dotIndex = String(index + 1);
        const dotCy = y + jitter;
        const dotIndexY = dotCy - 7;
        const studyCi = formatCi(item.study_ci_lower, item.study_ci_upper);
        return `
          <g>
            <text class="single-study-iou-dot-index" x="${valueX.toFixed(2)}" y="${dotIndexY}">${escapeHtml(dotIndex)}</text>
            <circle class="single-study-iou-dot" cx="${valueX.toFixed(2)}" cy="${dotCy.toFixed(2)}" r="4.6">
              <title>${escapeHtml(label)}: ${escapeHtml(formatPercent(item.overlap_ratio))}; study CI ${escapeHtml(studyCi)}</title>
            </circle>
          </g>
        `;
      }).join("");
      const legendItems = values.map((item, index) => {
        const label = String(item.label || item.pmid || "Study")
          .replace(/\s*\([^)]*\)\s*$/, "")
          .trim();
        return `${index + 1} ${label}`;
      });
      const legendLines = [];
      for (let i = 0; i < legendItems.length; i += 3) {
        legendLines.push(legendItems.slice(i, i + 3).join("   "));
      }
      const whisker = min !== null && max !== null
        ? `<line class="single-study-iou-whisker" x1="${min.toFixed(2)}" x2="${max.toFixed(2)}" y1="${y}" y2="${y}"></line>`
        : "";
      const medianMark = median !== null
        ? `<line class="single-study-iou-median" x1="${median.toFixed(2)}" x2="${median.toFixed(2)}" y1="${y - 11}" y2="${y + 11}"></line>`
        : "";
      const aggregateMark = aggregateX !== null
        ? `<polygon class="single-study-iou-aggregate" points="${aggregateX.toFixed(2)},${y - 12} ${(aggregateX + 11).toFixed(2)},${y} ${aggregateX.toFixed(2)},${y + 12} ${(aggregateX - 11).toFixed(2)},${y}">
            <title>Aggregate agent-vs-Cochrane IoU: ${escapeHtml(formatPercent(distribution.aggregate_overlap_ratio))}</title>
          </polygon>`
        : "";
      const percentileRank = summary.aggregate_percentile_rank !== null && summary.aggregate_percentile_rank !== undefined
        ? `; rank ${formatPercent(summary.aggregate_percentile_rank, 0)}`
        : "";
      const tickSvg = tickMarks.map((tick) => {
        const tickX = x(tick);
        return `
          <g>
            <line class="single-study-iou-tick" x1="${tickX}" x2="${tickX}" y1="${y - 8}" y2="${y + 8}"></line>
            <text class="single-study-iou-tick-label" x="${tickX}" y="${y + 28}">${tick === 0 || tick === 1 ? tick : tick.toFixed(2)}</text>
          </g>
        `;
      }).join("");
      return `
        <g>
          <text class="single-study-iou-row-label" x="${left}" y="${y - 42}">${escapeHtml(row.label)}</text>
          <line class="single-study-iou-row-axis" x1="${left}" x2="${left + plotWidth}" y1="${y}" y2="${y}"></line>
          ${tickSvg}
          ${whisker}
          ${dots}
          ${medianMark}
          ${aggregateMark}
          <text class="single-study-iou-row-summary" x="${left}" y="${y + 54}">
            median ${escapeHtml(formatPercent(summary.median))}; pooled ${escapeHtml(formatPercent(distribution.aggregate_overlap_ratio))}${escapeHtml(percentileRank)}
          </text>
          <text class="single-study-iou-row-legend">
            ${legendLines.map((line, lineIndex) => `<tspan x="${left}" y="${y + 76 + lineIndex * 15}">${escapeHtml(line)}</tspan>`).join("")}
          </text>
        </g>
      `;
    }).join("");

    return `
      <div class="single-study-iou-context">
        <div class="single-study-iou-head">
          <span>Single-study CI IoU context</span>
          <span>Dots compare each agent study CI with the Cochrane pooled CI target; diamond is the aggregate agent CI IoU.</span>
        </div>
        <svg class="single-study-iou-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Single-study CI IoU distributions">
          ${rowSvg}
        </svg>
      </div>
    `;
  }

  function renderCochraneAnalysisRecallEvaluation(ciOverlapArtifact, synthesisDisplayContext = {}) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((ciOverlapArtifact || {}).status !== "completed") {
      return "";
    }
    const counts = ciOverlapArtifact.counts || {};
    const designBranchForestPlots = Number(synthesisDisplayContext.designBranchForestPlots) || 0;
    const ciTarget = ((ciOverlapArtifact.metric_definition || {}).cochrane_ci_target)
      || "locally reproduced Cochrane all-studies CI using all estimable extracted Cochrane forest-plot rows";
    const rows = synthesisConfusionRows(ciOverlapArtifact);
    return `
      <div class="detail-card evaluation-card" style="margin-top:14px;">
        <h3>Cochrane Analysis Recall</h3>
        <p class="note"><strong>Evaluation plot selection:</strong> for each agent outcome/effect-measure, compare <span class="mono">all_eligible</span> with Cochrane when it exists; otherwise compare <span class="mono">study_design_randomized_trial</span> when it exists. Other study-design branches and subgroup plots are not counted in Cochrane recall or CI-IoU.</p>
        <p class="note">A Cochrane analysis is counted as recalled when the agent created a matched evaluated forest plot for the same outcome and effect measure. The evaluator uses the all-eligible forest plot when it exists; when all-eligible pooling was skipped for mixed study designs, it uses the randomized-trial study-design branch when available. Other subgroup or design-branch plots are skipped. TP/FP/FN is defined at the forest-plot-analysis level; no true-negative denominator is defined. CI intersection over union compares the agent CI with reproduced Cochrane CI targets: all estimable studies and, when available, the PMCID-only subset. Ratio measures use log-scale CI overlap; non-ratio measures use the original linear scale.</p>
        ${designBranchForestPlots ? `<p class="note synthesis-evaluation-scope-note">${number(designBranchForestPlots)} study-design branch ${designBranchForestPlots === 1 ? "forest plot is shown" : "forest plots are shown"} in the synthesis section. If all-eligible pooling is absent, the randomized-trial branch can be counted by the Cochrane recall/CI-IoU artifact; non-randomized or other branch plots remain display-only for this evaluation.</p>` : ""}
        ${renderEvaluationMetricGrid([
          {
            label: "Evaluated agent plots",
            value: number(counts.agent_evaluated_plots),
            detail: `${number(counts.agent_all_eligible_plots)} all-eligible; ${number(counts.agent_randomized_branch_plots)} randomized-trial fallback`,
          },
          {
            label: "Cochrane analyses recalled",
            value: formatPercent(counts.cochrane_analysis_recall),
            detail: `${number(counts.cochrane_analyses_recalled)} of ${number(counts.cochrane_all_studies_main_analyses)} Cochrane analyses linked to an agent forest plot`,
          },
          {
            label: "TP / FP / FN",
            value: `${number(counts.synthesis_tp)} / ${number(counts.synthesis_fp)} / ${number(counts.synthesis_fn)}`,
            detail: `Precision ${formatPercent(counts.synthesis_precision)}; recall ${formatPercent(counts.synthesis_recall)}`,
          },
          {
            label: "Mean all-estimable CI IoU",
            value: formatPercent(counts.mean_ci_overlap_ratio),
            detail: `${number(counts.matched_plots)} matched agent forest plots; target: ${ciTarget}`,
          },
          {
            label: "Mean PMCID-only CI IoU",
            value: formatPercent(counts.mean_pmcid_only_ci_overlap_ratio),
            detail: `${number(counts.pmcid_only_ci_overlap_count)} matched agent forest plots with a reproduced PMCID-only target`,
          },
        ])}
        ${rows.length ? `
          <div class="table-wrap screening-wrap evaluation-summary-table-wrap">
            <table class="screening-table evaluation-table evaluation-summary-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Cochrane analysis</th>
                  <th>Agent forest plot</th>
                  <th>Study rows</th>
                  <th>Agent CI</th>
                  <th>IoU</th>
                  <th>IoU (PMCID-only)</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => {
                  const classification = row.classification || "—";
                  const cochrane = row.cochrane_analysis || {};
                  const agent = row.agent_forest_plot || {};
                  const allStudies = row.all_studies_iou || null;
                  const pmcidOnly = row.pmcid_only_iou || null;
                  const allStudiesCi = allStudies
                    ? formatCi(allStudies.cochrane_ci_lower, allStudies.cochrane_ci_upper)
                    : formatCi(cochrane.ci_lower, cochrane.ci_upper);
                  const pmcidCi = pmcidOnly ? formatCi(pmcidOnly.cochrane_ci_lower, pmcidOnly.cochrane_ci_upper) : "—";
                  return `
                    <tr class="synthesis-confusion-row synthesis-confusion-row-${escapeHtml(String(classification).toLowerCase())}">
                      <td>
                        ${synthesisConfusionBadge(classification)}
                      </td>
                      <td class="synthesis-cochrane-analysis-cell">
                        <div class="screen-study-primary">${escapeHtml(cochrane.analysis_id || "—")}</div>
                        ${cochrane.outcome ? `<div class="screen-study-secondary synthesis-cochrane-analysis-label">${escapeHtml(cochrane.outcome)}</div>` : ""}
                      </td>
                      <td>
                        <div class="screen-study-primary">${escapeHtml(agent.outcome_name || agent.outcome_key || "—")}</div>
                        ${agent.agent_plot_key ? `<div class="screen-study-secondary">${escapeHtml(displayAgentPlotKey(agent.agent_plot_key))}</div>` : ""}
                        ${agent.agent_plot_subset ? `<div class="screen-study-secondary">Evaluated: ${escapeHtml(displayAgentPlotSubset(agent.agent_plot_subset))}</div>` : ""}
                      </td>
                      <td class="synthesis-study-overlap">${renderStudyRowOverlap(row.study_row_overlap)}</td>
                      <td>${escapeHtml(formatCi(agent.ci_lower, agent.ci_upper))}</td>
                      <td>
                        ${formatPercent(allStudies?.overlap_ratio)}
                        ${allStudiesCi !== "—" ? `<div class="screen-study-secondary">CI ${escapeHtml(allStudiesCi)}</div>` : ""}
                      </td>
                      <td>
                        ${formatPercent(pmcidOnly?.overlap_ratio)}
                        ${pmcidCi !== "—" ? `<div class="screen-study-secondary">CI ${escapeHtml(pmcidCi)}</div>` : ""}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="note evaluation-empty-note">No Cochrane analyses were recalled by matched evaluated agent forest plots.</p>`}
      </div>
    `;
  }

  function renderEvaluationSummary(searchMetrics, outcomeAlignment, comparisonAlignment, ciOverlapArtifact, synthesisDisplayContext = {}) {
    const hasAnyEvaluation = hasBenchmarkEvaluationArtifacts(searchMetrics, outcomeAlignment, comparisonAlignment, ciOverlapArtifact);
    if (!hasAnyEvaluation) {
      return "";
    }
    return `
	      <section class="step-card evaluation-summary-section" id="evaluation-summary">
	        <div class="step-header">
	          <div>
	            <p class="kicker">Benchmark check</p>
	            <h2>Evaluation summary</h2>
	          </div>
	        </div>
        <p class="note">Evaluation artifacts are generated under <span class="mono">evaluation/</span> and loaded into the demo after the agent run is complete. These metrics are not used by the agent during the run.</p>
        ${currentEvaluationVisible ? `
          ${renderSearchEvaluation(searchMetrics, ciOverlapArtifact, { summaryOnly: true })}
          ${renderScreeningEvaluation(searchMetrics)}
          ${renderComparisonIdentificationEvaluationSummary(comparisonAlignment)}
          ${renderOutcomeIdentificationEvaluationSummary(outcomeAlignment)}
          ${renderCochraneAnalysisRecallEvaluation(ciOverlapArtifact, synthesisDisplayContext)}
        ` : `
          <div class="evaluation-hidden-panel">
            Evaluation results are hidden across the pipeline view. Agent-generated artifacts remain visible.
          </div>
        `}
      </section>
    `;
  }

  function screeningDecisionCounts(screening) {
    const studies = Array.isArray(screening?.screened_studies) ? screening.screened_studies : [];
    if (!studies.length) {
      return {
        total: Number(screening?.n_total) || 0,
        include: Number(screening?.n_include) || 0,
        notEnoughInfo: Number(screening?.n_not_enough_info) || 0,
        exclude: Number(screening?.n_exclude) || 0,
      };
    }
    return studies.reduce((counts, study) => {
      const decision = String(study?.screen_decision || "not enough info").trim().toLowerCase();
      counts.total += 1;
      if (decision === "include") {
        counts.include += 1;
      } else if (decision === "exclude") {
        counts.exclude += 1;
      } else {
        counts.notEnoughInfo += 1;
      }
      return counts;
    }, {
      total: 0,
      include: 0,
      notEnoughInfo: 0,
      exclude: 0,
    });
  }

  function number(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    return typeof value === "number" ? fmt.format(value) : escapeHtml(value);
  }

  function formatDuration(seconds, fallback = "") {
    const numeric = Number(seconds);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return fallback ? String(fallback) : "—";
    }
    if (numeric < 60) {
      return `${numeric.toFixed(numeric < 10 ? 1 : 0)}s`;
    }
    if (numeric < 3600) {
      const minutes = Math.floor(numeric / 60);
      const secs = Math.round(numeric % 60);
      return secs ? `${minutes}m ${secs}s` : `${minutes}m`;
    }
    const hours = Math.floor(numeric / 3600);
    const minutes = Math.round((numeric % 3600) / 60);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function timingStageLabel(stage) {
    const key = String(stage || "").trim();
    return RUN_TIMING_STAGE_LABELS[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function runTimingSection(timing, runSummary) {
    const payload = timing && typeof timing === "object" ? timing : {};
    const stages = Array.isArray(payload.stages) ? payload.stages : [];
    const stageTotal = stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.elapsed_seconds) || 0), 0);
    const totalSeconds = Number(payload.total_elapsed_seconds ?? runSummary?.total_elapsed_seconds ?? stageTotal);
    const totalForScale = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : stageTotal;
    const longestStage = stages.reduce((best, stage) => {
      const elapsed = Number(stage.elapsed_seconds) || 0;
      return elapsed > (Number(best?.elapsed_seconds) || 0) ? stage : best;
    }, null);

    if ((!Number.isFinite(totalSeconds) || totalSeconds <= 0) && !stages.length) {
      return `
        <details class="detail-card run-timing-panel" id="run-timing">
          <summary class="collapsible-table-summary run-timing-summary">
            <h3>Run Timing</h3>
          </summary>
          <p class="note">No timing artifact was saved for this run.</p>
        </details>
      `;
    }

    return `
      <details class="detail-card run-timing-panel" id="run-timing">
        <summary class="collapsible-table-summary run-timing-summary">
          <h3>Run Timing</h3>
          <div class="run-timing-total">${formatDuration(totalSeconds, payload.total_elapsed_time)}</div>
        </summary>
        <p class="note">Elapsed runtime saved by the pipeline for this selected run. Resume runs may show only the resumed stages.</p>
        <div class="run-timing-stats">
          <div class="synthesis-mini-stat run-timing-stat">
            <div class="stat-label">Total Runtime</div>
            <div class="stat-value">${formatDuration(totalSeconds, payload.total_elapsed_time)}</div>
          </div>
          <div class="synthesis-mini-stat run-timing-stat">
            <div class="stat-label">Status</div>
            <div class="stat-value run-timing-status">${escapeHtml(payload.status || "unknown")}</div>
          </div>
          <div class="synthesis-mini-stat run-timing-stat">
            <div class="stat-label">Stages Recorded</div>
            <div class="stat-value">${number(stages.length)}</div>
          </div>
          <div class="synthesis-mini-stat run-timing-stat">
            <div class="stat-label">Longest Stage</div>
            <div class="stat-value run-timing-status">${longestStage ? escapeHtml(timingStageLabel(longestStage.stage)) : "—"}</div>
          </div>
        </div>
        ${stages.length ? `
          <div class="run-timing-bars" aria-label="Runtime by pipeline stage">
            ${stages.map((stage) => {
              const elapsed = Math.max(0, Number(stage.elapsed_seconds) || 0);
              const pct = totalForScale > 0 ? Math.max(2, Math.min(100, (elapsed / totalForScale) * 100)) : 0;
              return `
                <div class="run-timing-row">
                  <div class="run-timing-stage">
                    <span>${escapeHtml(timingStageLabel(stage.stage))}</span>
                    <span class="mono">${formatDuration(elapsed, stage.elapsed_time)}</span>
                  </div>
                  <div class="run-timing-bar-track">
                    <div class="run-timing-bar" style="width:${pct.toFixed(2)}%"></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        ` : `<p class="note">No per-stage timing breakdown was saved for this run.</p>`}
      </details>
    `;
  }

  function varianceFallbackNote(row) {
    const source = String(row?.synthesis_effect_size_source || row?.effect_size_source || "").trim();
    const note = String(row?.synthesis_effect_size_source_note || row?.effect_size_source_note || "").trim();
    const sources = source.split(",").map((item) => item.trim()).filter(Boolean);
    return note && sources.some((item) => VARIANCE_FALLBACK_SOURCES.has(item)) ? note : "";
  }

  function cochraneOutcomeBenchmarkLabel(mode) {
    const labels = {
      cochrane_analyzed: "Cochrane analyzed",
      cochrane_planned: "Cochrane planned",
      analyzed: "Cochrane analyzed",
      planned: "Cochrane planned",
    };
    return labels[mode] || "No Cochrane highlight";
  }

  function cochraneOutcomeBenchmarkKey(mode) {
    if (mode === "cochrane_analyzed" || mode === "analyzed") {
      return "analyzed";
    }
    if (mode === "cochrane_planned" || mode === "planned") {
      return "planned";
    }
    return "";
  }

  function cochraneOutcomeAlignmentByKey(alignment) {
    const rows = Array.isArray(alignment?.agent_outcomes)
      ? alignment.agent_outcomes
      : [];
    return rows.reduce((acc, row) => {
      const key = String(row?.outcome_key || "").trim();
      if (key) {
        acc[key] = row;
      }
      return acc;
    }, {});
  }

  function cochraneOutcomeMatchesForKey(alignment, outcomeKey, mode) {
    const benchmarkKey = cochraneOutcomeBenchmarkKey(mode);
    if (!benchmarkKey) {
      return [];
    }
    const row = cochraneOutcomeAlignmentByKey(alignment)[outcomeKey] || {};
    const matches = (row.matches || {})[benchmarkKey];
    return Array.isArray(matches) ? matches : [];
  }

  function cochraneMatchScore(match) {
    const score = Number(match?.score);
    return Number.isFinite(score) ? score : 0;
  }

  function formatCochraneMatchScore(match) {
    const score = cochraneMatchScore(match);
    return score ? score.toFixed(2) : "—";
  }

  function cochraneMatchStrength(match) {
    const explicit = String(match?.match_strength || "").trim().toLowerCase();
    if (["strong", "moderate", "weak"].includes(explicit)) {
      return explicit;
    }
    const score = cochraneMatchScore(match);
    if (score >= 0.9) {
      return "strong";
    }
    if (score >= 0.75) {
      return "moderate";
    }
    if (score >= 0.7) {
      return "weak";
    }
    return "none";
  }

  function cochraneStrengthLabel(value) {
    const labels = {
      strong: "Strong",
      moderate: "Moderate",
      weak: "Weak/domain",
    };
    return labels[value] || "No match";
  }

  function bestCochraneBenchmarkMatch(matches) {
    return (Array.isArray(matches) ? matches : []).reduce((best, match) => {
      if (!best || cochraneMatchScore(match) > cochraneMatchScore(best)) {
        return match;
      }
      return best;
    }, null);
  }

  function cochraneOutcomeMatchLabel(match) {
    return String(
      match?.label
      || match?.benchmark_label
      || match?.cochrane_label_clean
      || match?.cochrane_label
      || "Matched outcome"
    ).trim();
  }

  function cochraneOutcomeMatchDetail(matches) {
    return (Array.isArray(matches) ? matches : [])
      .map((match) => {
        const label = cochraneOutcomeMatchLabel(match);
        const strength = cochraneStrengthLabel(cochraneMatchStrength(match)).toLowerCase();
        const score = formatCochraneMatchScore(match);
        return `${label} (${strength}, score ${score})`;
      })
      .join("; ");
  }

  function renderCochraneOutcomeMapping(alignment, outcomeKey, options = {}) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((alignment || {}).status !== "completed") {
      return "";
    }
    const modes = Array.isArray(options.modes) && options.modes.length
      ? options.modes
      : ["analyzed"];
    const chips = modes.map((mode) => {
      const matches = cochraneOutcomeMatchesForKey(alignment, outcomeKey, mode);
      const bestMatch = bestCochraneBenchmarkMatch(matches);
      if (!bestMatch) {
        return "";
      }
      const strength = cochraneMatchStrength(bestMatch);
      const label = cochraneOutcomeMatchLabel(bestMatch);
      const detail = cochraneOutcomeMatchDetail(matches);
      return `
        <span class="cochrane-outcome-map-chip cochrane-outcome-map-${escapeHtml(strength)}" title="${escapeHtml(detail)}">
          <span class="cochrane-outcome-map-kind">${escapeHtml(cochraneOutcomeBenchmarkLabel(mode))}</span>
          <span class="cochrane-outcome-map-name">${escapeHtml(label)}</span>
          <span class="cochrane-outcome-map-score">${escapeHtml(`${cochraneStrengthLabel(strength)} ${formatCochraneMatchScore(bestMatch)}`)}</span>
        </span>
      `;
    }).filter(Boolean);

    if (!chips.length && !options.showEmpty) {
      return "";
    }

    return `
      <div class="cochrane-outcome-map">
        <span class="cochrane-outcome-map-label">Cochrane outcome mapping</span>
        ${chips.length
          ? chips.join("")
          : `<span class="cochrane-outcome-map-empty">No retained analyzed outcome match</span>`
        }
      </div>
    `;
  }

  function outcomePanelToggleButton() {
    return `<button class="outcome-panel-toggle" type="button" aria-label="Expand or collapse outcome section"></button>`;
  }

  function renderInlineMarkdown(text) {
    return escapeHtml(text || "")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const parts = [];
    let paragraph = [];
    let listItems = [];

    function flushParagraph() {
      if (!paragraph.length) {
        return;
      }
      parts.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!listItems.length) {
        return;
      }
      parts.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const depth = headingMatch[1].length;
        const tag = depth === 1 ? "h3" : depth === 2 ? "h4" : "h5";
        parts.push(`<${tag}>${renderInlineMarkdown(headingMatch[2].trim())}</${tag}>`);
        continue;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        flushParagraph();
        listItems.push(line.slice(2).trim());
        continue;
      }
      paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return parts.join("");
  }

  function findRun(runId) {
    return runs.find((item) => item.run_id === runId) || runs[0];
  }

  function runShortName(option) {
    const run = findRun(option?.run_id);
    const explicitName = option?.short_name || run?.run_summary?.short_name || "";
    if (explicitName) {
      return explicitName;
    }

    const runId = String(option?.run_id || run?.run_id || "").trim();
    return runId.replace(/^\d{8}_\d{6}_\d+_?/, "") || runId || "run";
  }

  function runLabel(option) {
    const question = option.question || "";
    const runtime = formatDuration(option.total_elapsed_seconds, option.total_elapsed_time);
    return `${option.run_id}${runtime !== "—" ? ` (${runtime})` : ""} - ${question}`;
  }

  function renderRunTabs(current) {
    const options = data.run_options && data.run_options.length
      ? data.run_options
      : runs.map((run) => ({
          run_id: run.run_id,
          short_name: run.run_summary?.short_name || "",
          question: run.review_definition?.research_question || "",
        }));

    if (options.length <= 1) {
      return "";
    }

    return `
      <nav class="run-tabs" aria-label="Demo runs">
        <div class="run-tabs-label">Select Run</div>
        <div class="run-tabs-list">
          ${options.map((option) => {
            const isActive = option.run_id === current.run_id;
            return `
              <button
                class="run-tab-button${isActive ? " active" : ""}"
                type="button"
                data-run-id="${escapeHtml(option.run_id)}"
                title="${escapeHtml(option.question || option.run_id)}"
                aria-current="${isActive ? "true" : "false"}"
              >
                ${escapeHtml(runShortName(option))}
              </button>
            `;
          }).join("")}
        </div>
      </nav>
    `;
  }

  function renderSideNavigation(options = {}) {
    const hasEvaluationArtifacts = options.hasEvaluationArtifacts === true;
    const groups = [
      {
        label: "Review setup",
        items: [
          ["Single prompt", "#single-prompt"],
          ["PICO", "#review-pico"],
        ],
      },
      {
        label: "Search",
        items: [
          ["Query history", "#search-query-history"],
        ],
      },
      {
        label: "Screening",
        items: [
          ["Criteria", "#screening-criteria"],
          ["Screening results", "#screening-results"],
        ],
      },
      {
        label: "Planning",
        items: [
          ["NCT linkage", "#nct-linkage"],
          ["Full text screening", "#fulltext-screening"],
          ["Source availability", "#source-availability-gate"],
          ["Outcomes", "#outcomes"],
          ["Comparison", "#comparison"],
          ["Publication linkage", "#publication-linkage"],
          ["Heterogeneity factors", "#subgroup-plan"],
        ].filter(Boolean),
      },
      {
        label: "Extraction/RoB",
        items: [
          ["Extraction results", "#extraction-results"],
          ["RoB tool selection", "#rob-routing"],
          ["RoB assessments", "#rob-assessments"],
        ],
      },
      {
        label: "Synthesis",
        items: [
          ["Forest plots", "#synthesis-results"],
          ["Final report", "#final-report"],
        ],
      },
      hasEvaluationArtifacts && {
        label: "Evaluation",
        items: [
          ["Evaluation summary", "#evaluation-summary"],
        ],
      },
      {
        label: "Run",
        items: [
          ["Run timing", "#run-timing"],
        ],
      },
    ].filter(Boolean);

    return `
      <nav class="section-side-nav" aria-label="Detailed page navigation">
        <div class="section-side-nav-title">On this page</div>
        <div class="section-side-nav-groups">
          ${groups.map((group) => `
            <div class="section-side-nav-group">
              <div class="section-side-nav-group-title">${escapeHtml(group.label)}</div>
              <div class="section-side-nav-links">
                ${group.items.map(([label, href]) => `
                  <a class="section-side-nav-link" href="${escapeHtml(href)}">${escapeHtml(label)}</a>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </nav>
    `;
  }

  function renderLeftRail(current, options = {}) {
    return `
      <aside class="left-rail" aria-label="Demo navigation">
        ${renderRunTabs(current)}
        ${renderSideNavigation(options)}
      </aside>
    `;
  }

  function pubmedUrl(entry) {
    const metaUrl = String(entry?.metadata?.url || "").trim();
    if (metaUrl) {
      return metaUrl;
    }
    const pmid = String(entry?.pmid || "").trim();
    return pmid ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/` : "";
  }

  function renderPmidLink(entry) {
    const pmid = String(entry?.pmid || "").trim();
    const url = pubmedUrl(entry);
    if (!pmid) {
      return "—";
    }
    if (!url) {
      return escapeHtml(pmid);
    }
    return `<a class="pmid-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pmid)}</a>`;
  }

  function firstAuthorLastNameFromAuthors(authors) {
    const values = Array.isArray(authors) ? authors : [];
    const firstAuthor = String(values[0] || "").trim();
    if (!firstAuthor) {
      return "";
    }
    if (firstAuthor.includes(",")) {
      return firstAuthor.split(",", 1)[0].trim();
    }
    const parts = firstAuthor.split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function extractionPubInfoParts(row) {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const author = cleanText(
      row?.first_author_last_name
      || firstAuthorLastNameFromAuthors(row?.authors)
      || metadata.first_author_last_name
      || firstAuthorLastNameFromAuthors(metadata.authors)
    );
    const studyLabel = cleanText(row?.study_label || metadata.study_label || "");
    const authorYear = studyLabel || [
      author,
      cleanText(row?.year || metadata.year),
    ].filter(Boolean).join(", ");
    const journal = cleanText(
      row?.journal
      || row?.journal_title
      || row?.publication_journal
      || metadata.journal
      || metadata.journal_title
      || ""
    );
    const title = cleanText(row?.title || metadata.title || "");
    const tooltip = [authorYear, journal, title].filter(Boolean).join("\n");
    return { authorYear, journal, title, tooltip };
  }

  function extractionPubInfoCell(row) {
    const { authorYear, journal, tooltip } = extractionPubInfoParts(row);

    return `
      <div class="screen-study-cell"${tooltip ? ` title="${escapeHtml(tooltip)}"` : ""}>
        <div class="screen-study-primary">${authorYear ? sentence(authorYear) : "No author/year."}</div>
        ${journal ? `<div class="screen-study-journal">${sentence(journal)}</div>` : ""}
      </div>
    `;
  }

  function compactStudyCell(row) {
    const { authorYear, journal, title, tooltip } = extractionPubInfoParts(row);
    const pmid = String(row?.pmid || row?.metadata?.pmid || "").trim();
    const studyTooltip = tooltip || [authorYear, journal, title, pmid ? `PMID ${pmid}` : ""].filter(Boolean).join("\n");
    return `
      <div class="screen-study-cell compact-study-cell"${studyTooltip ? ` title="${escapeHtml(studyTooltip)}"` : ""}>
        <div class="screen-study-primary">${authorYear ? sentence(authorYear) : "No author/year."}</div>
        ${pmid ? `<div class="compact-study-pmid">PMID ${renderPmidLink({ ...row, pmid })}</div>` : ""}
      </div>
    `;
  }

  function uniquePmids(values) {
    const seen = new Set();
    const out = [];
    (values || []).forEach((value) => {
      const pmid = String(value || "").trim();
      if (!pmid || seen.has(pmid)) {
        return;
      }
      seen.add(pmid);
      out.push(pmid);
    });
    return out;
  }

  function normalizeUncertainLinkageItem(item) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return {
        pmid: String(item.pmid || "").trim(),
        possibleGroupId: String(item.possible_group_id || "").trim(),
        reason: String(item.reason || "").trim(),
      };
    }
    return {
      pmid: String(item || "").trim(),
      possibleGroupId: "",
      reason: "",
    };
  }

  function publicationLinkagePayload(publicationLinkageArtifact, publicationLinkageEvidenceArtifact = {}) {
    const artifact = publicationLinkageArtifact || {};
    const linkage = artifact.publication_linkage || {};
    const evidenceArtifact = publicationLinkageEvidenceArtifact || {};
    const evidence = evidenceArtifact || {};
    return { artifact, linkage: linkage || {}, evidence: evidence || {} };
  }

  function publicationLinkageEvidenceList(linkage, evidence, key) {
    const evidenceItems = Array.isArray(evidence?.[key]) ? evidence[key].filter(Boolean) : [];
    if (evidenceItems.length) {
      return evidenceItems;
    }
    return Array.isArray(linkage?.[key]) ? linkage[key].filter(Boolean) : [];
  }

  function publicationLinkagePmidEvidenceMap(linkage, evidence) {
    return new Map(
      publicationLinkageEvidenceList(linkage, evidence, "pmid_linkage_evidence")
        .map((item) => [String(item.pmid || "").trim(), item])
        .filter(([pmid]) => pmid)
    );
  }

  function stringList(values) {
    if (Array.isArray(values)) {
      return values
        .map((value) => String(value || "").trim())
        .filter(Boolean);
    }
    const value = String(values || "").trim();
    return value ? [value] : [];
  }

  function publicationLinkageGroupPmids(group, pmidEvidenceByPmid = new Map()) {
    const groupId = String(group?.group_id || "").trim();
    const pmids = uniquePmids(group?.member_pmids);

    pmidEvidenceByPmid.forEach((evidenceItem, pmid) => {
      const assignedGroups = stringList(evidenceItem?.assigned_group_ids);
      if (groupId && assignedGroups.includes(groupId) && !pmids.includes(pmid)) {
        pmids.push(pmid);
      }
    });

    return uniquePmids(pmids).filter((pmid) => {
      const evidenceItem = pmidEvidenceByPmid.get(pmid);
      const assignedGroups = stringList(evidenceItem?.assigned_group_ids);
      return !assignedGroups.length || assignedGroups.includes(groupId);
    });
  }

  function publicationLinkageUniquePmidCount(linkage, evidence = {}) {
    const groups = Array.isArray(linkage?.publication_groups) ? linkage.publication_groups.filter(Boolean) : [];
    const singletonPmids = Array.isArray(linkage?.singleton_pmids) ? linkage.singleton_pmids.filter(Boolean) : [];
    const uncertainEntries = Array.isArray(linkage?.uncertain_linkage_pmids)
      ? linkage.uncertain_linkage_pmids.filter((item) => item !== null && item !== undefined)
      : [];
    const pmidEvidenceByPmid = publicationLinkagePmidEvidenceMap(linkage, evidence);
    const pmids = new Set();

    groups.forEach((group) => {
      publicationLinkageGroupPmids(group, pmidEvidenceByPmid).forEach((pmid) => pmids.add(pmid));
    });
    singletonPmids.forEach((pmid) => {
      const value = String(pmid || "").trim();
      if (value) {
        pmids.add(value);
      }
    });
    uncertainEntries.map(normalizeUncertainLinkageItem).forEach((item) => {
      if (item.pmid) {
        pmids.add(item.pmid);
      }
    });

    return pmids.size;
  }

  function hexToRgba(hex, alpha) {
    const normalized = String(hex || "").replace("#", "").trim();
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return `rgba(15, 118, 110, ${alpha})`;
    }
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function publicationLinkageDisplayMap(publicationLinkageArtifact, publicationLinkageEvidenceArtifact = {}) {
    const { linkage, evidence } = publicationLinkagePayload(publicationLinkageArtifact, publicationLinkageEvidenceArtifact);
    const groups = Array.isArray(linkage.publication_groups) ? linkage.publication_groups.filter(Boolean) : [];
    const singletonPmids = Array.isArray(linkage.singleton_pmids) ? linkage.singleton_pmids.filter(Boolean) : [];
    const uncertainEntries = Array.isArray(linkage.uncertain_linkage_pmids)
      ? linkage.uncertain_linkage_pmids.filter((item) => item !== null && item !== undefined)
      : [];
    const pmidEvidenceByPmid = publicationLinkagePmidEvidenceMap(linkage, evidence);
    const mapped = new Map();
    let colorIndex = 0;

    groups.forEach((group, index) => {
      const pmids = publicationLinkageGroupPmids(group, pmidEvidenceByPmid);
      if (!pmids.length) {
        return;
      }
      const color = LINKAGE_COLORS[colorIndex % LINKAGE_COLORS.length];
      colorIndex += 1;
      const label = group.group_id || `Group ${index + 1}`;
      pmids.forEach((pmid) => {
        const existing = mapped.get(pmid);
        if (existing?.type === "group" || existing?.type === "multi-group") {
          mapped.set(pmid, {
            label: `${existing.label}; ${label}`,
            color: existing.color,
            type: "multi-group",
          });
          return;
        }
        mapped.set(pmid, { label, color, type: "group" });
      });
    });

    const uncertainItems = [];
    const seenUncertain = new Set();
    uncertainEntries.map(normalizeUncertainLinkageItem).forEach((item) => {
      if (!item.pmid || mapped.has(item.pmid) || seenUncertain.has(item.pmid)) {
        return;
      }
      seenUncertain.add(item.pmid);
      uncertainItems.push(item);
    });
    if (uncertainItems.length) {
      const color = LINKAGE_COLORS[colorIndex % LINKAGE_COLORS.length];
      colorIndex += 1;
      uncertainItems.forEach((item) => {
        mapped.set(item.pmid, { label: "Uncertain linkage", color, type: "uncertain" });
      });
    }

    const singletonList = uniquePmids(singletonPmids).filter((pmid) => !mapped.has(pmid));
    if (singletonList.length) {
      const color = LINKAGE_COLORS[colorIndex % LINKAGE_COLORS.length];
      singletonList.forEach((pmid) => {
        mapped.set(pmid, { label: "Standalone records", color, type: "standalone" });
      });
    }

    return mapped;
  }

  function renderHero(current) {
    const runOptions = (data.run_options || [])
      .map(
        (option) => `
          <option value="${escapeHtml(option.run_id)}" ${option.run_id === current.run_id ? "selected" : ""}>
            ${escapeHtml(runLabel(option))}
          </option>
        `
      )
      .join("");

    heroPanel.innerHTML = `
      <div>
        <label class="select-label" for="run-select">Demo run</label>
        <select class="run-select" id="run-select">${runOptions}</select>
      </div>
    `;

    const select = document.getElementById("run-select");
    if (select) {
      select.addEventListener("change", (event) => {
        currentRunId = event.target.value;
        render();
      });
    }
  }

  function renderStepper(visibleSteps = steps) {
    stepper.innerHTML = visibleSteps
      .map(
        (step, index) => `
          <a class="step-chip ${step.kind === "evaluation" ? "step-chip-evaluation" : ""}" href="#${step.id}" title="${escapeHtml(step.title)}">
            <span class="step-index">${escapeHtml(step.indexLabel || String(index + 1).padStart(2, "0"))}</span>
            <span class="step-label">${escapeHtml(step.label)}</span>
          </a>
        `
      )
      .join("");

    function setActiveStep(stepId) {
      stepper.querySelectorAll(".step-chip").forEach((node) => {
        node.classList.toggle("active", node.getAttribute("href") === `#${stepId}`);
      });
    }

    stepper.querySelectorAll(".step-chip").forEach((chip) => {
      chip.addEventListener("click", (event) => {
        const href = chip.getAttribute("href") || "";
        const stepId = href.replace(/^#/, "");
        const section = stepId ? document.getElementById(stepId) : null;
        if (!section) {
          return;
        }
        event.preventDefault();
        currentStepLockUntil = Date.now() + 700;
        setActiveStep(stepId);
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    if (currentStepObserver) {
      currentStepObserver.disconnect();
    }

    if (currentStepScrollHandler) {
      window.removeEventListener("scroll", currentStepScrollHandler);
      window.removeEventListener("resize", currentStepScrollHandler);
    }

    function syncActiveStepFromScroll() {
      if (Date.now() < currentStepLockUntil) {
        return;
      }
      const targetLine = 140;
      const sections = visibleSteps
        .map((step) => document.getElementById(step.id))
        .filter(Boolean);
      if (!sections.length) {
        return;
      }
      const containing = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= targetLine && rect.bottom >= targetLine;
      });
      const best = containing || sections
        .slice()
        .sort((a, b) => Math.abs(a.getBoundingClientRect().top - targetLine) - Math.abs(b.getBoundingClientRect().top - targetLine))[0];
      if (best?.id) {
        setActiveStep(best.id);
      }
    }

    currentStepObserver = new IntersectionObserver(
      (entries) => {
        if (Date.now() < currentStepLockUntil) {
          return;
        }
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) {
          return;
        }
        const targetLine = 140;
        const best = visible
          .slice()
          .sort((a, b) => Math.abs(a.boundingClientRect.top - targetLine) - Math.abs(b.boundingClientRect.top - targetLine))[0];
        if (best?.target?.id) {
          setActiveStep(best.target.id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.05, 0.2, 0.4] }
    );

    visibleSteps.forEach((step) => {
      const section = document.getElementById(step.id);
      if (section) {
        currentStepObserver.observe(section);
      }
    });

    let scrollFrame = null;
    currentStepScrollHandler = () => {
      if (scrollFrame !== null) {
        cancelAnimationFrame(scrollFrame);
      }
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        syncActiveStepFromScroll();
      });
    };

    window.addEventListener("scroll", currentStepScrollHandler, { passive: true });
    window.addEventListener("resize", currentStepScrollHandler);
    syncActiveStepFromScroll();
  }

  function initSyncedTableScrollbars() {
    app.querySelectorAll("[data-scroll-proxy]").forEach((proxy) => {
      const key = proxy.getAttribute("data-scroll-proxy");
      const body = key ? app.querySelector(`[data-scroll-body="${key}"]`) : null;
      const track = proxy.querySelector(".table-scroll-proxy-inner");
      const table = body?.querySelector("table");
      if (!body || !track || !table) {
        return;
      }

      const syncTrackWidth = () => {
        track.style.width = `${table.scrollWidth}px`;
        proxy.style.display = table.scrollWidth > body.clientWidth ? "block" : "none";
      };

      let syncingFromProxy = false;
      let syncingFromBody = false;

      proxy.addEventListener("scroll", () => {
        if (syncingFromBody) {
          return;
        }
        syncingFromProxy = true;
        body.scrollLeft = proxy.scrollLeft;
        syncingFromProxy = false;
      });

      body.addEventListener("scroll", () => {
        if (syncingFromProxy) {
          return;
        }
        syncingFromBody = true;
        proxy.scrollLeft = body.scrollLeft;
        syncingFromBody = false;
      });

      syncTrackWidth();
      const resizeObserver = new ResizeObserver(() => syncTrackWidth());
      resizeObserver.observe(body);
      resizeObserver.observe(table);
    });
  }

  function criteriaTable(items, prefix) {
    return `
      <div class="table-wrap criteria-wrap">
        <table class="criteria-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Criterion</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr id="criterion-${escapeHtml(`${prefix}${index + 1}`)}" class="criterion-row">
                <td class="mono">${escapeHtml(`${prefix}${index + 1}`)}</td>
                <td>${sentence(item)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function studyTypeRoutingSection(robDisplay) {
    const rows = Array.isArray((robDisplay || {}).study_type_rows) ? robDisplay.study_type_rows : [];
    const routingLogic = Array.isArray((robDisplay || {}).routing_logic) ? robDisplay.routing_logic : [];

    function routingEvidenceSummary(row) {
      const evidence = Array.isArray(row.routing_evidence) ? row.routing_evidence : [];
      if (!evidence.length) {
        return "—";
      }
      return evidence
        .slice(0, 2)
        .map((item) => {
          const signal = String(item.signal || "").trim();
          const quote = String(item.quote || "").trim();
          return [signal, quote].filter(Boolean).join(": ");
        })
        .filter(Boolean)
        .map(sentence)
        .join("<br>") || "—";
    }

    if (!rows.length) {
      return `
        <details class="detail-card collapsible-table-panel rob-routing-panel" id="rob-routing">
          <summary class="collapsible-table-summary">
            <h3>RoB tool selection</h3>
          </summary>
          <p class="note">No saved RoB study-type routing table was found for this run.</p>
        </details>
      `;
    }

    return `
      <details class="detail-card collapsible-table-panel rob-routing-panel" id="rob-routing">
        <summary class="collapsible-table-summary">
          <h3>RoB tool selection</h3>
          <span class="collapsible-table-count mono">${number(rows.length)} studies</span>
        </summary>
        <p class="note">This table is rendered from the saved RoB routing summary. It shows the design classification, recommended tool, local implementation status, and whether a tool was actually administered.</p>
        <div class="table-wrap screening-wrap">
          <table class="screening-table rob-routing-table">
            <thead>
              <tr>
                <th>#</th>
                <th>PMID</th>
                <th>Pub. Info</th>
                <th>Study Type</th>
                <th>Subtype</th>
                <th>Confidence</th>
                <th>Recommended Tool</th>
                <th>Local Status</th>
                <th>Administered Tool</th>
                <th>Routing Status</th>
                <th>Reason / Evidence</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => {
                const reason = String(row.rob_routing_reason || "").trim();
                const evidence = routingEvidenceSummary(row);
                return `
                  <tr>
                    <td class="screen-col-index mono">${index + 1}</td>
                    <td class="screen-col-pmid mono">${renderPmidLink({ pmid: row.pmid })}</td>
                    <td class="screen-col-title">${extractionPubInfoCell(row)}</td>
                    <td>${sentence(row.study_design_type || "—")}</td>
                    <td>${sentence(row.study_design_subtype || "—")}</td>
                    <td>${sentence(row.study_design_confidence || "—")}</td>
                    <td class="mono">${escapeHtml(row.recommended_rob_tool_id || "—")}</td>
                    <td>${sentence(row.recommended_tool_implementation_status || "—")}</td>
                    <td class="mono">${escapeHtml(row.administered_rob_tool_id || "—")}</td>
                    <td>${sentence(row.rob_routing_status || "—")}</td>
                    <td class="rob-routing-reason">${reason ? sentence(reason) : "—"}${evidence !== "—" ? `<div class="small">${evidence}</div>` : ""}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
        ${routingLogic.length ? `
          <details class="subgroup-detail-panel rob-routing-logic-panel">
            <summary class="subgroup-plan-head">
              <h4>Routing Logic</h4>
            </summary>
            <ol class="rob-routing-logic-list">
              ${routingLogic.map((item) => `
                <li>
                  <span class="mono">${escapeHtml(item.decision || "")}</span>
                  <span>${sentence(item.logic || "")}</span>
                </li>
              `).join("")}
            </ol>
          </details>
        ` : ""}
      </details>
    `;
  }

  function riskOfBiasTable(robDisplay) {
    const groups = Array.isArray((robDisplay || {}).assessment_groups) ? robDisplay.assessment_groups : [];

    if (!groups.length) {
      return `<p class="note">No completed RoB assessments grouped by administered tool were available for this run.</p>`;
    }

    function shortTitle(title, maxLength = 90) {
      const text = String(title || "").trim();
      if (!text) {
        return "No title available.";
      }
      if (text.length <= maxLength) {
        return text;
      }
      return `${text.slice(0, maxLength).trim()}...`;
    }

    function firstAuthorLastName(study) {
      const authors = Array.isArray(study.authors) ? study.authors : [];
      const firstAuthor = String(authors[0] || "").trim();
      if (!firstAuthor) {
        return "";
      }
      if (firstAuthor.includes(",")) {
        return firstAuthor.split(",", 1)[0].trim();
      }
      const parts = firstAuthor.split(/\s+/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : "";
    }

    function firstAuthorYear(study, row = {}) {
      return [
        firstAuthorLastName(study) || String(row.first_author_last_name || "").trim(),
        String(study.year || row.year || "").trim(),
      ].filter(Boolean).join(" ");
    }

    function robStudyCell(study, row, showOutcome) {
      const authorYear = firstAuthorYear(study, row);
      const title = String(study.title || "").trim();
      const journal = String(study.journal || "").trim();
      const outcome = String(row.outcome_name || row.result_key || row.outcome_role || "").trim();
      const tooltip = [authorYear, journal, title, outcome].filter(Boolean).join("\n\n");
      return `
        <div class="rob-matrix-study" title="${escapeHtml(tooltip)}">
          <div class="rob-matrix-study-main">${authorYear ? sentence(authorYear) : "No author/year."}</div>
          <div class="rob-matrix-study-meta mono">${renderPmidLink(row)}</div>
          ${showOutcome ? `<div class="rob-matrix-study-outcome">${sentence(outcome || "Outcome not specified")}</div>` : ""}
          <div class="rob-matrix-study-title">${sentence(shortTitle(title, 56))}</div>
        </div>
      `;
    }

    function robOutcomeKey(row) {
      const explicitKey = String(row.result_key || "").trim();
      if (explicitKey) {
        return explicitKey;
      }
      const role = String(row.outcome_role || "").trim();
      const index = String(row.outcome_index || "").trim();
      if (role && index) {
        return `${role}_${index}`;
      }
      const outcome = String(row.outcome_name || "").trim();
      return outcome || "outcome_not_specified";
    }

    function robOutcomeLabel(row, key) {
      const outcome = String(row.outcome_name || "").trim();
      if (outcome) {
        return outcome;
      }
      if (key && key !== "outcome_not_specified") {
        return key.replace(/_/g, " ");
      }
      return "Outcome not specified";
    }

    function robOutcomeGroups(rows) {
      const byKey = new Map();
      (rows || []).forEach((row) => {
        const key = robOutcomeKey(row);
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            label: robOutcomeLabel(row, key),
            rows: [],
          });
        }
        byKey.get(key).rows.push(row);
      });
      return Array.from(byKey.values());
    }

    function robJudgmentMeta(domainResult) {
      const judgment = String((domainResult || {}).judgment || "").trim().toLowerCase();
      const normalized = judgment.replace(/[_-]+/g, " ");
      if (["low", "yes", "include", "probably yes", "low risk"].includes(normalized)) {
        return { tone: "pass", symbol: "+", label: "Low" };
      }
      if (["high", "very high", "serious", "critical", "no", "probably no", "exclude", "high risk"].includes(normalized)) {
        return { tone: "fail", symbol: "X", label: "High" };
      }
      if (normalized) {
        return { tone: "unclear", symbol: "-", label: "Some concerns" };
      }
      return { tone: "unknown", symbol: "-", label: "Not assessed" };
    }

    function robCell(domainResult) {
      const meta = robJudgmentMeta(domainResult);
      const judgment = String((domainResult || {}).judgment || "").trim();
      const title = (domainResult || {}).reason || meta.label;
      const tooltip = `${meta.label}${judgment ? ` (${judgment})` : ""}: ${title}`;
      return `
        <span class="rob-traffic-cell rob-traffic-${meta.tone}" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(meta.label)}">
          ${escapeHtml(meta.symbol)}
        </span>
      `;
    }

    function countRobJudgments(values) {
      const counts = { pass: 0, unclear: 0, fail: 0, unknown: 0 };
      (values || []).forEach((value) => {
        const tone = robJudgmentMeta(value).tone;
        counts[tone] = (counts[tone] || 0) + 1;
      });
      return counts;
    }

    function robSummaryTotal(counts) {
      return ["pass", "unclear", "fail", "unknown"].reduce((sum, key) => sum + (counts[key] || 0), 0);
    }

    function robSummarySegment(segment, counts, total) {
      const count = counts[segment.key] || 0;
      if (!count || !total) {
        return "";
      }
      const pct = (count / total) * 100;
      return `
        <span
          class="rob-summary-segment rob-summary-${segment.key}"
          style="width:${pct.toFixed(4)}%;"
          title="${escapeHtml(`${segment.label}: ${count} of ${total} (${Math.round(pct)}%)`)}"
          aria-label="${escapeHtml(`${segment.label}: ${count} of ${total}`)}"
        ></span>
      `;
    }

    function riskOfBiasDomainSummary(rows, domainNames) {
      const summaryRows = domainNames.map((name, index) => {
        const values = rows.map((row) => ((row.rob_assessment || {}).domains || {})[name]);
        const counts = countRobJudgments(values);
        return {
          key: `D${index + 1}`,
          label: name,
          counts,
          total: robSummaryTotal(counts),
          isOverall: false,
        };
      });
      const overallCounts = countRobJudgments(rows.map((row) => {
        const rob = row.rob_assessment || {};
        return {
          judgment: rob.overall_risk_of_bias || row.overall_risk_of_bias,
          reason: rob.overall_reason || row.overall_reason,
        };
      }));
      summaryRows.push({
        key: "Overall",
        label: "Overall risk of bias",
        counts: overallCounts,
        total: robSummaryTotal(overallCounts),
        isOverall: true,
      });
      const hasUnknown = summaryRows.some((row) => (row.counts.unknown || 0) > 0);
      const segments = [
        { key: "pass", label: "Low risk" },
        { key: "unclear", label: "Some concerns" },
        { key: "fail", label: "High risk" },
        ...(hasUnknown ? [{ key: "unknown", label: "Not assessed" }] : []),
      ];
      return `
        <div class="rob-domain-summary">
          <h5>Risk of bias - domain summary overview</h5>
          <div class="rob-domain-summary-grid">
            ${summaryRows.map((row) => `
              <div class="rob-domain-summary-label ${row.isOverall ? "rob-domain-summary-overall-label" : ""}">
                ${row.isOverall ? sentence(row.label) : `<span class="mono">${escapeHtml(row.key)}</span> ${sentence(row.label)}`}
              </div>
              <div class="rob-summary-bar" title="${escapeHtml(`${row.label}: ${row.total} assessed judgments`)}">
                ${row.total
                  ? segments.map((segment) => robSummarySegment(segment, row.counts, row.total)).join("")
                  : `<span class="rob-summary-empty">No assessed judgments</span>`}
              </div>
            `).join("")}
            <div class="rob-domain-summary-label rob-axis-spacer" aria-hidden="true"></div>
            <div class="rob-summary-axis" aria-hidden="true">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          <div class="rob-summary-legend" aria-label="Risk-of-bias domain summary legend">
            ${segments.map((segment) => `
              <span class="rob-summary-legend-item">
                <span class="rob-summary-swatch rob-summary-${segment.key}" aria-hidden="true"></span>
                <span>${escapeHtml(segment.label)}</span>
              </span>
            `).join("")}
          </div>
        </div>
      `;
    }

    function riskOfBiasMatrix(rows, domainNames, showOutcomeRows) {
      return `
        <div class="table-wrap screening-wrap rob-matrix-wrap">
          <div class="rob-matrix-title">Risk of bias domains</div>
          <table class="rob-matrix-table">
            <thead>
              <tr>
                <th class="rob-study-label-header">Study</th>
                ${domainNames.map((name, index) => `<th class="rob-domain-col" title="${escapeHtml(name)}">D${index + 1}</th>`).join("")}
                <th class="rob-overall-col">Overall</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => {
                const meta = row.metadata || {};
                const rob = row.rob_assessment || {};
                const domains = rob.domains || {};
                return `
                  <tr>
                    <th class="rob-study-label" scope="row">${robStudyCell(meta, row, showOutcomeRows)}</th>
                    ${domainNames.map((name) => `<td class="rob-domain-col">${robCell(domains[name])}</td>`).join("")}
                    <td class="rob-overall-col">${robCell({ judgment: rob.overall_risk_of_bias || row.overall_risk_of_bias, reason: rob.overall_reason || row.overall_reason })}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
          <div class="rob-matrix-footer">
            <div class="rob-domain-legend">
              <div class="rob-legend-heading">Domains</div>
              ${domainNames.map((name, index) => `
                <div class="rob-domain-legend-row">
                  <span class="mono">D${index + 1}</span>
                  <span>${sentence(name)}</span>
                </div>
              `).join("")}
            </div>
            <div class="rob-judgment-legend" aria-label="Risk-of-bias judgment legend">
              <div class="rob-legend-heading">Judgement</div>
              <div class="rob-judgment-legend-row">${robCell({ judgment: "high", reason: "High risk" })}<span>High</span></div>
              <div class="rob-judgment-legend-row">${robCell({ judgment: "some concerns", reason: "Some concerns" })}<span>Some concerns</span></div>
              <div class="rob-judgment-legend-row">${robCell({ judgment: "low", reason: "Low risk" })}<span>Low</span></div>
            </div>
          </div>
          ${riskOfBiasDomainSummary(rows, domainNames)}
        </div>
      `;
    }

    return `
      <div class="rob-tool-group-list">
        ${groups.map((group) => {
          const rows = Array.isArray(group.rows) ? group.rows : [];
          const domainNames = Array.isArray(group.domain_names) && group.domain_names.length
            ? group.domain_names
            : Array.from(new Set(rows.flatMap((row) => Object.keys((row.rob_assessment || {}).domains || {}))));
          const hasOutcomeRows = rows.some((row) => row.outcome_name || row.outcome_role || row.result_key);
          const outcomeGroups = hasOutcomeRows
            ? robOutcomeGroups(rows)
            : [{ key: "all_assessments", label: "All assessments", rows }];
          const title = group.tool_name || group.tool_id || "Administered RoB tool";
          return `
            <details class="collapsible-table-panel rob-tool-group">
              <summary class="collapsible-table-summary">
                <h4>${sentence(title)}</h4>
                <span class="collapsible-table-count mono">${number(group.n_completed_assessments ?? rows.length)} completed</span>
              </summary>
              <div class="rob-outcome-group-list">
                ${outcomeGroups.map((outcomeGroup) => `
                  <section class="rob-outcome-group">
                    ${hasOutcomeRows ? `
                      <div class="rob-outcome-head">
                        <h5>${sentence(outcomeGroup.label)}</h5>
                        <span class="mono">${number(outcomeGroup.rows.length)} ${outcomeGroup.rows.length === 1 ? "assessment" : "assessments"}</span>
                      </div>
                    ` : ""}
                    ${riskOfBiasMatrix(outcomeGroup.rows, domainNames, false)}
                  </section>
                `).join("")}
              </div>
            </details>
          `;
        }).join("")}
      </div>
    `;
  }

  function screeningMatrix(review, screening, limit, allowedDecisions, searchMetrics = {}, benchmarkOnly = false) {
    const allStudies = screening.screened_studies || [];
    const benchmarkIndexedPmids = screeningBenchmarkPmidSet(searchMetrics);
    const applyBenchmarkFilter = currentEvaluationVisible && benchmarkOnly && benchmarkIndexedPmids.size;
    const decisionSet = new Set((allowedDecisions || []).map((value) => String(value || "").trim().toLowerCase()));
    const filteredStudies = allStudies.filter((study) =>
      decisionSet.has(String(study.screen_decision || "not enough info").trim().toLowerCase())
      && (!applyBenchmarkFilter || benchmarkIndexedPmids.has(String(study?.pmid || "").trim()))
    );
    const normalizedLimit = String(limit) === "all" ? "all" : Number(limit) || 20;
    const studies = normalizedLimit === "all" ? filteredStudies : filteredStudies.slice(0, normalizedLimit);
    const inclusion = review.inclusion_criteria || [];
    const exclusion = review.exclusion_criteria || [];
    const benchmark = searchMetrics?.benchmark || {};
    const includedBenchmarkPmids = new Set(pmidListFromValue(benchmark.pmids));
    const excludedBenchmarkPmids = new Set(pmidListFromValue(benchmark.excluded_pmids));
    const showBenchmarkColumn = currentEvaluationVisible && (includedBenchmarkPmids.size || excludedBenchmarkPmids.size);

    function lookupAssessment(items, criterion) {
      return (items || []).find((item) => item.criterion === criterion) || {};
    }

    function screeningIndicatorCell(label, tone, title) {
      return `<span class="screen-cell ${tone}" title="${escapeHtml(title || label || "")}" aria-label="${escapeHtml(label || title || "")}"></span>`;
    }

    function inclusionCell(study, criterion) {
      const item = lookupAssessment(study.inclusion_criteria_assessment, criterion);
      const judgment = item.judgment || "unclear";
      if (judgment === "met") {
        return screeningIndicatorCell("Pass", "pass", item.justification || criterion);
      }
      if (judgment === "not_met") {
        return screeningIndicatorCell("Fail", "fail", item.justification || criterion);
      }
      return screeningIndicatorCell("Unclear", "unclear", item.justification || criterion);
    }

    function exclusionCell(study, criterion) {
      const item = lookupAssessment(study.exclusion_criteria_assessment, criterion);
      const judgment = item.judgment || "unclear";
      if (judgment === "not_triggered") {
        return screeningIndicatorCell("Pass", "pass", item.justification || criterion);
      }
      if (judgment === "triggered") {
        return screeningIndicatorCell("Fail", "fail", item.justification || criterion);
      }
      return screeningIndicatorCell("Unclear", "unclear", item.justification || criterion);
    }

    function decisionCell(study) {
      const decision = String(study.screen_decision || "not enough info").trim().toLowerCase();
      const tone = decision === "include" ? "pass" : decision === "exclude" ? "fail" : "unclear";
      const readable = decision === "include" ? "Include" : decision === "exclude" ? "Exclude" : "Not enough info";
      return screeningIndicatorCell(readable, tone, `${readable}: ${study.screen_reason || readable}`);
    }

    function benchmarkStatusCell(study) {
      const pmid = String(study?.pmid || "").trim();
      const decision = String(study?.screen_decision || "not enough info").trim().toLowerCase();
      const screenPositive = decision === "include" || decision === "not enough info";
      let label = "Not indexed";
      let tone = "unknown";
      let title = "PMID is not in the curated Cochrane included/excluded benchmark reference sets.";
      if (!pmid) {
        label = "No PMID";
        title = "No PMID is available for Cochrane benchmark lookup.";
      } else if (includedBenchmarkPmids.has(pmid)) {
        label = screenPositive ? "TP" : "FN";
        tone = screenPositive ? "tp" : "fn";
        title = screenPositive
          ? "True positive: Cochrane included-reference PMID kept by agent screening."
          : "False negative: Cochrane included-reference PMID excluded by agent screening.";
      } else if (excludedBenchmarkPmids.has(pmid)) {
        label = screenPositive ? "FP" : "TN";
        tone = screenPositive ? "fp" : "tn";
        title = screenPositive
          ? "False positive: Cochrane excluded-reference PMID kept by agent screening."
          : "True negative: Cochrane excluded-reference PMID excluded by agent screening.";
      }
      return `<span class="screen-benchmark-chip screen-benchmark-${tone}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
    }

    function criterionHeader(prefix, criterion, index) {
      const code = `${prefix}${index + 1}`;
      return `<a class="criterion-jump" href="#criterion-${escapeHtml(code)}" title="${escapeHtml(criterion)}">${escapeHtml(code)}</a>`;
    }

    return `
      <div class="table-wrap screening-wrap">
        <table class="screening-table screening-results-table study-sticky-table">
          <thead>
            <tr>
              <th class="screen-col-index">#</th>
              <th class="screen-col-study">Study</th>
              ${inclusion.map((criterion, index) => `<th class="screen-col-inclusion">${criterionHeader("I", criterion, index)}</th>`).join("")}
              ${exclusion.map((criterion, index) => `<th class="screen-col-exclusion${index === 0 ? " screen-col-section-start" : ""}">${criterionHeader("E", criterion, index)}</th>`).join("")}
              <th class="screen-col-decision screen-col-overall" title="Final screening decision">Decision</th>
              ${showBenchmarkColumn ? `<th class="screen-col-benchmark screen-col-overall" title="Benchmark status against curated Cochrane included/excluded references">Benchmark</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${studies.map((study, index) => `
              <tr>
                <td class="screen-col-index mono">${index + 1}</td>
                <td class="screen-col-study">${compactStudyCell(study)}</td>
                ${inclusion.map((criterion) => `<td class="screen-col-inclusion">${inclusionCell(study, criterion)}</td>`).join("")}
                ${exclusion.map((criterion, criterionIndex) => `<td class="screen-col-exclusion${criterionIndex === 0 ? " screen-col-section-start" : ""}">${exclusionCell(study, criterion)}</td>`).join("")}
                <td class="screen-col-decision screen-col-overall">${decisionCell(study)}</td>
                ${showBenchmarkColumn ? `<td class="screen-col-benchmark screen-col-overall">${benchmarkStatusCell(study)}</td>` : ""}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function picoArtifact(pico) {
    const payload = pico && Object.keys(pico).length ? pico : null;
    if (!payload) {
      return `<p class="note">No PICO artifact found for this run.</p>`;
    }

    const fields = [
      ["Population", payload.population],
      ["Intervention / Exposure", payload.intervention_exposure],
      ["Comparison", payload.comparison],
      ["Outcome", payload.outcome],
      ["Study Design", payload.study_design],
    ];

    return `
      <div class="pico-grid">
        ${fields.map(([label, value]) => `
          <div class="pico-row">
            <div class="pico-label">${escapeHtml(label)}</div>
            <div class="pico-value">${sentence(value || "Not specified.")}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function publicationLinkageSection(publicationLinkageArtifact, publicationLinkageEvidenceArtifact, screenedStudies) {
    const { artifact, linkage, evidence } = publicationLinkagePayload(
      publicationLinkageArtifact,
      publicationLinkageEvidenceArtifact
    );
    const status = artifact.status || "";
    const groups = Array.isArray(linkage.publication_groups) ? linkage.publication_groups.filter(Boolean) : [];
    const validGroupIds = new Set(groups.map((group) => String(group.group_id || "").trim()).filter(Boolean));
    const singletonPmids = Array.isArray(linkage.singleton_pmids) ? linkage.singleton_pmids.filter(Boolean) : [];
    const uncertainEntries = Array.isArray(linkage.uncertain_linkage_pmids)
      ? linkage.uncertain_linkage_pmids.filter((item) => item !== null && item !== undefined)
      : [];
    const groupEvidenceById = new Map(
      publicationLinkageEvidenceList(linkage, evidence, "group_linkage_evidence")
        .map((item) => [String(item.group_id || "").trim(), item])
        .filter(([groupId]) => groupId)
    );
    const pmidEvidenceByPmid = publicationLinkagePmidEvidenceMap(linkage, evidence);
    const multiGroupByPmid = new Map(
      publicationLinkageEvidenceList(linkage, evidence, "multi_group_pmids")
        .map((item) => [String(item.pmid || "").trim(), item])
        .filter(([pmid]) => pmid)
    );
    const studyByPmid = new Map(
      (screenedStudies || []).map((study) => [String(study.pmid || "").trim(), study])
    );

    function firstAuthorLastName(study) {
      const authors = Array.isArray(study?.authors) ? study.authors : [];
      const firstAuthor = String(authors[0] || "").trim();

      if (firstAuthor.includes(",")) {
        return firstAuthor.split(",", 1)[0].trim();
      }

      const parts = firstAuthor.split(/\s+/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : "";
    }

    function firstAuthorYear(study) {
      const lastName = firstAuthorLastName(study);
      const year = String(study?.year || "").trim();
      return [lastName, year].filter(Boolean).join(", ");
    }

    function studyYearForSort(study) {
      const year = Number.parseInt(study?.year, 10);
      return Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
    }

    function comparePmidsByAuthorYear(a, b) {
      const pmidA = String(a || "").trim();
      const pmidB = String(b || "").trim();
      const studyA = studyByPmid.get(pmidA) || { pmid: pmidA };
      const studyB = studyByPmid.get(pmidB) || { pmid: pmidB };
      const authorA = firstAuthorLastName(studyA).toLocaleLowerCase() || "\uffff";
      const authorB = firstAuthorLastName(studyB).toLocaleLowerCase() || "\uffff";
      const authorOrder = authorA.localeCompare(authorB, undefined, { sensitivity: "base" });

      if (authorOrder !== 0) {
        return authorOrder;
      }

      const yearOrder = studyYearForSort(studyA) - studyYearForSort(studyB);
      if (yearOrder !== 0) {
        return yearOrder;
      }

      return pmidA.localeCompare(pmidB, undefined, { numeric: true });
    }

    function sortedPmidsByAuthorYear(values) {
      return uniquePmids(values).slice().sort(comparePmidsByAuthorYear);
    }

    function renderChips(values) {
      const items = stringList(values);
      if (!items.length) {
        return "";
      }
      return `
        <span class="linkage-evidence-chips">
          ${items.map((item) => `<span class="linkage-evidence-chip">${escapeHtml(item)}</span>`).join("")}
        </span>
      `;
    }

    function renderEvidenceRow(label, bodyHtml) {
      if (!bodyHtml) {
        return "";
      }
      return `
        <div class="linkage-evidence-row">
          <span class="linkage-evidence-label">${escapeHtml(label)}</span>
          <span class="linkage-evidence-value">${bodyHtml}</span>
        </div>
      `;
    }

    function renderPmidEvidence(pmid, options = {}) {
      const evidenceItem = pmidEvidenceByPmid.get(String(pmid || "").trim()) || {};
      const multiItem = multiGroupByPmid.get(String(pmid || "").trim()) || {};
      const assignedGroups = stringList(evidenceItem.assigned_group_ids || multiItem.assigned_group_ids)
        .filter((groupId) => validGroupIds.has(groupId));
      const rows = [
        renderEvidenceRow("Reported dataset", renderChips(evidenceItem.reported_dataset_ids)),
        renderEvidenceRow("Reported acronym", renderChips(evidenceItem.reported_trial_acronyms)),
        renderEvidenceRow("Assigned group", renderChips(assignedGroups)),
        renderEvidenceRow("Reason", evidenceItem.reason ? sentence(evidenceItem.reason) : ""),
      ].filter(Boolean);

      if (!rows.length) {
        return "";
      }

      const currentGroupId = String(options.groupId || "").trim();
      const assignmentNote = currentGroupId && assignedGroups.length && !assignedGroups.includes(currentGroupId)
        ? `<p class="note linkage-evidence-warning">This PMID is shown in the group membership, but the saved per-PMID evidence does not list this group assignment.</p>`
        : "";

      return `
        <details class="linkage-evidence-details">
          <summary>Evidence</summary>
          <div class="linkage-evidence-grid">
            ${rows.join("")}
          </div>
          ${assignmentNote}
        </details>
      `;
    }

    function renderMultiGroupBadge(pmid) {
      const normalizedPmid = String(pmid || "").trim();
      const evidenceItem = pmidEvidenceByPmid.get(normalizedPmid) || {};
      const multiItem = multiGroupByPmid.get(normalizedPmid) || {};
      const assignedGroups = stringList(evidenceItem.assigned_group_ids)
        .filter((groupId) => validGroupIds.has(groupId));
      if (!evidenceItem.multi_group_assignment && assignedGroups.length < 2) {
        return "";
      }
      const title = multiItem.reason || evidenceItem.reason || "This publication is assigned to more than one linkage group.";
      return `<span class="linkage-multi-badge" title="${escapeHtml(title)}">Multiple groups</span>`;
    }

    function renderGroupEvidence(group) {
      const groupId = String(group.group_id || "").trim();
      const evidenceItem = groupEvidenceById.get(groupId) || {};
      const evidenceReason = String(evidenceItem.reason || group.rationale || "").trim();
      const rows = [
        renderEvidenceRow("Dataset", renderChips(evidenceItem.dataset_ids)),
        renderEvidenceRow("Trial acronym", renderChips(evidenceItem.trial_acronyms)),
        renderEvidenceRow("Evidence reason", evidenceReason ? sentence(evidenceReason) : ""),
      ].filter(Boolean);

      if (!rows.length) {
        return "";
      }

      return `
        <div class="linkage-group-evidence">
          <div class="linkage-evidence-heading">Group Evidence</div>
          <div class="linkage-evidence-grid">
            ${rows.join("")}
          </div>
        </div>
      `;
    }

    function renderLinkedStudy(pmid, options = {}) {
      const study = studyByPmid.get(String(pmid).trim()) || { pmid };
      const title = String(study.title || "").trim();
      const abstract = String(study.abstract || "").trim();
      const citation = firstAuthorYear(study);
      const titleTooltip = [
        title ? `Title: ${title}` : "",
        abstract ? `Abstract: ${abstract}` : "",
      ].filter(Boolean).join("\n\n");
      return `
        <div class="linkage-study-item">
          <div class="linkage-study-row">
            <div class="linkage-study-pmid mono">${renderPmidLink(study)}</div>
            <div class="linkage-study-citation">
              <span>${citation ? sentence(citation) : "—"}</span>
              ${renderMultiGroupBadge(study.pmid)}
            </div>
            <div class="linkage-study-title" title="${escapeHtml(titleTooltip)}">${title ? sentence(title) : "No title available."}</div>
          </div>
          ${options.showEvidence ? renderPmidEvidence(study.pmid, options) : ""}
        </div>
      `;
    }

    function uniquePmids(values) {
      const seen = new Set();
      const out = [];
      (values || []).forEach((value) => {
        const pmid = String(value || "").trim();
        if (!pmid || seen.has(pmid)) {
          return;
        }
        seen.add(pmid);
        out.push(pmid);
      });
      return out;
    }

    function studyCountLabel(count) {
      return `${number(count)} ${count === 1 ? "study" : "studies"}`;
    }

    function normalizeUncertainLinkageItem(item) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return {
          pmid: String(item.pmid || "").trim(),
          possibleGroupId: String(item.possible_group_id || "").trim(),
          reason: String(item.reason || "").trim(),
        };
      }
      return {
        pmid: String(item || "").trim(),
        possibleGroupId: "",
        reason: "",
      };
    }

    const displayGroups = groups
      .map((group, index) => ({
        group,
        detailKey: `group-${index}`,
        pmids: publicationLinkageGroupPmids(group, pmidEvidenceByPmid),
      }))
      .filter((item) => item.pmids.length > 0);
    const linkedPmidsForDisplay = new Set();
    displayGroups.forEach((item) => {
      item.pmids.forEach((pmid) => linkedPmidsForDisplay.add(pmid));
    });

    const displayUncertainItems = [];
    const seenUncertainPmids = new Set();
    uncertainEntries.map(normalizeUncertainLinkageItem).forEach((item) => {
      if (!item.pmid || linkedPmidsForDisplay.has(item.pmid) || seenUncertainPmids.has(item.pmid)) {
        return;
      }
      seenUncertainPmids.add(item.pmid);
      displayUncertainItems.push(item);
    });

    const uncertainPmidSet = new Set(displayUncertainItems.map((item) => item.pmid));
    const displaySingletonPmids = uniquePmids(singletonPmids)
      .filter((pmid) => !linkedPmidsForDisplay.has(pmid) && !uncertainPmidSet.has(pmid))
      .sort(comparePmidsByAuthorYear);
    displayUncertainItems.sort((a, b) => comparePmidsByAuthorYear(a.pmid, b.pmid));

    function linkageSummaryItems() {
      const items = displayGroups.map((item) => ({
        detailKey: item.detailKey,
        label: item.group.group_id || "Group",
        count: item.pmids.length,
      }));

      const uncertainCount = displayUncertainItems.length;
      if (uncertainCount > 0) {
        items.push({ detailKey: "uncertain", label: "Uncertain linkage", count: uncertainCount });
      }

      const singletonCount = displaySingletonPmids.length;
      if (singletonCount > 0) {
        items.push({ detailKey: "standalone", label: "Standalone records", count: singletonCount });
      }
      return items;
    }

    function renderLinkageOverview() {
      const items = linkageSummaryItems();
      const total = items.reduce((sum, item) => sum + item.count, 0);
      const uniqueTotal = publicationLinkageUniquePmidCount(linkage, evidence);
      if (!total) {
        return "";
      }

      const radius = 42;
      const circumference = 2 * Math.PI * radius;
      const sliceGap = items.length > 1 ? 1.4 : 0;
      let offset = 0;
      const slices = items.map((item, index) => {
        const length = (item.count / total) * circumference;
        const visibleLength = Math.max(0, length - sliceGap);
        const color = LINKAGE_COLORS[index % LINKAGE_COLORS.length];
        const slice = `
          <circle
            class="linkage-donut-slice"
            cx="50"
            cy="50"
            r="${radius}"
            stroke="${color}"
            stroke-dasharray="${visibleLength} ${circumference - visibleLength}"
            stroke-dashoffset="${-offset}"
          >
            <title>${escapeHtml(item.label)}: ${studyCountLabel(item.count)}</title>
          </circle>
        `;
        offset += length;
        return slice;
      }).join("");

      return `
        <div class="linkage-overview">
          <div class="linkage-donut-wrap" aria-label="Publication linkage study counts">
            <svg class="linkage-donut" viewBox="0 0 100 100" role="img" aria-label="Publication linkage distribution">
              <circle class="linkage-donut-track" cx="50" cy="50" r="${radius}"></circle>
              <g transform="rotate(-90 50 50)">${slices}</g>
            </svg>
            <div class="linkage-donut-center">
              <strong>${number(total)}</strong>
              <span>assignments</span>
            </div>
          </div>
          <div class="linkage-legend">
            ${items.map((item, index) => `
              <button class="linkage-legend-row linkage-legend-button" type="button" data-linkage-target="${escapeHtml(item.detailKey)}" aria-expanded="false">
                <span class="linkage-legend-swatch" style="background:${LINKAGE_COLORS[index % LINKAGE_COLORS.length]}"></span>
                <span class="linkage-legend-label">${escapeHtml(item.label)}</span>
                <span class="linkage-legend-count">${studyCountLabel(item.count)}</span>
              </button>
            `).join("")}
            ${uniqueTotal && uniqueTotal !== total ? `<p class="note linkage-overview-note">${number(uniqueTotal)} unique records; group counts may overlap when one publication reports multiple trials.</p>` : ""}
          </div>
        </div>
      `;
    }

    function renderUncertainStudy(item) {
      const details = [
        item.possibleGroupId ? `Possible group: ${item.possibleGroupId}.` : "",
        item.reason,
      ].filter(Boolean).join(" ");
      return `
        <div class="linkage-uncertain-item">
          ${renderLinkedStudy(item.pmid, { showEvidence: true })}
          ${details ? `<p class="note linkage-uncertain-note">${sentence(details)}</p>` : ""}
        </div>
      `;
    }

    const hasContent = displayGroups.length || displaySingletonPmids.length || displayUncertainItems.length;
    if (!hasContent) {
      return `
        <details class="detail-card publication-linkage-section" id="publication-linkage" style="margin-top:14px;">
          <summary class="collapsible-table-summary publication-linkage-summary">
            <span>
              <h3>Publication Linkage <span class="inline-section-count">(x 0)</span></h3>
              <span class="summary-description">Groups papers that may report the same underlying dataset or trial.</span>
            </span>
          </summary>
          <p class="note">No publication linkage results were saved for this run${status ? ` (${escapeHtml(status)})` : ""}.</p>
        </details>
      `;
    }

    return `
      <details class="detail-card publication-linkage-section" id="publication-linkage" style="margin-top:14px;">
        <summary class="collapsible-table-summary publication-linkage-summary">
          <span>
            <h3>Publication Linkage <span class="inline-section-count">(x ${number(displayGroups.length)})</span></h3>
            <span class="summary-description">Groups papers that may report the same underlying dataset or trial.</span>
          </span>
        </summary>
        <p class="note">Likely linked reports are grouped by shared underlying dataset, trial, or cohort. Group-level and per-PMID evidence are shown below for audit.</p>
        ${renderLinkageOverview()}
        <p class="note linkage-detail-empty" data-linkage-empty>Click a group name above to view included studies.</p>
        <div class="linkage-group-list">
          ${displayGroups.map(({ group, detailKey, pmids }) => `
            <div class="linkage-group-card" data-linkage-detail="${escapeHtml(detailKey)}" hidden>
              <div class="linkage-group-header">
                <div class="linkage-group-title">${escapeHtml(group.group_id || "Group")}</div>
              </div>
              ${renderGroupEvidence(group)}
              <div class="linkage-study-list">
                ${sortedPmidsByAuthorYear(pmids).map((pmid) => renderLinkedStudy(pmid, { showEvidence: true, groupId: group.group_id || "" })).join("")}
              </div>
            </div>
          `).join("")}
          ${displayUncertainItems.length
            ? `
              <div class="linkage-group-card" data-linkage-detail="uncertain" hidden>
                <div class="linkage-group-header">
                  <div class="linkage-group-title">Uncertain Linkage</div>
                </div>
                <p class="note linkage-group-note">${sentence(linkage.uncertain_linkage_pmids_description || "These proceeded-study PMIDs have plausible but unresolved publication-linkage signals and need manual review.")}</p>
                <div class="linkage-study-list">
                  ${displayUncertainItems.map((item) => renderUncertainStudy(item)).join("")}
                </div>
              </div>
            `
            : ""
          }
          ${displaySingletonPmids.length
            ? `
              <div class="linkage-group-card" data-linkage-detail="standalone" hidden>
                <div class="linkage-group-header">
                  <div class="linkage-group-title">Standalone Records</div>
                </div>
                <p class="note linkage-group-note">${sentence(linkage.singleton_pmids_description || "These proceeded-study PMIDs are currently treated as standalone records.")}</p>
                <div class="linkage-study-list">
                  ${displaySingletonPmids.map((pmid) => renderLinkedStudy(pmid, { showEvidence: true })).join("")}
                </div>
              </div>
            `
            : ""
          }
        </div>
      </details>
    `;
  }

  function outcomesSection(
    outcomesArtifact,
    pico,
    outcomeSignalInventory = {},
    cochraneOutcomeAlignment = {},
    outcomeSourceContribution = {}
  ) {
    const artifact = outcomesArtifact || {};
    const outcomes = artifact.outcomes || {};
    const status = artifact.status || "";
    const primary = outcomes.primary_outcome || {};
    const secondary = Array.isArray(outcomes.secondary_outcomes) ? outcomes.secondary_outcomes.filter(Boolean) : [];
    const initialOutcome = String((pico || {}).outcome || "").trim();
    const sourceInventory = outcomeSignalInventory || {};
    const benchmarkAlignment = cochraneOutcomeAlignment || {};
    const sourceContribution = currentEvaluationVisible ? outcomeSourceContribution || {} : {};

    function asArray(value) {
      if (Array.isArray(value)) {
        return value.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
      }
      if (value === null || value === undefined || String(value).trim() === "") {
        return [];
      }
      return [value];
    }

    function uniqueText(values) {
      const seen = new Set();
      return asArray(values)
        .map((value) => String(value || "").trim())
        .filter((value) => {
          const key = value.toLowerCase();
          if (!value || seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
    }

    function outcomeSourceLabel(item) {
      return String(
        item?.name
        || item?.outcome_label
        || item?.measure
        || item?.title
        || ""
      ).trim();
    }

    function sourceOutcomeLabels(items) {
      return uniqueText((Array.isArray(items) ? items : []).map(outcomeSourceLabel));
    }

    function sourceTagLabel(tag) {
      const labels = {
        abstract_derived: "Title/abstract",
        nct_derived: "NCT",
        fulltext_derived: "Full text",
      };
      return labels[tag] || String(tag || "").replaceAll("_", " ");
    }

    function sourceContributionByKey() {
      const summaries = Array.isArray(sourceContribution.source_summaries)
        ? sourceContribution.source_summaries
        : [];
      return summaries.reduce((acc, source) => {
        const key = String(source.source_key || "").trim();
        if (key) {
          acc[key] = source;
        }
        return acc;
      }, {});
    }

    function benchmarkLabel(mode) {
      return cochraneOutcomeBenchmarkLabel(mode);
    }

    function benchmarkKeyForMode(mode) {
      return cochraneOutcomeBenchmarkKey(mode);
    }

    function benchmarkOptions() {
      const outcomesByMode = benchmarkAlignment.cochrane_outcomes || {};
      const options = [{ value: "off", label: "Hide benchmark matches" }];
      const analyzedCount = Array.isArray(outcomesByMode.analyzed) ? outcomesByMode.analyzed.length : 0;
      if (analyzedCount) {
        options.push({ value: "cochrane_analyzed", label: `Show matches to Cochrane meta-analyses (${analyzedCount})` });
      }
      return options;
    }

    function benchmarkMode() {
      if (!currentEvaluationVisible) {
        return "off";
      }
      const options = benchmarkOptions().map((option) => option.value);
      return options.includes(currentOutcomeBenchmarkView) ? currentOutcomeBenchmarkView : "off";
    }

    function outcomeKey(role, index) {
      return role === "primary" ? "primary" : `secondary_${index}`;
    }

    function benchmarkMatchesForOutcome(key, activeMode) {
      return cochraneOutcomeMatchesForKey(benchmarkAlignment, key, activeMode);
    }

    function formatMatchScore(match) {
      return formatCochraneMatchScore(match);
    }

    function matchStrength(match) {
      return cochraneMatchStrength(match);
    }

    function strengthLabel(value) {
      return cochraneStrengthLabel(value);
    }

    function bestBenchmarkMatch(matches) {
      return bestCochraneBenchmarkMatch(matches);
    }

    function matchStrengthCounts(rows, benchmarkKey) {
      return (rows || []).reduce((acc, row) => {
        const match = bestBenchmarkMatch((row.matches || {})[benchmarkKey] || []);
        const strength = matchStrength(match);
        if (strength in acc) {
          acc[strength] += 1;
        }
        return acc;
      }, { strong: 0, moderate: 0, weak: 0 });
    }

    function matchDetail(matches) {
      return cochraneOutcomeMatchDetail(matches);
    }

    function benchmarkSummary(activeMode) {
      const benchmarkKey = benchmarkKeyForMode(activeMode);
      if (!benchmarkKey) {
        return "";
      }
      const rows = Array.isArray(benchmarkAlignment.agent_outcomes)
        ? benchmarkAlignment.agent_outcomes
        : [];
      const matchedAgentOutcomes = rows.filter((row) => {
        const matches = (row.matches || {})[benchmarkKey];
        return Array.isArray(matches) && matches.length;
      }).length;
      const totalAgentOutcomes = rows.length;
      const counts = matchStrengthCounts(rows, benchmarkKey);
      return `${matchedAgentOutcomes}/${totalAgentOutcomes} final outcomes have retained ${benchmarkLabel(activeMode).toLowerCase()} matches: ${counts.strong} strong, ${counts.moderate} moderate, ${counts.weak} weak/domain.`;
    }

    function outcomeCoverageMetric(benchmarkKey) {
      const counts = benchmarkAlignment.counts || {};
      const prefix = benchmarkKey === "planned" ? "cochrane_planned"
        : "cochrane_analyzed";
      const total = Number(counts[`${prefix}_outcomes`]);
      const matched = Number(counts[`${prefix}_outcomes_matched`]);
      const coverage = counts[`${prefix}_outcome_coverage`];
      if (!Number.isFinite(total) || total <= 0) {
        return null;
      }
      return {
        total,
        matched: Number.isFinite(matched) ? matched : 0,
        coverage,
      };
    }

    function renderOutcomeCoverageSummary() {
      if (!currentEvaluationVisible) {
        return "";
      }
      if (benchmarkAlignment.status !== "completed") {
        return "";
      }
      const analyzed = outcomeCoverageMetric("analyzed");
      const planned = outcomeCoverageMetric("planned");
      return renderEvaluationMetricGrid([
        analyzed && {
          label: "Cochrane analyzed outcomes created",
          value: formatPercent(analyzed.coverage),
          detail: `${number(analyzed.matched)} of ${number(analyzed.total)} analyzed Cochrane outcomes matched final agent outcomes`,
        },
        planned && {
          label: "Cochrane planned outcomes created",
          value: formatPercent(planned.coverage),
          detail: `${number(planned.matched)} of ${number(planned.total)} planned Cochrane outcomes matched final agent outcomes`,
        },
      ], "outcome-evaluation-grid");
    }

    function chips(values, className = "") {
      const labels = uniqueText(values);
      if (!labels.length) {
        return `<span class="outcome-empty">—</span>`;
      }
      return `
        <span class="outcome-chip-row ${className}">
          ${labels.map((value) => `<span class="outcome-chip">${escapeHtml(value)}</span>`).join("")}
        </span>
      `;
    }

    function compactLabelList(labels, maxItems = 8) {
      const values = uniqueText(labels);
      if (!values.length) {
        return "—";
      }
      const shown = values.slice(0, maxItems);
      const suffix = values.length > maxItems ? ` +${values.length - maxItems} more` : "";
      return `${shown.join("; ")}${suffix}`;
    }

    function sourceOutcomeList(labels) {
      const values = uniqueText(labels);
      if (!values.length) {
        return `<p class="outcome-source-empty">No outcomes discovered from this source.</p>`;
      }
      return `
        <ul class="outcome-source-label-list">
          ${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}
        </ul>
      `;
    }

    function sourceData() {
      const abstract = sourceInventory.abstract || {};
      const nct = sourceInventory.nct || {};
      const fulltext = sourceInventory.fulltext || {};

      return [
        {
          key: "abstract",
          classKey: "title-abstract",
          title: "Title/abstract study tables",
          subtitle: "Outcome labels projected from study tables for screened candidate studies.",
          outcomes: Array.isArray(abstract.outcomes) ? abstract.outcomes : [],
          counts: abstract.counts || {},
          inputLabel: "signals",
          inputCount: (abstract.counts || {}).n_raw_outcome_signals,
          sourceOutcomeCount: (abstract.counts || {}).n_merged_outcomes,
        },
        {
          key: "nct",
          classKey: "nct",
          title: "Exact Linked NCT Records",
          subtitle: "Protocol and posted-result endpoints from ClinicalTrials.gov records explicitly linked in PubMed abstracts.",
          outcomes: Array.isArray(nct.outcomes) ? nct.outcomes : [],
          counts: nct.counts || {},
          inputLabel: "signals",
          inputCount: (nct.counts || {}).n_raw_outcome_signals,
          sourceOutcomeCount: (nct.counts || {}).n_merged_outcomes,
        },
        {
          key: "fulltext",
          classKey: "fulltext",
          title: "Candidate-study full text",
          subtitle: "Outcome labels discovered from available PMC full text and merged into source-level concepts.",
          outcomes: Array.isArray(fulltext.outcomes) ? fulltext.outcomes : [],
          counts: fulltext.counts || {},
          inputLabel: "raw signals",
          inputCount: (fulltext.counts || {}).n_raw_outcome_signals,
          sourceOutcomeCount: (fulltext.counts || {}).n_merged_outcomes,
        },
      ];
    }

    function renderSourceCard(source) {
      const sourceSummary = sourceContributionByKey()[source.key] || {};
      const labels = sourceOutcomeLabels(source.outcomes);
      const counts = source.counts || {};
      const inputCount = source.inputCount ?? counts.n_raw_outcome_signals ?? counts.n_outcome_signals ?? source.outcomes.length;
      const sourceOutcomeCount = sourceSummary.source_outcome_count ?? source.sourceOutcomeCount ?? labels.length;
      const finalSupported = sourceSummary.final_outcomes_supported;
      const finalTotal = sourceSummary.final_outcomes_total;
      const uniqueSupported = sourceSummary.final_outcomes_unique_to_source;
      const analyzedMatched = sourceSummary.cochrane_analyzed_outcomes_matched;
      const analyzedTotal = sourceSummary.cochrane_analyzed_outcomes_total;
      const uniqueAnalyzed = sourceSummary.cochrane_analyzed_outcomes_unique_to_source;
      const plannedMatched = sourceSummary.cochrane_planned_outcomes_matched;
      const plannedTotal = sourceSummary.cochrane_planned_outcomes_total;
      const hasContribution = sourceContribution.status === "completed" && Object.keys(sourceSummary).length;
      const showBenchmarkContribution = currentEvaluationVisible && hasContribution;
      return `
        <details class="outcome-source-card outcome-source-${escapeHtml(source.classKey || source.key)}">
          <summary class="outcome-source-head">
            <div>
              <div class="insight-title">${escapeHtml(source.title)}</div>
              <p>${escapeHtml(source.subtitle)}</p>
            </div>
          </summary>
          <div class="outcome-source-body">
            <div class="outcome-source-stats">
              <div>
                <span class="stat-label">${escapeHtml(source.inputLabel)}</span>
                <strong>${number(inputCount)}</strong>
              </div>
              <div>
                <span class="stat-label">source outcomes</span>
                <strong>${number(sourceOutcomeCount)}</strong>
              </div>
              ${hasContribution ? `
                <div>
                  <span class="stat-label">matched final</span>
                  <strong>${number(finalSupported)}/${number(finalTotal)}</strong>
                </div>
                <div>
                  <span class="stat-label">unique final</span>
                  <strong>${number(uniqueSupported)}/${number(finalTotal)}</strong>
                </div>
                ${showBenchmarkContribution ? `
                <div>
                  <span class="stat-label">cochrane analyzed</span>
                  <strong>${number(analyzedMatched)}/${number(analyzedTotal)}</strong>
                </div>
                <div>
                  <span class="stat-label">unique cochrane</span>
                  <strong>${number(uniqueAnalyzed)}/${number(analyzedTotal)}</strong>
                </div>
                ` : ""}
              ` : ""}
            </div>
            ${hasContribution ? `
              <div class="outcome-source-contribution-note">
                Source-only final outcomes: ${compactLabelList((sourceSummary.unique_final_outcomes || []).map((item) => item.name), 4)}${showBenchmarkContribution ? `; source-only Cochrane analyzed: ${compactLabelList((sourceSummary.unique_cochrane_analyzed_matches || []).map((item) => item.label), 4)}; Cochrane planned in source: ${number(plannedMatched)}/${number(plannedTotal)}.` : "."}
              </div>
            ` : ""}
            <div class="outcome-source-labels">${sourceOutcomeList(labels)}</div>
          </div>
        </details>
      `;
    }

    function sourceSupportSummary(item) {
      const support = item?.source_support || {};
      if (!support || typeof support !== "object" || Array.isArray(support)) {
        return "";
      }
      const parts = [];
      const titlePmids = asArray(support.title_abstract?.pmids || support.title_abstract);
      const nctIds = asArray(support.nct_ids);
      const pmids = asArray(support.pmids || support.fulltext_pmids);
      if (titlePmids.length) {
        parts.push(`title/abstract PMIDs: ${compactLabelList(titlePmids, 4)}`);
      }
      if (nctIds.length) {
        parts.push(`NCT IDs: ${compactLabelList(nctIds, 4)}`);
      }
      if (pmids.length) {
        parts.push(`full-text/source PMIDs: ${compactLabelList(pmids, 4)}`);
      }
      return parts.join(" | ");
    }

    function renderBenchmarkControl() {
      if (!currentEvaluationVisible) {
        return "";
      }
      if (benchmarkAlignment.status !== "completed") {
        return "";
      }
      const options = benchmarkOptions();
      if (options.length <= 1) {
        return "";
      }
      const activeMode = benchmarkMode();
      return `
        <div class="outcome-benchmark-tools">
          <span class="outcome-benchmark-button">Evaluation Overlay</span>
          <label class="outcome-benchmark-control">
            <span>Compare final outcomes against</span>
            <select class="matrix-select" data-outcome-benchmark-view>
              ${options.map((option) => `
                <option value="${escapeHtml(option.value)}" ${option.value === activeMode ? "selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
          </label>
          ${activeMode !== "off" ? `<span class="outcome-benchmark-summary">${escapeHtml(benchmarkSummary(activeMode))}</span>` : ""}
        </div>
      `;
    }

    function renderOutcomeCard(title, item, role, index) {
      const key = outcomeKey(role, index);
      const activeMode = benchmarkMode();
      const benchmarkMatches = benchmarkMatchesForOutcome(key, activeMode);
      const isBenchmarkMatch = activeMode !== "off" && benchmarkMatches.length;
      const bestMatch = bestBenchmarkMatch(benchmarkMatches);
      const strength = matchStrength(bestMatch);
      const fields = [
        ["outcome type", item.outcome_type],
        ["outcome definition", item.outcome_definition],
        ["preferred timepoint", item.preferred_timepoint],
        ["preferred measure", Array.isArray(item.preferred_effect_measures) ? item.preferred_effect_measures.join(", ") : ""],
        [
          `${benchmarkLabel(activeMode)} match strength`,
          isBenchmarkMatch ? matchDetail(benchmarkMatches) : "",
        ],
        ["source support", sourceSupportSummary(item)],
        ["source note", item.source_note],
        ["notes", item.notes],
      ].filter(([, value]) => value !== undefined && String(value || "").trim() !== "");
      const outcomeName = String(item.name || title).trim();

      return `
        <details class="outcome-panel ${isBenchmarkMatch ? `is-cochrane-match is-cochrane-match-${escapeHtml(strength)}` : ""}">
          <summary class="outcome-panel-head" tabindex="-1">
            ${outcomePanelToggleButton()}
            <div>
              <div class="insight-title">${escapeHtml(title)}</div>
              <h4>
                ${sentence(outcomeName)}
                ${isBenchmarkMatch ? `<span class="cochrane-match-badge cochrane-match-badge-${escapeHtml(strength)}">${escapeHtml(`${strengthLabel(strength)} ${formatMatchScore(bestMatch)}`)}</span>` : ""}
              </h4>
              <div class="outcome-decision-sources">${chips((item.source_tags || []).map(sourceTagLabel), "outcome-source-chip-row")}</div>
            </div>
          </summary>
          ${Array.isArray(item.aliases) && item.aliases.length
            ? `<div class="outcome-aliases"><span class="artifact-field-key mono">aliases</span>${chips(item.aliases)}</div>`
            : ""
          }
          <div class="artifact-field-list">
            ${fields.map(([label, value]) => `
              <div class="artifact-field-row">
                <div class="artifact-field-key mono">${escapeHtml(label)}</div>
                <div class="artifact-field-value">${sentence(value || "—")}</div>
              </div>
            `).join("")}
          </div>
        </details>
      `;
    }

    if (!primary.name && !secondary.length) {
      return `
        <div class="detail-card" id="outcomes" style="margin-top:14px;">
          <h3>Outcomes</h3>
          <p class="note">No outcomes artifact was saved for this run${status ? ` (${escapeHtml(status)})` : ""}.</p>
        </div>
      `;
    }

    return `
      <div class="detail-card outcome-decision-section" id="outcomes" style="margin-top:14px;">
        <h3>Outcomes</h3>
        <p class="note">The final outcome list is a merge decision across three post-screening evidence sources, rather than only the initial PICO outcome of ${sentence(initialOutcome || "Not specified")}.</p>
        <div class="outcome-merge-flow" aria-label="Outcome source merge">
          <div class="outcome-source-grid">
            ${sourceData().map(renderSourceCard).join("")}
          </div>
          <div class="outcome-merge-connector" aria-label="Merge outcome source signals into final outcomes">
            <span class="outcome-merge-line" aria-hidden="true"></span>
            <span class="outcome-merge-step">Merge, deduplicate, canonicalize</span>
            <span class="outcome-merge-arrow" aria-hidden="true"></span>
          </div>
          <div class="outcome-final-decision">
            <div class="outcome-final-head">
              <div>
                <div class="insight-title">Final Outcome Decision</div>
                <p>Canonical outcomes selected for extraction and synthesis after deduplicating aliases, preserving source support, and keeping clinically important component endpoints separate from composites.</p>
              </div>
              <div class="outcome-final-count mono">${number((primary.name ? 1 : 0) + secondary.length)}</div>
            </div>
            ${renderOutcomeCoverageSummary()}
            <div class="outcome-panel-list outcome-final-grid">
              ${primary.name ? renderOutcomeCard("Primary Outcome", primary, "primary", 0) : ""}
              ${secondary.map((item, index) => renderOutcomeCard(`Secondary Outcome ${index + 1}`, item, "secondary", index + 1)).join("")}
            </div>
            ${renderBenchmarkControl()}
          </div>
        </div>
      </div>
    `;
  }

  function subgroupPlanSection(subgroupPlanArtifact, studyLevelSubgroupValues = []) {
    const artifact = subgroupPlanArtifact || {};
    const dimensions = Array.isArray(artifact.subgroup_dimensions)
      ? artifact.subgroup_dimensions.filter(Boolean)
      : [];
    const invalidDimensions = Array.isArray(artifact.invalid_subgroup_dimensions)
      ? artifact.invalid_subgroup_dimensions.filter(Boolean)
      : [];
    const warnings = Array.isArray(artifact.warnings)
      ? artifact.warnings.filter((item) => String(item || "").trim())
      : [];
    const studyLevelRows = Array.isArray(studyLevelSubgroupValues)
      ? studyLevelSubgroupValues.filter(Boolean)
      : [];
    const status = artifact.status || "";

    if (!dimensions.length && !invalidDimensions.length) {
      if (!Object.keys(artifact).length) {
        return "";
      }
      return `
        <details class="detail-card subgroup-plan-section" id="subgroup-plan" style="margin-top:14px;">
          <summary class="collapsible-table-summary subgroup-plan-summary">
            <span>
              <h3>Subgroups <span class="inline-section-count">(x 0)</span></h3>
              <span class="summary-description">Planned study/result factors that may be used for subgroup analyses.</span>
            </span>
          </summary>
          <p class="note">No subgroup dimensions were saved for this run${status ? ` (${escapeHtml(status)})` : ""}.</p>
        </details>
      `;
    }

    function normalizedSubgroupSourceLevel(dimension) {
      const direct = String(dimension?.source_level || "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
      if (["study", "study_level", "study_table"].includes(direct)) {
        return "study_level";
      }
      if (["result", "result_level", "outcome", "outcome_level"].includes(direct)) {
        return "result_level";
      }
      const rawSource = dimension?.source_levels || dimension?.scope;
      const raw = Array.isArray(rawSource) ? rawSource : rawSource ? [rawSource] : [];
      const levels = [];
      raw.forEach((value) => {
        const normalized = String(value || "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
        if (["study", "study_level", "study_table"].includes(normalized)) {
          if (!levels.includes("study_level")) {
            levels.push("study_level");
          }
        } else if (["result", "result_level", "outcome", "outcome_level"].includes(normalized)) {
          if (!levels.includes("result_level")) {
            levels.push("result_level");
          }
        }
      });
      return levels.length === 1 ? levels[0] : "";
    }

    function subgroupScopeLabel(level) {
      if (level === "study_level") {
        return "Study-level";
      }
      if (level === "result_level") {
        return "Result-level";
      }
      return humanizeMetric(level || "Scope");
    }

    function renderScopeChip(dimension) {
      const level = normalizedSubgroupSourceLevel(dimension);
      if (!level) {
        return "";
      }
      return `
        <div class="subgroup-scope-list">
          <span class="subgroup-scope-chip subgroup-scope-${escapeHtml(level)}">${escapeHtml(subgroupScopeLabel(level))}</span>
        </div>
      `;
    }

    function renderCategory(category) {
      const value = String(category.value || "").trim();
      const label = String(category.label || "").trim();
      return `
        <span class="subgroup-category-chip">
          ${escapeHtml(label || value || "Unlabeled")}
        </span>
      `;
    }

    function studyLevelSubgroupFields(rows) {
      const excluded = new Set(["pmid", "study_label", "year"]);
      const fields = [];
      const seen = new Set();
      rows.forEach((row) => {
        Object.entries(row || {}).forEach(([key, value]) => {
          if (excluded.has(key) || seen.has(key) || !String(value || "").trim()) {
            return;
          }
          seen.add(key);
          fields.push(key);
        });
      });
      return fields;
    }

    function renderStudyLevelSubgroupValues(rows) {
      const fields = studyLevelSubgroupFields(rows);
      if (!rows.length || !fields.length) {
        return "";
      }
      return `
        <details class="collapsible-table-panel subgroup-study-values-panel">
          <summary class="collapsible-table-summary">
            <h4>Study-level subgroup values (${number(rows.length)})</h4>
          </summary>
          <div class="table-wrap screening-wrap">
            <table class="screening-table subgroup-study-values-table study-sticky-table">
              <thead>
                <tr>
                  <th class="screen-col-index">#</th>
                  <th class="screen-col-study">Study</th>
                  ${fields.map((field) => `<th class="mono">${escapeHtml(field)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${rows.map((row, index) => `
                  <tr>
                    <td class="screen-col-index mono">${index + 1}</td>
                    <td class="screen-col-study">${compactStudyCell(row)}</td>
                    ${fields.map((field) => `<td class="mono">${escapeHtml(row?.[field] || "—")}</td>`).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </details>
      `;
    }

    function renderOutcomeScope(dimension) {
      const level = normalizedSubgroupSourceLevel(dimension);
      const outcomeNames = Array.isArray(dimension.outcome_names)
        ? dimension.outcome_names.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      if (level !== "result_level" || !outcomeNames.length) {
        return "";
      }
      return `
        <div class="subgroup-outcome-scope">
          <div class="artifact-field-key mono">Relevant outcomes</div>
          <div class="subgroup-outcome-list">
            ${outcomeNames.map((name) => `<span class="subgroup-outcome-chip">${escapeHtml(name)}</span>`).join("")}
          </div>
        </div>
      `;
    }

    function renderInvalidSubgroupWarnings() {
      if (!warnings.length && !invalidDimensions.length) {
        return "";
      }
      const rows = invalidDimensions.map((dimension) => {
        const label = String(dimension.label || dimension.field_name || "Unlabeled factor").trim();
        const reason = String(dimension.reason || "Invalid subgroup source level.").trim();
        return `<li><span class="mono">${escapeHtml(label)}</span>: ${escapeHtml(reason)}</li>`;
      });
      return `
        <details class="subgroup-invalid-panel">
          <summary class="collapsible-table-summary">
            <h4>Invalid subgroup factors (${number(invalidDimensions.length || warnings.length)})</h4>
          </summary>
          ${rows.length
            ? `<ul>${rows.join("")}</ul>`
            : `<p class="note">${escapeHtml(warnings.join(" "))}</p>`
          }
        </details>
      `;
    }

    function renderDimension(dimension, index) {
      const label = String(dimension.label || dimension.field_name || `Subgroup ${index + 1}`).trim();
      const categories = Array.isArray(dimension.categories) ? dimension.categories.filter(Boolean) : [];
      const fields = [
        ["Description", dimension.description],
        ["Why add this", dimension.reason],
      ].filter(([, value]) => value !== undefined && value !== "");

      return `
        <div class="outcome-panel subgroup-plan-panel">
          <div class="outcome-panel-head subgroup-plan-head">
            <div>
              <h4>${number(index + 1)}. ${sentence(label)}</h4>
              ${renderScopeChip(dimension)}
            </div>
          </div>
          ${categories.length
            ? `
              <div class="subgroup-category-block">
                <div class="subgroup-category-list">
                  ${categories.map(renderCategory).join("")}
                </div>
              </div>
            `
            : ""
          }
          ${renderOutcomeScope(dimension)}
          ${fields.length
            ? `
              <div class="subgroup-detail-panel">
                <div class="artifact-field-list">
                  ${fields.map(([fieldLabel, value]) => `
                    <div class="artifact-field-row">
                      <div class="artifact-field-key mono">${escapeHtml(fieldLabel)}</div>
                      <div class="artifact-field-value">${sentence(value || "—")}</div>
                    </div>
                  `).join("")}
                </div>
              </div>
            `
            : ""
          }
        </div>
      `;
    }

    return `
      <details class="detail-card subgroup-plan-section" id="subgroup-plan" style="margin-top:14px;">
        <summary class="collapsible-table-summary subgroup-plan-summary">
          <span>
            <h3>Heterogeneity Factors <span class="inline-section-count">(x ${number(dimensions.length)})</span></h3>
            <span class="summary-description">Planned study/result factors that may be used for subgroup analyses.</span>
          </span>
        </summary>
        <p class="note">These study-level and result-level factors are planned from study tables. Synthesis uses a factor only when extracted data support an analyzable subset.</p>
        <div class="outcome-panel-list subgroup-plan-list">
          ${dimensions.map(renderDimension).join("")}
        </div>
        ${renderInvalidSubgroupWarnings()}
        ${renderStudyLevelSubgroupValues(studyLevelRows)}
      </details>
    `;
  }

  function studyArmsSection(studyArmsArtifact, options = {}) {
    const artifact = studyArmsArtifact || {};
    const allStudies = Array.isArray(artifact.studies) ? artifact.studies.filter(Boolean) : [];
    if (!allStudies.length && !Object.keys(artifact).length) {
      return "";
    }
    const counts = artifact.counts || {};

    function armList(values) {
      const items = uniqueTextList(values);
      if (!items.length) {
        return `<span class="muted">—</span>`;
      }
      if (items.length === 1) {
        return `<span class="study-arm-single">${sentence(items[0])}</span>`;
      }
      return `
        <ul class="study-arm-list study-arm-list-multi">
          ${items.map((value) => `<li>${sentence(value)}</li>`).join("")}
        </ul>
      `;
    }

    function compactArmDetails(study) {
      const arms = Array.isArray(study.study_arms) ? study.study_arms.filter(Boolean) : [];
      const labels = arms
        .map((arm) => [arm.arm_label, arm.description].filter(Boolean).join(": "))
        .filter(Boolean);
      return labels.length ? labels : [];
    }

    function hasArmContent(study) {
      return Boolean(
        uniqueTextList(study.intervention_arms).length
        || uniqueTextList(study.comparator_arms).length
        || uniqueTextList(study.extra_or_irrelevant_arms).length
        || compactArmDetails(study).length
        || cleanText(study.multi_arm_handling_note)
      );
    }

    const studies = allStudies.filter(hasArmContent);
    const omittedStudies = allStudies.filter((study) => !hasArmContent(study));

    function omittedStudiesBlock() {
      if (!omittedStudies.length) {
        return "";
      }
      return `
        <details class="study-arms-omitted">
          <summary>
            <span>Studies without mapped arm details <span class="inline-section-count">(x ${number(omittedStudies.length)})</span></span>
          </summary>
          <p class="note">No intervention, comparator, extra arm, or study-arm detail was saved in study_arms.json.</p>
          <div class="table-wrap screening-wrap study-arms-omitted-wrap">
            <table class="screening-table extraction-study-summary-table study-sticky-table">
              <thead>
                <tr>
                  <th class="screen-col-index">#</th>
                  <th class="screen-col-study">Study</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                ${omittedStudies.map((study, index) => `
                  <tr>
                    <td class="screen-col-index mono">${index + 1}</td>
                    <td class="screen-col-study">${compactStudyCell(study)}</td>
                    <td class="study-arm-omitted-reason">No mapped arm detail saved.</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </details>
      `;
    }

    return `
      <details class="${options.embedded ? "study-arms-section comparison-subsection" : "detail-card study-arms-section"}"${options.embedded ? "" : ` id="study-arms"`} style="margin-top:14px;">
        <summary class="collapsible-table-summary study-arms-summary">
          <h3>${escapeHtml(options.title || "Study arms")} <span class="inline-section-count">(x ${number(studies.length)})</span></h3>
        </summary>
        <p class="note">${options.embedded ? "Per-study intervention and comparator arms projected from saved study tables." : "Intervention and comparator arms are projected from saved study tables for candidates not excluded by full-text screening."}</p>
        ${studies.length
          ? `
            <div class="table-wrap screening-wrap study-arms-table-wrap">
              <table class="screening-table study-arms-table study-sticky-table">
                <thead>
                  <tr>
                    <th class="screen-col-index">#</th>
                    <th class="screen-col-study">Study</th>
                    <th>Intervention arms</th>
                    <th>Comparator arms</th>
                    <th>Extra arms / handling note</th>
                  </tr>
                </thead>
                <tbody>
                  ${studies.map((study, index) => {
                    const extraArms = uniqueTextList(study.extra_or_irrelevant_arms);
                    const handlingNote = cleanText(study.multi_arm_handling_note);
                    const fallbackArms = !uniqueTextList(study.intervention_arms).length && !uniqueTextList(study.comparator_arms).length
                      ? compactArmDetails(study)
                      : [];
                    return `
                      <tr>
                        <td class="screen-col-index mono">${index + 1}</td>
                        <td class="screen-col-study">${compactStudyCell(study)}</td>
                        <td>${armList(study.intervention_arms)}</td>
                        <td>${armList(study.comparator_arms)}</td>
                        <td class="study-arms-extra-col">
                          ${extraArms.length ? armList(extraArms) : ""}
                          ${fallbackArms.length ? `<div class="study-arm-fallback"><span class="stat-label">Study arms</span>${armList(fallbackArms)}</div>` : ""}
                          ${handlingNote ? `<p class="study-arm-note">${sentence(handlingNote)}</p>` : (!extraArms.length && !fallbackArms.length ? `<span class="muted">—</span>` : "")}
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `
          : `<p class="note">No study-arm rows were saved for this run.</p>`
        }
        ${omittedStudiesBlock()}
      </details>
    `;
  }

  function comparisonSection(comparisonArtifact, pico, cochraneComparisonAlignment = {}, studyArmsArtifact = {}) {
    const artifact = comparisonArtifact || {};
    const comparison = artifact.comparison || {};
    const comparisonAlignment = cochraneComparisonAlignment || {};
    const mappedStudyArms = studyArmsSection(studyArmsArtifact, { embedded: true, title: "Study arms by publication" });
    const initialComparison = String((pico || {}).comparison || "").trim();
    const placeholderValues = new Set([
      "n/a",
      "na",
      "none",
      "not applicable",
      "not specified",
      "no comparison",
      "no comparator",
      "no comparator specified",
      "target comparison",
    ]);
    const hasMeaningfulValue = (value) => {
      const text = String(value || "").trim();
      return Boolean(text) && !placeholderValues.has(text.toLowerCase());
    };

    const fields = [
      ["Comparison description", comparison.comparison_description],
      ["Arm 1 role", comparison.arm_1_role],
      ["Arm 2 role", comparison.arm_2_role],
      ["Notes", comparison.notes],
    ].filter(([, value]) => hasMeaningfulValue(value));
    const comparisonLabel = hasMeaningfulValue(comparison.comparison_label)
      ? String(comparison.comparison_label).trim()
      : "";

    function comparisonScore(value) {
      const score = Number(value);
      return Number.isFinite(score) ? score : 0;
    }

    function formatComparisonScore(value) {
      const score = comparisonScore(value);
      return score ? score.toFixed(2) : "—";
    }

    function strengthLabel(value) {
      const labels = {
        strong: "Strong",
        moderate: "Moderate",
        weak: "Weak/domain",
      };
      return labels[String(value || "").toLowerCase()] || "No retained match";
    }

    function renderComparisonEvaluation() {
      if (!currentEvaluationVisible) {
        return "";
      }
      if (comparisonAlignment.status !== "completed") {
        return "";
      }
      const best = comparisonAlignment.best_match || {};
      if (!Object.keys(best).length) {
        return `
          <div class="comparison-evaluation-panel">
            <div class="insight-title">Evaluation Overlay</div>
            <p class="note">No retained match was found against local Cochrane analysis comparison labels.</p>
          </div>
        `;
      }
      const counts = comparisonAlignment.counts || {};
      const detailRows = [
        ["Cochrane comparison", best.cochrane_label_clean || best.cochrane_label],
        ["Match strength", `${strengthLabel(best.match_strength)} ${formatComparisonScore(best.score)}`],
        ["Label score", `${formatComparisonScore(best.label_score)} (${best.label_reason || "label similarity"})`],
        ["Arm score", `${formatComparisonScore(best.arm_average_score)} (${best.orientation === "swapped" ? "swapped arm order" : "same arm order"})`],
        ["Cochrane analysis comparisons", counts.cochrane_analysis_comparisons],
      ].filter(([, value]) => value !== undefined && String(value || "").trim() !== "");
      return `
        <div class="comparison-evaluation-panel">
          <div class="comparison-evaluation-head">
            <div>
              <div class="insight-title">Evaluation Overlay</div>
              <p class="note">Saved comparison alignment against local Cochrane meta-analysis comparison labels. This is evaluation-only and was not used by the agent.</p>
            </div>
            <span class="cochrane-match-badge">${escapeHtml(`${strengthLabel(best.match_strength)} ${formatComparisonScore(best.score)}`)}</span>
          </div>
          <div class="artifact-field-list comparison-evaluation-details">
            ${detailRows.map(([label, value]) => `
              <div class="artifact-field-row">
                <div class="artifact-field-key">${escapeHtml(label)}</div>
                <div class="artifact-field-value">${sentence(value || "—")}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    if (!comparisonLabel && !fields.length && !mappedStudyArms) {
      return "";
    }

    return `
      <div class="detail-card" id="comparison" style="margin-top:14px;">
        <h3>Comparison</h3>
        <p class="note">Study arms are mapped from each included study first. The agent then summarizes those mapped arms into a review-level comparison used for extraction and synthesis.</p>
        ${mappedStudyArms}
        ${comparisonLabel || fields.length
          ? `
            <div class="outcome-panel-list">
              <div class="outcome-panel comparison-panel">
                <div class="outcome-panel-head comparison-panel-head">
                  <div>
                    <div class="insight-title">Comparison Decision</div>
                    <h4>${sentence(comparisonLabel || "Target comparison")}</h4>
                    <p class="note">Review-level comparison framing inferred from the mapped arms and original PICO.</p>
                  </div>
                </div>
                ${fields.length
                  ? `
                    <div class="artifact-field-list comparison-detail-panel">
                      ${fields.map(([label, value]) => `
                        <div class="artifact-field-row">
                          <div class="artifact-field-key">${escapeHtml(label)}</div>
                          <div class="artifact-field-value">${sentence(value || "—")}</div>
                        </div>
                      `).join("")}
                    </div>
                  `
                  : `<p class="note">No additional comparison details were generated for this run.</p>`
                }
                ${renderComparisonEvaluation()}
              </div>
            </div>
          `
          : `<p class="note">No comparison decision artifact was generated for this run.</p>`
        }
      </div>
    `;
  }

  function extractionTemplateTable(extractionTemplate) {
    const reviewTargets = Object.entries(extractionTemplate.review_targets || {});
    const studyDataFields = Object.entries(extractionTemplate.study_data_fields || {});

    if (!reviewTargets.length && !studyDataFields.length) {
      return `<p class="note extraction-template-wrap">No extraction fields were generated for this run.</p>`;
    }

    function renderFieldList(title, fields) {
      if (!fields.length) {
        return "";
      }
      return `
        <div class="extraction-template-group">
          <div class="extraction-template-group-title">${escapeHtml(title)}</div>
          <ul class="extraction-template-list">
            ${fields.map(([field, guidance]) => `
              <li class="extraction-template-item">
                <div class="extraction-template-field mono">${escapeHtml(field)}</div>
                <div class="extraction-template-guidance">${sentence(guidance || "No guidance provided.")}</div>
              </li>
            `).join("")}
          </ul>
        </div>
      `;
    }

    return `
      <div class="extraction-template-wrap">
        ${renderFieldList("Review Targets", reviewTargets)}
        ${renderFieldList("Study Data Fields", studyDataFields)}
      </div>
    `;
  }

  function extractionTemplateForOutcomeTable(table, templateSet) {
    const role = String(table?.role || "").trim().toLowerCase();
    if (role === "primary") {
      return (templateSet || {}).primary_template || {};
    }
    if (role === "secondary") {
      const index = Number(table?.index);
      const secondaryTemplates = Array.isArray((templateSet || {}).secondary_templates)
        ? templateSet.secondary_templates
        : [];
      return index > 0 ? secondaryTemplates[index - 1] || {} : {};
    }
    return {};
  }

  function sourceLabel(value) {
    const key = String(value || "").trim();
    const labels = {
      full_text: "Full text",
      full_text_supplement: "Full text + supplement",
      full_text_multimodal: "Full text + images",
      abstract_nct: "Abstract + NCT",
      abstract: "Abstract",
    };
    return labels[key] || key || "—";
  }

  function extractionOutcomeKey(table, tableIndex = 0) {
    const role = String(table?.role || "").trim().toLowerCase();
    const index = Number(table?.index);
    if (role === "primary") {
      return "primary";
    }
    if (role === "secondary" && Number.isFinite(index) && index > 0) {
      return `secondary_${index}`;
    }
    return String(table?.key || role || `outcome_${tableIndex}`).trim();
  }

  function extractionTargetKey(outcomeKey, pmid) {
    return `${outcomeKey}:${pmid}`;
  }

  function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function parseLooseObjectValue(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    const text = String(value || "").trim();
    if (!text.startsWith("{") || !text.endsWith("}")) {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (_error) {
      const entries = [];
      const pattern = /['"]([^'"]+)['"]\s*:\s*(['"])(.*?)\2/g;
      let match = pattern.exec(text);
      while (match) {
        entries.push([match[1], match[3]]);
        match = pattern.exec(text);
      }
      return entries.length ? Object.fromEntries(entries) : null;
    }
  }

  function parseLooseArrayValue(value) {
    if (Array.isArray(value)) {
      return value;
    }
    const text = String(value || "").trim();
    if (!text.startsWith("[") || !text.endsWith("]")) {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_error) {
      const objects = [];
      const objectPattern = /\{[^{}]*\}/g;
      let match = objectPattern.exec(text);
      while (match) {
        const parsedObject = parseLooseObjectValue(match[0]);
        if (parsedObject) {
          objects.push(parsedObject);
        }
        match = objectPattern.exec(text);
      }
      return objects.length ? objects : null;
    }
  }

  function orderedObjectEntries(value, preferredOrder = []) {
    const objectValue = parseLooseObjectValue(value);
    if (!objectValue) {
      return [];
    }
    const keys = Object.keys(objectValue);
    const orderedKeys = [
      ...preferredOrder.filter((field) => keys.includes(field)),
      ...keys.filter((field) => !preferredOrder.includes(field)),
    ];
    return orderedKeys.map((field) => [field, objectValue[field]]);
  }

  function parseFieldEvidence(row) {
    const raw = row?.field_evidence_json;
    if (!hasValue(raw)) {
      return {};
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw;
    }
    try {
      const parsed = JSON.parse(String(raw));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function evidenceText(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
    }
    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value || "").trim();
  }

  function fieldEvidenceTooltip(field, evidenceByField) {
    const evidence = evidenceByField?.[field];
    if (!evidence) {
      return "";
    }
    if (typeof evidence !== "object" || Array.isArray(evidence)) {
      const text = evidenceText(evidence);
      return text ? `${field}\nEvidence: ${text}` : "";
    }

    const source = evidenceText(evidence.source);
    const quote = evidenceText(evidence.evidence);
    const visualAssets = evidenceText(evidence.visual_asset_ids);
    const notes = evidenceText(evidence.notes);
    const lines = [
      source ? `Source: ${source}` : "",
      quote ? `Evidence: ${quote}` : "",
      visualAssets ? `Visual asset(s): ${visualAssets}` : "",
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean);
    return lines.length ? `${field}\n${lines.join("\n")}` : "";
  }

  function sourceTraceEvidenceCandidates(evidence) {
    const candidates = [];
    const addCandidate = (value) => {
      if (Array.isArray(value)) {
        value.forEach(addCandidate);
        return;
      }
      const text = cleanText(value);
      if (text && !candidates.includes(text)) {
        candidates.push(text);
      }
    };
    if (evidence && typeof evidence === "object" && !Array.isArray(evidence)) {
      ["evidence", "quote", "evidence_text", "text"].forEach((key) => addCandidate(evidence[key]));
    } else {
      addCandidate(evidence);
    }
    return candidates;
  }

  function sourceTraceRowEvidenceCandidates(row) {
    const evidenceByField = parseFieldEvidence(row);
    const candidates = [];
    Object.values(evidenceByField || {}).forEach((evidence) => {
      if (!isAbstractSourceEvidence(row, evidence)) {
        return;
      }
      sourceTraceEvidenceCandidates(evidence).forEach((candidate) => {
        if (candidate && !candidates.includes(candidate)) {
          candidates.push(candidate);
        }
      });
    });
    return candidates;
  }

  function isAbstractSourceEvidence(row, evidence) {
    const source = cleanText(evidence?.source).toLowerCase();
    const textSource = cleanText(row?.extraction_text_source).toLowerCase();
    if (source.includes("abstract")) {
      return true;
    }
    return textSource === "abstract" && !source.includes("nct") && !source.includes("full");
  }

  function isAbstractSourceTraceCell(row, evidence) {
    return isAbstractSourceEvidence(row, evidence)
      && sourceTraceEvidenceCandidates(evidence).length > 0;
  }

  function currentPerStudyMetadataByPmid(pmid) {
    const current = findRun(currentRunId);
    const target = String(pmid || "").trim();
    if (!target) {
      return {};
    }
    const entry = (current?.per_study_outputs || []).find((item) => {
      const entryPmid = String(item?.pmid || item?.metadata?.pmid || "").trim();
      return entryPmid === target;
    });
    return entry?.metadata || {};
  }

  function currentExtractionRowForCell(cell) {
    const rowNode = cell?.closest("[data-extraction-row]");
    const pmid = rowNode?.getAttribute("data-extraction-pmid") || "";
    const outcomeKey = rowNode?.getAttribute("data-extraction-outcome-key") || "";
    const field = cell?.getAttribute("data-extraction-field") || "";
    if (!pmid || !outcomeKey || !field) {
      return {};
    }
    const current = findRun(currentRunId);
    const tables = Array.isArray(current?.outcome_extraction_tables)
      ? current.outcome_extraction_tables
      : [];
    for (const [tableIndex, table] of tables.entries()) {
      if (extractionOutcomeKey(table, tableIndex) !== outcomeKey) {
        continue;
      }
      const row = (table.extractable_rows || []).find((item) => String(item?.pmid || "").trim() === pmid);
      if (row) {
        return { row, field, table };
      }
    }
    return {};
  }

  function sourceTracePayloadForCell(cell) {
    const { row, field, table } = currentExtractionRowForCell(cell);
    if (!row || !field) {
      return null;
    }
    const evidence = parseFieldEvidence(row)?.[field];
    if (!isAbstractSourceTraceCell(row, evidence)) {
      return null;
    }
    const metadata = currentPerStudyMetadataByPmid(row.pmid);
    const pubInfo = extractionPubInfoParts({ ...row, metadata });
    return {
      row,
      field,
      value: row[field],
      evidence,
      evidenceCandidates: sourceTraceEvidenceCandidates(evidence),
      allEvidenceCandidates: sourceTraceRowEvidenceCandidates(row),
      abstract: cleanText(metadata.abstract),
      pmid: cleanText(row.pmid || metadata.pmid),
      pubInfo,
      outcomeName: cleanText(table?.outcome_name || table?.label || "Outcome"),
    };
  }

  function highlightedSourceText(sourceText, evidenceCandidates, { all = false } = {}) {
    const text = String(sourceText || "");
    const candidates = (evidenceCandidates || [])
      .map((candidate) => cleanText(candidate))
      .filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);
    if (!all) {
      for (const candidate of candidates) {
        const index = text.indexOf(candidate);
        if (index < 0) {
          continue;
        }
        return {
          matched: true,
          matchedCount: 1,
          totalCandidates: candidates.length,
          html: [
            escapeHtml(text.slice(0, index)),
            `<mark class="source-trace-highlight">${escapeHtml(candidate)}</mark>`,
            escapeHtml(text.slice(index + candidate.length)),
          ].join(""),
        };
      }
      return { matched: false, matchedCount: 0, totalCandidates: candidates.length, html: escapeHtml(text) };
    }

    const ranges = [];
    const matchedCandidates = new Set();
    candidates
      .slice()
      .sort((a, b) => b.length - a.length)
      .forEach((candidate) => {
        let start = 0;
        while (start < text.length) {
          const index = text.indexOf(candidate, start);
          if (index < 0) {
            break;
          }
          const end = index + candidate.length;
          const overlaps = ranges.some((range) => index < range.end && end > range.start);
          if (!overlaps) {
            ranges.push({ start: index, end, text: candidate });
            matchedCandidates.add(candidate);
          }
          start = end;
        }
      });

    if (!ranges.length) {
      return { matched: false, matchedCount: 0, totalCandidates: candidates.length, html: escapeHtml(text) };
    }

    ranges.sort((a, b) => a.start - b.start);
    const pieces = [];
    let cursor = 0;
    ranges.forEach((range) => {
      pieces.push(escapeHtml(text.slice(cursor, range.start)));
      pieces.push(`<mark class="source-trace-highlight">${escapeHtml(text.slice(range.start, range.end))}</mark>`);
      cursor = range.end;
    });
    pieces.push(escapeHtml(text.slice(cursor)));
    return {
      matched: true,
      matchedCount: matchedCandidates.size,
      totalCandidates: candidates.length,
      html: pieces.join(""),
    };
  }

  function hasExtraSourceTraceEvidence(payload) {
    const clicked = new Set(payload?.evidenceCandidates || []);
    const all = payload?.allEvidenceCandidates || [];
    return all.some((candidate) => !clicked.has(candidate)) || all.length > 1;
  }

  function sourceTraceWarningHtml(payload, highlighted, showAllEvidence) {
    if (!payload.abstract) {
      return `<p class="source-trace-warning">No abstract text was saved for this study.</p>`;
    }
    if (!highlighted.matched) {
      return `<p class="source-trace-warning">Exact source highlight not found.</p>`;
    }
    if (showAllEvidence && highlighted.matchedCount < highlighted.totalCandidates) {
      return `<p class="source-trace-warning">Some evidence snippets were not found exactly in the source text.</p>`;
    }
    return "";
  }

  function sourceTraceToggleButton(showAllEvidence) {
    return `
      <button class="source-trace-toggle" type="button" data-source-trace-toggle-all aria-pressed="${showAllEvidence ? "true" : "false"}">
        ${showAllEvidence ? "Show clicked field only" : "Highlight all evidence"}
      </button>
    `;
  }

  function sourceTraceBodyHtml(payload, showAllEvidence) {
    const candidates = showAllEvidence ? payload.allEvidenceCandidates : payload.evidenceCandidates;
    const highlighted = payload.abstract
      ? highlightedSourceText(payload.abstract, candidates, { all: showAllEvidence })
      : { matched: false, matchedCount: 0, totalCandidates: candidates.length, html: "" };
    return `
      ${sourceTraceWarningHtml(payload, highlighted, showAllEvidence)}
      ${payload.abstract ? `
        <div class="source-trace-source">
          <h4>PubMed abstract</h4>
          <div class="source-trace-text">${highlighted.html}</div>
        </div>
      ` : ""}
    `;
  }

  function bindSourceTraceToggle(actionsNode, bodyNode, payload, showAllEvidence) {
    actionsNode.innerHTML = payload.abstract && hasExtraSourceTraceEvidence(payload)
      ? sourceTraceToggleButton(showAllEvidence)
      : "";
    actionsNode.querySelector("[data-source-trace-toggle-all]")?.addEventListener("click", () => {
      renderSourceTraceContent(actionsNode, bodyNode, payload, !showAllEvidence);
    });
  }

  function renderSourceTraceContent(actionsNode, bodyNode, payload, showAllEvidence = false) {
    if (!actionsNode || !bodyNode || !payload) {
      return;
    }
    bindSourceTraceToggle(actionsNode, bodyNode, payload, showAllEvidence);
    bodyNode.innerHTML = sourceTraceBodyHtml(payload, showAllEvidence);
  }

  function sourceTraceDrawer() {
    return `
      <aside class="source-trace-drawer" data-source-trace-drawer hidden aria-live="polite" aria-label="Extracted source detail">
        <div class="source-trace-head">
          <div class="source-trace-head-main">
            <div class="source-trace-study" data-source-trace-study></div>
            <div class="source-trace-actions" data-source-trace-actions></div>
          </div>
          <button class="source-trace-close" type="button" data-source-trace-close aria-label="Close source trace">×</button>
        </div>
        <div class="source-trace-body" data-source-trace-body></div>
      </aside>
    `;
  }

  function openSourceTraceDrawer(payload) {
    const drawer = app.querySelector("[data-source-trace-drawer]");
    const studyNode = drawer?.querySelector("[data-source-trace-study]");
    const actionsNode = drawer?.querySelector("[data-source-trace-actions]");
    const bodyNode = drawer?.querySelector("[data-source-trace-body]");
    if (!drawer || !studyNode || !actionsNode || !bodyNode || !payload) {
      return;
    }
    studyNode.innerHTML = `
      <div class="screen-study-primary">${escapeHtml(payload.pubInfo.authorYear || payload.pmid || "Study")}</div>
      ${payload.pubInfo.journal ? `<div class="screen-study-journal">${escapeHtml(payload.pubInfo.journal)}</div>` : ""}
      ${payload.pmid ? `<div class="screen-study-title">PMID ${escapeHtml(payload.pmid)}</div>` : ""}
    `;
    renderSourceTraceContent(actionsNode, bodyNode, payload, false);
    drawer.hidden = false;
    drawer.classList.add("is-open");
    document.body.classList.add("source-trace-open");
  }

  function closeSourceTraceDrawer() {
    const drawer = app.querySelector("[data-source-trace-drawer]");
    if (!drawer) {
      return;
    }
    drawer.classList.remove("is-open");
    drawer.hidden = true;
    document.body.classList.remove("source-trace-open");
  }

  function extractionStudyGroupsFromTables(tables) {
    const allStudies = new Map();
    const extractablePmids = new Set();
    const extractableOutcomesByPmid = new Map();

    (Array.isArray(tables) ? tables : []).forEach((table) => {
      const extractableRows = Array.isArray(table.extractable_rows) ? table.extractable_rows : [];
      const nonExtractableRows = Array.isArray(table.non_extractable_rows) ? table.non_extractable_rows : [];
      const outcomeName = cleanText(table.outcome_name || table.label || "Outcome");
      [...extractableRows, ...nonExtractableRows].forEach((row) => {
        const pmid = String(row?.pmid || "").trim();
        if (pmid && !allStudies.has(pmid)) {
          allStudies.set(pmid, row);
        }
      });
      extractableRows.forEach((row) => {
        const pmid = String(row?.pmid || "").trim();
        if (pmid) {
          extractablePmids.add(pmid);
          if (!extractableOutcomesByPmid.has(pmid)) {
            extractableOutcomesByPmid.set(pmid, []);
          }
          const outcomes = extractableOutcomesByPmid.get(pmid);
          if (outcomeName && !outcomes.includes(outcomeName)) {
            outcomes.push(outcomeName);
          }
        }
      });
    });

    const extractable = [];
    const nonExtractable = [];
    allStudies.forEach((row, pmid) => {
      if (extractablePmids.has(pmid)) {
        extractable.push({
          ...row,
          extractable_outcomes: extractableOutcomesByPmid.get(pmid) || [],
        });
      } else {
        nonExtractable.push(row);
      }
    });

    return { extractable, nonExtractable };
  }

  function extractionOverviewStudyTable(rows, options = {}) {
    const showExtractedOutcomes = options.showExtractedOutcomes === true;
    if (!rows.length) {
      return `<p class="note">No studies in this group.</p>`;
    }
    return `
      <div class="table-wrap screening-wrap extraction-study-summary-wrap">
        <table class="screening-table extraction-study-summary-table">
          <thead>
            <tr>
              <th>PMID</th>
              <th>Pub. Info</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const outcomes = showExtractedOutcomes && Array.isArray(row.extractable_outcomes)
                ? row.extractable_outcomes
                : [];
              return `
                <tr class="${outcomes.length ? "has-extracted-outcome-tooltip" : ""}">
                  <td class="screen-col-pmid mono">${renderPmidLink(row)}</td>
                  <td class="screen-col-title">
                    ${extractionPubInfoCell(row)}
                    ${outcomes.length ? `
                      <div class="extracted-outcome-tooltip" role="tooltip">
                        <div class="extracted-outcome-tooltip-title">Extracted outcomes</div>
                        <ul>
                          ${outcomes.map((outcome) => `<li>${sentence(outcome)}</li>`).join("")}
                        </ul>
                      </div>
                    ` : ""}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function extractionResultsOverviewContent(tables) {
    const { extractable, nonExtractable } = extractionStudyGroupsFromTables(tables);
    return `
      <div class="extraction-study-summary-grid">
        <div class="extraction-study-summary-card">
          <div class="extraction-study-summary-head">
            <h5>Studies with any extractable outcome</h5>
            <span class="mono">${number(extractable.length)}</span>
          </div>
          ${extractionOverviewStudyTable(extractable, { showExtractedOutcomes: true })}
        </div>
        <div class="extraction-study-summary-card">
          <div class="extraction-study-summary-head">
            <h5>Studies with no extractable outcome</h5>
            <span class="mono">${number(nonExtractable.length)}</span>
          </div>
          ${extractionOverviewStudyTable(nonExtractable)}
        </div>
      </div>
    `;
  }

  function extractionOverviewSection(overview, tables) {
    const hiddenTitles = new Set([
      "linked trial support",
      "full-text retrieval",
      "rob status",
      "study characteristics",
    ]);
    const sections = (Array.isArray((overview || {}).sections) ? overview.sections : [])
      .filter((section) => {
        const title = String(section?.title || "").trim().toLowerCase();
        return title && !hiddenTitles.has(title);
      });
    if (!sections.length) {
      return "";
    }

    return `
      <div class="extraction-overview">
        ${sections.map((section) => `
          <details class="extraction-overview-section collapsible-table-panel extraction-overview-panel">
            <summary class="collapsible-table-summary extraction-overview-summary">
              <div>
                <h4>${sentence(section.title || "Extraction Summary")}</h4>
                ${section.description ? `<p class="note">${sentence(section.description)}</p>` : ""}
              </div>
            </summary>
            ${String(section.title || "").trim().toLowerCase() === "extraction results"
              ? extractionResultsOverviewContent(tables)
              : `<div class="extraction-overview-stats">
                  ${(section.stats || []).map((stat) => `
                    <div class="synthesis-mini-stat extraction-overview-stat">
                      <div class="stat-label">${escapeHtml(stat.label || "")}</div>
                      <div class="stat-value">${number(stat.value ?? 0)}</div>
                      ${stat.detail ? `<div class="extraction-stat-detail">${sentence(stat.detail)}</div>` : ""}
                    </div>
                  `).join("")}
                </div>`}
          </details>
        `).join("")}
      </div>
    `;
  }

  function nctLinkageSection(nctRows) {
    const entries = Array.isArray(nctRows) ? nctRows : [];

    return `
      <details class="detail-card nct-linkage-panel" id="nct-linkage">
        <summary class="collapsible-table-summary nct-linkage-summary">
          <h3>NCT Linkage <span class="inline-section-count">(x ${number(entries.length)})</span></h3>
        </summary>
        <p class="note">Exact NCT IDs found in PubMed abstracts are linked to ClinicalTrials.gov records. This deterministic linkage is generated after screening and can support publication linkage and abstract+NCT extraction. Trial labels are shown when the abstract names the trial near the NCT ID or the ClinicalTrials.gov record provides an acronym. Posted Results counts how many linked NCT records have posted results on ClinicalTrials.gov.</p>
        ${entries.length ? `
        <div class="table-wrap screening-wrap">
          <table class="screening-table nct-linkage-table">
            <thead>
              <tr>
                <th>PMID</th>
                <th>Pub. Info</th>
                <th>NCT IDs</th>
                <th>Trial Label</th>
                <th>Posted Results</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map((entry) => {
                const links = Array.isArray(entry.nct_links) ? entry.nct_links : [];
                const nctLinks = links.map((link) => {
                  const nct = String(link.nct_id || "").trim();
                  const url = link.url || `https://clinicaltrials.gov/study/${nct}`;
                  return nct ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(nct)}</a>` : "";
                }).filter(Boolean).join("<br>");
                const labelHtml = links.map((link) => {
                  const label = String(link.trial_label || "").trim();
                  return label ? escapeHtml(label) : `<span class="muted">Not identified</span>`;
                }).join("<br>") || `<span class="muted">Not identified</span>`;
                const hasResults = links.filter((link) => link.has_results).length;
                return `
                  <tr>
                    <td class="screen-col-pmid mono">${renderPmidLink({ pmid: entry.pmid })}</td>
                    <td>${extractionPubInfoCell(entry)}</td>
                    <td class="mono">${nctLinks || "—"}</td>
                    <td>${labelHtml}</td>
                    <td>${number(entry.posted_results_count ?? hasResults)} of ${number(entry.nct_count ?? links.length)} NCTs</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
        ` : `<p class="note">No exact NCT IDs were linked from PubMed abstracts for this run.</p>`}
      </details>
    `;
  }

  function fulltextEligibilitySection(perStudyOutputs) {
    const entries = Array.isArray(perStudyOutputs) ? perStudyOutputs : [];
    if (!entries.length) {
      return "";
    }

    function eligibilityJudgmentMeta(judgment, criterionType) {
      const normalized = cleanText(judgment).toLowerCase().replace(/[\s-]+/g, "_");
      if (criterionType === "exclusion") {
        if (normalized === "triggered") {
          return { tone: "fail", label: "Triggered" };
        }
        if (normalized === "not_triggered") {
          return { tone: "pass", label: "Not triggered" };
        }
      } else {
        if (normalized === "met") {
          return { tone: "pass", label: "Met" };
        }
        if (normalized === "not_met") {
          return { tone: "fail", label: "Not met" };
        }
      }
      if (normalized === "unclear") {
        return { tone: "unclear", label: "Unclear" };
      }
      return { tone: "unclear", label: cleanText(judgment) || "Not assessed" };
    }

    function fulltextIndicatorCell(label, tone, title) {
      return `<span class="screen-cell ${tone}" title="${escapeHtml(title || label || "")}" aria-label="${escapeHtml(label || title || "")}"></span>`;
    }

    function eligibilityDecisionCell(row) {
      const normalized = cleanText(row.decision).toLowerCase();
      if (normalized === "include") {
        return fulltextIndicatorCell("Include", "pass", `Include: ${row.reason || row.status || "Full-text eligible."}`);
      }
      if (normalized === "exclude") {
        return fulltextIndicatorCell("Exclude", "fail", `Exclude: ${row.reason || row.status || "Full-text ineligible."}`);
      }
      const label = cleanText(row.status).toLowerCase() === "skipped" ? "Not screened" : "No decision";
      return fulltextIndicatorCell(label, "unclear", `${label}: ${row.reason || row.status || "No full-text decision found."}`);
    }

    const rows = entries.map((entry) => {
      const metadata = entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
      const source = entry?.fulltext_source && typeof entry.fulltext_source === "object" ? entry.fulltext_source : {};
      const eligibility = entry?.fulltext_eligibility && typeof entry.fulltext_eligibility === "object" ? entry.fulltext_eligibility : {};
      return {
        pmid: cleanText(entry?.pmid) || cleanText(metadata.pmid),
        first_author_last_name: cleanText(metadata.first_author_last_name),
        year: cleanText(metadata.year),
        metadata,
        source,
        eligibility,
        status: cleanText(eligibility.status),
        decision: cleanText(eligibility.decision || source.fulltext_eligibility_decision),
        reason: cleanText(eligibility.reason || source.fulltext_eligibility_reason || source.skip_reason),
      };
    });
    const obtainedRows = rows.filter((row) => row.source.fulltext_obtained === true);
    const missingRows = rows.filter((row) => row.source.fulltext_obtained !== true);
    const included = obtainedRows.filter((row) => row.decision.toLowerCase() === "include").length;
    const excluded = obtainedRows.filter((row) => row.decision.toLowerCase() === "exclude").length;
    const inclusionCriteria = [];
    const exclusionCriteria = [];

    function collectCriteria(items, target) {
      (Array.isArray(items) ? items : []).forEach((item) => {
        const criterion = cleanText(item?.criterion);
        if (criterion && !target.includes(criterion)) {
          target.push(criterion);
        }
      });
    }

    obtainedRows.forEach((row) => {
      collectCriteria(row.eligibility.inclusion_criteria_assessment, inclusionCriteria);
      collectCriteria(row.eligibility.exclusion_criteria_assessment, exclusionCriteria);
    });

    function lookupAssessment(items, criterion) {
      return (Array.isArray(items) ? items : []).find((item) => cleanText(item?.criterion) === criterion) || null;
    }

    function criterionHeader(prefix, criterion, index) {
      return `<span class="criterion-jump" title="${escapeHtml(criterion)}">${escapeHtml(`${prefix}${index + 1}`)}</span>`;
    }

    function criterionDecisionCell(row, criterion, criterionType) {
      const field = criterionType === "exclusion"
        ? "exclusion_criteria_assessment"
        : "inclusion_criteria_assessment";
      const item = lookupAssessment(row.eligibility[field], criterion);
      if (!item) {
        return fulltextIndicatorCell("Not assessed", "unclear", `Not assessed: ${criterion}`);
      }
      const judgment = cleanText(item.judgment).toLowerCase().replace(/[\s-]+/g, "_");
      let label = "Unclear";
      let tone = "unclear";
      if (criterionType === "exclusion") {
        if (judgment === "triggered") {
          label = "Yes";
          tone = "fail";
        } else if (judgment === "not_triggered") {
          label = "No";
          tone = "pass";
        }
      } else if (judgment === "met") {
        label = "Yes";
        tone = "pass";
      } else if (judgment === "not_met") {
        label = "No";
        tone = "fail";
      }
      const meta = eligibilityJudgmentMeta(item.judgment, criterionType);
      const tooltip = [
        criterion,
        `Decision: ${label}`,
        `Judgment: ${meta.label}`,
        cleanText(item.justification),
      ].filter(Boolean).join("\n");
      return fulltextIndicatorCell(label, tone, tooltip);
    }

    function missingFullTextList() {
      if (!missingRows.length) {
        return "";
      }
      return `
        <div class="fulltext-missing-panel">
          <div class="fulltext-missing-title">
            <span>No full text available</span>
            <span class="mono">${number(missingRows.length)} candidates</span>
          </div>
          <div class="fulltext-missing-list">
            ${missingRows.map((row) => {
              const reason = row.reason ? sentence(row.reason) : "Full text unavailable.";
              return `
                <div class="fulltext-missing-item" title="${escapeHtml(reason)}">
                  ${compactStudyCell(row)}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="fulltext-eligibility-panel">
        <div class="matrix-toolbar fulltext-screening-toolbar">
          <p class="note">Showing ${number(obtainedRows.length)} full-text-screened records (${number(rows.length)} title/abstract candidates). Criterion headers map to the full-text inclusion and exclusion criteria; hover over dots for the saved reason.</p>
          <div class="matrix-controls">
            <div class="matrix-filter-group" role="group" aria-label="Full-text screening decisions">
              <span class="matrix-control-label">Decision</span>
              <span class="matrix-check matrix-check-include"><span>${number(included)} include</span></span>
              <span class="matrix-check matrix-check-exclude"><span>${number(excluded)} exclude</span></span>
            </div>
          </div>
        </div>
        ${obtainedRows.length ? `
          <div class="table-wrap screening-wrap">
          <table class="screening-table screening-results-table fulltext-eligibility-table study-sticky-table">
            <thead>
              <tr>
                <th class="screen-col-index">#</th>
                <th class="screen-col-study">Study</th>
                ${inclusionCriteria.map((criterion, index) => `<th class="fulltext-criterion-col">${criterionHeader("I", criterion, index)}</th>`).join("")}
                ${exclusionCriteria.map((criterion, index) => `<th class="fulltext-criterion-col${index === 0 ? " screen-col-section-start" : ""}">${criterionHeader("E", criterion, index)}</th>`).join("")}
                <th class="screen-col-decision screen-col-overall">Decision</th>
              </tr>
            </thead>
            <tbody>
              ${obtainedRows.map((row, index) => `
                <tr>
                  <td class="screen-col-index mono">${index + 1}</td>
                  <td class="screen-col-study">${compactStudyCell(row)}</td>
                  ${inclusionCriteria.map((criterion) => `<td class="fulltext-criterion-col">${criterionDecisionCell(row, criterion, "inclusion")}</td>`).join("")}
                  ${exclusionCriteria.map((criterion, criterionIndex) => `<td class="fulltext-criterion-col${criterionIndex === 0 ? " screen-col-section-start" : ""}">${criterionDecisionCell(row, criterion, "exclusion")}</td>`).join("")}
                  <td class="screen-col-decision screen-col-overall">${eligibilityDecisionCell(row)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          </div>
        ` : `<p class="note fulltext-empty-note">No candidate full text was available for eligibility screening.</p>`}
        ${missingFullTextList()}
      </div>
    `;
  }

  function sourceAvailabilityGateSection(gate) {
    if (!gate || typeof gate !== "object" || !Object.keys(gate).length) {
      return "";
    }
    const counts = gate.counts && typeof gate.counts === "object" ? gate.counts : {};
    const droppedRecords = Array.isArray(gate.dropped_records) ? gate.dropped_records : [];
    const droppedCount = Number(counts.n_dropped_no_source_text ?? droppedRecords.length) || 0;
    const retainedCount = Number(counts.n_retained ?? 0) || 0;

    return `
      <details class="detail-card source-availability-panel" id="source-availability-gate" style="margin-top:14px;">
        <summary class="collapsible-table-summary source-availability-summary">
          <div>
            <h3>Source availability gate <span class="inline-section-count">(x ${number(droppedCount)})</span></h3>
            <p class="summary-note">Drops only not-enough-info candidates with no abstract, linked NCT text, or full text.</p>
          </div>
        </summary>
        <p class="note">${number(retainedCount)} candidates retained after this deterministic gate.</p>
        ${droppedRecords.length ? `
          <div class="table-wrap screening-wrap">
            <table class="screening-table extraction-study-summary-table source-availability-table study-sticky-table">
              <thead>
                <tr>
                  <th class="screen-col-index">#</th>
                  <th class="screen-col-study">Study</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                ${droppedRecords.map((record, index) => `
                  <tr>
                    <td class="screen-col-index mono">${index + 1}</td>
                    <td class="screen-col-study">${compactStudyCell(record)}</td>
                    <td>${sentence(record.reason || "No usable source text was available.")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="note">No candidates were dropped by this gate.</p>`}
      </details>
    `;
  }

  function extractionAttemptSection(
    outcomeTables,
    nonExtractableLimit,
    publicationLinkageArtifact,
    extractionOverview,
    extractionTemplates,
    cochraneOutcomeAlignment = {}
  ) {
    const tables = Array.isArray(outcomeTables) ? outcomeTables : [];
    if (!tables.length) {
      return `<p class="note">No outcome extraction CSV files were found for this run.</p>`;
    }

    const linkageByPmid = publicationLinkageDisplayMap(publicationLinkageArtifact);
    const maxNonExtractableRows = Math.max(
      0,
      ...tables.map((table) => Number(table.non_extractable_count) || 0)
    );
    const nonExtractableLimitOptions = [5, 10, 20, 30, 50, 100, "all"].filter(
      (option, index) => option === "all" || option <= maxNonExtractableRows || index < 2
    );
    const normalizedNonExtractableLimit = String(nonExtractableLimit) === "all"
      ? "all"
      : Number(nonExtractableLimit) || 5;

    function renderExtractionStudyCell(row) {
      return compactStudyCell(row);
    }

    function extractionDisplayFields(table) {
      const fields = Array.isArray(table.display_fields) ? table.display_fields : [];
      return fields.filter((field) => !EXTRACTION_DISPLAY_FIELD_EXCLUDE.has(field));
    }

    function renderExtractedValueCell(row, field, evidenceByField) {
      const value = row[field];
      const evidence = evidenceByField?.[field];
      const tooltip = fieldEvidenceTooltip(field, evidenceByField);
      const hasSourceTrace = isAbstractSourceTraceCell(row, evidence);
      const evidenceAttrs = [
        tooltip && !hasSourceTrace ? `title="${escapeHtml(tooltip)}"` : "",
        tooltip && !hasSourceTrace ? `aria-label="${escapeHtml(tooltip)}"` : "",
        hasSourceTrace ? `aria-label="${escapeHtml(`Open abstract source trace for ${field}`)}"` : "",
        hasSourceTrace ? `data-source-trace-cell data-extraction-field="${escapeHtml(field)}" role="button" tabindex="0"` : "",
      ].filter(Boolean).join(" ");
      const evidenceClass = [
        tooltip ? "has-field-evidence" : "",
        hasSourceTrace ? "has-source-trace" : "",
      ].filter(Boolean).join(" ");
      const className = evidenceClass ? `extract-value-col ${evidenceClass}` : "extract-value-col";
      return `<td class="${className}"${evidenceAttrs ? ` ${evidenceAttrs}` : ""}>${hasValue(value) ? sentence(value) : "—"}</td>`;
    }

    function linkageRowParts(row) {
      const pmid = String(row.pmid || "").trim();
      const linkage = linkageByPmid.get(pmid);
      if (!linkage) {
        return { className: "", style: "", title: "" };
      }
      return {
        className: "extraction-linkage-row",
        style: ` style="--linkage-color:${escapeHtml(linkage.color)}; --linkage-bg:${escapeHtml(hexToRgba(linkage.color, 0.08))}; --linkage-border:${escapeHtml(hexToRgba(linkage.color, 0.55))};"`,
        title: "",
      };
    }

    function extractionRowAttributes(row, table, tableIndex) {
      const pmid = String(row.pmid || "").trim();
      const linkage = linkageRowParts(row);
      const fallbackNote = varianceFallbackNote(row);
      const classes = [
        "extraction-target-row",
        linkage.className,
        fallbackNote ? "synthesis-derived-row" : "",
      ].filter(Boolean).join(" ");
      const outcomeKey = extractionOutcomeKey(table, tableIndex);
      const targetAttrs = pmid
        ? ` data-extraction-target="${escapeHtml(extractionTargetKey(outcomeKey, pmid))}" data-extraction-outcome-key="${escapeHtml(outcomeKey)}" data-extraction-pmid="${escapeHtml(pmid)}"`
        : "";
      const fallbackAttrs = fallbackNote
        ? ` title="${escapeHtml(fallbackNote)}" aria-label="${escapeHtml(fallbackNote)}"`
        : "";
      return ` class="${classes}"${linkage.style}${linkage.title}${fallbackAttrs}${targetAttrs} data-extraction-row tabindex="0"`;
    }

    function linkageRowAttributes(row) {
      const linkage = linkageRowParts(row);
      return linkage.className
        ? ` class="${linkage.className}"${linkage.style}${linkage.title}`
        : "";
    }

    function renderExtractableTable(rows, table, tableIndex) {
      if (!rows.length) {
        return `<p class="note">No studies were marked extractable for this outcome.</p>`;
      }

      const fields = extractionDisplayFields(table);
      const scrollKey = `extractable-${table.role || "outcome"}-${table.index || tableIndex}`;

      return `
        <div class="extraction-table-frame">
          <div class="table-scroll-proxy screening-wrap" data-scroll-proxy="${escapeHtml(scrollKey)}" aria-label="Horizontal scroll for extractable studies table">
            <div class="table-scroll-proxy-inner"></div>
          </div>
          <div class="table-wrap screening-wrap extraction-table-wrap" data-scroll-body="${escapeHtml(scrollKey)}">
            <table class="screening-table extractable-table study-sticky-table">
              <thead>
                <tr>
                  <th class="screen-col-index">#</th>
                  <th class="screen-col-study">Study</th>
                  <th class="extract-source-col">Source</th>
                  ${fields.map((field) => `<th class="mono extract-value-col">${escapeHtml(field)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${rows.map((row, index) => {
                  const evidenceByField = parseFieldEvidence(row);
                  return `
                    <tr${extractionRowAttributes(row, table, tableIndex)}>
                      <td class="screen-col-index mono">${index + 1}</td>
                      <td class="screen-col-study">${renderExtractionStudyCell(row)}</td>
                      <td class="extract-source-col">${sentence(sourceLabel(row.extraction_text_source))}</td>
                      ${fields.map((field) => renderExtractedValueCell(row, field, evidenceByField)).join("")}
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderNonExtractableTable(rows) {
      if (!rows.length) {
        return `<p class="note">All studies that reached extraction for this outcome were marked extractable.</p>`;
      }

      const visibleRows = normalizedNonExtractableLimit === "all"
        ? rows
        : rows.slice(0, normalizedNonExtractableLimit);

      return `
        <div class="matrix-toolbar">
          <p class="note">Showing ${number(visibleRows.length)} of ${number(rows.length)} not extractable studies.</p>
          <label class="matrix-control">
            <span class="matrix-control-label">Show</span>
            <select class="matrix-select" data-nonextract-limit>
              ${nonExtractableLimitOptions.map((option) => `
                <option value="${option}" ${String(option) === String(nonExtractableLimit) ? "selected" : ""}>${option === "all" ? "All" : option}</option>
              `).join("")}
            </select>
          </label>
        </div>
        <div class="table-wrap screening-wrap">
          <table class="screening-table nonextract-table study-sticky-table">
            <thead>
              <tr>
                <th class="screen-col-index">#</th>
                <th class="screen-col-study">Study</th>
                <th>Source</th>
                <th class="nonextract-note-col">Why Not Extractable</th>
              </tr>
            </thead>
            <tbody>
              ${visibleRows.map((row, index) => {
                const note = String(row.non_extractable_reason || "").trim();
                return `
                  <tr${linkageRowAttributes(row)}>
                    <td class="screen-col-index mono">${index + 1}</td>
                    <td class="screen-col-study">${compactStudyCell(row)}</td>
                    <td>${sentence(sourceLabel(row.extraction_text_source))}</td>
                    <td class="nonextract-note-col">${note ? sentence(note) : "No non-extractable reason provided."}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderOutcomeTemplatePanel(table) {
      const extractionTemplate = extractionTemplateForOutcomeTable(table, extractionTemplates);

      return `
        <details class="collapsible-table-panel" data-extraction-panel="template" ${currentTemplateOpen ? "open" : ""}>
          <summary class="collapsible-table-summary">
            <h4>Template</h4>
          </summary>
          ${extractionTemplateTable(extractionTemplate)}
        </details>
      `;
    }

    function renderOutcomeExtractionPanel(table, tableIndex) {
      const extractableRows = Array.isArray(table.extractable_rows) ? table.extractable_rows : [];
      const nonExtractableRows = Array.isArray(table.non_extractable_rows) ? table.non_extractable_rows : [];
      const outcomeTitle = String(table.outcome_name || table.label || "Outcome").trim();
      const outcomeKey = extractionOutcomeKey(table, tableIndex);

      return `
        <details class="outcome-panel" open>
          <summary class="outcome-panel-head" tabindex="-1">
            ${outcomePanelToggleButton()}
            <div>
              <div class="insight-title">${escapeHtml(table.label || "Outcome")}</div>
              <h4>${sentence(outcomeTitle)}</h4>
              ${renderCochraneOutcomeMapping(cochraneOutcomeAlignment, outcomeKey, { showEmpty: true })}
            </div>
          </summary>
          <div class="outcome-extraction-panel-row">
            <details class="collapsible-table-panel" data-extraction-panel="extractable" ${currentExtractableOpen ? "open" : ""}>
              <summary class="collapsible-table-summary">
                <h4>Extractable (${number(table.extractable_count ?? extractableRows.length)})</h4>
              </summary>
              ${renderExtractableTable(extractableRows, table, tableIndex)}
            </details>
            <details class="collapsible-table-panel" data-extraction-panel="nonextract" ${currentNonExtractableOpen ? "open" : ""}>
              <summary class="collapsible-table-summary">
                <h4>Not Extractable (${number(table.non_extractable_count ?? nonExtractableRows.length)})</h4>
              </summary>
              ${renderNonExtractableTable(nonExtractableRows)}
            </details>
            ${renderOutcomeTemplatePanel(table)}
          </div>
        </details>
      `;
    }

    return `
      ${extractionOverviewSection(extractionOverview, tables)}
      <div class="outcome-panel-list">
        ${tables.map((table, index) => renderOutcomeExtractionPanel(table, index)).join("")}
      </div>
    `;
  }

  function synthesisOutcomeSortKey(key) {
    if (key === "primary") {
      return [0, 0];
    }
    if (String(key).startsWith("secondary_")) {
      const index = Number(String(key).replace("secondary_", ""));
      return [1, Number.isFinite(index) ? index : 999];
    }
    return [2, String(key)];
  }

  function synthesisOutcomeEntries(synthesis) {
    const outcomes = (synthesis || {}).outcomes || {};
    return Object.entries(outcomes)
      .map(([key, entry]) => ({ key, ...(entry || {}) }))
      .sort((a, b) => {
        const aKey = synthesisOutcomeSortKey(a.key);
        const bKey = synthesisOutcomeSortKey(b.key);
        return aKey[0] - bKey[0] || String(aKey[1]).localeCompare(String(bKey[1]), undefined, { numeric: true });
      });
  }

  function matchingOutcomeExtractionTable(entry, outcomeExtractionTables) {
    const tables = Array.isArray(outcomeExtractionTables) ? outcomeExtractionTables : [];
    const key = String(entry?.key || "").trim();
    const outcomeName = String(entry?.outcome_name || "").trim().toLowerCase();

    return tables.find((table) => {
      if (!table || typeof table !== "object") {
        return false;
      }
      if (key === "primary" && table.role === "primary") {
        return true;
      }
      const secondaryMatch = key.match(/^secondary_(\d+)$/);
      if (secondaryMatch && table.role === "secondary" && String(table.index) === secondaryMatch[1]) {
        return true;
      }
      return outcomeName && String(table.outcome_name || "").trim().toLowerCase() === outcomeName;
    }) || null;
  }

  function synthesisOutcomeDefinition(entry, outcomeExtractionTables) {
    const table = matchingOutcomeExtractionTable(entry, outcomeExtractionTables);
    if (!table) {
      return "";
    }

    const rows = [
      ...(Array.isArray(table.extractable_rows) ? table.extractable_rows : []),
      ...(Array.isArray(table.non_extractable_rows) ? table.non_extractable_rows : []),
    ];
    const fields = [
      "definition_note",
      "outcome_definition",
      "outcome_definition_note",
      "endpoint_definition",
      "measurement_definition",
    ];

    for (const row of rows) {
      for (const field of fields) {
        const text = String(row?.[field] || "").replace(/\s+/g, " ").trim();
        if (text && text !== "—") {
          return text;
        }
      }
    }
    return "";
  }

  function humanizeMetric(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function finiteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatEffect(value, digits = 3) {
    const parsed = finiteNumber(value);
    return parsed === null ? "—" : parsed.toFixed(digits);
  }

  function formatForestStatistic(value, digits = 5) {
    const parsed = finiteNumber(value);
    return parsed === null ? "—" : parsed.toFixed(digits).replace(/\.?0+$/, "");
  }

  function formatWeightPercent(value) {
    const parsed = finiteNumber(value);
    return parsed === null ? "" : `${parsed.toFixed(1)}%`;
  }

  function sampleSizeNumber(value) {
    const text = String(value ?? "").replaceAll(",", "").trim();
    if (!text) {
      return null;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatSampleSize(value) {
    const parsed = sampleSizeNumber(value);
    if (parsed !== null) {
      return fmt.format(parsed);
    }
    const text = String(value ?? "").trim();
    return text ? escapeHtml(text) : "—";
  }

  function forestSampleSize(row, key, totals) {
    if (row?.type === "pooled") {
      const explicit = formatSampleSize(row?.source_row?.[key]);
      if (explicit !== "—") {
        return explicit;
      }
      return totals?.[key] === null || totals?.[key] === undefined ? "—" : fmt.format(totals[key]);
    }
    return formatSampleSize(row?.source_row?.[key]);
  }

  function forestTransformedSe(row) {
    const explicit = finiteNumber(row?.source_row?.effect_size_se);
    if (explicit !== null) {
      return explicit;
    }
    const variance = finiteNumber(row?.source_row?.effect_size_variance);
    return variance !== null && variance >= 0 ? Math.sqrt(variance) : null;
  }

  function forestComparisonDetail(comparisonPayload) {
    if (!comparisonPayload || typeof comparisonPayload !== "object") {
      return {};
    }
    const detail = comparisonPayload.comparison;
    return detail && typeof detail === "object" && !Array.isArray(detail) ? detail : comparisonPayload;
  }

  function cleanForestArmHeader(value, fallback) {
    const text = String(value || fallback || "").trim()
      .replace(/\bin combination with\b/gi, "plus")
      .replace(/\bsupplementation\b/gi, "supplement")
      .replace(/,\s*no supplement,\s*or lower intake\b/gi, " / lower intake")
      .replace(/\bsupplement\s+or higher intake\b/gi, "supplement / higher intake")
      .replace(/\bmedicines\b/gi, "therapy")
      .replace(/\balone\b/gi, "")
      .replace(/\bonly\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return text || fallback || "";
  }

  function firstForestRowValue(rows, field) {
    for (const row of rows || []) {
      if (row?.type === "pooled") {
        continue;
      }
      const value = String(row?.source_row?.[field] || "").trim();
      if (value) {
        return value;
      }
    }
    return "";
  }

  function forestSampleHeaders(rows, comparisonPayload) {
    const comparison = forestComparisonDetail(comparisonPayload);
    return {
      arm1: cleanForestArmHeader(
        comparison.arm_1_role || firstForestRowValue(rows, "arm_1_label"),
        "Intervention"
      ),
      arm2: cleanForestArmHeader(
        comparison.arm_2_role || firstForestRowValue(rows, "arm_2_label"),
        "Comparator"
      ),
    };
  }

  function wrapTextLines(text, maxChars = 24, maxLines = 3) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    const lines = [];
    words.forEach((word) => {
      const current = lines[lines.length - 1] || "";
      if (!current) {
        lines.push(word);
      } else if (`${current} ${word}`.length <= maxChars) {
        lines[lines.length - 1] = `${current} ${word}`;
      } else {
        lines.push(word);
      }
    });
    if (lines.length <= maxLines) {
      return lines;
    }
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\.$/, "")}...`;
    return kept;
  }

  function renderForestHeaderLabel(label, x, centerY, className) {
    const lines = wrapTextLines(label, 12, 5);
    const lineHeight = 11;
    const allLines = [...lines, "Total"];
    const firstY = centerY - ((allLines.length - 1) * lineHeight) / 2;
    return `
      <text class="${className}">
        ${lines.map((line, index) => `<tspan x="${x}" y="${firstY + index * lineHeight}">${escapeHtml(line)}</tspan>`).join("")}
        <tspan class="forest-column-subheader" x="${x}" y="${firstY + lines.length * lineHeight}">Total</tspan>
      </text>
    `;
  }

  function renderForestEventHeaderLabel(label, eventX, totalX, centerY, className) {
    const lines = wrapTextLines(label, 12, 4);
    const lineHeight = 11;
    const groupX = (eventX + totalX) / 2;
    const firstY = centerY - ((lines.length + 1) * lineHeight) / 2;
    const subheaderY = firstY + lines.length * lineHeight + 2;
    return `
      <text class="${className}">
        ${lines.map((line, index) => `<tspan x="${groupX}" y="${firstY + index * lineHeight}">${escapeHtml(line)}</tspan>`).join("")}
        <tspan class="forest-column-subheader" x="${eventX}" y="${subheaderY}">Events</tspan>
        <tspan class="forest-column-subheader" x="${totalX}" y="${subheaderY}">Total</tspan>
      </text>
    `;
  }

  function renderForestColumnHeader(label, x, centerY, className, maxChars = 14, maxLines = 3) {
    const lines = wrapTextLines(label, maxChars, maxLines);
    const lineHeight = 14;
    const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;
    return `
      <text class="${className}">
        ${lines.map((line, index) => `<tspan x="${x}" y="${firstY + index * lineHeight}">${escapeHtml(line)}</tspan>`).join("")}
      </text>
    `;
  }

  function renderForestValueLabel(valueText, x, y, split = false) {
    if (!split) {
      return `<text class="forest-value-label" x="${x}" y="${y + 5}">${escapeHtml(valueText)}</text>`;
    }
    const match = String(valueText || "").match(/^(.+?)\s+(\[[^\]]+\])$/);
    const lines = match ? [match[1], match[2]] : [valueText];
    return `
      <text class="forest-value-label forest-value-label-split">
        ${lines.map((line, index) => `<tspan x="${x}" y="${y - 5 + index * 15}">${escapeHtml(line)}</tspan>`).join("")}
      </text>
    `;
  }

  function shortFavoursLabel(value) {
    const cleaned = cleanForestArmHeader(String(value || "").replace(/^favours\s+/i, ""), "").trim();
    if (!cleaned) {
      return "";
    }
    if (/daratumumab/i.test(cleaned)) {
      return "Favours daratumumab";
    }
    if (/placebo/i.test(cleaned)) {
      return "Favours placebo";
    }
    if (/vitamin\s*b/i.test(cleaned)) {
      return "Favours Vitamin B";
    }
    if (/standard|antimyeloma|control|usual care|no treatment/i.test(cleaned)) {
      return "Favours control";
    }
    return `Favours ${cleaned}`;
  }

  function renderForestFooterLabel(label, x, y, className) {
    const lines = wrapTextLines(shortFavoursLabel(label), 24, 3);
    if (!lines.length) {
      return "";
    }
    return `
      <text class="${className}">
        ${lines.map((line, index) => `<tspan x="${x}" y="${y + index * 14}">${escapeHtml(line)}</tspan>`).join("")}
      </text>
    `;
  }

  function forestStudyLabelParts(row) {
    if (row?.type === "pooled") {
      return { primary: String(row?.label || "Total").trim() || "Total", secondary: "" };
    }
    const label = String(row?.label || "").trim();
    const pmid = String(row?.pmid || "").trim();
    if (!pmid) {
      return { primary: label, secondary: "" };
    }
    const escapedPmid = pmid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const primary = label
      .replace(new RegExp(`\\s*\\(${escapedPmid}\\)\\s*$`), "")
      .trim();
    return {
      primary: primary || label,
      secondary: `PMID ${pmid}`,
    };
  }

  function renderForestStudyLabel(row, x, y) {
    const parts = forestStudyLabelParts(row);
    if (!parts.secondary) {
      const primary = String(parts.primary || "").trim();
      if (row?.type === "pooled" && primary.length > 18) {
        const parentheticalMatch = primary.match(/^(.*?)\s+(\([^)]*\))$/);
        const lines = parentheticalMatch
          ? [parentheticalMatch[1], parentheticalMatch[2]]
          : wrapTextLines(primary, 18, 2);
        return `
          <text class="forest-row-label">
            ${lines.map((line, index) => `<tspan x="${x}" y="${y - 3 + index * 16}">${sentence(line)}</tspan>`).join("")}
          </text>
        `;
      }
      return `<text class="forest-row-label" x="${x}" y="${y + 5}">${sentence(parts.primary)}</text>`;
    }
    return `
      <text class="forest-row-label" x="${x}" y="${y - 3}">${sentence(parts.primary)}</text>
      <text class="forest-row-label forest-row-pmid" x="${x}" y="${y + 15}">${sentence(parts.secondary)}</text>
    `;
  }

  function effectMeasureLabel(value) {
    const text = String(value || "").trim();
    const labels = {
      hazard_ratio: "Hazard Ratio",
      risk_ratio: "Risk Ratio",
      odds_ratio: "Odds Ratio",
      mean_difference: "Mean Difference",
      standardized_mean_difference: "Standardized Mean Difference",
      proportion: "Proportion",
    };
    return labels[text.toLowerCase()] || humanizeMetric(text || "Analysis");
  }

  function synthesisForestPlotKeys(outcomeKey, analysis) {
    const subsetName = (analysis || {}).subsetName || "all_eligible";
    const measure = String((analysis || {}).measure || "").trim();
    const keys = [];
    if (measure) {
      keys.push(`${outcomeKey}:measure:${measure}:${subsetName}`);
    }
    if ((analysis || {}).includeLegacyTopLevel) {
      keys.push(`${outcomeKey}:${subsetName}`);
    }
    return keys.length ? keys : [`${outcomeKey}:${subsetName}`];
  }

  function synthesisPlotSubsetNames(outcomeKey, analysis, assets) {
    const subsetNames = new Set();
    const results = (analysis || {}).results || {};
    const plots = (assets || {}).synthesis_forest_plot_data || {};
    const measure = String((analysis || {}).measure || "").trim();

    [
      results.forest_plot_data,
      results.subsets,
    ].forEach((collection) => {
      if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
        return;
      }
      Object.keys(collection).forEach((subsetName) => {
        if (String(subsetName || "").trim()) {
          subsetNames.add(String(subsetName).trim());
        }
      });
    });

    if (measure) {
      const prefix = `${outcomeKey}:measure:${measure}:`;
      Object.keys(plots).forEach((plotKey) => {
        if (plotKey.startsWith(prefix)) {
          const subsetName = plotKey.slice(prefix.length).trim();
          if (subsetName && !subsetName.includes(":")) {
            subsetNames.add(subsetName);
          }
        }
      });
    }

    if ((analysis || {}).includeLegacyTopLevel || !measure) {
      const prefix = `${outcomeKey}:`;
      Object.keys(plots).forEach((plotKey) => {
        if (!plotKey.startsWith(prefix)) {
          return;
        }
        const subsetName = plotKey.slice(prefix.length).trim();
        if (subsetName && !subsetName.includes(":")) {
          subsetNames.add(subsetName);
        }
      });
    }

    return Array.from(subsetNames).sort((a, b) => {
      if (a === "all_eligible") {
        return -1;
      }
      if (b === "all_eligible") {
        return 1;
      }
      return humanizeMetric(a).localeCompare(humanizeMetric(b));
    });
  }

  function attachSynthesisPlot(outcomeKey, analysis, assets) {
    const plots = (assets || {}).synthesis_forest_plot_data || {};
    const keys = synthesisForestPlotKeys(outcomeKey, analysis);
    const plotKey = keys.find((key) => plots[key]) || keys[0];
    return {
      ...analysis,
      plotKey,
      plotData: plots[plotKey] || {},
    };
  }

  function hasForestPlotData(plotData) {
    return Array.isArray(plotData?.rows) && plotData.rows.length;
  }

  function synthesisStudyDesignHandling(analysis) {
    const handling = analysis?.results?.study_design_handling;
    return handling && typeof handling === "object" && !Array.isArray(handling) ? handling : {};
  }

  function isMixedStudyDesignSynthesis(analysis) {
    const handling = synthesisStudyDesignHandling(analysis);
    const skipReason = String(analysis?.primaryResult?.skip_reason || "").trim();
    return handling.mixed_study_designs === true || skipReason === "mixed_study_designs";
  }

  function isStudyDesignSubsetName(subsetName) {
    return String(subsetName || "").trim().startsWith("study_design_");
  }

  function synthesisDesignBranchEntries(analysis) {
    const subgroups = Array.isArray(analysis?.subgroupAnalyses) ? analysis.subgroupAnalyses : [];
    const designSubgroups = subgroups.filter((subgroup) => isStudyDesignSubsetName(subgroup.subsetName));
    if (!designSubgroups.length) {
      return [];
    }

    const bySubsetName = new Map(
      designSubgroups.map((subgroup) => [String(subgroup.subsetName || "").trim(), subgroup])
    );
    const handling = synthesisStudyDesignHandling(analysis);
    const families = Array.isArray(handling.families) ? handling.families : [];
    const ordered = [];
    families.forEach((family) => {
      const familyId = String(family?.family || "").trim();
      const subsetName = familyId ? `study_design_${familyId}` : "";
      const subgroup = bySubsetName.get(subsetName);
      if (subgroup) {
        ordered.push({
          ...subgroup,
          designFamily: family,
          label: family.label || subgroup.label,
        });
        bySubsetName.delete(subsetName);
      }
    });
    return ordered;
  }

  function synthesisNonDesignSubgroupEntries(analysis) {
    return (Array.isArray(analysis?.subgroupAnalyses) ? analysis.subgroupAnalyses : [])
      .filter((subgroup) => !isStudyDesignSubsetName(subgroup.subsetName));
  }

  function hasSynthesisDisplayPayload(analysis) {
    if (hasForestPlotData(analysis?.plotData) || isMixedStudyDesignSynthesis(analysis)) {
      return true;
    }
    return (Array.isArray(analysis?.subgroupAnalyses) ? analysis.subgroupAnalyses : [])
      .some((subgroup) => hasForestPlotData(subgroup.plotData));
  }

  function synthesisAnalysisForestPlotCount(analysis) {
    const primaryCount = hasForestPlotData(analysis?.plotData) ? 1 : 0;
    const branchCount = (Array.isArray(analysis?.subgroupAnalyses) ? analysis.subgroupAnalyses : [])
      .filter((subgroup) => hasForestPlotData(subgroup.plotData))
      .length;
    return primaryCount + branchCount;
  }

  function synthesisStudyCountFromPlot(plotData) {
    const rows = synthesisStudyRowsFromPlot(plotData);
    const ids = new Set();
    rows.forEach((row, index) => {
      const id = String(row?.pmid || row?.study_id || row?.label || `row-${index}`).trim();
      if (id) {
        ids.add(id);
      }
    });
    return ids.size;
  }

  function studyCountText(count) {
    const n = Number(count) || 0;
    return `${number(n)} ${n === 1 ? "study" : "studies"}`;
  }

  function synthesisAnalysisStudyCountDetail(analysis) {
    const primaryCount = synthesisStudyCountFromPlot(analysis?.plotData);
    if (primaryCount) {
      return studyCountText(primaryCount);
    }

    const designBranches = synthesisDesignBranchEntries(analysis)
      .filter((branch) => hasForestPlotData(branch.plotData));
    if (designBranches.length) {
      return designBranches
        .map((branch) => {
          const label = branch.label || humanizeMetric(branch.subsetName || "study design branch");
          return `${label}: ${studyCountText(synthesisStudyCountFromPlot(branch.plotData))}`;
        })
        .join("; ");
    }

    const subgroupRows = (Array.isArray(analysis?.subgroupAnalyses) ? analysis.subgroupAnalyses : [])
      .filter((subgroup) => hasForestPlotData(subgroup.plotData))
      .flatMap((subgroup) => synthesisStudyRowsFromPlot(subgroup.plotData));
    if (subgroupRows.length) {
      const ids = new Set();
      subgroupRows.forEach((row, index) => {
        const id = String(row?.pmid || row?.study_id || row?.label || `row-${index}`).trim();
        if (id) {
          ids.add(id);
        }
      });
      return `${studyCountText(ids.size)} in plotted subgroups`;
    }

    return "0 synthesized studies";
  }

  function synthesisOutcomeSummaryDetail(analyses) {
    const plottedAnalyses = (Array.isArray(analyses) ? analyses : [])
      .filter((analysis) => synthesisAnalysisForestPlotCount(analysis));
    if (!plottedAnalyses.length) {
      return "0 synthesized studies";
    }
    if (plottedAnalyses.length === 1) {
      return synthesisAnalysisStudyCountDetail(plottedAnalyses[0]);
    }
    return plottedAnalyses
      .map((analysis) => {
        const measure = String(analysis?.measure || analysis?.results?.effect_measure || analysis?.label || "").trim();
        const label = effectMeasureLabel(measure || "analysis").toLowerCase();
        return `${label}: ${synthesisAnalysisStudyCountDetail(analysis)}`;
      })
      .join("; ");
  }

  function synthesisDesignBranchForestPlotCount(analysis) {
    return synthesisDesignBranchEntries(analysis)
      .filter((branch) => hasForestPlotData(branch.plotData))
      .length;
  }

  function synthesisPlottedAnalyses(entry, assets) {
    return synthesisAnalysisEntries(entry.key, entry.results || {}, assets)
      .filter(hasSynthesisDisplayPayload);
  }

  function synthesisForestPlotSummary(synthesis, assets) {
    const outcomes = synthesisOutcomeEntries(synthesis);
    const plottedOutcomeEntries = outcomes
      .map((entry) => ({
        entry,
        analyses: synthesisPlottedAnalyses(entry, assets),
      }))
      .filter((item) => item.analyses.length);
    const plottedKeys = new Set(plottedOutcomeEntries.map((item) => item.entry.key));
    return {
      totalOutcomes: outcomes.length,
      plottedOutcomes: plottedOutcomeEntries.length,
      forestPlots: plottedOutcomeEntries.reduce(
        (sum, item) => sum + item.analyses.reduce(
          (analysisSum, analysis) => analysisSum + synthesisAnalysisForestPlotCount(analysis),
          0
        ),
        0
      ),
      designBranchForestPlots: plottedOutcomeEntries.reduce(
        (sum, item) => sum + item.analyses.reduce(
          (analysisSum, analysis) => analysisSum + synthesisDesignBranchForestPlotCount(analysis),
          0
        ),
        0
      ),
      plottedOutcomeItems: plottedOutcomeEntries.map((item) => ({
        name: item.entry.outcome_name || item.entry.key || "Outcome",
        detail: synthesisOutcomeSummaryDetail(item.analyses),
      })),
      unplottedOutcomeItems: outcomes
        .filter((entry) => !plottedKeys.has(entry.key))
        .map((entry) => ({
          name: entry.outcome_name || entry.key || "Outcome",
          detail: "0 synthesized studies",
        })),
    };
  }

  function renderSynthesisStepSummary(summary) {
    const totalOutcomes = Number(summary?.totalOutcomes) || 0;
    const forestPlots = Number(summary?.forestPlots) || 0;
    const designBranchForestPlots = Number(summary?.designBranchForestPlots) || 0;
    const plottedOutcomes = Number(summary?.plottedOutcomes) || 0;
    const plottedItems = Array.isArray(summary?.plottedOutcomeItems) ? summary.plottedOutcomeItems : [];
    const unplottedItems = Array.isArray(summary?.unplottedOutcomeItems) ? summary.unplottedOutcomeItems : [];
    if (!totalOutcomes) {
      return `<p class="note synthesis-step-summary">No configured outcomes were available for synthesis.</p>`;
    }
    const outcomeSuffix = plottedOutcomes === forestPlots
      ? ""
      : ` across ${number(plottedOutcomes)} ${plottedOutcomes === 1 ? "outcome" : "outcomes"}`;
    const renderOutcomeList = (items) => {
      if (!items.length) {
        return `<span class="synthesis-step-list-text">None</span>`;
      }
      return `
        <ul class="synthesis-step-list-text synthesis-step-bullet-list">
          ${items.map((item) => {
            const name = String(item?.name || "").trim() || "Outcome";
            const detail = String(item?.detail || "").trim();
            return `
              <li>
                <span class="synthesis-step-list-name">${sentence(name)}</span>
                ${detail ? `<span class="synthesis-step-list-detail">(${escapeHtml(detail)})</span>` : ""}
              </li>
            `;
          }).join("")}
        </ul>
      `;
    };
    return `
      <div class="synthesis-step-summary">
        <p class="note">
          Out of ${number(totalOutcomes)} configured ${totalOutcomes === 1 ? "outcome" : "outcomes"},
          ${number(forestPlots)} ${forestPlots === 1 ? "forest plot was" : "forest plots were"} created${outcomeSuffix}.
          ${designBranchForestPlots ? `${number(designBranchForestPlots)} ${designBranchForestPlots === 1 ? "plot is" : "plots are"} study-design branch syntheses.` : ""}
          Outcomes without a forest plot are hidden below.
        </p>
        <div class="synthesis-step-outcome-lists">
          <div>
            <span class="synthesis-step-list-label">Forest plots</span>
            ${renderOutcomeList(plottedItems)}
          </div>
          <div>
            <span class="synthesis-step-list-label">No forest plot</span>
            ${renderOutcomeList(unplottedItems)}
          </div>
        </div>
      </div>
    `;
  }

  function synthesisStudyRowsFromPlot(plotData) {
    const rows = Array.isArray(plotData?.rows) ? plotData.rows : [];
    return rows.filter((row) => row?.type !== "pooled");
  }

  function synthesisResultFromPlot(plotData, subsetName) {
    const rows = Array.isArray(plotData?.rows) ? plotData.rows : [];
    const pooledRow = rows.find((row) => row?.type === "pooled") || {};
    const studyRows = synthesisStudyRowsFromPlot(plotData);
    return {
      subset: subsetName,
      title: plotData?.title || humanizeMetric(subsetName),
      k: studyRows.length || null,
      estimate_type: plotData?.estimate_type || "",
      pooled_effect: pooledRow.effect,
      ci_low: pooledRow.ci_low,
      ci_high: pooledRow.ci_high,
    };
  }

  function synthesisSubsetResult(analysis, plotData, subsetName) {
    const subsets = analysis?.results?.subsets || {};
    const explicitResult = subsets && typeof subsets === "object" && !Array.isArray(subsets)
      ? subsets[subsetName] || {}
      : {};
    const plotResult = synthesisResultFromPlot(plotData, subsetName);
    return {
      ...plotResult,
      ...explicitResult,
      subset: explicitResult.subset || plotResult.subset,
      title: explicitResult.title || plotResult.title,
      k: explicitResult.k ?? plotResult.k,
      pooled_effect: explicitResult.pooled_effect ?? plotResult.pooled_effect,
      ci_low: explicitResult.ci_low ?? plotResult.ci_low,
      ci_high: explicitResult.ci_high ?? plotResult.ci_high,
    };
  }

  function synthesisSubsetLabel(subsetName, plotData, result) {
    return String(plotData?.title || result?.title || humanizeMetric(subsetName)).trim();
  }

  function hasSynthesisAnalysisPayload(analysis) {
    const hasResult = analysis?.primaryResult?.pooled_effect !== null
      && analysis?.primaryResult?.pooled_effect !== undefined
      && analysis?.primaryResult?.pooled_effect !== "";
    const hasPlot = Array.isArray(analysis?.plotData?.rows) && analysis.plotData.rows.length;
    const hasMeasure = String(analysis?.results?.effect_measure || analysis?.measure || "").trim();
    return hasResult || hasPlot || hasMeasure;
  }

  function hasSynthesisEstimateOrPlot(analysis) {
    const hasResult = analysis?.primaryResult?.pooled_effect !== null
      && analysis?.primaryResult?.pooled_effect !== undefined
      && analysis?.primaryResult?.pooled_effect !== "";
    const hasPlot = Array.isArray(analysis?.plotData?.rows) && analysis.plotData.rows.length;
    return hasResult || hasPlot;
  }

  function synthesisSubgroupEntries(outcomeKey, analysis, assets) {
    const primarySubset = String(analysis?.subsetName || "all_eligible").trim() || "all_eligible";
    return synthesisPlotSubsetNames(outcomeKey, analysis, assets)
      .filter((subsetName) => subsetName && subsetName !== "all_eligible" && subsetName !== primarySubset)
      .map((subsetName) => {
        const subgroup = attachSynthesisPlot(outcomeKey, {
          ...analysis,
          id: `${analysis.id}:subset:${subsetName}`,
          subsetName,
        }, assets);
        const primaryResult = synthesisSubsetResult(analysis, subgroup.plotData, subsetName);
        return {
          ...subgroup,
          label: synthesisSubsetLabel(subsetName, subgroup.plotData, primaryResult),
          primaryResult,
          isSubgroup: true,
        };
      })
      .filter(hasSynthesisEstimateOrPlot);
  }

  function attachSynthesisSubgroups(outcomeKey, analysis, assets) {
    const attached = attachSynthesisPlot(outcomeKey, analysis, assets);
    return {
      ...attached,
      subgroupAnalyses: synthesisSubgroupEntries(outcomeKey, attached, assets),
    };
  }

  function synthesisAnalysisEntries(outcomeKey, results, assets) {
    const measureAnalyses = results?.effect_measure_analyses || {};
    if (measureAnalyses && typeof measureAnalyses === "object" && Object.keys(measureAnalyses).length) {
      return Object.entries(measureAnalyses)
        .filter(([, analysis]) => analysis && typeof analysis === "object")
        .sort(([measureA], [measureB]) => effectMeasureLabel(measureA).localeCompare(effectMeasureLabel(measureB)))
        .map(([measure, analysis]) => {
          const subsetName = analysis.primary?.subset || analysis.primary_subset || "all_eligible";
          return attachSynthesisSubgroups(outcomeKey, {
            id: `measure:${measure}`,
            label: analysis.label || effectMeasureLabel(measure),
            measure,
            subsetName,
            results: analysis,
            primaryResult: analysis.primary || {},
          }, assets);
        })
        .filter(hasSynthesisAnalysisPayload);
    }

    const primarySubset = results?.primary_subset || results?.primary?.subset || "all_eligible";
    const mainAnalysis = attachSynthesisSubgroups(outcomeKey, {
      id: "main",
      label: effectMeasureLabel(results?.effect_measure || results?.analysis_type || "Analysis"),
      measure: results?.effect_measure || "",
      subsetName: primarySubset,
      results,
      primaryResult: results?.primary || {},
      includeLegacyTopLevel: true,
    }, assets);

    return [mainAnalysis].filter(hasSynthesisAnalysisPayload);
  }

  function plotTicks(min, max, count = 6) {
    const start = finiteNumber(min);
    const end = finiteNumber(max);
    if (start === null || end === null || end <= start) {
      return [];
    }
    return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
  }

  const LINEAR_AXIS_NICE_FACTORS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const RATIO_AXIS_NICE_BOUNDS = [1.01, 1.1, 1.25, 1.5, 2, 3, 5, 10, 20, 50, 100];

  function niceLinearAxisHalfWidth(value) {
    const parsed = Math.max(Math.abs(Number(value) || 0), 1e-12);
    const exponent = Math.floor(Math.log10(parsed));
    const base = 10 ** exponent;
    const fraction = parsed / base;
    const factor = LINEAR_AXIS_NICE_FACTORS.find((candidate) => candidate >= fraction) || 10;
    return factor * base;
  }

  function forestCiExtent(plotData) {
    const rows = Array.isArray(plotData?.rows) ? plotData.rows : [];
    const lows = rows.map((row) => finiteNumber(row?.ci_low)).filter((value) => value !== null);
    const highs = rows.map((row) => finiteNumber(row?.ci_high)).filter((value) => value !== null);
    if (!lows.length || !highs.length) {
      return null;
    }
    return {
      min: Math.min(...lows),
      max: Math.max(...highs),
    };
  }

  function shouldUseSymmetricLinearForestAxis(plotData) {
    const nullX = finiteNumber(plotData?.null_x);
    const analysisType = String(plotData?.analysis_type || "").trim().toLowerCase();
    return plotData?.x_scale !== "log"
      && nullX === 0
      && analysisType !== "proportion_meta_analysis";
  }

  function symmetricLinearForestAxisFromExtent(extent, padFraction = 0.05) {
    if (!extent) {
      return null;
    }
    const maxAbs = Math.max(Math.abs(extent.min), Math.abs(extent.max), 0.01);
    const bound = niceLinearAxisHalfWidth(maxAbs * (1 + padFraction));
    return {
      x_min: -bound,
      x_max: bound,
      null_x: 0,
    };
  }

  function symmetricLogForestAxisFromExtent(extent) {
    if (!extent || extent.min <= 0 || extent.max <= 0) {
      return null;
    }
    const maxDistance = Math.max(extent.max, 1 / extent.min, 1.1) * 1.05;
    const bound = RATIO_AXIS_NICE_BOUNDS.find((candidate) => candidate >= maxDistance) || maxDistance;
    return {
      x_min: 1 / bound,
      x_max: bound,
      null_x: 1,
    };
  }

  function combineForestCiExtents(...plots) {
    const extents = plots.map(forestCiExtent).filter(Boolean);
    if (!extents.length) {
      return null;
    }
    return {
      min: Math.min(...extents.map((extent) => extent.min)),
      max: Math.max(...extents.map((extent) => extent.max)),
    };
  }

  function forestDisplayAxis(plotData, axisOverride = null) {
    const isLogScale = plotData?.x_scale === "log";
    const overrideMin = finiteNumber(axisOverride?.x_min);
    const overrideMax = finiteNumber(axisOverride?.x_max);
    if (overrideMin !== null && overrideMax !== null && overrideMax > overrideMin) {
      return {
        x_min: overrideMin,
        x_max: overrideMax,
        null_x: finiteNumber(axisOverride?.null_x),
      };
    }
    if (shouldUseSymmetricLinearForestAxis(plotData)) {
      const symmetricAxis = symmetricLinearForestAxisFromExtent(forestCiExtent(plotData));
      if (symmetricAxis) {
        return symmetricAxis;
      }
    }
    if (isLogScale) {
      const symmetricAxis = symmetricLogForestAxisFromExtent(forestCiExtent(plotData));
      if (symmetricAxis) {
        return symmetricAxis;
      }
    }
    return {
      x_min: finiteNumber(plotData?.x_min),
      x_max: finiteNumber(plotData?.x_max),
      null_x: finiteNumber(plotData?.null_x),
    };
  }

  function sharedForestComparisonAxis(agentPlot, cochranePlot) {
    if (!agentPlot || !cochranePlot || agentPlot.x_scale !== cochranePlot.x_scale) {
      return null;
    }
    const combinedExtent = combineForestCiExtents(agentPlot, cochranePlot);
    if (!combinedExtent) {
      return null;
    }
    if (agentPlot.x_scale === "log") {
      return symmetricLogForestAxisFromExtent(combinedExtent);
    }
    if (shouldUseSymmetricLinearForestAxis(agentPlot) && shouldUseSymmetricLinearForestAxis(cochranePlot)) {
      return symmetricLinearForestAxisFromExtent(combinedExtent);
    }
    return null;
  }

  function logPlotTicks(min, max) {
    const start = finiteNumber(min);
    const end = finiteNumber(max);
    if (start === null || end === null || start <= 0 || end <= start) {
      return [];
    }
    const ticks = [];
    const multipliers = [1, 2, 5];
    const startPower = Math.floor(Math.log10(start)) - 1;
    const endPower = Math.ceil(Math.log10(end)) + 1;
    for (let power = startPower; power <= endPower; power += 1) {
      const base = 10 ** power;
      multipliers.forEach((multiplier) => {
        const tick = multiplier * base;
        if (tick >= start && tick <= end) {
          ticks.push(tick);
        }
      });
    }
    return ticks.length ? ticks : [start, end];
  }

  function formatAxisTick(value, isLogScale) {
    const parsed = finiteNumber(value);
    if (parsed === null) {
      return "—";
    }
    if (!isLogScale) {
      const rounded = Number(parsed.toFixed(2));
      return Object.is(rounded, -0) ? "0" : rounded.toString();
    }
    if (parsed < 1) {
      return Number(parsed.toPrecision(2)).toString();
    }
    if (parsed < 10) {
      return Number(parsed.toFixed(2)).toString();
    }
    return Number(parsed.toFixed(1)).toString();
  }

  function formatCompactStat(value, digits = 2) {
    const parsed = finiteNumber(value);
    if (parsed === null) {
      return "—";
    }
    const formatted = parsed.toFixed(digits).replace(/\.?0+$/, "");
    return formatted === "" || formatted === "-" ? "0" : formatted;
  }

  function formatPValue(value) {
    const parsed = finiteNumber(value);
    if (parsed === null) {
      return "P not available";
    }
    if (parsed < 0.00001) {
      return "P < 0.00001";
    }
    if (parsed < 0.001) {
      return `P = ${parsed.toFixed(4)}`;
    }
    if (parsed < 0.01) {
      return `P = ${parsed.toFixed(3)}`;
    }
    return `P = ${parsed.toFixed(2)}`;
  }

  function subgroupTestLabel(field, subgroupPlan) {
    const dimensionsByField = subgroupPlanLookup(subgroupPlan);
    const dimension = dimensionsByField.get(String(field || "").trim());
    return dimension?.groupLabel || humanizeMetric(field);
  }

  function validSubgroupDifferenceTestEntries(subgroupTests) {
    return subgroupTests && typeof subgroupTests === "object" && !Array.isArray(subgroupTests)
      ? Object.entries(subgroupTests).filter(([, test]) => {
          const q = finiteNumber(test?.Q_between);
          const df = finiteNumber(test?.df);
          return q !== null && df !== null && df > 0;
        })
      : [];
  }

  function subgroupDifferenceTestsForFields(subgroupTests, fieldNames) {
    const fields = new Set((fieldNames || []).map((field) => String(field || "").trim()).filter(Boolean));
    if (!fields.size) {
      return {};
    }
    return Object.fromEntries(
      validSubgroupDifferenceTestEntries(subgroupTests)
        .filter(([field]) => fields.has(String(field || "").trim()))
    );
  }

  function renderSubgroupDifferenceTests(subgroupTests, subgroupPlan) {
    const tests = validSubgroupDifferenceTestEntries(subgroupTests);
    if (!tests.length) {
      return `<div><strong>Test for subgroup differences:</strong> Not applicable</div>`;
    }
    return tests.map(([field, test]) => {
      const q = finiteNumber(test.Q_between);
      const df = finiteNumber(test.df);
      const pValue = finiteNumber(test.p_value);
      const i2 = finiteNumber(test.I2);
      const label = subgroupTestLabel(field, subgroupPlan);
      return `
        <div><strong>Test for subgroup differences${tests.length > 1 ? ` (${escapeHtml(label)})` : ""}:</strong> ${tests.length === 1 ? `${escapeHtml(label)}: ` : ""}Chi² = ${formatCompactStat(q, 2)}, df = ${formatCompactStat(df, 0)} (${formatPValue(pValue)}); I² = ${formatCompactStat(i2, 0)}%</div>
      `;
    }).join("");
  }

  function renderSynthesisDiagnostics(primaryResult, subgroupTests = null, subgroupPlan = {}, options = {}) {
    const tau2 = finiteNumber(primaryResult?.tau2);
    const q = finiteNumber(primaryResult?.Q);
    const df = finiteNumber(primaryResult?.df);
    const i2 = finiteNumber(primaryResult?.I2);
    const k = finiteNumber(primaryResult?.k);
    const z = finiteNumber(primaryResult?.overall_z);
    const zAbs = z === null ? null : Math.abs(z);
    const hasHeterogeneityTest = k !== null && k > 1 && df !== null && df > 0 && q !== null;
    const heterogeneityP = finiteNumber(primaryResult?.heterogeneity_p_value);
    const overallP = finiteNumber(primaryResult?.overall_p_value);
    const showSubgroupDifferences = options.showSubgroupDifferences !== false;
    const subgroupDifferenceRows = showSubgroupDifferences
      ? renderSubgroupDifferenceTests(subgroupTests, subgroupPlan)
      : "";
    const collapsed = options.collapsed === true;

    if (tau2 === null && q === null && i2 === null && z === null && !subgroupDifferenceRows) {
      return "";
    }
    const heterogeneityText = hasHeterogeneityTest
      ? `Tau² = ${formatCompactStat(tau2)}; Chi² = ${formatCompactStat(q)}, df = ${formatCompactStat(df, 0)} (${formatPValue(heterogeneityP)}); I² = ${formatCompactStat(i2, 0)}%`
      : "Not applicable";

    const body = `
      <div class="synthesis-analysis-notes ${collapsed ? "synthesis-analysis-notes-collapsed-body" : ""}">
        <div><strong>Heterogeneity:</strong> ${heterogeneityText}</div>
        <div><strong>Test for overall effect:</strong> Z = ${formatCompactStat(zAbs, 2)} (${formatPValue(overallP)})</div>
        ${subgroupDifferenceRows}
      </div>
    `;
    if (!collapsed) {
      return body;
    }
    return `
      <details class="synthesis-diagnostics-collapsible">
        <summary>Synthesis diagnostics</summary>
        ${body}
      </details>
    `;
  }

  function renderPublicationOverlapWarnings(warnings) {
    const items = (Array.isArray(warnings) ? warnings : [])
      .filter((warning) => warning && typeof warning === "object");
    if (!items.length) {
      return "";
    }
    return `
      <div class="synthesis-publication-overlap-warning" role="note">
        <strong>Possible overlapping dataset</strong>
        <ul>
          ${items.map((warning) => {
            const groupId = String(warning.group_id || "linked publication group").trim();
            const members = (Array.isArray(warning.member_labels_in_analysis)
              ? warning.member_labels_in_analysis
              : warning.member_pmids_in_analysis || []
            )
              .map((item) => String(item || "").trim())
              .filter(Boolean);
            const message = String(warning.message || "This synthesis includes multiple linked publications; manual review is required.").trim();
            const reason = String(warning.reason || "").trim();
            return `
              <li>
                <span>${escapeHtml(message)}</span>
                <span class="synthesis-publication-overlap-detail">Group: ${escapeHtml(groupId)}${members.length ? `; studies: ${escapeHtml(members.join("; "))}` : ""}${reason ? `; reason: ${escapeHtml(reason)}` : ""}</span>
              </li>
            `;
          }).join("")}
        </ul>
      </div>
    `;
  }

  function cochraneReferenceStatusSummaryLabel(status) {
    return COCHRANE_REFERENCE_STATUS_META[String(status || "")]?.label
      || String(status || "").replaceAll("_", " ");
  }

  function cochraneReferenceStatusesForPlot(ciOverlapArtifact, plotKey) {
    const row = synthesisCiOverlapByPlotKey(ciOverlapArtifact)[plotKey] || {};
    const statuses = Array.isArray(row.agent_study_reference_statuses)
      ? row.agent_study_reference_statuses
      : [];
    return statuses.reduce((acc, item) => {
      const pmid = String(item?.pmid || "").trim();
      const label = String(item?.label || "").trim();
      if (pmid) {
        acc[pmid] = item;
      } else if (label) {
        acc[`label:${label}`] = item;
      }
      return acc;
    }, {});
  }

  function cochraneLogPlotTicks(min, max) {
    const preferred = [0.01, 0.1, 1, 10, 100];
    const ticks = preferred.filter((tick) => tick >= min && tick <= max);
    return ticks.length >= 2 ? ticks : logPlotTicks(min, max);
  }

  function normalizeStudyLabel(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\bpmid\s*\d+\b/g, "")
      .replace(/\(\s*\d+\s*\)\s*$/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function wrapForestTitle(title, maxChars = 88, maxLines = 3) {
    const words = String(title || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [];
    }

    const lines = [];
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars || !current) {
        current = candidate;
        return;
      }
      lines.push(current);
      current = word;
    });
    if (current) {
      lines.push(current);
    }

    if (lines.length <= maxLines) {
      return lines;
    }

    const kept = lines.slice(0, maxLines);
    const suffix = "...";
    const last = kept[kept.length - 1] || "";
    kept[kept.length - 1] = last.length + suffix.length <= maxChars
      ? `${last}${suffix}`
      : `${last.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`;
    return kept;
  }

  function renderInteractiveForestPlot(plotData, plotKey, outcomeTitle, comparisonPayload, options = {}) {
    const sourceRows = Array.isArray(plotData.rows) ? plotData.rows : [];
    const studyRows = sourceRows.filter((row) => row?.type !== "pooled");
    const pooledRows = sourceRows.filter((row) => row?.type === "pooled");
    const fallbackPooledRows = !pooledRows.length && studyRows.length === 1
      ? [{
          ...studyRows[0],
          type: "pooled",
          label: "Total",
          weight_percent: 100.0,
          source_row: {},
        }]
      : [];
    const rows = [
      ...studyRows,
      ...pooledRows,
      ...fallbackPooledRows,
    ];
    const isLogScale = plotData.x_scale === "log";
    const displayAxis = forestDisplayAxis(plotData, options.axisOverride);
    const xMin = finiteNumber(displayAxis.x_min);
    const xMax = finiteNumber(displayAxis.x_max);
    if (!rows.length || xMin === null || xMax === null || xMax <= xMin) {
      return "";
    }

    if (isLogScale && (xMin <= 0 || xMax <= 0)) {
      return "";
    }

    const displayTitle = String(outcomeTitle || plotData.outcome_name || plotData.title || "Forest plot").trim();
    const effectMeasure = String(plotData.effect_measure || "").trim().toLowerCase();
    const showHazardLogColumns = effectMeasure === "hazard_ratio";
    const showEventColumns = ["risk_ratio", "odds_ratio"].includes(effectMeasure);
    const splitEffectValueLabel = !showHazardLogColumns && !showEventColumns;
    const favoursLeft = String(plotData.favours_left || "").trim();
    const favoursRight = String(plotData.favours_right || "").trim();
    const hasFavours = Boolean(favoursLeft || favoursRight);
    const showTitle = options.showTitle !== false;
    const showReferenceStatuses = options.showReferenceStatuses === true;
    const referenceStatuses = options.referenceStatuses || {};
    const disableRowJump = options.disableRowJump === true;
    const selectedStudy = options.selectedStudy || {};
    const selectedPmid = String(selectedStudy.pmid || "").trim();
    const selectedLabel = normalizeStudyLabel(selectedStudy.label);
    const cochraneStudyMatchPlotKey = String(options.cochraneStudyMatchPlotKey || "").trim();
    const width = showHazardLogColumns ? 1280 : showEventColumns ? 1340 : 1180;
    const titleMaxChars = Math.max(54, Math.floor((width - 220) / 12));
    const titleLines = showTitle ? wrapForestTitle(displayTitle, titleMaxChars, 3) : [];
    const titleLineHeight = 24;
    const titleOffset = showTitle ? Math.max(0, (titleLines.length - 1) * titleLineHeight) : -32;
    const left = showHazardLogColumns ? 895 : showEventColumns ? 925 : 725;
    const right = 38;
    const titleY = 28;
    const headerCenterY = 76 + titleOffset;
    const plotAreaTop = 116 + titleOffset;
    const top = 148 + titleOffset;
    const bottom = hasFavours ? 130 : 46;
    const rowHeight = 58;
    const plotLeft = left;
    const plotRight = width - right;
    const plotWidth = plotRight - plotLeft;
    const height = top + bottom + rows.length * rowHeight;
    const studyLabelX = showHazardLogColumns ? 150 : showEventColumns ? 155 : 165;
    const logValueX = 285;
    const seValueX = 365;
    const sampleOneEventX = showEventColumns ? 292 : null;
    const sampleOneX = showHazardLogColumns ? 490 : showEventColumns ? 360 : 300;
    const sampleTwoEventX = showEventColumns ? 475 : null;
    const sampleTwoX = showHazardLogColumns ? 585 : showEventColumns ? 543 : 390;
    const weightLabelX = showHazardLogColumns ? 685 : showEventColumns ? 640 : 485;
    const valueLabelX = showHazardLogColumns ? 860 : showEventColumns ? 870 : 650;
    const sampleHeaders = forestSampleHeaders(rows, comparisonPayload);
    const sampleTotalFields = showEventColumns
      ? ["events_arm_1", "n_arm_1", "events_arm_2", "n_arm_2"]
      : ["n_arm_1", "n_arm_2"];
    const sampleTotals = sampleTotalFields.reduce((totals, key) => {
      const values = rows
        .filter((row) => row.type !== "pooled")
        .map((row) => sampleSizeNumber(row?.source_row?.[key]))
        .filter((value) => value !== null);
      totals[key] = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
      return totals;
    }, {});
    const nullX = finiteNumber(displayAxis.null_x);
    const xScale = isLogScale
      ? (value) => plotLeft + ((Math.log(value) - Math.log(xMin)) / (Math.log(xMax) - Math.log(xMin))) * plotWidth
      : (value) => plotLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const centeredLinearNull = !isLogScale
      && nullX !== null
      && Math.abs((xMin + xMax) / 2 - nullX) <= Math.max((xMax - xMin) * 1e-9, 1e-9);
    const ticks = isLogScale ? cochraneLogPlotTicks(xMin, xMax) : plotTicks(xMin, xMax, centeredLinearNull ? 5 : 6);
    const tickTopY = top + rows.length * rowHeight - 12;
    const tickBottomY = tickTopY + 12;
    const tickY = tickBottomY + 18;
    const favoursY = tickY + 22;
    const hasVisibleNull = nullX !== null && nullX >= xMin && nullX <= xMax && (!isLogScale || nullX > 0);
    const nullLineX = hasVisibleNull ? xScale(nullX) : plotLeft + plotWidth / 2;
    const favoursLeftX = (plotLeft + nullLineX) / 2;
    const favoursRightX = (nullLineX + plotRight) / 2;
    const effectColumnLabel = plotData.x_axis_label || "Effect size";

    return `
      <div class="interactive-forest-scroll">
        <svg
          class="interactive-forest-svg"
          viewBox="0 0 ${width} ${height}"
          role="img"
          aria-label="${escapeHtml(displayTitle)}"
        >
          <rect class="forest-panel-bg" x="0" y="0" width="${width}" height="${height}" rx="18"></rect>
          <rect class="forest-plot-area" x="${plotLeft}" y="${plotAreaTop}" width="${plotWidth}" height="${rows.length * rowHeight + 30}"></rect>
          ${titleLines.map((line, index) => `
            <text class="forest-title" x="${width / 2}" y="${titleY + index * titleLineHeight}">${sentence(line)}</text>
          `).join("")}
          ${renderForestColumnHeader("Study", studyLabelX, headerCenterY, "forest-column-header forest-study-header", 12, 1)}
          ${showHazardLogColumns ? renderForestColumnHeader("log[Hazard Ratio]", logValueX, headerCenterY, "forest-column-header forest-log-header", 12, 3) : ""}
          ${showHazardLogColumns ? renderForestColumnHeader("SE", seValueX, headerCenterY, "forest-column-header forest-se-header", 4, 1) : ""}
          ${showEventColumns
            ? renderForestEventHeaderLabel(sampleHeaders.arm1, sampleOneEventX, sampleOneX, headerCenterY, "forest-column-header forest-sample-header")
            : renderForestHeaderLabel(sampleHeaders.arm1, sampleOneX, headerCenterY, "forest-column-header forest-sample-header")
          }
          ${showEventColumns
            ? renderForestEventHeaderLabel(sampleHeaders.arm2, sampleTwoEventX, sampleTwoX, headerCenterY, "forest-column-header forest-sample-header")
            : renderForestHeaderLabel(sampleHeaders.arm2, sampleTwoX, headerCenterY, "forest-column-header forest-sample-header")
          }
          ${renderForestColumnHeader("Weight", weightLabelX, headerCenterY, "forest-column-header forest-weight-header", 8, 1)}
          ${renderForestColumnHeader(effectColumnLabel, valueLabelX, headerCenterY, "forest-column-header forest-effect-header", 13, 3)}
          ${renderForestColumnHeader(effectColumnLabel, plotLeft + plotWidth / 2, headerCenterY, "forest-column-header forest-plot-header", 16, 3)}
          <line class="forest-header-line" x1="24" x2="${width - 24}" y1="${plotAreaTop}" y2="${plotAreaTop}"></line>
          ${ticks.map((tick) => {
            const x = xScale(tick);
            return `
              <line class="forest-grid-line" x1="${x}" x2="${x}" y1="${plotAreaTop}" y2="${top + rows.length * rowHeight - 12}"></line>
              <line class="forest-axis-tick-mark" x1="${x}" x2="${x}" y1="${tickTopY}" y2="${tickBottomY}"></line>
              <text class="forest-axis-tick" x="${x}" y="${tickY}">${formatAxisTick(tick, isLogScale)}</text>
            `;
          }).join("")}
          ${hasVisibleNull
            ? `<line class="forest-null-line" x1="${xScale(nullX)}" x2="${xScale(nullX)}" y1="${plotAreaTop}" y2="${top + rows.length * rowHeight - 12}"></line>`
            : ""
          }
          ${rows.map((row, index) => {
            const effect = finiteNumber(row.effect);
            const ciLow = finiteNumber(row.ci_low);
            const ciHigh = finiteNumber(row.ci_high);
            if (effect === null || ciLow === null || ciHigh === null || (isLogScale && (effect <= 0 || ciLow <= 0 || ciHigh <= 0))) {
              return "";
            }
            const y = top + index * rowHeight;
            const isPooled = row.type === "pooled";
            const pmid = String(row.pmid || "").trim();
            const label = isPooled ? (row.label || "Total") : row.label || "";
            const rowSelected = !isPooled && (
              (selectedPmid && pmid && pmid === selectedPmid)
              || (!selectedPmid && selectedLabel && normalizeStudyLabel(label) === selectedLabel)
            );
            const referenceKey = pmid || (label ? `label:${String(label).trim()}` : "");
            const referenceStatus = showReferenceStatuses && !isPooled && referenceKey ? referenceStatuses[referenceKey] : null;
            const referenceStatusCode = String(referenceStatus?.cochrane_reference_status || "").trim();
            const referenceStatusTooltip = referenceStatusCode
              ? `\nCochrane reference status: ${referenceStatus?.cochrane_reference_status_label || cochraneReferenceStatusSummaryLabel(referenceStatusCode)}`
              : "";
            const cochraneStudyMatchTooltip = cochraneStudyMatchPlotKey && !isPooled
              ? "\nClick to compare this Cochrane study row with the agent plot."
              : "";
            const valueText = `${formatEffect(effect)} [${formatEffect(ciLow)}, ${formatEffect(ciHigh)}]`;
            const weightText = formatWeightPercent(row.weight_percent);
            const logValueText = showHazardLogColumns && !isPooled ? formatForestStatistic(row?.source_row?.effect_size_transformed, 6) : "";
            const seText = showHazardLogColumns && !isPooled ? formatForestStatistic(forestTransformedSe(row), 6) : "";
            const eventArm1 = showEventColumns ? forestSampleSize(row, "events_arm_1", sampleTotals) : "";
            const nArm1 = forestSampleSize(row, "n_arm_1", sampleTotals);
            const eventArm2 = showEventColumns ? forestSampleSize(row, "events_arm_2", sampleTotals) : "";
            const nArm2 = forestSampleSize(row, "n_arm_2", sampleTotals);
            const sampleText = showEventColumns
              ? ` | Intervention events/total=${eventArm1}/${nArm1}, Comparator events/total=${eventArm2}/${nArm2}`
              : nArm1 === "—" && nArm2 === "—" ? "" : ` | Intervention n=${nArm1}, Comparator n=${nArm2}`;
            const weightTooltip = weightText ? ` | Weight=${weightText}` : "";
            const transformedTooltip = logValueText && seText ? ` | log(HR)=${logValueText}, SE=${seText}` : "";
            const fallbackNote = varianceFallbackNote(row?.source_row);
            const tooltipText = fallbackNote
              ? `${forestStudyLabelParts(row).primary}\n${fallbackNote}${referenceStatusTooltip}${cochraneStudyMatchTooltip}`
              : `${label}: ${valueText}${sampleText}${weightTooltip}${transformedTooltip}${referenceStatusTooltip}${cochraneStudyMatchTooltip}`;
            const rowClass = [
              "forest-row",
              isPooled ? "forest-row-pooled" : "forest-row-study",
              referenceStatusCode ? `forest-row-reference-${referenceStatusCode}` : "",
              rowSelected ? "forest-row-study-selected" : "",
            ].filter(Boolean).join(" ");
            const attrs = cochraneStudyMatchPlotKey && !isPooled
              ? `tabindex="0" role="button" data-cochrane-study-match="${escapeHtml(cochraneStudyMatchPlotKey)}" data-cochrane-study-pmid="${escapeHtml(pmid)}" data-cochrane-study-label="${escapeHtml(label)}" aria-label="${escapeHtml(`Compare ${label || pmid || "this Cochrane study"} with the agent synthesis plot`)}"`
              : !isPooled && pmid && !disableRowJump
              ? `tabindex="0" role="button" data-forest-plot-key="${escapeHtml(plotKey)}" data-forest-pmid="${escapeHtml(pmid)}" aria-label="${escapeHtml(`Jump to extraction row for ${label}`)}"`
              : "";
            const pointX = xScale(effect);
            const ciLowX = xScale(ciLow);
            const ciHighX = xScale(ciHigh);
            const weightValue = finiteNumber(row.weight_percent);
            const squareSide = isPooled
              ? 0
              : 7 + Math.sqrt(Math.max(0, Math.min(100, weightValue ?? 100)) / 100) * 11;
            const diamondHalfHeight = 10;
            const pointShape = isPooled
              ? `<polygon class="forest-point forest-diamond" points="${ciLowX},${y} ${pointX},${y - diamondHalfHeight} ${ciHighX},${y} ${pointX},${y + diamondHalfHeight}"></polygon>`
              : `<rect class="forest-point forest-square" x="${pointX - squareSide / 2}" y="${y - squareSide / 2}" width="${squareSide}" height="${squareSide}"></rect>`;
            return `
              <g class="${rowClass}" ${attrs}>
                <title>${escapeHtml(tooltipText)}</title>
                <rect class="forest-row-hit" x="8" y="${y - 24}" width="${width - 16}" height="46" rx="8"></rect>
                ${renderForestStudyLabel(row, studyLabelX, y)}
                ${showHazardLogColumns ? `<text class="forest-log-label" x="${logValueX}" y="${y + 5}">${escapeHtml(logValueText)}</text>` : ""}
                ${showHazardLogColumns ? `<text class="forest-se-label" x="${seValueX}" y="${y + 5}">${escapeHtml(seText)}</text>` : ""}
                ${showEventColumns ? `<text class="forest-sample-label" x="${sampleOneEventX}" y="${y + 5}">${eventArm1}</text>` : ""}
                <text class="forest-sample-label" x="${sampleOneX}" y="${y + 5}">${nArm1}</text>
                ${showEventColumns ? `<text class="forest-sample-label" x="${sampleTwoEventX}" y="${y + 5}">${eventArm2}</text>` : ""}
                <text class="forest-sample-label" x="${sampleTwoX}" y="${y + 5}">${nArm2}</text>
                <text class="forest-weight-label" x="${weightLabelX}" y="${y + 5}">${escapeHtml(weightText)}</text>
                ${renderForestValueLabel(valueText, valueLabelX, y, splitEffectValueLabel)}
                ${isPooled ? "" : `<line class="forest-ci-line" x1="${ciLowX}" x2="${ciHighX}" y1="${y}" y2="${y}"></line>`}
                ${pointShape}
              </g>
            `;
          }).join("")}
          ${renderForestFooterLabel(favoursLeft, favoursLeftX, favoursY, "forest-favours-label forest-favours-left")}
          ${renderForestFooterLabel(favoursRight, favoursRightX, favoursY, "forest-favours-label forest-favours-right")}
        </svg>
      </div>
    `;
  }

  function renderCompactSynthesisTotalPlot(plotData, plotKey) {
    const rows = Array.isArray(plotData?.rows) ? plotData.rows : [];
    const pooledRows = rows.filter((row) => row?.type === "pooled");
    const row = pooledRows.find((item) => item?.role === "subgroup_family_total") || pooledRows[pooledRows.length - 1] || null;
    const effect = finiteNumber(row?.effect);
    const ciLow = finiteNumber(row?.ci_low);
    const ciHigh = finiteNumber(row?.ci_high);
    const isLogScale = plotData.x_scale === "log";
    const displayAxis = forestDisplayAxis(plotData);
    const xMin = finiteNumber(displayAxis.x_min);
    const xMax = finiteNumber(displayAxis.x_max);
    if (!row || effect === null || ciLow === null || ciHigh === null || xMin === null || xMax === null || xMax <= xMin) {
      return "";
    }

    if (isLogScale && (effect <= 0 || ciLow <= 0 || ciHigh <= 0 || xMin <= 0 || xMax <= 0)) {
      return "";
    }

    const effectMeasure = String(plotData.effect_measure || "").trim().toLowerCase();
    const showHazardLogColumns = effectMeasure === "hazard_ratio";
    const showEventColumns = ["risk_ratio", "odds_ratio"].includes(effectMeasure);
    const splitEffectValueLabel = !showHazardLogColumns && !showEventColumns;
    const width = showHazardLogColumns ? 1280 : showEventColumns ? 1340 : 1180;
    const favoursLeft = String(plotData.favours_left || "").trim();
    const favoursRight = String(plotData.favours_right || "").trim();
    const hasFavours = Boolean(favoursLeft || favoursRight);
    const height = hasFavours ? 184 : 112;
    const plotLeft = showHazardLogColumns ? 895 : showEventColumns ? 925 : 725;
    const plotRight = width - 38;
    const plotWidth = plotRight - plotLeft;
    const studyLabelX = showHazardLogColumns ? 150 : showEventColumns ? 155 : 165;
    const logValueX = 285;
    const seValueX = 365;
    const sampleOneEventX = showEventColumns ? 292 : null;
    const sampleOneX = showHazardLogColumns ? 490 : showEventColumns ? 360 : 300;
    const sampleTwoEventX = showEventColumns ? 475 : null;
    const sampleTwoX = showHazardLogColumns ? 585 : showEventColumns ? 543 : 390;
    const weightLabelX = showHazardLogColumns ? 685 : showEventColumns ? 640 : 485;
    const valueLabelX = showHazardLogColumns ? 860 : showEventColumns ? 870 : 650;
    const rowY = 40;
    const axisTop = 18;
    const axisBottom = 68;
    const tickTopY = axisBottom;
    const tickBottomY = tickTopY + 11;
    const tickY = tickBottomY + 17;
    const favoursY = tickY + 22;
    const nullX = finiteNumber(displayAxis.null_x);
    const xScale = isLogScale
      ? (value) => plotLeft + ((Math.log(value) - Math.log(xMin)) / (Math.log(xMax) - Math.log(xMin))) * plotWidth
      : (value) => plotLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const ticks = isLogScale ? cochraneLogPlotTicks(xMin, xMax) : plotTicks(xMin, xMax, 5);
    const hasVisibleNull = nullX !== null && nullX >= xMin && nullX <= xMax && (!isLogScale || nullX > 0);
    const nullLineX = hasVisibleNull ? xScale(nullX) : plotLeft + plotWidth / 2;
    const favoursLeftX = (plotLeft + nullLineX) / 2;
    const favoursRightX = (nullLineX + plotRight) / 2;
    const pointX = xScale(effect);
    const ciLowX = xScale(ciLow);
    const ciHighX = xScale(ciHigh);
    const valueText = `${formatEffect(effect)} [${formatEffect(ciLow)}, ${formatEffect(ciHigh)}]`;
    const label = String(row.label || "Total (95% CI)").trim();
    const compactSampleSize = (key) => {
      const formatted = formatSampleSize(row?.source_row?.[key]);
      return formatted === "—" ? "" : formatted;
    };
    const eventArm1 = showEventColumns ? compactSampleSize("events_arm_1") : "";
    const nArm1 = compactSampleSize("n_arm_1");
    const eventArm2 = showEventColumns ? compactSampleSize("events_arm_2") : "";
    const nArm2 = compactSampleSize("n_arm_2");
    const weightText = formatWeightPercent(row.weight_percent);
    const compactRow = {
      ...row,
      label,
      type: "pooled",
    };

    return `
      <div class="synthesis-total-compact">
        <svg
          class="synthesis-total-compact-svg"
          viewBox="0 0 ${width} ${height}"
          role="img"
          aria-label="${escapeHtml(`${label}: ${valueText}`)}"
          data-forest-plot-key="${escapeHtml(plotKey || "")}"
        >
          <title>${escapeHtml(`${label}: ${valueText}`)}</title>
          <rect class="synthesis-total-compact-bg" x="0" y="0" width="${width}" height="${height}" rx="12"></rect>
          <rect class="synthesis-total-plot-area" x="${plotLeft}" y="${axisTop}" width="${plotWidth}" height="${axisBottom - axisTop}"></rect>
          <g class="forest-row forest-row-pooled">
            ${renderForestStudyLabel(compactRow, studyLabelX, rowY)}
            ${showHazardLogColumns ? `<text class="forest-log-label" x="${logValueX}" y="${rowY + 5}"></text>` : ""}
            ${showHazardLogColumns ? `<text class="forest-se-label" x="${seValueX}" y="${rowY + 5}"></text>` : ""}
            ${showEventColumns ? `<text class="forest-sample-label" x="${sampleOneEventX}" y="${rowY + 5}">${eventArm1}</text>` : ""}
            <text class="forest-sample-label" x="${sampleOneX}" y="${rowY + 5}">${nArm1}</text>
            ${showEventColumns ? `<text class="forest-sample-label" x="${sampleTwoEventX}" y="${rowY + 5}">${eventArm2}</text>` : ""}
            <text class="forest-sample-label" x="${sampleTwoX}" y="${rowY + 5}">${nArm2}</text>
            <text class="forest-weight-label" x="${weightLabelX}" y="${rowY + 5}">${escapeHtml(weightText)}</text>
            ${renderForestValueLabel(valueText, valueLabelX, rowY, splitEffectValueLabel)}
          </g>
          ${ticks.map((tick) => {
            const x = xScale(tick);
            return `
              <line class="forest-grid-line" x1="${x}" x2="${x}" y1="${axisTop}" y2="${axisBottom}"></line>
              <line class="forest-axis-tick-mark" x1="${x}" x2="${x}" y1="${tickTopY}" y2="${tickBottomY}"></line>
              <text class="forest-axis-tick" x="${x}" y="${tickY}">${formatAxisTick(tick, isLogScale)}</text>
            `;
          }).join("")}
          <line class="forest-axis-baseline" x1="${plotLeft}" x2="${plotRight}" y1="${axisBottom}" y2="${axisBottom}"></line>
          ${hasVisibleNull
            ? `<line class="forest-null-line" x1="${xScale(nullX)}" x2="${xScale(nullX)}" y1="${axisTop}" y2="${axisBottom}"></line>`
            : ""
          }
          ${renderForestFooterLabel(favoursLeft, favoursLeftX, favoursY, "forest-favours-label forest-favours-left")}
          ${renderForestFooterLabel(favoursRight, favoursRightX, favoursY, "forest-favours-label forest-favours-right")}
          <polygon class="forest-point forest-diamond" points="${ciLowX},${rowY} ${pointX},${rowY - 10} ${ciHighX},${rowY} ${pointX},${rowY + 10}"></polygon>
        </svg>
      </div>
    `;
  }

  function synthesisStudyCountLabel(analysis) {
    const explicitK = finiteNumber(analysis?.primaryResult?.k);
    const count = explicitK ?? synthesisStudyRowsFromPlot(analysis?.plotData).length;
    const normalized = finiteNumber(count);
    if (normalized === null) {
      return "Studies unavailable";
    }
    return `${formatCompactStat(normalized, 0)} ${normalized === 1 ? "study" : "studies"}`;
  }

  function synthesisEstimateLabel(analysis) {
    const primaryResult = analysis?.primaryResult || {};
    const effect = finiteNumber(primaryResult.pooled_effect);
    const ciLow = finiteNumber(primaryResult.ci_low);
    const ciHigh = finiteNumber(primaryResult.ci_high);
    if (effect === null || ciLow === null || ciHigh === null) {
      return "";
    }
    const measure = effectMeasureLabel(analysis?.plotData?.effect_measure || analysis?.measure || "");
    return `${measure} ${formatEffect(effect)} [${formatEffect(ciLow)}, ${formatEffect(ciHigh)}]`;
  }

  function subgroupDimensionLabel(dimension) {
    const fieldName = String(dimension?.field_name || "").trim();
    const label = String(dimension?.label || fieldName || "Subgroup").trim();
    const normalized = label.toLowerCase();
    if (fieldName === "comparison_variant") {
      return "Comparison variants";
    }
    if (fieldName === "age_group" || normalized.includes("age")) {
      return "Age";
    }
    return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function subgroupPlanLookup(subgroupPlan) {
    const dimensions = Array.isArray((subgroupPlan || {}).subgroup_dimensions)
      ? subgroupPlan.subgroup_dimensions
      : [];
    const byField = new Map();
    dimensions.forEach((dimension, dimensionIndex) => {
      const fieldName = String(dimension?.field_name || "").trim();
      if (!fieldName) {
        return;
      }
      const categories = Array.isArray(dimension.categories) ? dimension.categories : [];
      const categoryByValue = new Map();
      categories.forEach((category, categoryIndex) => {
        const value = String(category?.value || "").trim();
        if (value) {
          categoryByValue.set(value, { ...category, categoryIndex });
        }
      });
      byField.set(fieldName, {
        ...dimension,
        dimensionIndex,
        groupLabel: subgroupDimensionLabel(dimension),
        categoryByValue,
      });
    });
    return byField;
  }

  function synthesisSubsetSpecsForAnalysis(analysis = {}) {
    const config = analysis?.results?.synthesis_configuration || analysis?.synthesis_configuration || {};
    const subsets = Array.isArray(config.subsets) ? config.subsets : [];
    return new Map(
      subsets
        .filter((subset) => subset?.name)
        .map((subset) => [String(subset.name).trim(), subset])
    );
  }

  function subgroupDescriptor(subgroup, subsetSpecMap, subgroupPlan) {
    const subsetName = String(subgroup?.subsetName || "").trim();
    const subsetSpec = subsetSpecMap.get(subsetName) || {};
    const filter = Array.isArray(subsetSpec.filters) ? subsetSpec.filters[0] || {} : {};
    const fieldName = String(filter.field || "").trim();
    const value = String(filter.value || "").trim();
    const dimensionsByField = subgroupPlanLookup(subgroupPlan);
    const dimension = dimensionsByField.get(fieldName);
    const category = value && dimension ? dimension.categoryByValue.get(value) : null;
    const rawLabel = String(
      category?.label
        || subgroup?.label
        || subsetSpec.title
        || humanizeMetric(subsetName)
    ).trim();

    if (dimension) {
      const groupLabel = dimension.groupLabel;
      const prefixPattern = new RegExp(`^${groupLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i");
      return {
        groupLabel,
        label: rawLabel.replace(prefixPattern, ""),
        groupOrder: dimension.dimensionIndex,
        itemOrder: category?.categoryIndex ?? 999,
        fieldName,
        value,
      };
    }

    if (subsetName.startsWith("comparison_")) {
      return {
        groupLabel: "Comparison variants",
        label: rawLabel.replace(/^comparison\s*:\s*/i, ""),
        groupOrder: 50,
        itemOrder: 999,
        fieldName: fieldName || "comparison_variant",
        value,
      };
    }
    if (subsetName.startsWith("age_")) {
      return {
        groupLabel: "Age",
        label: rawLabel.replace(/^age(?: group)?\s*:\s*/i, ""),
        groupOrder: 40,
        itemOrder: 999,
        fieldName: fieldName || "age_group",
        value,
      };
    }
    return {
      groupLabel: "Other subgroups",
      label: rawLabel,
      groupOrder: 999,
      itemOrder: 999,
      fieldName,
      value,
    };
  }

  function groupedSynthesisSubgroups(subgroups, subsetSpecMap, subgroupPlan) {
    const groups = new Map();
    subgroups.forEach((subgroup) => {
      const descriptor = subgroupDescriptor(subgroup, subsetSpecMap, subgroupPlan);
      const group = groups.get(descriptor.groupLabel) || {
        label: descriptor.groupLabel,
        order: descriptor.groupOrder,
        items: [],
        fieldNames: new Set(),
      };
      group.items.push({ subgroup, descriptor });
      if (descriptor.fieldName) {
        group.fieldNames.add(descriptor.fieldName);
      }
      groups.set(descriptor.groupLabel, group);
    });
    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .map((group) => ({
        ...group,
        fieldNames: Array.from(group.fieldNames || []),
        items: group.items.sort((a, b) => (
          a.descriptor.itemOrder - b.descriptor.itemOrder
          || a.descriptor.label.localeCompare(b.descriptor.label)
        )),
      }));
  }

  function renderSynthesisSubgroupAnalyses(
    subgroupAnalyses,
    entry,
    comparisonPayload,
    subgroupPlan,
    subsetSpecMap,
    subgroupDifferenceTests = {}
  ) {
    const subgroups = Array.isArray(subgroupAnalyses) ? subgroupAnalyses : [];
    if (!subgroups.length) {
      return "";
    }
    const groups = groupedSynthesisSubgroups(subgroups, subsetSpecMap, subgroupPlan);

    return `
      <details class="synthesis-subgroup-section">
        <summary class="synthesis-subgroup-head">
          <h5>Show subgroup analyses</h5>
        </summary>
        <div class="synthesis-subgroup-list">
          ${groups.map((group) => {
            const groupDifferenceTests = subgroupDifferenceTestsForFields(
              subgroupDifferenceTests,
              group.fieldNames
            );
            const groupDifferenceEntries = validSubgroupDifferenceTestEntries(groupDifferenceTests);
            const totalRows = groupDifferenceEntries.map(([field, test]) => {
              const totalResult = test?.total_result && typeof test.total_result === "object"
                ? test.total_result
                : null;
              const subgroupFamilyPlot = test?.forest_plot_data && typeof test.forest_plot_data === "object"
                ? test.forest_plot_data
                : null;
              if (!totalResult || !Array.isArray(subgroupFamilyPlot?.rows) || !subgroupFamilyPlot.rows.length) {
                return "";
              }
              const totalCount = finiteNumber(totalResult.k);
              const totalEstimate = synthesisEstimateLabel({
                primaryResult: totalResult,
                measure: group.items[0]?.subgroup?.measure || "",
              });
              return `
                <div class="synthesis-subgroup-total">
                  <div class="synthesis-subgroup-level-header synthesis-subgroup-total-header">
                    <span></span>
                    <span class="synthesis-subgroup-meta">
                      ${totalCount === null ? "" : `<span>${formatCompactStat(totalCount, 0)} ${totalCount === 1 ? "study" : "studies"}</span>`}
                      ${totalEstimate ? `<span>${escapeHtml(totalEstimate)}</span>` : ""}
                    </span>
                  </div>
                  <div class="synthesis-subgroup-total-body">
                    ${renderCompactSynthesisTotalPlot(subgroupFamilyPlot, `${entry.key}:subgroup:${field}`)}
                    ${renderSynthesisDiagnostics(totalResult, { [field]: test }, subgroupPlan)}
                  </div>
                </div>
              `;
            }).join("");
            const levelCount = group.items.length;
            return `
              <details class="synthesis-subgroup-group">
                <summary class="synthesis-subgroup-group-summary">
                  <span>${escapeHtml(group.label)}</span>
                  <span class="synthesis-subgroup-group-meta">${number(levelCount)} ${levelCount === 1 ? "level" : "levels"}</span>
                </summary>
                <div class="synthesis-subgroup-group-body">
                  ${group.items.map(({ subgroup, descriptor }) => {
                    const interactivePlot = renderInteractiveForestPlot(
                      subgroup.plotData,
                      subgroup.plotKey,
                      subgroup.label || entry.outcome_name || entry.label || entry.key,
                      comparisonPayload,
                      { showTitle: false }
                    );
                    const estimateLabel = synthesisEstimateLabel(subgroup);
                    return `
                      <div class="synthesis-subgroup-level">
                        <div class="synthesis-subgroup-level-header">
                          <span class="synthesis-subgroup-title">${escapeHtml(descriptor.label || subgroup.label || humanizeMetric(subgroup.subsetName))}</span>
                          <span class="synthesis-subgroup-meta">
                            <span>${escapeHtml(synthesisStudyCountLabel(subgroup))}</span>
                            ${estimateLabel ? `<span>${escapeHtml(estimateLabel)}</span>` : ""}
                          </span>
                        </div>
                        <div class="synthesis-subgroup-body">
                          <div class="synthesis-forest-result">
                            ${interactivePlot
                              ? interactivePlot
                              : `<p class="note">No forest plot was generated for this subgroup subset.</p>`
                            }
                            ${renderPublicationOverlapWarnings(
                              subgroup.plotData?.publication_overlap_warnings
                              || subgroup.primaryResult?.publication_overlap_warnings
                              || []
                            )}
                            ${renderSynthesisDiagnostics(subgroup.primaryResult || {}, null, subgroupPlan, { showSubgroupDifferences: false })}
                          </div>
                        </div>
                      </div>
                    `;
                  }).join("")}
                  ${totalRows}
                </div>
              </details>
            `;
          }).join("")}
        </div>
      </details>
    `;
  }

  function renderSynthesisExcludedFieldList(row) {
    const fields = Array.isArray(row?.available_effect_fields) ? row.available_effect_fields : [];
    if (!fields.length) {
      return "—";
    }
    return fields.map((item) => {
      const field = String(item?.field || "").trim();
      const value = String(item?.value ?? "").trim();
      if (!field || !value) {
        return "";
      }
      return `<div><span class="mono">${escapeHtml(field)}</span>: ${escapeHtml(value)}</div>`;
    }).filter(Boolean).join("") || "—";
  }

  function renderOutcomeSynthesisExcludedRowsPanel(rows) {
    const excludedRows = Array.isArray(rows) ? rows : [];
    if (!excludedRows.length) {
      return "";
    }

    return `
      <details class="synthesis-exclusion-panel synthesis-subgroup-section">
        <summary class="synthesis-subgroup-head">
          <h5>Extracted but not synthesized for this outcome (${number(excludedRows.length)})</h5>
        </summary>
        <div class="synthesis-subgroup-list">
          <div class="table-wrap screening-wrap">
            <table class="screening-table synthesis-exclusion-table study-sticky-table">
              <thead>
                <tr>
                  <th class="screen-col-index">#</th>
                  <th class="screen-col-study">Study</th>
                  <th>effect_measure_reported</th>
                  <th>effect_measure_reported_raw</th>
                  <th>analysis_exclusion_reasons</th>
                  <th>available effect fields</th>
                </tr>
              </thead>
              <tbody>
                ${excludedRows.map((row, index) => `
                  <tr>
                    <td class="screen-col-index mono">${index + 1}</td>
                    <td class="screen-col-study">${compactStudyCell(row)}</td>
                    <td class="mono">${escapeHtml(row?.effect_measure_reported || "—")}</td>
                    <td class="mono">${escapeHtml(row?.effect_measure_reported_raw || "—")}</td>
                    <td class="mono">${escapeHtml((row?.analysis_exclusion_reasons || []).join("; ") || row?.analysis_exclusion_reason || "—")}</td>
                    <td>${renderSynthesisExcludedFieldList(row)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    `;
  }

  function renderSynthesisStudyDesignBranches(analysis, entry, comparisonPayload, subgroupPlan) {
    if (!isMixedStudyDesignSynthesis(analysis)) {
      return "";
    }
    const branches = synthesisDesignBranchEntries(analysis);
    const handling = synthesisStudyDesignHandling(analysis);
    const families = Array.isArray(handling.families) ? handling.families : [];
    const primaryResult = analysis?.primaryResult || {};
    const message = String(primaryResult.skip_message || "").trim()
      || "Combined synthesis was skipped because analysis-eligible rows contain multiple study-design families.";
    const familySummary = families.map((family) => {
      const label = String(family?.label || family?.family || "").trim();
      const count = finiteNumber(family?.n_analysis_eligible);
      if (!label) {
        return "";
      }
      return `
        <span class="synthesis-design-branch-chip">
          ${escapeHtml(label)}
          ${count === null ? "" : `<strong>${formatCompactStat(count, 0)}</strong>`}
        </span>
      `;
    }).join("");

    return `
      <div class="synthesis-design-branch-section">
        <div class="synthesis-design-branch-callout">
          <div class="synthesis-design-branch-title">Study-design separated synthesis</div>
          <p>${escapeHtml(message)} Forest plots below are grouped by study design rather than combined into one all-eligible estimate.</p>
          ${familySummary ? `<div class="synthesis-design-branch-chips">${familySummary}</div>` : ""}
        </div>
        ${branches.length ? `
          <div class="synthesis-design-branch-list">
            ${branches.map((branch) => {
              const interactivePlot = renderInteractiveForestPlot(
                branch.plotData,
                branch.plotKey,
                branch.label || entry.outcome_name || entry.label || entry.key,
                comparisonPayload,
                { showTitle: true }
              );
              const estimateLabel = synthesisEstimateLabel(branch);
              return `
                <div class="synthesis-design-branch-panel">
                  <div class="synthesis-design-branch-head">
                    <div>
                      <div class="synthesis-design-branch-name">${escapeHtml(branch.label || humanizeMetric(branch.subsetName))}</div>
                      <div class="synthesis-design-branch-meta">
                        ${escapeHtml(synthesisStudyCountLabel(branch))}
                        ${estimateLabel ? ` &middot; ${escapeHtml(estimateLabel)}` : ""}
                      </div>
                    </div>
                  </div>
                  <div class="synthesis-plot-card synthesis-forest-result labeled-forest-result agent-synthesis-forest-result" data-forest-source-label="Agent made">
                    ${interactivePlot || `<p class="note">No forest plot was generated for this study-design branch.</p>`}
                    ${renderPublicationOverlapWarnings(
                      branch.plotData?.publication_overlap_warnings
                      || branch.primaryResult?.publication_overlap_warnings
                      || []
                    )}
                    ${renderSynthesisDiagnostics(branch.primaryResult || {}, null, subgroupPlan, { showSubgroupDifferences: false })}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        ` : `<p class="note synthesis-note">No study-design branch forest plots were saved.</p>`}
      </div>
    `;
  }

  function synthesisCiOverlapByPlotKey(ciOverlapArtifact) {
    const rows = Array.isArray(ciOverlapArtifact?.plot_alignments)
      ? ciOverlapArtifact.plot_alignments
      : [];
    return rows.reduce((acc, row) => {
      const key = String(row?.agent_plot_key || "").trim();
      if (key) {
        acc[key] = row;
      }
      return acc;
    }, {});
  }

  function synthesisOutcomeAnalyzedMatch(alignment, outcomeKey) {
    const matches = cochraneOutcomeMatchesForKey(alignment, outcomeKey, "analyzed");
    return bestCochraneBenchmarkMatch(matches);
  }

  function cochraneForestPlotVersions(match) {
    return Array.isArray(match?.cochrane_forest_plot_versions)
      ? match.cochrane_forest_plot_versions.filter((version) => version?.plot_data && Array.isArray(version.plot_data.rows))
      : [];
  }

  function selectedCochraneForestPlotVersion(plotKey, versions) {
    if (!versions.length) {
      return null;
    }
    const requestedSubset = currentCochraneForestPlotViews.get(plotKey);
    return versions.find((version) => version.subset === requestedSubset)
      || versions.find((version) => version.subset === "all_studies")
      || versions[0];
  }

  function agentStudyMatchForSelection(agentStudies, selection) {
    const pmid = String(selection?.pmid || "").trim();
    if (!pmid) {
      return null;
    }
    return (agentStudies || []).find((study) => String(study?.pmid || "").trim() === pmid) || null;
  }

  function truthyArtifactValue(value) {
    return value === true || ["true", "1", "yes"].includes(String(value || "").trim().toLowerCase());
  }

  function synthesisOutcomeKeyFromPlotKey(plotKey) {
    return String(plotKey || "").split(":measure:", 1)[0] || "";
  }

  function outcomeExtractionTableForPlotKey(outcomeExtractionTables, plotKey) {
    const outcomeKey = synthesisOutcomeKeyFromPlotKey(plotKey);
    if (!outcomeKey) {
      return {};
    }
    return (outcomeExtractionTables || []).find((table) => extractionOutcomeKey(table) === outcomeKey) || {};
  }

  function findPmidRecord(rows, pmid) {
    const key = String(pmid || "").trim();
    if (!key) {
      return null;
    }
    return (rows || []).find((row) => String(row?.pmid || "").trim() === key) || null;
  }

  function screeningStudyLookup(screeningResults, pmid) {
    return findPmidRecord(screeningResults?.screened_studies || [], pmid);
  }

  function extractionSourceStudyLookup(extractionSourceSummary, pmid) {
    return findPmidRecord(extractionSourceSummary?.studies || [], pmid);
  }

  function extractionOutcomeStudyLookup(outcomeExtractionTables, plotKey, pmid) {
    const table = outcomeExtractionTableForPlotKey(outcomeExtractionTables, plotKey);
    const extractable = findPmidRecord(table.extractable_rows || [], pmid);
    const nonExtractable = findPmidRecord(table.non_extractable_rows || [], pmid);
    return {
      table,
      row: extractable || nonExtractable,
      extractable: Boolean(extractable),
      nonExtractable: Boolean(nonExtractable),
    };
  }

  function readableScreenDecision(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "include") {
      return "Included";
    }
    if (normalized === "not enough info") {
      return "Not enough info";
    }
    if (normalized === "exclude") {
      return "Excluded";
    }
    return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not retrieved";
  }

  function cochraneStudyTrace(selection, agentStudies, plotKey, context = {}) {
    const pmid = String(selection?.pmid || "").trim();
    const matched = agentStudyMatchForSelection(agentStudies, selection);
    const screeningStudy = screeningStudyLookup(context.screeningResults || {}, pmid);
    const extractionSourceStudy = extractionSourceStudyLookup(context.extractionSourceSummary || {}, pmid);
    const extractionOutcome = extractionOutcomeStudyLookup(context.outcomeExtractionTables || [], plotKey, pmid);
    const screenDecision = String(screeningStudy?.screen_decision || "").trim().toLowerCase();
    const screenPositive = ["include", "not enough info"].includes(screenDecision);
    const extractionRow = extractionOutcome.row || {};
    const dataExtractable = extractionOutcome.extractable || truthyArtifactValue(extractionRow.data_extractable);
    const extractionTextSource = extractionRow.extraction_text_source || extractionSourceStudy?.extraction_text_source || "";
    const extractionReason = String(extractionRow.non_extractable_reason || "").trim();
    const fulltextDecision = String(extractionSourceStudy?.fulltext_eligibility_decision || "").trim();
    const fulltextReason = String(extractionSourceStudy?.fulltext_eligibility_reason || "").trim();

    let extractionStatus = "Not reached";
    let extractionTone = "not-reached";
    let extractionDetail = "";
    if (matched) {
      extractionStatus = "In agent plot";
      extractionTone = "included";
      extractionDetail = "This PMID is present in the displayed agent forest plot.";
    } else if (extractionOutcome.row) {
      if (dataExtractable) {
        extractionStatus = "Extracted, not plotted";
        extractionTone = "extracted";
        extractionDetail = "The study was extractable for this outcome, but it is not present in this plotted synthesis. This usually points to synthesis eligibility, effect-measure, or branch-selection differences rather than extraction failure.";
      } else {
        extractionStatus = "Extraction failed";
        extractionTone = "failed";
        extractionDetail = extractionReason || "The study reached outcome extraction but was marked not extractable for this outcome.";
      }
    } else if (screenPositive) {
      extractionStatus = "No outcome row";
      extractionTone = "not-reached";
      extractionDetail = "The PMID was screen-positive, but no outcome extraction row was found for this plotted outcome in the demo bundle.";
    } else if (screeningStudy) {
      extractionDetail = "The study was screened out before candidate extraction.";
    } else {
      extractionDetail = "This PMID was not found in the agent retrieved PubMed records, so it did not reach screening, candidate selection, or extraction.";
    }

    return {
      matched,
      pmid,
      screeningStudy,
      extractionSourceStudy,
      extractionOutcome,
      screenDecision,
      screenPositive,
      screenLabel: readableScreenDecision(screenDecision),
      screenReason: String(screeningStudy?.screen_reason || "").trim(),
      extractionStatus,
      extractionTone,
      extractionDetail,
      extractionTextSource,
      fulltextDecision,
      fulltextReason,
    };
  }

  function renderCochraneStudyTrace(selection, agentStudies, plotKey, context = {}) {
    const trace = cochraneStudyTrace(selection, agentStudies, plotKey, context);
    const screeningClass = trace.screeningStudy
      ? trace.screenPositive ? "included" : "excluded"
      : "not-screened";
    const sourceText = trace.extractionTextSource ? sourceLabel(trace.extractionTextSource) : "";
    const fulltextText = trace.fulltextDecision
      ? `Full-text gate: ${trace.fulltextDecision}.`
      : trace.extractionSourceStudy
      ? "Full-text gate: not run or unavailable."
      : "";
    return `
      <div class="cochrane-study-trace">
        <div class="cochrane-study-trace-grid">
          <div class="cochrane-study-trace-card cochrane-study-trace-${screeningClass}">
            <div class="cochrane-study-trace-label">Title/abstract screening</div>
            <div class="cochrane-study-trace-value">${escapeHtml(trace.screenLabel)}</div>
            ${trace.screenReason ? `<div class="cochrane-study-trace-detail">${sentence(trace.screenReason)}</div>` : ""}
          </div>
          <div class="cochrane-study-trace-card cochrane-study-trace-${trace.extractionTone}">
            <div class="cochrane-study-trace-label">Outcome extraction</div>
            <div class="cochrane-study-trace-value">${escapeHtml(trace.extractionStatus)}</div>
            <div class="cochrane-study-trace-detail">
              ${sourceText ? `<span>Source: ${escapeHtml(sourceText)}.</span> ` : ""}
              ${fulltextText ? `<span>${escapeHtml(fulltextText)}</span> ` : ""}
              ${sentence(trace.extractionDetail)}
            </div>
          </div>
        </div>
        ${trace.fulltextReason ? `<div class="cochrane-study-trace-footnote">Full-text eligibility note: ${sentence(trace.fulltextReason)}</div>` : ""}
      </div>
    `;
  }

  function renderCochraneStudySelectionNote(selection, agentStudies, plotKey, context = {}) {
    if (!selection) {
      return `<div class="cochrane-study-match-note">Click a Cochrane study row to check whether the same PMID appears in the agent plot below.</div>`;
    }
    const label = String(selection.label || selection.pmid || "Selected study").trim();
    const pmid = String(selection.pmid || "").trim();
    if (!pmid) {
      return `<div class="cochrane-study-match-note is-missing">Selected ${escapeHtml(label)}; no PMID is available for direct matching against the agent plot.</div>`;
    }
    const matched = agentStudyMatchForSelection(agentStudies, selection);
    return `
      <div class="cochrane-study-match-panel">
        <div class="cochrane-study-match-note ${matched ? "is-present" : "is-missing"}">
          Selected ${escapeHtml(label)} (${escapeHtml(pmid)}):
          ${matched ? "also present in the agent plot." : "not found in the agent plot."}
        </div>
        ${renderCochraneStudyTrace(selection, agentStudies, plotKey, context)}
      </div>
    `;
  }

  function selectedCochraneForestPlotDataForPlot(ciOverlapArtifact, plotKey) {
    const row = synthesisCiOverlapByPlotKey(ciOverlapArtifact)[plotKey] || {};
    const versions = cochraneForestPlotVersions(row.best_match || {});
    const selectedVersion = selectedCochraneForestPlotVersion(plotKey, versions);
    return selectedVersion?.plot_data || null;
  }

  function synthesisComparisonAxisOverride(ciOverlapArtifact, plotKey, agentPlot) {
    if (!currentCochraneForestPlotViews.has(plotKey)) {
      return null;
    }
    const cochranePlot = selectedCochraneForestPlotDataForPlot(ciOverlapArtifact, plotKey);
    return sharedForestComparisonAxis(agentPlot, cochranePlot);
  }

  function renderCochraneReproducedForestPlot(match, plotKey, comparisonPayload = {}, agentStudies = [], axisOverride = null, selectionContext = {}) {
    const versions = cochraneForestPlotVersions(match);
    if (!currentCochraneForestPlotViews.has(plotKey) || !versions.length) {
      return "";
    }
    const selectedVersion = selectedCochraneForestPlotVersion(plotKey, versions);
    if (!selectedVersion) {
      return "";
    }
    const selectedSubset = selectedVersion.subset || "";
    const selectedStudy = currentCochraneStudySelections.get(plotKey) || null;
    const plot = selectedVersion.plot_data || {};
    const plotKeyForRows = `${plotKey}:cochrane:${selectedSubset || "plot"}`;
    const hasSharedAxis = finiteNumber(axisOverride?.x_min) !== null && finiteNumber(axisOverride?.x_max) !== null;
    return `
      <div class="cochrane-reproduced-plot-panel">
        <div class="cochrane-reproduced-plot-head">
          <div>
            ${renderCochraneStudySelectionNote(selectedStudy, agentStudies, plotKey, selectionContext)}
            ${hasSharedAxis ? `
              <div class="cochrane-axis-note">
                Common x-axis is used in this comparison view; standalone forest plots keep their own axis.
              </div>
            ` : ""}
          </div>
          ${versions.length > 1 ? `
            <div class="cochrane-plot-version-tabs" aria-label="Cochrane reproduced plot versions">
              ${versions.map((version) => `
                <button
                  class="cochrane-plot-version-tab ${version.subset === selectedSubset ? "is-active" : ""}"
                  type="button"
                  data-cochrane-forest-version="${escapeHtml(plotKey)}"
                  data-cochrane-forest-subset="${escapeHtml(version.subset || "")}"
                  aria-pressed="${version.subset === selectedSubset ? "true" : "false"}"
                >
                  ${escapeHtml(version.label || version.subset || "Subset")}
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
        <div class="synthesis-plot-card synthesis-forest-result labeled-forest-result cochrane-reproduced-forest-result" data-forest-source-label="Cochrane reproduced">
          ${renderInteractiveForestPlot(
            plot,
            plotKeyForRows,
            plot.title || match.outcome || "Reproduced Cochrane forest plot",
            comparisonPayload,
            {
              showTitle: true,
              disableRowJump: true,
              cochraneStudyMatchPlotKey: plotKey,
              selectedStudy,
              axisOverride,
            }
          ) || `<p class="note">No plottable reproduced Cochrane forest plot was saved for this subset.</p>`}
        </div>
      </div>
    `;
  }

  function renderSynthesisCiOverlapEvaluation(ciOverlapArtifact, plotKey, outcomeAlignment = {}, outcomeKey = "", comparisonPayload = {}) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((ciOverlapArtifact || {}).status !== "completed") {
      return "";
    }
    const row = synthesisCiOverlapByPlotKey(ciOverlapArtifact)[plotKey] || {};
    if (row.status !== "matched" || !row.best_match) {
      const relatedAnalysis = row.related_cochrane_analysis || {};
      const outcomeMatch = synthesisOutcomeAnalyzedMatch(outcomeAlignment, outcomeKey);
      if (!outcomeMatch && !relatedAnalysis.analysis_id) {
        return "";
      }
      const relatedScore = Number(relatedAnalysis.outcome_match_score);
      const relatedStrength = String(relatedAnalysis.outcome_match_strength || "").trim();
      const relatedLabel = relatedAnalysis.analysis_id
        ? `${relatedAnalysis.outcome || "Related Cochrane analysis"} (${relatedAnalysis.analysis_id})`
        : cochraneOutcomeMatchLabel(outcomeMatch);
      const relatedMatchText = relatedAnalysis.analysis_id
        ? `${cochraneStrengthLabel(relatedStrength).toLowerCase()}, score ${Number.isFinite(relatedScore) ? relatedScore.toFixed(2) : "—"}`
        : `${cochraneStrengthLabel(cochraneMatchStrength(outcomeMatch)).toLowerCase()}, score ${formatCochraneMatchScore(outcomeMatch)}`;
      const statusText = row.status === "no_matched_cochrane_analysis"
        ? "No matched Cochrane forest-plot analysis with the same outcome/effect-measure target was found for this synthesized plot."
        : "No Cochrane synthesis-overlap match was available for this synthesized plot.";
      return `
        <div class="synthesis-evaluation-panel synthesis-evaluation-panel-missing">
          <div class="synthesis-evaluation-title">No Cochrane forest-plot match</div>
          <div class="synthesis-evaluation-detail">
            Related Cochrane outcome context: ${escapeHtml(relatedLabel)}
            (${escapeHtml(relatedMatchText)}).
            ${escapeHtml(relatedAnalysis.message || statusText)}
          </div>
        </div>
      `;
    }
    const match = row.best_match || {};
    const referenceStatuses = cochraneReferenceStatusesForPlot(ciOverlapArtifact, plotKey);
    const hasReferenceStatuses = Object.keys(referenceStatuses).length > 0;
    const statusActive = currentCochraneReferenceStatusPlots.has(plotKey);
    const forestVersions = cochraneForestPlotVersions(match);
    const forestPlotActive = currentCochraneForestPlotViews.has(plotKey);
    const selectedVersion = selectedCochraneForestPlotVersion(plotKey, forestVersions);
    const selectedSubset = selectedVersion?.subset || "all_studies";
    const selectedSubsetLabel = selectedVersion?.label || (selectedSubset === "pmcid_only" ? "PMCID-only studies" : "All estimable studies");
    const selectedIou = ciOverlapSubsetValue(match, selectedSubset);
    const selectedCi = ciOverlapSubsetCi(match, selectedSubset);
    return `
      <div class="synthesis-evaluation-block">
        <div class="synthesis-evaluation-panel">
          <div class="synthesis-evaluation-title">Reproduced Cochrane CI IoU</div>
          <div class="synthesis-evaluation-values">
            <span><strong>${formatPercent(selectedIou)}</strong> ${escapeHtml(selectedSubsetLabel)}</span>
          </div>
          <div class="synthesis-evaluation-detail">
            Matched ${escapeHtml(match.outcome || "Cochrane outcome")} (${escapeHtml(match.analysis_id || "analysis")});
            reproduced Cochrane CI ${escapeHtml(selectedCi)}.
          </div>
          <div class="synthesis-evaluation-actions">
            ${hasReferenceStatuses ? `
              <button
                class="synthesis-evaluation-toggle ${statusActive ? "is-active" : ""}"
                type="button"
                data-cochrane-row-status="${escapeHtml(plotKey)}"
                aria-pressed="${statusActive ? "true" : "false"}"
                title="Color the agent study rows by whether each PMID was used in this Cochrane analysis, included elsewhere in the review, excluded by the review, or absent from curated Cochrane reference sets."
              >
                ${statusActive ? "Hide Cochrane row status" : "Show Cochrane row status"}
              </button>
            ` : ""}
            ${forestVersions.length ? `
              <button
                class="synthesis-evaluation-toggle ${forestPlotActive ? "is-active" : ""}"
                type="button"
                data-cochrane-forest-plot="${escapeHtml(plotKey)}"
                aria-pressed="${forestPlotActive ? "true" : "false"}"
                title="Show the locally reproduced Cochrane forest plot linked to this matched Cochrane analysis."
              >
                ${forestPlotActive ? "Hide Cochrane forest plot" : "Show Cochrane forest plot"}
              </button>
            ` : ""}
          </div>
          ${forestPlotActive ? renderSingleStudyCiOverlapVisualization(row.single_study_ci_overlap_distributions, selectedSubset) : ""}
        </div>
      </div>
    `;
  }

  function renderSynthesisCochraneForestPlotEvaluation(ciOverlapArtifact, plotKey, comparisonPayload = {}, axisOverride = null, selectionContext = {}) {
    if (!currentEvaluationVisible) {
      return "";
    }
    if ((ciOverlapArtifact || {}).status !== "completed") {
      return "";
    }
    const row = synthesisCiOverlapByPlotKey(ciOverlapArtifact)[plotKey] || {};
    if (row.status !== "matched" || !row.best_match) {
      return "";
    }
    return renderCochraneReproducedForestPlot(
      row.best_match || {},
      plotKey,
      comparisonPayload,
      row.agent_studies || [],
      axisOverride,
      selectionContext
    );
  }

  function openAncestorDetails(element) {
    let parent = element.parentElement;
    while (parent && parent !== app) {
      if (parent.tagName?.toLowerCase() === "details") {
        parent.open = true;
      }
      parent = parent.parentElement;
    }
  }

  function renderPreservingViewportAnchor(selector) {
    const anchor = selector ? app.querySelector(selector) : null;
    const beforeTop = anchor ? anchor.getBoundingClientRect().top : null;
    render();
    if (beforeTop === null || !selector) {
      return;
    }
    const nextAnchor = app.querySelector(selector);
    if (!nextAnchor) {
      return;
    }
    const afterTop = nextAnchor.getBoundingClientRect().top;
    window.scrollBy(0, afterTop - beforeTop);
  }

  function renderPreservingScrollPosition() {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    render();
    window.scrollTo(scrollX, scrollY);
  }

  function toggleEvaluationVisibility() {
    setEvaluationVisibility(!currentEvaluationVisible);
  }

  function setEvaluationVisibility(isVisible) {
    const nextVisible = Boolean(isVisible);
    if (currentEvaluationVisible === nextVisible) {
      return;
    }
    currentEvaluationVisible = nextVisible;
    saveDemoUiState();
    renderPreservingScrollPosition();
  }

  function dataSelector(attribute, value) {
    return `[${attribute}="${cssEscape(value)}"]`;
  }

  function cochraneStudySelector(plotKey, pmid, label) {
    const identitySelector = pmid
      ? dataSelector("data-cochrane-study-pmid", pmid)
      : dataSelector("data-cochrane-study-label", label);
    return `${dataSelector("data-cochrane-study-match", plotKey)}${identitySelector}`;
  }

  function cssEscape(value) {
    const text = String(value || "");
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(text);
    }
    return text.replace(/["\\]/g, "\\$&");
  }

  function highlightExtractionRow(row, { scroll = false } = {}) {
    if (!row) {
      return;
    }
    app.querySelectorAll(".extraction-target-row.is-jump-outline").forEach((item) => {
      item.classList.remove("is-jump-outline");
    });
    row.classList.add("is-jump-outline");
    if (scroll) {
      row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    row.focus({ preventScroll: true });
  }

  function jumpToExtractionRow(outcomeKey, pmid) {
    const target = extractionTargetKey(outcomeKey, pmid);
    const row = Array.from(app.querySelectorAll("[data-extraction-target]"))
      .find((item) => item.getAttribute("data-extraction-target") === target);
    if (!row) {
      document.getElementById("step-5")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    currentExtractableOpen = true;
    openAncestorDetails(row);
    highlightExtractionRow(row, { scroll: true });
  }

  function synthesisOutcomeSection(
    synthesis,
    assets,
    comparisonPayload,
    outcomeExtractionTables = [],
    subgroupPlan = {},
    cochraneOutcomeAlignment = {},
    cochraneSynthesisCiOverlap = {},
    screeningResults = {},
    extractionSourceSummary = {}
  ) {
    const outcomes = synthesisOutcomeEntries(synthesis);
    if (!outcomes.length) {
      return `<p class="note">No outcome-level synthesis results were saved for this run.</p>`;
    }
    const plottedOutcomes = outcomes
      .map((entry) => ({
        entry,
        analyses: synthesisPlottedAnalyses(entry, assets),
      }))
      .filter((item) => item.analyses.length);
    if (!plottedOutcomes.length) {
      return `<p class="note">No forest plots were generated for the configured synthesis outcomes.</p>`;
    }

    return `
      <div class="outcome-panel-list synthesis-outcome-list">
        ${plottedOutcomes.map(({ entry, analyses }) => {
          const definitionNote = synthesisOutcomeDefinition(entry, outcomeExtractionTables);
          const measureNote = analyses.length > 1
            ? "Different effect measures were extracted for this outcome, so each measure is synthesized separately."
            : "";
          return `
            <details class="outcome-panel synthesis-outcome-panel synthesis-interactive-outcome" data-synthesis-outcome-key="${escapeHtml(entry.key)}" ${currentOpenSynthesisOutcomeKeys.has(entry.key) ? "open" : ""}>
              <summary class="outcome-panel-head" tabindex="-1">
                ${outcomePanelToggleButton()}
                <div>
                  <div class="insight-title">${escapeHtml(entry.label || "Outcome")}</div>
                  <h4>${sentence(entry.outcome_name || entry.key || "Outcome")}</h4>
                  ${definitionNote ? `<p class="synthesis-outcome-note">${sentence(definitionNote)}</p>` : ""}
                  ${renderCochraneOutcomeMapping(cochraneOutcomeAlignment, entry.key, { showEmpty: true })}
                  ${measureNote ? `<p class="synthesis-measure-note">${escapeHtml(measureNote)}</p>` : ""}
                </div>
              </summary>
              ${analyses.map((analysis) => {
                    const subsetSpecMap = synthesisSubsetSpecsForAnalysis(analysis);
	                  const primaryResult = analysis.primaryResult || {};
	                  const hasEstimate = primaryResult.pooled_effect !== null && primaryResult.pooled_effect !== undefined && primaryResult.pooled_effect !== "";
                    const mixedDesignSynthesis = isMixedStudyDesignSynthesis(analysis);
                    const nonDesignSubgroupAnalyses = synthesisNonDesignSubgroupEntries(analysis);
	                  const showCochraneReferenceStatuses = currentEvaluationVisible && currentCochraneReferenceStatusPlots.has(analysis.plotKey);
	                  const showCochraneReproducedPlot = currentEvaluationVisible && currentCochraneForestPlotViews.has(analysis.plotKey);
	                  const cochraneReferenceStatuses = currentEvaluationVisible ? cochraneReferenceStatusesForPlot(cochraneSynthesisCiOverlap, analysis.plotKey) : {};
	                  const selectedCochraneStudy = currentEvaluationVisible ? currentCochraneStudySelections.get(analysis.plotKey) || null : null;
	                  const comparisonAxisOverride = showCochraneReproducedPlot
	                    ? synthesisComparisonAxisOverride(cochraneSynthesisCiOverlap, analysis.plotKey, analysis.plotData)
	                    : null;
                    const cochraneStudySelectionContext = {
                      screeningResults,
                      outcomeExtractionTables,
                      extractionSourceSummary,
                    };
	                  const interactivePlot = renderInteractiveForestPlot(
	                    analysis.plotData,
	                    analysis.plotKey,
	                    entry.outcome_name || entry.label || entry.key,
	                    comparisonPayload,
	                    {
	                      referenceStatuses: cochraneReferenceStatuses,
	                      showReferenceStatuses: showCochraneReferenceStatuses,
	                      selectedStudy: selectedCochraneStudy,
	                      axisOverride: comparisonAxisOverride,
	                    }
	                  );
                  const measureTooltip = String(analysis.plotData?.effect_measure_interpretation?.tooltip || "").trim();
                  const measureHeading = measureTooltip
                    ? `<h4 class="synthesis-measure-help" title="${escapeHtml(measureTooltip)}" aria-label="${escapeHtml(measureTooltip)}" tabindex="0">${escapeHtml(analysis.label)}</h4>`
                    : `<h4>${escapeHtml(analysis.label)}</h4>`;
                  return `
                      <div class="synthesis-analysis-card">
                        <div class="synthesis-analysis-head">
                          <div>
                            ${measureHeading}
                          </div>
                        </div>
                      ${hasEstimate || mixedDesignSynthesis
                        ? ""
                        : `<p class="note synthesis-note">No estimate was produced for this analysis.</p>`
                      }
                      ${interactivePlot ? `
                        ${renderSynthesisCochraneForestPlotEvaluation(
                          cochraneSynthesisCiOverlap,
                          analysis.plotKey,
                          comparisonPayload,
                          comparisonAxisOverride,
                          cochraneStudySelectionContext
                        )}
                        <div class="synthesis-plot-card synthesis-forest-result labeled-forest-result agent-synthesis-forest-result" data-forest-source-label="Agent made">
                          ${interactivePlot}
                          ${renderPublicationOverlapWarnings(
                            analysis.plotData?.publication_overlap_warnings
                            || primaryResult.publication_overlap_warnings
                            || []
                          )}
                          ${renderSynthesisDiagnostics(primaryResult, {}, subgroupPlan, {
                            collapsed: showCochraneReproducedPlot,
                          })}
                        </div>
                        ${renderSynthesisCiOverlapEvaluation(
                          cochraneSynthesisCiOverlap,
                          analysis.plotKey,
                          cochraneOutcomeAlignment,
                          entry.key,
                          comparisonPayload
                        )}
                      ` : ""}
                      ${renderSynthesisStudyDesignBranches(
                        analysis,
                        entry,
                        comparisonPayload,
                        subgroupPlan
                      )}
                      ${renderSynthesisSubgroupAnalyses(
                        nonDesignSubgroupAnalyses,
                        entry,
                        comparisonPayload,
                        subgroupPlan,
                        subsetSpecMap,
                        analysis.results?.subgroup_difference_tests || {}
                      )}
                    </div>
                  `;
                }).join("")}
              ${renderOutcomeSynthesisExcludedRowsPanel(entry.results?.outcome_synthesis_excluded_rows)}
            </details>
          `;
        }).join("")}
      </div>
    `;
  }

  function finalReportSection(markdown, verification = {}) {
    const text = String(markdown || "").trim();
    const isHumanVerified = verification?.human_verified === true
      || verification?.final_report_human_verified === true
      || String(verification?.status || "").trim().toLowerCase() === "human_verified";
    const statusClass = isHumanVerified ? "report-status-verified" : "report-status-draft";
    const statusLabel = isHumanVerified ? "Human-verified narrative report" : "AI-generated draft";
    const statusText = isHumanVerified
      ? "A human reviewer has marked this narrative report as verified."
      : "This narrative report has not been human-verified. Use it as a draft audit summary, not as a final evidence synthesis.";
    if (!text) {
      return `
        <details class="detail-card final-report-panel" id="final-report" style="margin-top:14px;">
          <summary class="collapsible-table-summary final-report-summary">
            <span>Final Report</span>
          </summary>
          <p class="note">No final report was saved for this run.</p>
        </details>
      `;
    }

    return `
      <details class="detail-card final-report-panel" id="final-report" style="margin-top:14px;">
        <summary class="collapsible-table-summary final-report-summary">
          <span>Final Report</span>
        </summary>
        <div class="report-status-banner ${statusClass}">
          <strong>${escapeHtml(statusLabel)}</strong>
          <span>${escapeHtml(statusText)}</span>
        </div>
        <div class="report-body">
          ${renderMarkdown(text)}
        </div>
      </details>
    `;
  }

  function extractionRobStatusBanner(verification = {}) {
    const isHumanVerified = verification?.human_verified === true
      || verification?.extraction_rob_human_verified === true
      || String(verification?.status || "").trim().toLowerCase() === "human_verified";
    const statusClass = isHumanVerified ? "report-status-verified" : "report-status-draft";
    const statusLabel = isHumanVerified
      ? "Human-verified extraction and RoB results"
      : "AI-generated draft";
    const statusText = isHumanVerified
      ? "A human reviewer has marked these extraction and RoB results as verified."
      : "Extraction and RoB results require human verification.";
    return `
      <div class="report-status-banner ${statusClass}">
        <strong>${escapeHtml(statusLabel)}</strong>
        <span>${escapeHtml(statusText)}</span>
      </div>
    `;
  }

  function render() {
    document.body.classList.remove("source-trace-open");
    const current = findRun(currentRunId);
    const pico = current.pico || {};
    const screening = current.screening_results || {};
    const run = current.run_summary || {};
    const review = current.review_definition || {};
    const queryReview = current.query_review || {};
    const screeningQueryUpdate = current.screening_query_update || {};
    const assets = current.assets || {};
    const synthesis = current.synthesis_results || {};
    const extractionTemplates = current.extraction_templates || {};
    const perStudyOutputs = current.per_study_outputs || [];
    const outcomeExtractionTables = current.outcome_extraction_tables || [];
    const extractionSourceSummary = current.extraction_source_summary || {};
    const robDisplay = current.rob_display || {};
    const outcomes = current.outcomes || {};
    const outcomeSignalInventory = current.outcome_signal_inventory || {};
    const cochraneOutcomeAlignment = current.cochrane_outcome_alignment || {};
    const cochraneComparisonAlignment = current.cochrane_comparison_alignment || {};
    const cochraneSynthesisCiOverlap = current.cochrane_synthesis_ci_overlap || {};
    const cochraneSearchScreeningMetrics = current.cochrane_search_screening_metrics || {};
    const hasEvaluationArtifacts = hasBenchmarkEvaluationArtifacts(
      cochraneSearchScreeningMetrics,
      cochraneOutcomeAlignment,
      cochraneComparisonAlignment,
      cochraneSynthesisCiOverlap
    );
    const outcomeSourceContribution = current.outcome_source_contribution || {};
    const comparison = current.comparison || {};
    const studyArms = current.study_arms || {};
    const sourceAvailabilityGate = current.source_availability_gate || {};
    const subgroupPlan = current.subgroup_plan || {};
    const publicationLinkage = current.publication_linkage || {};
    const publicationLinkageEvidence = current.publication_linkage_evidence || {};
    const extractionOverview = current.extraction_overview || {};
    const nctLinkageRows = current.nct_linkage_rows || [];
    const timing = current.timing || {};
    const finalReportMarkdown = current.final_report_markdown || "";
    const completedRobReviewCount = (Array.isArray(robDisplay.assessment_groups) ? robDisplay.assessment_groups : [])
      .reduce((total, group) => total + Number(group.n_completed_assessments || 0), 0);
    const screeningCounts = screeningDecisionCounts(screening);
    const totalScreenedStudies = screeningCounts.total;
    const screeningBenchmarkPmids = screeningBenchmarkPmidSet(cochraneSearchScreeningMetrics);
    const showScreeningBenchmarkFilter = currentEvaluationVisible && screeningBenchmarkPmids.size > 0;
    const applyScreeningBenchmarkFilter = showScreeningBenchmarkFilter && currentScreeningBenchmarkOnly;
    const filteredScreeningStudies = (screening.screened_studies || []).filter((study) =>
      currentScreeningDecisions.includes(String(study.screen_decision || "not enough info").trim().toLowerCase())
      && (!applyScreeningBenchmarkFilter || screeningBenchmarkPmids.has(String(study?.pmid || "").trim()))
    );
    const screeningLimitOptions = [10, 20, 30, 50, 100, "all"].filter(
      (option, index) => option === "all" || option <= filteredScreeningStudies.length || index < 2
    );
    const shownScreeningCount = String(currentScreeningLimit) === "all"
      ? filteredScreeningStudies.length
      : Math.min(Number(currentScreeningLimit) || 20, filteredScreeningStudies.length);
    const fulltextScreenedCount = (Array.isArray(perStudyOutputs) ? perStudyOutputs : [])
      .filter((entry) => entry?.fulltext_source?.fulltext_obtained === true).length;
    const synthesisPlotSummary = synthesisForestPlotSummary(synthesis, assets);
    renderHero(current);

	    app.innerHTML = `
	    ${renderLeftRail(current, {
	        hasEvaluationArtifacts,
	      })}
	    ${hasEvaluationArtifacts ? renderEvaluationVisibilityBanner() : ""}
		    <section class="step-card" id="step-1">
	      <div class="step-header">
	        <div>
	          <p class="kicker">Stage 1</p>
	          <h2>Review setup</h2>
	        </div>
	      </div>
	      <div class="panel root-prompt-card" id="single-prompt">
	        <div class="root-prompt-head">
	          <div>
	            <span class="root-prompt-badge">Single prompt</span>
	            <p class="root-prompt-note">This is the only input; every stage below is replayed from artifacts generated from it.</p>
	          </div>
	          <div class="root-prompt-window-controls" aria-hidden="true">
	            <span></span>
	            <span></span>
	            <span></span>
	          </div>
	        </div>
	        <div class="root-prompt-dialogue">
	          <div class="root-prompt-avatar">Q</div>
	          <p class="root-prompt-question">${sentence(review.research_question)}</p>
	        </div>
	      </div>
	      <div class="small" style="margin:10px 2px 0;">Structured into PICO framework</div>
      <div class="panel" id="review-pico" style="margin-top:8px;">
        <h3>PICO</h3>
        ${picoArtifact(pico)}
      </div>
    </section>

	    <section class="step-card" id="step-2">
	      <div class="step-header">
	        <div>
	          <p class="kicker">Stage 2</p>
	          <h2>Search and retrieval</h2>
	        </div>
	      </div>
	      ${renderQueryHistory(queryReview, screeningQueryUpdate, cochraneSearchScreeningMetrics)}
	    </section>

	    <section class="step-card" id="step-3">
	      <div class="step-header">
	        <div>
	          <p class="kicker">Stage 3</p>
	          <h2>Eligibility criteria and screening</h2>
	        </div>
	      </div>
	      <div class="panel-grid" id="screening-criteria">
        <div class="panel">
          <h3>Inclusion Criteria</h3>
          ${criteriaTable(review.inclusion_criteria || [], "I")}
        </div>
        <div class="panel">
          <h3>Exclusion Criteria</h3>
          ${criteriaTable(review.exclusion_criteria || [], "E")}
        </div>
      </div>
      <div class="stats-grid" style="margin-top:14px;">
        <div class="stat-card screening-summary-card screening-summary-include">
          <div class="stat-label">Include</div>
          <div class="stat-value">${number(screeningCounts.include)}</div>
        </div>
        <div class="stat-card screening-summary-card screening-summary-unclear">
          <div class="stat-label">Not Enough Info</div>
          <div class="stat-value">${number(screeningCounts.notEnoughInfo)}</div>
        </div>
        <div class="stat-card screening-summary-card screening-summary-exclude">
          <div class="stat-label">Exclude</div>
          <div class="stat-value">${number(screeningCounts.exclude)}</div>
        </div>
      </div>
	      <div class="detail-card" id="screening-results" style="margin-top:14px;">
	        <h3>Screening Results</h3>
        <div class="matrix-toolbar">
          <p class="note">Showing ${number(shownScreeningCount)} of ${number(filteredScreeningStudies.length)} filtered records (${number(totalScreenedStudies)} total) from this run. Screening is based on title and abstract only. Criterion headers map to the inclusion and exclusion criteria listed above.</p>
          <div class="matrix-controls">
            <div class="matrix-filter-group" role="group" aria-label="Screening decisions">
              <span class="matrix-control-label">Decision</span>
              <label class="matrix-check matrix-check-include">
                <input type="checkbox" value="include" ${currentScreeningDecisions.includes("include") ? "checked" : ""}>
                <span>include</span>
              </label>
              <label class="matrix-check matrix-check-exclude">
                <input type="checkbox" value="exclude" ${currentScreeningDecisions.includes("exclude") ? "checked" : ""}>
                <span>exclude</span>
              </label>
	              <label class="matrix-check matrix-check-unclear">
	                <input type="checkbox" value="not enough info" ${currentScreeningDecisions.includes("not enough info") ? "checked" : ""}>
	                <span>not enough info</span>
	              </label>
	            </div>
	            ${showScreeningBenchmarkFilter ? `
	              <button
	                class="matrix-toggle-button ${currentScreeningBenchmarkOnly ? "is-active" : ""}"
	                type="button"
	                data-screening-benchmark-only
	                aria-pressed="${currentScreeningBenchmarkOnly ? "true" : "false"}"
	                title="Show only rows with curated Cochrane included/excluded benchmark labels"
	              >
	                Indexed only
	              </button>
	            ` : ""}
	            <label class="matrix-control" for="screening-limit">
              <span class="matrix-control-label">Show</span>
              <select class="matrix-select" id="screening-limit">
                ${screeningLimitOptions.map((option) => `
                  <option value="${option}" ${String(option) === String(currentScreeningLimit) ? "selected" : ""}>${option === "all" ? "All" : option}</option>
                `).join("")}
              </select>
            </label>
          </div>
	      </div>
				        ${screeningMatrix(review, screening, currentScreeningLimit, currentScreeningDecisions, cochraneSearchScreeningMetrics, currentScreeningBenchmarkOnly)}
			        ${renderScreeningEvaluation(cochraneSearchScreeningMetrics)}
			      </div>
		    </section>

		    <section class="step-card" id="step-4">
	      <div class="step-header">
	        <div>
	          <p class="kicker">Stage 4</p>
		          <h2>Planning</h2>
		        </div>
		      </div>
		      ${nctLinkageSection(nctLinkageRows)}
		      <details class="detail-card fulltext-screening-panel" id="fulltext-screening" style="margin-top:14px;">
		        <summary class="collapsible-table-summary fulltext-screening-summary">
		          <h3>Full text screening <span class="inline-section-count">(x ${number(fulltextScreenedCount)})</span></h3>
		        </summary>
		        ${fulltextEligibilitySection(perStudyOutputs) || `<p class="note">No full-text screening rows were found for this run.</p>`}
		      </details>
		      ${sourceAvailabilityGateSection(sourceAvailabilityGate)}
			      ${outcomesSection(outcomes, pico, outcomeSignalInventory, cochraneOutcomeAlignment, outcomeSourceContribution)}
		      ${comparisonSection(comparison, pico, cochraneComparisonAlignment, studyArms)}
		      ${publicationLinkageSection(publicationLinkage, publicationLinkageEvidence, screening.screened_studies || [])}
		      ${subgroupPlanSection(subgroupPlan, current.study_level_subgroup_values || [])}
		    </section>

	    <section class="step-card" id="step-5">
	      <div class="step-header">
	        <div>
	          <p class="kicker">Stage 5</p>
	          <h2>Extraction and risk of bias</h2>
	        </div>
	      </div>
	      ${extractionRobStatusBanner(current.extraction_rob_verification || {})}
	      <div class="detail-card" id="extraction-results" style="margin-top:14px;">
	        <h3>Study extraction results</h3>
	        <p class="note">This section summarizes outcome-specific extraction rows. With full text, extraction and RoB are produced together; without full text, extraction uses abstract plus exact linked NCT records when available, otherwise the abstract alone, and RoB is skipped.</p>
	        ${extractionAttemptSection(outcomeExtractionTables, currentNonExtractableLimit, publicationLinkage, extractionOverview, extractionTemplates, cochraneOutcomeAlignment)}
	      </div>
	      ${studyTypeRoutingSection(robDisplay)}
	      <div class="detail-card" id="rob-assessments" style="margin-top:14px;">
        <h3>RoB Assessments <span class="inline-section-count">(x ${number(completedRobReviewCount)})</span></h3>
        <p class="note">${number(completedRobReviewCount)} completed study-level RoB assessments are grouped below by the RoB tool that was actually administered. Incomplete or unavailable RoB outputs are omitted from these domain tables but remain visible in the routing table above.</p>
        ${riskOfBiasTable(robDisplay)}
      </div>
    </section>

	    <section class="step-card" id="step-6">
	      <div class="step-header">
	        <div>
	          <p class="kicker">Stage 6</p>
	          <h2>Final synthesis and reporting</h2>
	          ${renderSynthesisStepSummary(synthesisPlotSummary)}
	        </div>
	      </div>
      <div>
        <div class="detail-card" id="synthesis-results">
          ${synthesisOutcomeSection(synthesis, assets, current.comparison || {}, outcomeExtractionTables, subgroupPlan, cochraneOutcomeAlignment, cochraneSynthesisCiOverlap, screening, extractionSourceSummary)}
        </div>
      </div>
      ${finalReportSection(finalReportMarkdown, current.final_report_verification || current.human_verification || {})}
	    </section>

			    ${renderEvaluationSummary(cochraneSearchScreeningMetrics, cochraneOutcomeAlignment, cochraneComparisonAlignment, cochraneSynthesisCiOverlap, synthesisPlotSummary)}
			    ${runTimingSection(timing, run)}
			    ${sourceTraceDrawer()}

			    <div class="page-jump-controls" aria-label="Page navigation">
      <button class="page-jump-button" id="jump-top" type="button">Top</button>
      <button class="page-jump-button" id="jump-bottom" type="button">Bottom</button>
    </div>
  `;

    renderStepper(hasEvaluationArtifacts ? steps : steps.filter((step) => step.kind !== "evaluation"));

	    const screeningLimitSelect = document.getElementById("screening-limit");
	    if (screeningLimitSelect) {
	      screeningLimitSelect.addEventListener("change", (event) => {
	        currentScreeningLimit = event.target.value;
	        render();
	      });
	    }

	    app.querySelectorAll("[data-screening-benchmark-only]").forEach((button) => {
	      button.addEventListener("click", () => {
	        currentScreeningBenchmarkOnly = !currentScreeningBenchmarkOnly;
	        currentScreeningLimit = "all";
	        saveDemoUiState();
	        render();
	      });
	    });

	    app.querySelectorAll("[data-run-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextRunId = button.getAttribute("data-run-id");
        if (!nextRunId || nextRunId === currentRunId) {
          return;
        }
        saveDemoScrollState();
        saveDemoUiState();
	        currentRunId = nextRunId;
        resetRunUiState();
        initialScrollRestorePending = false;
	        render();
	        window.scrollTo({ top: 0, behavior: "smooth" });
	      });
	    });

	    app.querySelectorAll("[data-nonextract-limit]").forEach((nonExtractLimitSelect) => {
	      nonExtractLimitSelect.addEventListener("change", (event) => {
	        currentNonExtractableLimit = event.target.value;
	        render();
	      });
	    });

	    app.querySelectorAll("[data-evaluation-visibility-toggle]").forEach((button) => {
	      button.addEventListener("click", () => {
	        const value = button.dataset.evaluationVisibilityValue;
	        if (value === "on" || value === "off") {
	          setEvaluationVisibility(value === "on");
	          return;
	        }
	        toggleEvaluationVisibility();
	      });
	    });

		    app.querySelectorAll("[data-outcome-benchmark-view]").forEach((select) => {
		      select.addEventListener("change", (event) => {
		        currentOutcomeBenchmarkView = event.target.value || "off";
		        render();
	      });
	    });

	    app.querySelectorAll("[data-cochrane-row-status]").forEach((button) => {
	      button.addEventListener("click", (event) => {
	        event.preventDefault();
	        event.stopPropagation();
	        const plotKey = button.getAttribute("data-cochrane-row-status") || "";
	        if (!plotKey) {
	          return;
	        }
	        const next = new Set(currentCochraneReferenceStatusPlots);
	        if (next.has(plotKey)) {
	          next.delete(plotKey);
	        } else {
	          next.add(plotKey);
	        }
	        currentCochraneReferenceStatusPlots = next;
	        button.blur();
	        renderPreservingScrollPosition();
	      });
	    });

	    app.querySelectorAll("[data-cochrane-forest-plot]").forEach((button) => {
	      button.addEventListener("click", (event) => {
	        event.preventDefault();
	        event.stopPropagation();
	        const plotKey = button.getAttribute("data-cochrane-forest-plot") || "";
	        if (!plotKey) {
	          return;
	        }
	        const next = new Map(currentCochraneForestPlotViews);
	        if (next.has(plotKey)) {
	          next.delete(plotKey);
	          const nextSelections = new Map(currentCochraneStudySelections);
	          nextSelections.delete(plotKey);
	          currentCochraneStudySelections = nextSelections;
	        } else {
	          next.set(plotKey, "all_studies");
	        }
	        currentCochraneForestPlotViews = next;
	        renderPreservingViewportAnchor(dataSelector("data-cochrane-forest-plot", plotKey));
	      });
	    });

	    app.querySelectorAll("[data-cochrane-forest-version]").forEach((button) => {
	      button.addEventListener("click", (event) => {
	        event.preventDefault();
	        event.stopPropagation();
	        const plotKey = button.getAttribute("data-cochrane-forest-version") || "";
	        const subset = button.getAttribute("data-cochrane-forest-subset") || "";
	        if (!plotKey || !subset) {
	          return;
	        }
	        const next = new Map(currentCochraneForestPlotViews);
	        next.set(plotKey, subset);
	        currentCochraneForestPlotViews = next;
	        const nextSelections = new Map(currentCochraneStudySelections);
	        nextSelections.delete(plotKey);
	        currentCochraneStudySelections = nextSelections;
	        renderPreservingViewportAnchor(
	          `${dataSelector("data-cochrane-forest-version", plotKey)}${dataSelector("data-cochrane-forest-subset", subset)}`
	        );
	      });
	    });

	    app.querySelectorAll("[data-cochrane-study-match]").forEach((row) => {
	      const activate = () => {
	        const plotKey = row.getAttribute("data-cochrane-study-match") || "";
	        const pmid = row.getAttribute("data-cochrane-study-pmid") || "";
	        const label = row.getAttribute("data-cochrane-study-label") || "";
	        if (!plotKey || (!pmid && !label)) {
	          return;
	        }
	        const next = new Map(currentCochraneStudySelections);
	        const current = next.get(plotKey) || {};
	        if (String(current.pmid || "") === pmid && String(current.label || "") === label) {
	          next.delete(plotKey);
	        } else {
	          next.set(plotKey, { pmid, label });
	        }
	        currentCochraneStudySelections = next;
	        currentCochraneReferenceStatusPlots = new Set();
	        renderPreservingViewportAnchor(cochraneStudySelector(plotKey, pmid, label));
	      };
	      row.addEventListener("click", (event) => {
	        event.preventDefault();
	        event.stopPropagation();
	        activate();
	      });
	      row.addEventListener("keydown", (event) => {
	        if (event.key === "Enter" || event.key === " ") {
	          event.preventDefault();
	          event.stopPropagation();
	          activate();
	        }
	      });
	    });

    app.querySelectorAll("summary.outcome-panel-head").forEach((summary) => {
      summary.addEventListener("click", (event) => {
        const toggleButton = event.target.closest(".outcome-panel-toggle");
        event.preventDefault();
        if (!toggleButton || !summary.contains(toggleButton)) {
          return;
        }
        const panel = summary.closest("details.outcome-panel");
        if (panel) {
          panel.open = !panel.open;
          const synthesisOutcomeKey = panel.getAttribute("data-synthesis-outcome-key") || "";
          if (synthesisOutcomeKey) {
            const nextOpen = new Set(currentOpenSynthesisOutcomeKeys);
            if (panel.open) {
              nextOpen.add(synthesisOutcomeKey);
            } else {
              nextOpen.delete(synthesisOutcomeKey);
            }
            currentOpenSynthesisOutcomeKeys = nextOpen;
          }
        }
      });
      summary.addEventListener("keydown", (event) => {
        if (event.target === summary && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
        }
      });
    });

	    app.querySelectorAll('[data-extraction-panel="extractable"]').forEach((extractablePanel) => {
      extractablePanel.addEventListener("toggle", (event) => {
        currentExtractableOpen = event.target.open;
      });
    });

    app.querySelectorAll('[data-extraction-panel="nonextract"]').forEach((nonExtractPanel) => {
      nonExtractPanel.addEventListener("toggle", (event) => {
        currentNonExtractableOpen = event.target.open;
      });
    });

    app.querySelectorAll('[data-extraction-panel="template"]').forEach((templatePanel) => {
      templatePanel.addEventListener("toggle", (event) => {
        currentTemplateOpen = event.target.open;
      });
    });

    app.querySelectorAll("[data-source-trace-cell]").forEach((cell) => {
      const activate = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openSourceTraceDrawer(sourceTracePayloadForCell(cell));
      };
      cell.addEventListener("click", activate);
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          activate(event);
        }
      });
    });

    app.querySelectorAll("[data-source-trace-close]").forEach((button) => {
      button.addEventListener("click", closeSourceTraceDrawer);
    });

    app.querySelectorAll("[data-extraction-row]").forEach((row) => {
      const activate = () => {
        highlightExtractionRow(row);
      };
      row.addEventListener("click", activate);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });

    app.querySelectorAll("[data-forest-pmid]").forEach((row) => {
      const activate = () => {
        const plotKey = row.getAttribute("data-forest-plot-key") || "";
        const pmid = row.getAttribute("data-forest-pmid") || "";
        if (!plotKey || !pmid) {
          return;
        }
        jumpToExtractionRow(plotKey.split(":")[0], pmid);
      };
      row.addEventListener("click", activate);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });

    if (!jumpOutlineClearHandlerAttached) {
      document.addEventListener("click", (event) => {
        const outlinedRow = app.querySelector(".extraction-target-row.is-jump-outline");
        if (!outlinedRow || outlinedRow.contains(event.target) || event.target.closest("[data-forest-pmid]")) {
          return;
        }
        outlinedRow.classList.remove("is-jump-outline");
      });
      jumpOutlineClearHandlerAttached = true;
    }

    if (!rowStatusDismissHandlerAttached) {
      document.addEventListener("click", (event) => {
        if (!currentCochraneReferenceStatusPlots.size) {
          return;
        }
        if (
          event.target.closest("[data-cochrane-row-status]")
          || event.target.closest(".agent-synthesis-forest-result")
        ) {
          return;
        }
        currentCochraneReferenceStatusPlots = new Set();
        renderPreservingScrollPosition();
      });
      rowStatusDismissHandlerAttached = true;
    }

    const linkageButtons = app.querySelectorAll("[data-linkage-target]");
    if (linkageButtons.length) {
      const linkagePanels = app.querySelectorAll("[data-linkage-detail]");
      const linkageEmpty = app.querySelector("[data-linkage-empty]");
      linkageButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const target = button.getAttribute("data-linkage-target") || "";
          const shouldClose = button.classList.contains("is-active");

          linkageButtons.forEach((item) => {
            const isActive = !shouldClose && item.getAttribute("data-linkage-target") === target;
            item.classList.toggle("is-active", isActive);
            item.setAttribute("aria-expanded", isActive ? "true" : "false");
          });

          linkagePanels.forEach((panel) => {
            panel.hidden = shouldClose || panel.getAttribute("data-linkage-detail") !== target;
          });

          if (linkageEmpty) {
            linkageEmpty.hidden = !shouldClose;
          }
        });
      });
    }

    app.querySelectorAll('.matrix-filter-group input[type="checkbox"]').forEach((input) => {
      input.addEventListener("change", () => {
        const selected = Array.from(
          app.querySelectorAll('.matrix-filter-group input[type="checkbox"]:checked')
        ).map((node) => node.value);
        currentScreeningDecisions = selected.length
          ? selected
          : ["include", "exclude", "not enough info"];
        render();
      });
    });

    const jumpTopButton = document.getElementById("jump-top");
    if (jumpTopButton) {
      jumpTopButton.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    const jumpBottomButton = document.getElementById("jump-bottom");
    if (jumpBottomButton) {
      jumpBottomButton.addEventListener("click", () => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      });
    }

    initSyncedTableScrollbars();
    restoreInitialScrollPosition();
  }

  window.addEventListener("scroll", scheduleDemoScrollSave, { passive: true });
  function saveDemoPageState() {
    saveDemoScrollState();
    saveDemoUiState();
  }

  window.addEventListener("pagehide", saveDemoPageState);
  window.addEventListener("beforeunload", saveDemoPageState);

  restoreDemoUiState();
  render();
})();
