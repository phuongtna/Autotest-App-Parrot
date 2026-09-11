/**
 * Builder cho response giả `GET /api/user/report-stats/room-analytic?room_id=` - nguồn dữ liệu
 * "Chưa nộp bài"/"Đã hoàn thành"/"Phổ điểm" (xem schema thật trong speakingReportPageObjects.js).
 */
export function buildRoomAnalytic({ roomId, roomName, submitted = [], notSubmitted = [] }) {
  const distribution = { below_5: 0, "from_5_to_6.9": 0, "from_7_to_8.9": 0, "from_9_to_10": 0 };
  for (const s of submitted) {
    if (s.score < 5) distribution.below_5 += 1;
    else if (s.score < 7) distribution["from_5_to_6.9"] += 1;
    else if (s.score < 9) distribution["from_7_to_8.9"] += 1;
    else distribution["from_9_to_10"] += 1;
  }
  return {
    status: true,
    room_id: roomId,
    room_name: roomName,
    submitted: submitted.map((s) => ({
      id: s.id,
      profile_id: s.id,
      name: s.name,
      avatar: s.avatar ?? "",
      score: s.score,
    })),
    not_submitted: notSubmitted.map((s) => ({ id: s.id, profile_id: s.id, name: s.name, avatar: s.avatar ?? "" })),
    score_distribution: distribution,
  };
}
