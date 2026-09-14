/**
 * Track A - chọn "lượt làm bài Speaking cần đối chiếu" từ danh sách lượt làm bài (điểm tổng),
 * dùng làm single source of truth khi verify điểm tổng trên Web Báo cáo Speaking.
 *
 * Rule (đã xác nhận qua AskUserQuestion với user - "Lượt GẦN NHẤT" là assumption, KHÔNG phải đã
 * confirm với Dev/BA):
 *   1. bestScore = max(score) trong toàn bộ attempts.
 *   2. candidates = các attempt có score == bestScore.
 *   3. Nếu chỉ 1 candidate -> trả về candidate đó.
 *   4. Nếu nhiều candidate cùng bestScore -> trả về candidate có timestamp mới nhất.
 *   5. Nếu timestamp cũng bằng nhau (hiếm, vd làm tròn phút) -> KHÔNG throw, giữ candidate đầu
 *      tiên gặp trong mảng input (deterministic, không phụ thuộc thứ tự sort của caller).
 *
 * Pure function - không phụ thuộc Playwright/Maestro, không gọi API/UI, không mutate input.
 */
export function selectBestAttempt(attempts) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    throw new Error("selectBestAttempt: attempts rỗng hoặc không hợp lệ.");
  }

  for (const attempt of attempts) {
    if (typeof attempt?.score !== "number" || Number.isNaN(attempt.score)) {
      throw new Error(
        `selectBestAttempt: attempt thiếu score hợp lệ - ${JSON.stringify(attempt)}`,
      );
    }
  }

  const bestScore = Math.max(...attempts.map((attempt) => attempt.score));
  const candidates = attempts.filter((attempt) => attempt.score === bestScore);

  if (candidates.length === 1) {
    return candidates[0];
  }

  // Hòa điểm cao nhất -> chọn timestamp mới nhất. reduce() giữ nguyên phần tử đầu tiên khi
  // currentTime <= latestTime (không đổi latest), nên tie-break timestamp bằng nhau tự nhiên
  // giữ candidate đầu tiên trong mảng candidates (thứ tự này bám theo thứ tự trong `attempts`
  // gốc vì filter() không sắp xếp lại) - đúng yêu cầu "deterministic, giữ candidate đầu tiên".
  return candidates.reduce((latest, current) => {
    const currentTime = new Date(current.timestamp).getTime();
    const latestTime = new Date(latest.timestamp).getTime();

    if (Number.isNaN(currentTime) || Number.isNaN(latestTime)) {
      throw new Error(
        "selectBestAttempt: timestamp không parse được thành Date hợp lệ - " +
          `current=${JSON.stringify(current)}, latest=${JSON.stringify(latest)}`,
      );
    }

    return currentTime > latestTime ? current : latest;
  });
}
