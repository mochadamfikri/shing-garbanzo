const BULAN = ["JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI","JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"];

export function formatTanggalID(dateLike) {
  if (!dateLike) return "-";
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  if (isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${BULAN[d.getMonth()]}/${d.getFullYear()}`;
}

export function formatRupiah(value) {
  const n = Number(value || 0);
  if (!isFinite(n)) return "Rp 0";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function parseRupiahInput(str) {
  if (typeof str !== "string") return Number(str) || 0;
  const only = str.replace(/[^0-9]/g, "");
  return only ? parseInt(only, 10) : 0;
}
