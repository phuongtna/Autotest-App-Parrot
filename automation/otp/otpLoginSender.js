function collectTexts(node, acc) {
  const text = node?.attributes?.text;
  if (typeof text === "string" && text.trim()) acc.push(text.trim());
  for (const child of node?.children ?? []) collectTexts(child, acc);
  return acc;
}

/**
 * Gửi 1 lần OTP cho `phone` qua màn đăng nhập (SĐT -> "Đăng nhập") - KHÔNG dùng link "Gửi lại OTP"
 * trên màn "Xác thực OTP".
 *
 * PHÁT HIỆN THẬT (2026-09-10, thiết bị 3201d866d40a1681, SĐT 0987652170/0936021880 - tài khoản
 * Zalo thật, KHÔNG phải OTP=888888 cố định trong accounts.env): link "Gửi lại OTP" trên màn Xác
 * thực OTP CHỈ hiện sau khi đếm ngược "Mã sẽ hết hạn sau Ns" chạy hết 300s - đó là gate PHÍA UI.
 * Nhưng quay lại màn đăng nhập (bấm "Đổi số điện thoại"), nhập lại CHÍNH SĐT đang chờ hoặc SĐT
 * khác, rồi bấm "Đăng nhập" - gửi NGAY 1 mã mới, HOÀN TOÀN không chờ 300s đó (đã lặp lại nhiều
 * lần liên tiếp, xác nhận nhất quán). Giới hạn 5 lần/ngày là cơ chế backend THẬT SỰ riêng - chặn
 * đúng lần thứ 6 dù gửi qua đường "Đăng nhập" hay "Gửi lại OTP", với thông báo:
 *   "Bạn đã gửi quá số lần cho phép trong ngày. Vui lòng thử lại vào ngày mai"
 * Do đó dùng "Đăng nhập" cho MỌI lần gửi (kể cả lần đầu) là cách NHANH NHẤT để cạn quota thật
 * (không cần chờ cooldown giữa các lần) - hàm này không mô phỏng, gọi thẳng UI thật mỗi lần.
 *
 * @param {import("../bridge/maestroBridge.js").MaestroBridge} bridge
 * @param {string} phone
 * @returns {Promise<{ outcome: "SUCCESS"|"BLOCKED"|"UNKNOWN", blockedMessage: string|null, texts: string[] }>}
 */
export async function sendOtpViaLogin(bridge, phone) {
  const texts0 = collectTexts(bridge.hierarchy(), []);
  if (texts0.some((t) => /Xác thực OTP/.test(t))) {
    await bridge.tap("Đổi số điện thoại");
  }

  await bridge.tap("Nhập số điện thoại");
  await bridge.runSteps([{ eraseText: 15 }, { inputText: phone }, "hideKeyboard", { tapOn: "Đăng nhập" }]);

  const texts1 = collectTexts(bridge.hierarchy(), []);
  const blockedLine = texts1.find((t) => /đã gửi quá số lần cho phép trong ngày/i.test(t));
  if (blockedLine) {
    return { outcome: "BLOCKED", blockedMessage: blockedLine, texts: texts1 };
  }
  if (texts1.some((t) => /Xác thực OTP/.test(t)) && texts1.some((t) => t === phone)) {
    return { outcome: "SUCCESS", blockedMessage: null, texts: texts1 };
  }
  return { outcome: "UNKNOWN", blockedMessage: null, texts: texts1 };
}
