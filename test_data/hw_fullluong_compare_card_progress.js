// Xac nhan card DA HOAN THANH - KHONG dung dong "N/M" lam tin hieu (xem comment chi tiet trong
// flows/bai_tap/ktra_fullluong_lambai.yaml, khoi PROGRESS_AFTER): da xac nhan THAT qua hierarchy
// dump truoc/sau rang dong "N/M" mang 2 y nghia khac nhau tuy thoi diem (truoc = so cau da tra
// loi/tong so cau, sau = so cau DUNG/tong so cau) du CUNG 1 VI TRI tren card - co the trung
// chuoi (vd "0/1" ca 2 lan) du ban chat khac han, khien so sanh so hoc bao SAI "khong tang" dù
// bai da that su hoan thanh.
//
// Tin hieu dang tin cay hon (da xac nhan that): dong "Diem <so>" (1 node hop nhat, dung SAU dong
// N/M, phia DUOI title) - CHI xuat hien tren card DA hoan thanh, card CHUA lam khong co dong nay
// o bat ky dau (da xac nhan ca 2 chieu qua hierarchy dump that, fixture "G3-U19-L3: Listen and
// choose"). output.afterCardProgress duoc doc bang selector rieng regex "Diem\s*[\d.,]+" nen chi
// co the la dong nay (khong phai badge diem so phia TREN title - badge do la 2 node RIENG "Diem"
// va "<so>", khong khop 1 dong gop).
var afterText = output.afterCardProgress;
var completedPattern = /Điểm\s*[0-9.,]+/;

if (completedPattern.test(String(afterText))) {
  output.cardProgressOk = true;
  output.cardProgressBlockedReason = null;
} else {
  output.cardProgressOk = false;
  output.cardProgressBlockedReason =
    "BLOCKED_CARD_NOT_COMPLETED - khong tim thay dong 'Diem <so>' o dung card sau khi ve danh " +
    "sach (gia tri doc duoc: " + JSON.stringify(afterText) + ") - card co the chua thuc su hoan " +
    "thanh, hoac scrollUntilVisible o buoc truoc dung sai vi tri.";
}
