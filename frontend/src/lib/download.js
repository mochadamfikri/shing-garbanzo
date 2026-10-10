import {api} from "@/lib/api";
export async function downloadCsv(path,filename) {
 const res=await api.get(path,{responseType:"blob"});
 const type=res.headers?.["content-type"]||"text/csv; charset=utf-8";
 if (!type.includes("csv") && !type.includes("octet-stream")) throw new Error("Server tidak mengirim file CSV");
 const blob=new Blob([res.data],{type});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");
 const disposition=res.headers?.["content-disposition"]||"";
 const fileFromServer=disposition.match(/filename="?([^";]+)"?/i)?.[1];
 link.href=url;
 link.download=fileFromServer||filename;
 document.body.appendChild(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
