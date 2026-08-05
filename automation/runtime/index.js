#!/usr/bin/env node
import { config } from "../src/config.js";
import { loadDiscoveryOutput } from "./discoveryReader.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { NavigationEngine } from "../navigation/navigationEngine.js";
import { HandlerRegistry } from "./handlers/handlerRegistry.js";
import { writeRunResult } from "./resultWriter.js";

/**
 * Runtime - điều phối Discovery (chỉ ĐỌC output/discovery.json) -> NavigationEngine -> Handler
 * (theo QuestionType) -> Next Question -> Finish. KHÔNG chứa logic UI (đó là NavigationEngine/
 * Handler qua MaestroBridge) và KHÔNG chứa logic CMS (đó là automation/discovery/, độc lập
 * hoàn toàn - Runtime không import module nào trong đó).
 *
 * Dependency Injection: Runtime tạo 1 MaestroBridge DUY NHẤT rồi tự truyền (inject) cho
 * NavigationEngine và HandlerRegistry (nơi tạo Handler) - NavigationEngine/Handler không tự
 * tạo Bridge riêng.
 *
 * GIẢ ĐỊNH (xem automation/navigation/navigationEngine.js): app đã mở, đã đăng nhập, đang ở tab
 * gốc "Vui học" trước khi chạy - Runtime hiện CHƯA tự đăng nhập (ngoài phạm vi được yêu cầu:
 * NavigationEngine chỉ điều hướng Book/Unit/Lesson/Exercise, không phải đăng nhập).
 *
 * Chạy: node runtime/index.js (hoặc npm run run-e2e), sau khi đã có output/discovery.json
 * (npm run discover) và app đang mở sẵn ở tab "Vui học" trên thiết bị/emulator đang kết nối.
 */

function log(...args) {
  console.log(...args);
}

function buildResultEntry(discovery, question, outcome, durationMs) {
  return {
    book: discovery.book?.name ?? null,
    unit: discovery.unit?.name ?? null,
    lesson: discovery.lesson?.name ?? null,
    exercise: discovery.exercise?.name ?? null,
    questionType: question.type,
    correctAnswer: question.correctAnswer,
    selectedAnswer: outcome.selectedAnswer ?? null,
    status: outcome.status,
    duration: durationMs,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  log("[DISCOVERY]");
  const discovery = loadDiscoveryOutput();
  log(`Book: ${discovery.book?.name}`);
  log(`Unit: ${discovery.unit?.name}`);
  log(`Lesson: ${discovery.lesson?.name}`);
  log(`Exercise: ${discovery.exercise?.name}`);
  log(`Question count: ${discovery.questions?.length ?? 0}`);

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });

  log("\n[NAVIGATION]");
  log(`Open Book "${discovery.book?.name}"...`);
  log(`Open Unit "${discovery.unit?.name}"...`);
  log(`Open Lesson "${discovery.lesson?.name}"...`);
  log(`Open Exercise "${discovery.exercise?.name}"...`);
  const navigation = new NavigationEngine(bridge);
  await navigation.navigateTo({
    book: discovery.book,
    unit: discovery.unit,
    lesson: discovery.lesson,
    exercise: discovery.exercise,
  });

  log("\n[RUNTIME]");
  const registry = new HandlerRegistry(bridge);
  const results = [];

  const questions = discovery.questions ?? [];
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    log(`\nQuestion ${i + 1} (type=${question.type})`);

    const handler = registry.resolve(question.type);
    if (!handler) {
      log(`Handler = (không có handler khớp - bỏ qua)`);
      results.push(
        buildResultEntry(discovery, question, { selectedAnswer: null, status: "SKIPPED" }, 0),
      );
      continue;
    }

    log(`Handler = ${handler.constructor.name}`);
    const startedAt = Date.now();
    let outcome;
    try {
      outcome = await handler.execute(question);
    } catch (err) {
      // 1 Handler lỗi (vd chưa implement - xem fillBlankHandler.js/sentenceBuilderHandler.js/
      // matchingHandler.js/dragDropHandler.js) không được làm hỏng cả lượt chạy - log rõ rồi
      // qua câu tiếp theo, giống cách automation/bridge/flowGenerator.js xử lý.
      log(`[RUNTIME] Lỗi khi xử lý câu hỏi: ${err.message}`);
      outcome = { selectedAnswer: null, expected: question.correctAnswer, actual: null, status: "ERROR" };
    }
    const duration = Date.now() - startedAt;

    log(`Answer = ${outcome.selectedAnswer ?? "(none)"}`);
    log(`Expected = ${outcome.expected ?? "(none)"}`);
    log(`Actual = ${outcome.actual ?? "(none)"}`);
    log(`Result = ${outcome.status}`);

    results.push(buildResultEntry(discovery, question, outcome, duration));
  }

  const resultFile = writeRunResult(results);
  log(`\n[FINISH] Đã ghi ${results.length} kết quả ra ${resultFile}`);
}

main().catch((err) => {
  console.error(`\n[runtime] Lỗi: ${err.message}`);
  process.exitCode = 1;
});
