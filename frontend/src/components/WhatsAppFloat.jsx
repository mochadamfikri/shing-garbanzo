import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSettings } from "@/lib/settings";
import { MessageCircle, GripVertical } from "lucide-react";

const SIZE = 52;
function clamp(pos) {
  return { x:Math.max(8,Math.min(window.innerWidth-SIZE-8,pos.x)),
           y:Math.max(70,Math.min(window.innerHeight-SIZE-8,pos.y)) };
}
export default function WhatsAppFloat(){
 const { settings }=useSettings(),location=useLocation(),drag=useRef(null);
 const [pos,setPos]=useState(()=>{try{const val=JSON.parse(localStorage.getItem("wa-float-position"));if(val&&Number.isFinite(val.x)&&Number.isFinite(val.y))return clamp(val);}catch(e){}return clamp({x:window.innerWidth-70,y:window.innerHeight-90});});
 useEffect(()=>{const reposition=()=>setPos(p=>clamp(p));window.addEventListener("resize",reposition);return()=>window.removeEventListener("resize",reposition)},[]);
 const nomor=settings?.whatsapp_number?.replace(/[^0-9]/g,"");
 if (!nomor || location.pathname.startsWith("/admin")) return null;
 const url=`https://wa.me/${nomor}?text=${encodeURIComponent(settings?.whatsapp_pesan_default||"Halo, saya ingin bertanya.")}`;
 const down=e=>{if(e.button!==0 && e.pointerType==="mouse")return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,left:pos.x,top:pos.y,moved:false};};
 const move=e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>6)drag.current.moved=true;if(drag.current.moved)setPos(clamp({x:drag.current.left+dx,y:drag.current.top+dy}));};
 const up=e=>{if(!drag.current)return;const moved=drag.current.moved;drag.current=null;try{localStorage.setItem("wa-float-position",JSON.stringify(pos));}catch(err){}if(!moved)window.open(url,"_blank","noopener,noreferrer");};
 return <button type="button" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null}} aria-label="Chat WhatsApp. Tahan dan geser untuk memindahkan tombol." title="Geser untuk pindahkan, ketuk untuk chat" data-testid="whatsapp-float"
 style={{position:"fixed",left:pos.x,top:pos.y,touchAction:"none",width:SIZE,height:SIZE,zIndex:39}}
 className="rounded-full flex items-center justify-center bg-[#25D366] text-white shadow-lg ring-2 ring-white cursor-grab active:cursor-grabbing"><MessageCircle className="w-6 h-6"/><GripVertical className="w-3 h-3 absolute -right-1 -top-1 bg-white text-slate-600 rounded-full"/></button>;
}
