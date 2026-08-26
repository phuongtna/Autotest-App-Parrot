// Dung cho HW-30 (flows/app/bai_tap/ktra_doan_van_dai_dich_va_dich_tu.yaml): xac nhan noi dung
// vua copyTextFrom (vd ban dich ca doan van, id paragraph_translate_result) khong rong sau khi
// trim - KHONG kiem tra dung noi dung cu the, vi doan van/ban dich phu thuoc bai duoc chon ngau
// nhien, khong duoc hardcode.
output.copiedTextNonEmpty = (maestro.copiedText || "").trim().length > 0;
