import { useSettings } from "@/lib/settings";
import { MessageCircle } from "lucide-react";

export default function WhatsAppFloat() {
  const { settings } = useSettings();
  const nomor = settings?.whatsapp_number?.replace(/[^0-9]/g, "");
  if (!nomor) return null;
  const pesan = encodeURIComponent(settings?.whatsapp_pesan_default || "Halo, saya ingin bertanya.");
  const url = `https://wa.me/${nomor}?text=${pesan}`;
  return (
    <a
      href={url} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE57] text-white font-medium rounded-full shadow-lg px-4 py-3 transition-transform hover:scale-105 active:scale-95"
      data-testid="whatsapp-float"
      aria-label="Chat via WhatsApp"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="hidden sm:inline text-sm">Chat WhatsApp</span>
    </a>
  );
}
