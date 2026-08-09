// Sinh số lần scroll ngẫu nhiên (0-2) để giả-random chọn 1 Homework trong danh sách
// "Bài tập" - xem giải thích trong flows/bai_tap/complete_random_homework_success.yaml
// (Maestro không có API chọn ngẫu nhiên thật giữa nhiều phần tử cùng text).
output.scrollTimes = Math.floor(Math.random() * 3);
