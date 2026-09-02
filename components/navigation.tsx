"use client";

import { Gift, Home, Images, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/create", label: "스튜디오", icon: Sparkles },
  { href: "/goods", label: "굿즈", icon: Gift },
  { href: "/album", label: "앨범", icon: Images },
  { href: "/mypage", label: "마이", icon: UserRound }
];

export function BottomNavigation() {
  const path = usePathname();
  return <nav aria-label="주요 메뉴" className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[480px] -translate-x-1/2 items-end justify-around border-t border-[#F0E4D8] bg-white/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
    {items.map(({ href, label, icon: Icon }) => {
      const active = path === href || (href !== "/home" && path.startsWith(href));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 flex-col items-center gap-1 text-[11px] font-semibold ${active ? "text-coral" : "text-[#8C7A6D]"}`}>
        <span className={`grid h-8 w-10 place-items-center rounded-xl transition-colors ${active ? "bg-[#FFF0E8]" : ""}`}><Icon size={21} /></span>
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
