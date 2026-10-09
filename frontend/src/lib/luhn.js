// Validasi IMEI: panjang 14-17 digit numerik. Jika 15 digit (standar), harus lulus Luhn.
export function luhnCheck(num) {
  if (!/^\d+$/.test(num)) return false;
  let sum = 0;
  const rev = num.split("").reverse();
  for (let i = 0; i < rev.length; i++) {
    let d = parseInt(rev[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function validateImeiClient(imei) {
  const v = (imei || "").trim();
  if (!v) return { ok: false, message: "IMEI tidak boleh kosong" };
  if (!/^\d+$/.test(v)) return { ok: false, message: "IMEI hanya boleh berisi angka" };
  if (v.length < 14 || v.length > 17) return { ok: false, message: `Panjang IMEI harus 14-17 digit (saat ini ${v.length})` };
  if (v.length === 15 && !luhnCheck(v)) return { ok: false, message: "Checksum IMEI (Luhn) tidak valid" };
  return { ok: true, message: "OK" };
}
