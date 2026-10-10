import {useEffect,useState} from "react";
import {api,formatApiErrorDetail} from "@/lib/api";
import {downloadCsv} from "@/lib/download";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Download,Users} from "lucide-react";
import {toast} from "sonner";
export default function UserAnalyticsPage(){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 useEffect(()=>{api.get("/admin/users/summary").then(r=>setData(r.data)).catch(e=>toast.error(formatApiErrorDetail(e?.response?.data?.detail)||"Gagal memuat")).finally(()=>setLoading(false));},[]);
 const items=[["Total User",data?.total_user],["Pelanggan",data?.pelanggan],["Admin dan Staf",data?.staf_admin],["Email Terverifikasi",data?.verified],["Belum Verifikasi",data?.unverified],["Daftar 7 Hari",data?.pelanggan_baru_7_hari],["Daftar 30 Hari",data?.pelanggan_baru_30_hari]];
 const download=async()=>{setSaving(true);try{await downloadCsv("/admin/users/export","pelanggan_sadam_gadget.csv");toast.success("CSV pengguna siap diunduh");}catch(e){toast.error("Gagal mengunduh data pengguna: "+(e.message||"Silakan coba lagi"));}finally{setSaving(false);}};
 return <div className="space-y-5 pb-10"><div className="flex flex-wrap justify-between gap-3 items-start"><div><h1 className="font-heading font-bold text-2xl md:text-3xl">Analitik Pengguna</h1><p className="text-sm text-slate-500">Ringkasan akun terdaftar dan pertumbuhan pengguna.</p></div><Button onClick={download} disabled={saving} className="min-h-11"><Download className="mr-2 w-4 h-4"/>{saving?"Mengunduh...":"Unduh Pengguna (CSV)"}</Button></div>{loading?<p>Memuat data...</p>:<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{items.map(([label,value])=><Card key={label} className="p-4"><p className="text-slate-500 text-xs">{label}</p><p className="font-bold text-2xl mt-2">{value??0}</p></Card>)}</div>}<Card className="p-4 text-xs text-slate-500">Data CSV hanya tersedia bagi Owner dan Admin. Pengunduhan mencakup nama, email, nomor telepon, role, status akun, tanggal registrasi, dan persetujuan promosi—tanpa password atau token akses.</Card></div>;
}
