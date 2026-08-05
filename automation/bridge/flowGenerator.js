#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dump } from "js-yaml";
import { resolveHandler } from "./handlers/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const DISCOVERY_FILE = join(OUTPUT_DIR, "discovery.json");
const FLOW_FILE = join(OUTPUT_DIR, "generated_flow.yaml");

/**
 * Bridge - CHỈ đọc discovery.json (kết quả của `npm run discover`, xem
 * automation/model/questionModel.js cho contract dữ liệu) và ghi ra 1 file Maestro YAML cụ
 * thể. KHÔNG tự gọi `maestro test` ở đây - Discovery/Bridge và việc chạy Maestro trên
 * emulator là 2 việc tách biệt hoàn toàn (bạn tự chạy `maestro test` sau khi file được sinh
 * ra, xem automation/README.md).
 *
 * GIỚI HẠN HIỆN TẠI (cố tình, không giả vờ đã xong): flow sinh ra CHỈ gồm các bước trả lời
 * câu hỏi (do handler tạo) - KHÔNG có bước đăng nhập/điều hướng tới đúng Book/Unit/Lesson/
 * Exercise đã random. Phần điều hướng tham số hoá theo tên thật (navigate_to_lesson.yaml)
 * chưa làm - xem TaskList "[Deferred phase 2] flowRenderer.js + navigate_to_lesson.yaml".
 * Trước khi chạy file sinh ra, cần tự mở app và vào đúng màn hình bài tập tương ứng.
 */
function loadDiscovery() {
  if (!existsSync(DISCOVERY_FILE)) {
    throw new Error(
      `Không tìm thấy ${DISCOVERY_FILE}. Chạy "npm run discover" trước để tạo file này.`,
    );
  }
  return JSON.parse(readFileSync(DISCOVERY_FILE, "utf8"));
}

/**
 * @param {Object} discovery - nội dung discovery.json
 * @returns {{ steps: Array<Object>, summary: { total: number, handled: number, skipped: number } }}
 */
export function buildStepsFromDiscovery(discovery) {
  const steps = [];
  let handled = 0;
  let skipped = 0;

  for (const question of discovery.questions ?? []) {
    const handler = resolveHandler(question.type);
    try {
      const questionSteps = handler.buildSteps(question);
      if (questionSteps.length > 0) {
        steps.push(...questionSteps);
        handled += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.warn(
        `[bridge] Bỏ qua question ${question.id} (type="${question.type}"): ${err.message}`,
      );
      skipped += 1;
    }
  }

  return { steps, summary: { total: (discovery.questions ?? []).length, handled, skipped } };
}

export function renderMaestroFlow(discovery, steps) {
  const header = dump({ appId: "${APP_ID}" }, { lineWidth: -1 });
  const body = steps.length > 0 ? dump(steps, { lineWidth: -1 }) : "[]\n";

  const comment =
    `# Flow được sinh tự động bởi automation/bridge/flowGenerator.js - KHÔNG sửa tay file này,\n` +
    `# sửa lại discovery.json hoặc handler tương ứng trong automation/bridge/handlers/ rồi\n` +
    `# chạy lại "npm run generate-flow".\n` +
    `#\n` +
    `# Nguồn: Book "${discovery.book?.name}" > Unit "${discovery.unit?.name}" > ` +
    `Lesson "${discovery.lesson?.name}" > Exercise "${discovery.exercise?.name}" > ` +
    `Exam "${discovery.examName}" (id=${discovery.examId})\n` +
    `#\n` +
    `# GIỚI HẠN: flow này CHƯA có bước đăng nhập/điều hướng tới đúng màn hình bài tập -\n` +
    `# phải tự mở app và vào đúng Exercise trên trước khi chạy \`maestro test\` file này.\n`;

  return `${comment}${header}---\n${body}`;
}

async function main() {
  const discovery = loadDiscovery();
  const { steps, summary } = buildStepsFromDiscovery(discovery);

  console.log("== Bridge: Discovery -> Maestro flow ==\n");
  console.log(
    `Book: ${discovery.book?.name} | Unit: ${discovery.unit?.name} | Lesson: ${discovery.lesson?.name}`,
  );
  console.log(`Exercise: ${discovery.exercise?.name} | Exam: ${discovery.examName}`);
  console.log(
    `Question: ${summary.total} tổng - ${summary.handled} có handler xử lý, ${summary.skipped} bị bỏ qua ` +
      `(xem log cảnh báo ở trên để biết lý do từng câu).`,
  );

  if (steps.length === 0) {
    console.warn(
      "\n[bridge] Không sinh được bước nào (0/... question có handler) - file flow vẫn được ghi " +
        "ra nhưng sẽ không thao tác gì trên emulator. Kiểm tra log cảnh báo ở trên.",
    );
  }

  const flowYaml = renderMaestroFlow(discovery, steps);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(FLOW_FILE, flowYaml, "utf8");
  console.log(`\nĐã ghi flow ra ${FLOW_FILE}`);
  console.log(
    `Chạy thử (sau khi tự mở app + vào đúng màn hình Exercise trên emulator):\n` +
      `  maestro test "${FLOW_FILE}" -e APP_ID=com.inet.parrotedu`,
  );
}

main().catch((err) => {
  console.error(`\n[generate-flow] Lỗi: ${err.message}`);
  process.exitCode = 1;
});
