import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
const BASE = "https://www.emsifa.com/api-wilayah-indonesia/v2";
const opts = [{field:"provinsi",title:"Provinsi",url:"provinces.json"},
  {field:"kabupaten",title:"Kabupaten/Kota",url:"regencies"},
  {field:"kecamatan",title:"Kecamatan",url:"districts"},
  {field:"kelurahan",title:"Kelurahan/Desa",url:"villages"}];
export default function WilayahSelector({value,onChange}){
 const [provinces,setProvinces]=useState([]),[cities,setCities]=useState([]),[districts,setDistricts]=useState([]),[villages,setVillages]=useState([]);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const all=[provinces,cities,districts,villages];
 const setters=[setProvinces,setCities,setDistricts,setVillages];
 const ids=all.map((list,i)=>list.find(x=>x.name===value[opts[i].field])?.id||"");
 useEffect(()=>{
   let active=true;
   (async()=>{
     try{
       setError("");
       const r=await fetch(`${BASE}/provinces.json`);
       if(!r.ok)throw Error("HTTP "+r.status);
       const j=await r.json();if(active)setProvinces(j.data||[]);
     }catch(e){if(active)setError("Daftar wilayah tidak dapat dimuat. Periksa koneksi internet dan coba lagi.");}
   })();
   return ()=>{active=false};
 },[retry]);
 useEffect(()=>{
   const parent=ids[0];
   setCities([]);setDistricts([]);setVillages([]);
   if(!parent)return;
   let active=true;
   fetch(`${BASE}/regencies/${encodeURIComponent(parent)}.json`)
     .then(r=>{if(!r.ok)throw Error();return r.json()})
     .then(j=>{if(active)setCities(j.data||[])})
     .catch(()=>{if(active)setError("Gagal memuat kabupaten/kota. Coba lagi.")});
   return ()=>{active=false};
 },[ids[0],retry]);
 useEffect(()=>{
   const parent=ids[1];setDistricts([]);setVillages([]);
   if(!parent)return;
   let active=true;
   fetch(`${BASE}/districts/${encodeURIComponent(parent)}.json`)
    .then(r=>{if(!r.ok)throw Error();return r.json()})
    .then(j=>{if(active)setDistricts(j.data||[])})
    .catch(()=>{if(active)setError("Gagal memuat kecamatan. Coba lagi.")});
   return ()=>{active=false};
 },[ids[1],retry]);
 useEffect(()=>{
   const parent=ids[2];setVillages([]);
   if(!parent)return;
   let active=true;
   fetch(`${BASE}/villages/${encodeURIComponent(parent)}.json`)
    .then(r=>{if(!r.ok)throw Error();return r.json()})
    .then(j=>{if(active)setVillages(j.data||[])})
    .catch(()=>{if(active)setError("Gagal memuat kelurahan/desa. Coba lagi.")});
   return ()=>{active=false};
 },[ids[2],retry]);
 const change=(i,id)=>{
   const item=all[i].find(x=>x.id===id);
   const patch={[opts[i].field]:item?.name||""};
   for(let n=i+1;n<4;n++)patch[opts[n].field]="";
   if(i===3)patch.kode_pos=item?.postal_code||"";
   else patch.kode_pos="";
   onChange(patch);
 };
 return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {opts.map((opt,i)=><label key={opt.field} className="block text-sm"><Label>{opt.title}</Label>
 <select required value={ids[i]} onChange={e=>change(i,e.target.value)} disabled={i>0&&!ids[i-1]} className="w-full h-11 rounded-md border border-slate-300 bg-white px-3 mt-1" data-testid={`addr-${opt.field}`}>
  <option value="">Pilih {opt.title}</option>
  {all[i].map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
 </select></label>)}
 {error&&<div role="alert" className="col-span-full text-xs text-rose-700">{error} <button type="button" className="underline" onClick={()=>setRetry(v=>v+1)}>Coba lagi</button></div>}
 </div>;
}
