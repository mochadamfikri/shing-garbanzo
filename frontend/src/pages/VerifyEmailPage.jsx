import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
export default function VerifyEmailPage(){
 const [params]=useSearchParams();
 const [email,setEmail]=useState(params.get("email")||"");
 const [code,setCode]=useState("");
 const [busy,setBusy]=useState(false),[verified,setVerified]=useState(false);
 const check=async e=>{e.preventDefault();setBusy(true);try{await api.post("/auth/verify-email",{email,code});setVerified(true);toast.success("Email sudah diverifikasi");}catch(e){toast.error(formatApiErrorDetail(e?.response?.data?.detail));}finally{setBusy(false)}};
 const resend=async()=>{setBusy(true);try{const r=await api.post("/auth/resend-verification",{email});toast.info(r.data.message);}catch(e){toast.error(formatApiErrorDetail(e?.response?.data?.detail));}finally{setBusy(false)}};
 return <div className="max-w-md mx-auto px-4 py-12"><Card className="p-6 space-y-4"><h1 className="font-bold text-2xl">Verifikasi Email</h1><p className="text-sm text-slate-600">Masukkan kode 6 digit yang dikirim melalui email. Berlaku 10 menit dan hanya sekali digunakan.</p>{verified?<><p className="font-medium text-emerald-700">Akun sudah aktif.</p><Link to="/masuk" className="text-blue-700 underline">Masuk ke akun</Link></>:<form onSubmit={check} className="space-y-3"><label className="block text-sm">Email<Input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><label className="block text-sm">Kode Verifikasi<Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} /></label><Button className="w-full" disabled={busy}>{busy?"Memproses...":"Verifikasi Sekarang"}</Button><Button type="button" variant="outline" className="w-full" disabled={busy||!email} onClick={resend}>Kirim Ulang Kode</Button></form>}</Card></div>;
}
