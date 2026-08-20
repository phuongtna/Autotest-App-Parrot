#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../../src/config.js";
import { MaestroMcpBridge } from "../../bridge/maestroMcpBridge.js";
import { HomeworkNavigationEngine } from "../navigation/homeworkNavigationEngine.js";
import { homeworkPageObjects as po } from "../navigation/homeworkPageObjects.js";
import {
  HomeworkExamEngine,
  collectTexts,
  hasResourceId,
  collectConnectSlots,
  resolveConnectCorrectPairs,
  collectBlankIndices,
  resolveFillWordValues,
} from "../navigation/homeworkExamEngine.js";
import { findAssignment } from "../discovery/findAssignment.js";
import { centerPoint } from "../discovery/homeworkUiList.js";
import { parseQuestionsFromExamPage } from "../../discovery/examPageScraper.js";
import { normalizeQuestions } from "../../model/questionModel.js";

/**
 * Weekly Report E2E test data generator - MO 1 bai tap CU THE (khong random) va tra loi dung
 * CHINH XAC N cau (khong random so cau dung) - dung de tao du lieu that co diem so kiem soat
 * duoc cho weekly_report_test_ledger (baocaotuan_2026-08-15.xlsx).
 *
 * KHONG dung resolveHomeworkExamQuestions() (bai_tap/discovery/homeworkExamResolver.js) vi ham do
 * BAT BUOC room.attempts[].examId - CHI co sau khi da co it nhat 1 luot lam (xem docblock file do).
 * Bai tap moi giao (0 attempt) se luon BLOCKED (UNRESOLVED_EXAM_ID) qua duong do. Thay vao do dung
 * THANG examId da biet truoc tu teacherAssignmentApiDiscovery.fetchEligibleAssignmentTree() (field
 * item.examIds - lay luc giao bai, xem giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js)
 * roi goi thang parseQuestionsFromExamPage(examId) + normalizeQuestions() - CUNG 1 pipeline CMS
 * exam-scraper ma discovery/cli.js (Vui hoc) dang dung, chi khac nguon examId (biet truoc thay vi
 * random tu getExamOfExercise()). Khong doan/khong tao nguon moi.
 *
 * ENV bat buoc: TARGET_TITLE, EXAM_ID
 * ENV tuy chon: TARGET_DUE_DATE_DM ("DD/MM"), TARGET_SCORE (so nguyen 0..so cau - khong truyen
 *   thi RANDOM so cau dung, cung cong thuc voi buildRandomCorrectPlan() trong
 *   homeworkRandomScoringE2E.js: Math.floor(Math.random() * (soCau + 1)))
 *
 * Chay: node bai_tap/runtime/weeklyReportAnswerHomework.mjs
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const MAX_QUESTIONS = 40;

function log(...args) {
  console.log(...args);
}

const t0 = Date.now();
function perf(label) {
  console.log(`[PERF] +${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);
}

/** Boc `runSteps()`/`hierarchy()` cua 1 bridge instance de log PERF moi lan goi that (khong sua
 * bridge/maestroMcpBridge.js dung chung - chi wrap TRONG script nay). Tra ve CUNG instance (mutate
 * method tren instance, khong tao class moi) nen moi noi khac (HomeworkExamEngine/
 * HomeworkNavigationEngine/findAssignment) tu dong duoc log ma khong can sua cac file do. */
function wrapBridgeWithPerfLog(bridge) {
  let runCount = 0;
  let hierarchyCount = 0;
  const originalRunSteps = bridge.runSteps.bind(bridge);
  const originalHierarchy = bridge.hierarchy.bind(bridge);
  bridge.runSteps = async (steps) => {
    runCount++;
    const start = Date.now();
    const result = await originalRunSteps(steps);
    console.log(`[PERF-MCP] run #${runCount}: ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  };
  bridge.hierarchy = async () => {
    hierarchyCount++;
    const start = Date.now();
    const result = await originalHierarchy();
    console.log(`[PERF-MCP] inspect_screen #${hierarchyCount}: ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  };
  return bridge;
}

/** Thu tu questions[] tra ve tu CMS KHONG dam bao khop thu tu hien thi that tren man hinh (da xac
 * nhan that: cau man hinh la CONNECT/"Match" nhung questions[answeredCount] tuong ung lai la 1 cau
 * ONE/fill-in-blank khac - trung 1 tu vung "avoid" khien nham TEXT_CHOICE). SUA: tim trong pool cau
 * CHUA DUNG khop NOI DUNG voi man hinh hien tai (cung tinh than "so khop theo noi dung, khong doan
 * theo index" da dung cho CONNECT/resolveConnectSlotIndex) - KHONG dua vao vi tri mang. */
function findMatchingQuestion(tree, pool) {
  const textsOnScreen = collectTexts(tree);
  const isVisibleInTree = (t) => textsOnScreen.some((x) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`).test(x));

  // CONNECT - id "exercise_connect_left_0" la tin hieu rieng (khong trung dang khac). Khop theo
  // TYPE truoc (giong FILL_WORD ben duoi): da xac nhan that (2026-08-20, G7U2-HW-Lis-BTNC 5 cap)
  // 1 lan hierarchy() KHONG cuon co the chi thay 4/5 cap (UI ao hoa RecyclerView) - doi hoi
  // pairs.every(...) khop CA 5 cap se LUON fail sai dù dung 1 CONNECT DUY NHAT con lai trong pool.
  // Chi can doc du PAIR khi that su can phan biet >1 cau CONNECT chua dung trong pool (hiem, chua
  // gap that) - luc do moi doi hoi khop theo NOI DUNG cac pair DANG THAY (khong doi hoi ca nhung
  // cap con ngoai vung nhin, tranh lap lai dung bug tuong tu).
  if (hasResourceId(tree, /^exercise_connect_left_0$/)) {
    const byType = pool.filter((entry) => !entry.used && entry.q.type === "CONNECT");
    if (byType.length === 1) return byType[0];
    if (byType.length > 1) {
      const slots = collectConnectSlots(tree);
      const slotTexts = { left: new Set(slots.left.map((s) => s.text)), right: new Set(slots.right.map((s) => s.text)) };
      const byVisiblePairs = byType.filter((entry) => {
        const pairs = resolveConnectCorrectPairs(entry.q);
        if (!pairs) return false;
        const visiblePairs = pairs.filter((p) => slotTexts.left.has(p.leftText) || slotTexts.right.has(p.rightText));
        if (visiblePairs.length === 0) return false;
        return visiblePairs.every((p) => slotTexts.left.has(p.leftText) && slotTexts.right.has(p.rightText));
      });
      if (byVisiblePairs.length === 1) return byVisiblePairs[0];
    }
    return null;
  }

  // FILL_WORD (dien tu, vd "Listen and complete the notes...") - id "exercise_fillword_blank_0"
  // la tin hieu rieng, khong trung voi CONNECT/TEXT_CHOICE nen khong can uu tien dac biet nhu
  // CONNECT (khong the bi nham voi cau khac vi cau khac khong co id nay). Khop theo type truoc,
  // neu 1 exam co >1 cau FILL_WORD (chua gap that) moi can phan biet them theo SO O TRONG dang
  // hien tren man (dem node id blank_i) - khong doan, chi dem thuc te ca 2 phia.
  if (hasResourceId(tree, /^exercise_fillword_blank_0$/)) {
    const byType = pool.filter((entry) => !entry.used && entry.q.type === "FILL_WORD");
    if (byType.length === 1) return byType[0];
    if (byType.length > 1) {
      const blankCountOnScreen = collectBlankIndices(tree).size;
      const byBlankCount = byType.filter((entry) => (resolveFillWordValues(entry.q) ?? []).length === blankCountOnScreen);
      if (byBlankCount.length === 1) return byBlankCount[0];
    }
    return null;
  }

  // Uu tien khop theo NOI DUNG CAU HOI (q.question, cau hoan chinh render 1 node text duy nhat
  // tren man - da xac nhan that) - DUY NHAT hon overlap dap an: exam nay co NHIEU cau "Fill in
  // the blank" dung CHUNG 1 bo dap an {fit, avoid, dim, chapped} (khac nhau o cau hoi/dap an dung),
  // khien khop theo dap an tra ve >=2 ket qua (da xac nhan that qua probe - 2 cau cung visCount=4).
  const byPrompt = pool.filter((entry) => !entry.used && entry.q.question && isVisibleInTree(entry.q.question));
  if (byPrompt.length === 1) return byPrompt[0];

  // Fallback (khong co/khong khop prompt): khop theo dap an hien thi nhu cu.
  const matches = pool.filter((entry) => {
    if (entry.used) return false;
    if (!(entry.q.answers?.length >= 2)) return false;
    return entry.q.answers.filter((a) => a && isVisibleInTree(a)).length >= 2;
  });
  if (matches.length === 1) return matches[0];
  return null;
}

async function main() {
  const targetTitle = process.env.TARGET_TITLE;
  const targetDueDateDM = process.env.TARGET_DUE_DATE_DM || null;
  const targetScoreEnv = process.env.TARGET_SCORE;
  if (!targetTitle) throw new Error("Thieu env TARGET_TITLE.");
  if (targetScoreEnv !== undefined) {
    const n = Number(targetScoreEnv);
    if (!Number.isInteger(n) || n < 0) throw new Error(`TARGET_SCORE khong hop le: "${targetScoreEnv}".`);
  }
  const examId = process.env.EXAM_ID;
  if (!examId) throw new Error("Thieu env EXAM_ID (lay tu fetchEligibleAssignmentTree luc giao bai).");

  // MaestroMcpBridge: 1 tien trinh `maestro mcp` DUY NHAT song xuyen suot toan bo bai (thay vi
  // MaestroBridge cu tu spawn 1 tien trinh CLI rieng cho MOI runSteps()/hierarchy() - xem PERF
  // audit 2026-08-20, ~30-90s khoi dong session/lan). deviceId tai su dung tu config (KHONG tu
  // doan) - cung nguon DEVICE_ID da dung cho MaestroBridge truoc day.
  const bridge = wrapBridgeWithPerfLog(new MaestroMcpBridge({ appId: config.appId, deviceId: config.deviceId }));
  const nav = new HomeworkNavigationEngine(bridge);
  const exam = new HomeworkExamEngine(bridge);

  const resultFile = join(OUTPUT_DIR, `weekly_report_answer_${targetTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  const out = { targetTitle, targetDueDateDM, phases: {} };

  perf("MCP start requested");
  await bridge.start();
  perf(`MCP started (deviceId=${bridge.deviceId})`);
  try {
    await runFlow();
  } finally {
    perf("MCP stop requested");
    await bridge.stop();
    perf("MCP stopped");
  }

  async function runFlow() {
  // Neu lan chay truoc bi throw giua chung (vd loi CONNECT), app co the con dang dung o man
  // Doing (khong co tab bar "Bai tap" de nav.openHomeworkTab() tap vao) - thoat truoc qua
  // exercise_close_button, best-effort (khong throw neu khong thay - dang o dau khac cung on).
  let preTree = await bridge.hierarchy();
  if (hasResourceId(preTree, /^exercise_close_button$/)) {
    log(`[RECOVER] Dang con o man Doing tu lan chay truoc - thoat ra truoc qua exercise_close_button...`);
    await bridge.tap({ id: "exercise_close_button" });
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
    preTree = await bridge.hierarchy();
  }
  // Man Ket qua (exercise_result_screen) cung la 1 trang thai "ket thuc giua chung" khac Doing -
  // xay ra khi lan chay truoc throw NGAY SAU khi nop bai (vd MISMATCH) truoc khi kip dong man Ket
  // qua. Id "exercise_result_close_button" da xac nhan that (xem ktra_fullluong_lambai.yaml dong
  // ~333). Khong doan id moi - dung dung id da verify trong repo.
  if (hasResourceId(preTree, /^exercise_result_screen$/)) {
    log(`[RECOVER] Dang con o man Ket qua tu lan chay truoc - dong lai qua exercise_result_close_button...`);
    await bridge.tap({ id: "exercise_result_close_button" });
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
  }

  // Gop 4 lenh (openHomeworkTab/openFilterSheet/selectFilterRange/applyFilter) vao 1 lan
  // runSteps() bang ham OneShot co san (homeworkNavigationEngine.js) - PERF audit 2026-08-20:
  // day la doan chiem phan lon "~15 phut truoc khi bat dau lam bai" (4 lan `maestro test` rieng,
  // moi lan ~30-50s khoi dong session).
  log(`[MENU] Mo tab "Bai tap", filter "1 thang gan nhat" (gop 1 lan)...`);
  await nav.openHomeworkTabWithFilterOneShot(po.filterSheet.optionOneMonth);
  out.phases.menu = "PASS";
  perf("menu+filter ready");

  log(`[FIND] Tim card "${targetTitle}" (dueDateDM=${targetDueDateDM ?? "(bo qua)"})...`);
  const found = await findAssignment(bridge, { title: targetTitle, dueDateDM: targetDueDateDM });
  if (found.status !== "FOUND") {
    out.phases.find = { status: found.status, reason: found.reason ?? null };
    writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
    throw new Error(`Khong tim thay assignment: status=${found.status} reason=${found.reason ?? "(khong ro)"}`);
  }
  out.phases.find = "PASS";
  perf(`card found (title="${found.card.title}")`);
  log(`  FOUND: title="${found.card.title}" dueDate="${found.card.dueDate}" cta="${found.card.cta}"`);

  // Gop tap CTA + dismiss AI popup + verifyIdentity vao 1 lan runSteps() (cung tinh than
  // openHomeworkAndVerifyIdentityOneShot(), nhung KHONG goi thang ham do vi no tu goi lai
  // findAssignment() ben trong - se ton thoi gian scroll-tim THEM 1 lan nua, trong khi da co san
  // `found.card` roi). Dung ctaBounds (toa do that) neu co, giong tapFoundCard().
  log(`[OPEN] Tap vao card + xac nhan identity (gop 1 lan)...`);
  const tapCtaStep = found.card.ctaBounds
    ? { tapOn: { point: `${centerPoint(found.card.ctaBounds).x},${centerPoint(found.card.ctaBounds).y}` } }
    : { tapOn: { below: found.card.title, text: found.card.cta } };
  const openResult = await bridge.runSteps([
    tapCtaStep,
    { waitForAnimationToEnd: { timeout: 3000 } },
    { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
    { extendedWaitUntil: { visible: { text: found.card.title }, timeout: 10000 } },
    { assertNotVisible: { text: "Trò chuyện" } },
    { assertNotVisible: { text: "Bài tập về nhà" } },
  ]);
  if (!openResult.success) {
    throw new Error(`Khong mo duoc bai + xac nhan identity (gop 1 lan): ${openResult.error}`);
  }
  out.phases.open = "PASS";
  out.phases.identity = "PASS";
  perf("exercise opened + identity verified (1 lan runSteps)");

  // Lay Question/CorrectAnswer TRUOC (cache toan bo mot lan) - khong goi lai CMS trong vong lap
  // ANSWER ben duoi.
  log(`[EXAM RESOLVE] Lay Question/CorrectAnswer qua CMS exam-scraper (examId da biet truoc: ${examId})...`);
  const examData = await parseQuestionsFromExamPage(examId);
  const questions = normalizeQuestions(examData);
  if (!questions || questions.length === 0) {
    out.phases.examResolve = { status: "BLOCKED", reason: "parseQuestionsFromExamPage tra ve 0 cau hoi." };
    writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
    throw new Error(`BLOCKED: examId=${examId} khong co cau hoi nao.`);
  }
  // TARGET_SCORE truyen vao -> dung dung so do. Khong truyen -> RANDOM (cung cong thuc
  // buildRandomCorrectPlan() cua homeworkRandomScoringE2E.js: Math.floor(Math.random()*(N+1))).
  const correctCount =
    targetScoreEnv !== undefined ? Number(targetScoreEnv) : Math.floor(Math.random() * (questions.length + 1));
  if (correctCount > questions.length) {
    throw new Error(`TARGET_SCORE=${correctCount} > tong so cau (${questions.length}) cua bai nay.`);
  }
  out.correctCount = correctCount;
  out.correctCountSource = targetScoreEnv !== undefined ? "TARGET_SCORE" : "RANDOM";
  out.phases.examResolve = "PASS";
  out.questionCount = questions.length;
  log(`  RESOLVED: examId=${examId}, ${questions.length} cau - ke hoach (${out.correctCountSource}): ${correctCount} cau DUNG, ${questions.length - correctCount} cau SAI.`);
  perf("answer strategy ready (exam resolved + plan built)");

  // Pool cau CHUA DUNG, khop theo NOI DUNG hien thi that (KHONG theo thu tu index cua CMS - da xac
  // nhan thu tu mang questions[] KHONG khop thu tu hien thi thuc te tren man hinh).
  const pool = questions.map((q) => ({ q, used: false }));
  let correctRemaining = correctCount;

  log(`[ANSWER] Tra loi (khop noi dung, muc tieu ${correctCount}/${questions.length} cau dung)...`);
  let answeredCount = 0;
  const achieved = [];
  let reachedResult = false;
  // snapshot = {tree, texts} cua man hinh HIEN TAI - tai su dung xuyen suot vong lap, CHI fetch
  // hierarchy() MOI khi vua thao tac tap (state doi that). Trach redundant hierarchy()/isVisible()
  // rieng le (nguyen nhan chinh gay cham, xem PERF audit 2026-08-20: moi cau CONNECT truoc day ton
  // ~8-12 lan goi `maestro hierarchy`/`isVisible` rieng le, nay con dung 2 lan/cau).
  let snapshot = { tree: await bridge.hierarchy(), texts: null };
  snapshot.texts = collectTexts(snapshot.tree);
  for (let i = 0; i < MAX_QUESTIONS; i++) {
    if (exam.isResultScreen(snapshot.tree)) {
      reachedResult = true;
      break;
    }
    let matched = findMatchingQuestion(snapshot.tree, pool);
    if (!matched) {
      // Man hinh vua chuyen (vd sang CONNECT co audio/8 o - nang hon ONE/FILL_WORD) co the CHUA
      // kip render het cac node id can thiet dung luc snapshot truoc do duoc doc (waitForAnimationToEnd
      // 1000ms trong answerCurrentQuestionOneShot co the chua du) - thu doc lai hierarchy 1 LAN DUY
      // NHAT (khong lap vo han) truoc khi ket luan that su khong khop.
      await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
      snapshot = { tree: await bridge.hierarchy(), texts: null };
      snapshot.texts = collectTexts(snapshot.tree);
      if (exam.isResultScreen(snapshot.tree)) {
        reachedResult = true;
        break;
      }
      matched = findMatchingQuestion(snapshot.tree, pool);
    }
    if (!matched) {
      throw new Error(
        `Da tra loi ${answeredCount} cau - khong khop duoc DUY NHAT 1 question model nao trong pool con lai voi man hinh hien tai (khong doan).`,
      );
    }
    matched.used = true;
    perf(`matching started (cau ${answeredCount + 1}, type=${matched.q.type ?? "?"})`);
    // Phan bo ngan sach "dung" tuan tu theo cau THAT SU gap (khong theo vi tri mang): con ngan
    // sach "dung" thi cau gap tiep theo nham dung, het ngan sach thi nham sai.
    const wantCorrect = correctRemaining > 0;
    if (wantCorrect) correctRemaining--;
    const isLast = answeredCount + 1 === questions.length;
    const outcome = await exam.answerCurrentQuestionOneShot(matched.q, {
      wantCorrect,
      snapshot,
      resultLabel: isLast ? `weekly_report_answer_${targetTitle}_result` : null,
    });
    if (!outcome.supported) {
      throw new Error(`Handler khong ho tro cau ${answeredCount + 1}: ${outcome.reason} (${outcome.texts?.join(" | ") ?? ""})`);
    }
    if (outcome.isTargetCorrect === null) {
      throw new Error(`Cau ${answeredCount + 1}: khong xac dinh duoc dung/sai - dung lai.`);
    }
    perf(`matching completed + next button tapped (cau ${answeredCount + 1}, scrollCount=${outcome.scrollCount ?? 0})`);
    snapshot = { tree: outcome.finalTree, texts: collectTexts(outcome.finalTree) };
    answeredCount++;
    achieved.push(outcome.isTargetCorrect);
    log(`  Cau ${answeredCount}/${questions.length}: ${outcome.isTargetCorrect ? "DUNG" : "SAI"}`);
  }
  if (!reachedResult && !exam.isResultScreen(snapshot.tree)) {
    throw new Error(`Vuot qua ${MAX_QUESTIONS} cau ma chua thay man Ket qua.`);
  }
  out.phases.answer = "PASS";
  out.answeredCount = answeredCount;
  out.achieved = achieved;
  perf("all questions answered");

  log(`[RESULT] Doc diem that (tai su dung snapshot cuoi cung, khong fetch hierarchy moi)...`);
  const result = exam.readResult(snapshot.tree);
  out.result = result;
  log(`  Diem so: ${result.score ?? "(khong doc duoc)"} | So cau dung: ${result.correctCount ?? result.correct ?? "(khong doc duoc)"} / ${result.totalCount ?? "?"}`);

  const expectedCorrectCountFinal = achieved.filter((v) => v === true).length;
  if (result.correctCount !== null && expectedCorrectCountFinal !== result.correctCount) {
    out.phases.result = "MISMATCH";
    writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
    throw new Error(
      `Diem thuc te khong khop ke hoach: du kien ${expectedCorrectCountFinal}/${answeredCount} cau dung nhung man Ket qua bao ${result.correctCount}/${result.totalCount}.`,
    );
  }
  out.phases.result = "PASS";
  out.overall = "PASS";
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
  log(`\n[FINISH] PASS - diem that=${result.score}, da ghi ${resultFile}`);
  }
}

main().catch((err) => {
  console.error(`\n[weeklyReportAnswerHomework] Loi: ${err.message}`);
  process.exitCode = 1;
});
