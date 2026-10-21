import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";

const APP_ID = "com.inet.parrotedu";
const bridge = new MaestroMcpBridge({ appId: APP_ID });
await bridge.start();
try {
  await bridge.tap({ id: "exercise_close_button" });
  await new Promise((r) => setTimeout(r, 1500));
  const tree = await bridge.hierarchy();
  const text = JSON.stringify(tree);
  console.log("[AFTER-CLOSE] has exercise_doing_screen:", text.includes("exercise_doing_screen"));
  console.log("[AFTER-CLOSE] has confirm-dialog markers:", text.includes("Thoát") || text.includes("Đồng ý") || text.includes("Xác nhận"));
  // dump button texts to find a confirm button if dialog appeared
  const matches = [...text.matchAll(/"text"\s*:\s*"([^"]+)"/g)].map((m) => m[1]).filter((t) => t && t !== "\\" );
  console.log("[TEXTS]", JSON.stringify([...new Set(matches)]));
} finally {
  await bridge.stop();
}
