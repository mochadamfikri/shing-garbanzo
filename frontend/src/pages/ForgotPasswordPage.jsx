import { useState } from "react";
import { Link } from "react-router-dom";
import { api,formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
export default function ForgotPasswordPage(){
 const [email,setEmail]=useState(""),[code,setCode]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
 const [step,setStep]=useState(1),[busy,setBusy]=useState(false);
 const request=async e=>{e.preventDefault();setBusy(true);try{const r=await api.post("/auth/forgot-password",{email});toast.info(r.data.message);setStep(2);}catch(e){toast.error(formatApiErrorDetail(e?.response?.data?.detail));}finally{setBusy(false)}};
 const reset=async e=>{e.preventDefault();if(password!==confirm)return toast.error("Konfirmasi kata sandi tidak sama");setBusy(true);try{await api.post("/auth/reset-password",{email,code,new_password:password});toast.success("Password berhasil direset");setStep(3);}catch(e){toast.error(formatApiErrorDetail(e?.response?.data?.detail));}finally{setBusy(false)}};
 return <div className="max-w-md mx-auto px-4 py-12"><Card className="p-6 space-y-4"><h1 className="font-bold text-2xl">Reset Password</h1>{step===3?<><p>Password berhasil diperbarui.</p><Link className="text-blue-700 underline" to="/masuk">Masuk dengan password baru</Link></>:step===1?<form className="space-y-3" onSubmit={request}><p className="text-sm text-slate-600">Masukkan email terdaftar. Kami akan mengirim kode reset 6 digit melalui SMTP toko.</p><Input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><Button className="w-full" disabled={busy}>{busy?"Mengirim...":"Kirim Kode Reset"}</Button></form>:<form className="space-y-3" onSubmit={reset}><p className="text-sm text-slate-600">Cek inbox/spam {email}. Kode hanya berlaku 10 menit.</p><Input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Kode 6 digit" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/><Input required type="password" minLength={8} maxLength={128} placeholder="Password baru (min. 8 karakter)" value={password} onChange={e=>setPassword(e.target.value)}/><Input required type="password" placeholder="Ulangi password" value={confirm} onChange={e=>setConfirm(e.target.value)}/><Button disabled={busy} className="w-full">{busy?"Memproses...":"Ganti Password"}</Button><Button type="button" variant="outline" className="w-full" disabled={busy} onClick={()=>setStep(1)}>Kirim ulang kode</Button></form>}<Link to="/masuk" className="text-sm text-blue-700 underline">Kembali ke login</Link></Card></div>;
}
