import { useEffect,useState } from "react";
import { api,formatApiErrorDetail } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid } from "recharts";
import { toast } from "sonner";
const localDate=d=>new Date(d).toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"});
export default function AnalitikV2Page(){
 const [start,setStart]=useState(()=>localDate(Date.now()-29*86400000));
 const [end,setEnd]=useState(()=>localDate(Date.now()));
 const [data,setData]=useState(null),[loading,setLoading]=useState(false);
 const load=async()=>{setLoading(true);try{const r=await api.get("/reports/v2/summary",{params:{start,end}});setData(r.data);}catch(e){toast.error(formatApiErrorDetail(e?.response?.data?.detail)||"Gagal memuat laporan");}finally{setLoading(false)}};
 useEffect(()=>{load();/* eslint-disable-next-line react-hooks/exhaustive-deps */},[]);
 const m=data?.metrics||{};
 const cards=[["Omzet",formatRupiah(m.omzet)],["POS",formatRupiah(m.pos)],["Online",formatRupiah(m.online)],["Total Transaksi",m.total_transaksi??0],["Unit Terjual",m.unit_terjual??0],["HPP",formatRupiah(m.hpp)],["Laba Kotor",formatRupiah(m.laba_kotor)],["Biaya Transaksi",formatRupiah(m.biaya_transaksi)],["Pengeluaran",formatRupiah(m.pengeluaran)],["Laba Bersih",formatRupiah(m.laba_bersih)],["Margin",`${m.margin_persen??0}%`]];
 return <div className="space-y-5 pb-8"><div><h1 className="font-bold text-2xl md:text-3xl">Analitik V2</h1><p className="text-sm text-slate-500">Transaksi POS dan website dalam satu laporan.</p></div>
 <Card className="p-4"><div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end"><label className="text-xs">Dari<Input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="text-xs">Sampai<Input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><Button disabled={loading} onClick={load}>{loading?"Memuat...":"Terapkan"}</Button></div></Card>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(([name,value])=><Card key={name} className="p-3 md:p-4 min-w-0"><p className="text-xs text-slate-500">{name}</p><p className="mt-1 font-bold text-base md:text-xl break-words">{value}</p></Card>)}</div>
 <Card className="p-4"><h2 className="font-semibold mb-3">Tren omzet harian</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.harian||[]}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="tanggal" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} width={44}/><Tooltip formatter={v=>formatRupiah(v)}/><Bar dataKey="pos" stackId="s" fill="#2563eb" name="POS"/><Bar dataKey="online" stackId="s" fill="#10b981" name="Online"/></BarChart></ResponsiveContainer></div></Card>
 <Card className="p-4"><h2 className="font-semibold mb-3">Produk terlaris</h2>{!data?.produk_terlaris?.length?<p className="text-sm text-slate-500">Belum ada transaksi di periode ini.</p>:data.produk_terlaris.map(x=><div key={x.produk} className="py-2 border-b last:border-0 flex justify-between gap-3 text-sm"><span>{x.produk}</span><strong>{x.unit} unit</strong></div>)}</Card>
 {data?.catatan&&<p className="text-xs text-amber-700">{data.catatan}</p>}</div>
}