"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, Bell, CalendarDays, Camera, Check, CheckSquare, ChevronLeft, ChevronRight, Coffee, CreditCard, Eye, EyeOff, Folder, FolderPlus, Frame, Grid2X2, GripVertical, Heart, ImageIcon, ImagePlus, LogOut, Package, Palette, PawPrint, Pencil, Share2, Sparkles, Upload, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { BottomNavigation } from "@/components/navigation";
import { Button, Card } from "@/components/mna-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { MockAIProvider } from "@/lib/ai/mock-provider";
import { seedStyles, type AlbumFolder, type Artwork, type Gender, type Pet, type PetImage, type Species, type Style } from "@/lib/types";

type UserInfo = { id: string; email: string };
type Notice = { type: "error" | "success"; text: string } | null;
const demoPhotos = [
  "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80"
];

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}
function saveLocal(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function uid() { return crypto.randomUUID(); }
function ageOf(date: string | null) {
  if (!date) return "생일 미등록";
  const years = new Date().getFullYear() - new Date(date).getFullYear();
  return `${Math.max(0, years)}살`;
}

export default function MeongnyangApp() {
  const path = usePathname();
  const router = useRouter();
  const supabase = getSupabase();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [guest, setGuest] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petImages, setPetImages] = useState<PetImage[]>([]);
  const [albumFolders, setAlbumFolders] = useState<AlbumFolder[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [notice, setNotice] = useState<Notice>(null);

  const loadData = useCallback(async (current: UserInfo) => {
    if (!supabase) {
      setPets(readLocal<Pet[]>("mna_pets", []));
      setPetImages(readLocal<PetImage[]>("mna_pet_images", []));
      setAlbumFolders(readLocal<AlbumFolder[]>("mna_album_folders", []));
      setArtworks(readLocal<Artwork[]>("mna_artworks", []));
      return;
    }
    const { data: petRows, error } = await supabase.from("pets").select("*").eq("user_id", current.id).order("created_at", { ascending: false });
    if (error) { setNotice({ type: "error", text: "반려동물 정보를 불러오지 못했어요." }); return; }
    const withUrls = await Promise.all((petRows || []).map(async (pet: Pet) => {
      if (!pet.cover_image_path) return pet;
      const { data } = await supabase.storage.from("pet-uploads").createSignedUrl(pet.cover_image_path, 3600);
      return { ...pet, cover_url: data?.signedUrl || null };
    }));
    setPets(withUrls);
    let petImageResult = await supabase.from("pet_images").select("id,pet_id,user_id,storage_path,is_primary,folder_id,taken_at,note,created_at").eq("user_id", current.id).order("created_at", { ascending: false });
    if (petImageResult.error) petImageResult = await supabase.from("pet_images").select("id,pet_id,user_id,storage_path,is_primary,created_at").eq("user_id", current.id).order("created_at", { ascending: false });
    const { data: petImageRows, error: petImageError } = petImageResult;
    if (!petImageError) {
      const originals = await Promise.all((petImageRows || []).map(async (img) => {
        const { data } = await supabase.storage.from("pet-uploads").createSignedUrl(img.storage_path, 3600);
        return { ...img, folder_id: img.folder_id || null, taken_at: img.taken_at || img.created_at, note: img.note || null, url: data?.signedUrl || "" } as PetImage;
      }));
      setPetImages(originals.filter(img => Boolean(img.url)));
    }
    const { data: folderRows } = await supabase.from("album_folders").select("id,user_id,pet_id,name,cover_storage_path,cover_bucket,sort_order,created_at").eq("user_id", current.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    const foldersWithUrls = await Promise.all((folderRows || []).map(async folder => {
      if (!folder.cover_storage_path || !folder.cover_bucket) return { ...folder, cover_url: null } as AlbumFolder;
      const { data } = await supabase.storage.from(folder.cover_bucket).createSignedUrl(folder.cover_storage_path, 3600);
      return { ...folder, cover_url: data?.signedUrl || null } as AlbumFolder;
    }));
    setAlbumFolders(foldersWithUrls);
    let generatedResult = await supabase.from("generation_images").select("id,generation_id,storage_path,is_saved,is_favorite,folder_id,taken_at,note,created_at").eq("user_id", current.id).order("created_at", { ascending: false });
    if (generatedResult.error) generatedResult = await supabase.from("generation_images").select("id,generation_id,storage_path,is_saved,is_favorite,created_at").eq("user_id", current.id).order("created_at", { ascending: false });
    const { data: imageRows } = generatedResult;
    if (!imageRows?.length) { setArtworks([]); return; }
    const { data: gens } = await supabase.from("generations").select("id,pet_id,style_id").in("id", imageRows.map(x => x.generation_id));
    const enriched = await Promise.all(imageRows.map(async (img) => {
      const gen = gens?.find(g => g.id === img.generation_id);
      const pet = withUrls.find(p => p.id === gen?.pet_id);
      const style = seedStyles.find(s => s.id === gen?.style_id);
      const { data } = await supabase.storage.from("generated-images").createSignedUrl(img.storage_path, 3600);
      return { ...img, folder_id: img.folder_id || null, taken_at: img.taken_at || img.created_at, note: img.note || null, pet_id: gen?.pet_id || "", pet_name: pet?.name || "우리 아이", style_name: style?.name || "AI 사진", url: data?.signedUrl || "/brand-reference.png" } as Artwork;
    }));
    setArtworks(enriched);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setGuest(readLocal<boolean>("mna_guest", false));
      if (!supabase) {
        const demoUser = readLocal<UserInfo | null>("mna_user", null);
        setUser(demoUser);
        if (demoUser) await loadData(demoUser);
        setReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      const current = u ? { id: u.id, email: u.email || "" } : null;
      setUser(current);
      if (current) await loadData(current);
      setReady(true);
    })();
  }, [loadData, supabase]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const protectedRoute = path.startsWith("/home") || path.startsWith("/pets") || path.startsWith("/create") || path.startsWith("/result") || path.startsWith("/goods") || path.startsWith("/album") || path.startsWith("/mypage");
  useEffect(() => { if (ready && protectedRoute && !user && !guest) router.replace("/login"); }, [guest, ready, protectedRoute, router, user]);

  if (!ready) return <Shell><Loading text="멍냥앨범을 준비하고 있어요" /></Shell>;

  const shared = { user, pets, petImages, albumFolders, artworks, setPets, setPetImages, setAlbumFolders, setArtworks, loadData, setNotice };
  let page: React.ReactNode;
  if (path === "/") page = <Splash user={user} guest={guest} />;
  else if (path === "/onboarding") page = <Onboarding onGuest={() => { saveLocal("mna_guest", true); setGuest(true); }} />;
  else if (path === "/login" || path === "/signup") page = <Auth mode={path === "/signup" ? "signup" : "login"} onGuest={() => { saveLocal("mna_guest", true); setGuest(true); }} onUser={(u) => { localStorage.removeItem("mna_guest"); setGuest(false); setUser(u); loadData(u); }} setNotice={setNotice} />;
  else if (path === "/home") page = <HomePage {...shared} />;
  else if (path === "/pets/new") page = <PetForm {...shared} />;
  else if (/^\/pets\/.+/.test(path)) page = <PetProfile petId={path.split("/").pop() || ""} {...shared} />;
  else if (path === "/create") page = <CreateStart {...shared} />;
  else if (path === "/create/upload") page = <UploadPage {...shared} />;
  else if (path === "/create/styles") page = <StylesPage {...shared} />;
  else if (path.startsWith("/create/generating/")) page = <GeneratingPage generationId={path.split("/").pop() || ""} {...shared} />;
  else if (path.startsWith("/result/")) page = <ResultPage generationId={path.split("/").pop() || ""} {...shared} />;
  else if (path === "/goods") page = <GoodsCatalog artworks={artworks} />;
  else if (path === "/goods/select") page = <GoodsPhotoPicker {...shared} />;
  else if (path.startsWith("/goods/")) page = <GoodsPage generationId={path.split("/").pop() || ""} {...shared} />;
  else if (path === "/album") page = <AlbumPage {...shared} />;
  else if (path.startsWith("/album/pet/")) page = <PetAlbumPage petId={path.split("/").pop() || ""} {...shared} />;
  else if (path === "/mypage") page = <MyPage {...shared} onLogout={() => setUser(null)} />;
  else page = <NotFound />;

  const showNav = protectedRoute && !path.includes("generating") && !path.startsWith("/result") && Boolean(user || guest);
  return <Shell nav={showNav}>{notice && <Toast notice={notice} />}{page}</Shell>;
}

function Shell({ children, nav = false }: { children: React.ReactNode; nav?: boolean }) {
  return <main className={`app-shell ${nav ? "safe-bottom" : ""}`}>{children}{nav && <BottomNavigation />}</main>;
}
function Toast({ notice }: { notice: Exclude<Notice, null> }) {
  return <div role="status" className={`fixed left-1/2 top-4 z-50 w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-bold shadow-soft ${notice.type === "error" ? "bg-[#5A362A] text-white" : "bg-sage text-white"}`}>{notice.text}</div>;
}
function Loading({ text }: { text: string }) { return <div className="grid min-h-[70dvh] place-items-center px-8 text-center"><div><Sparkles className="mx-auto mb-4 animate-pulse-soft text-coral" size={40} /><p className="font-bold">{text}</p></div></div>; }
function PageHeader({ title, back = true }: { title: string; back?: boolean }) {
  const router = useRouter();
  return <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#F5E9DD] bg-[#FFFAF4]/95 px-5 backdrop-blur">
    <button aria-label="뒤로" className={`grid h-11 w-11 place-items-center rounded-full ${back ? "" : "invisible"}`} onClick={() => router.back()}><ChevronLeft /></button><h1 className="font-bold">{title}</h1><span className="w-11" />
  </header>;
}
function Empty({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return <Card className="mx-5 my-8 px-6 py-10 text-center"><PawPrint className="mx-auto mb-4 text-[#D8B89C]" size={38} /><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#8C7A6D]">{text}</p><Link href={href} className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-coral px-6 font-bold text-white">{cta}</Link></Card>;
}

function Splash({ user, guest }: { user: UserInfo | null; guest: boolean }) {
  const router = useRouter();
  useEffect(() => { const t = setTimeout(() => router.replace(user || guest ? "/home" : readLocal("mna_seen", false) ? "/login" : "/onboarding"), 1800); return () => clearTimeout(t); }, [guest, router, user]);
  return <section className="relative grid min-h-dvh place-items-center overflow-hidden bg-cream px-6 text-center"><div className="absolute -left-16 top-20 h-44 w-44 rounded-full bg-[#FCEBDD]" /><div className="absolute -right-10 bottom-20 h-36 w-36 rounded-full bg-[#F6E7D4]" /><div className="relative animate-floaty"><BrandMark lockup /><p className="mt-3 text-[#7A6659]">우리 아이의 모든 순간을 한곳에</p></div></section>;
}

function Onboarding({ onGuest }: { onGuest: () => void }) {
  const [step, setStep] = useState(0); const router = useRouter();
  const cards = [
    ["우리 아이를 등록해보세요", "강아지 또는 고양이의 프로필을 만들어 사진을 한곳에서 관리합니다.", UserRound],
    ["AI로 특별한 순간을", "사진을 선택하고 스타일을 고르면 새로운 모습을 만들어드립니다.", Sparkles],
    ["모든 순간을 앨범에", "만든 사진을 앨범에 저장하고 언제든 다시 볼 수 있습니다.", ImagePlus]
  ] as const;
  const [title, text, Icon] = cards[step];
  function next() { if (step < 2) setStep(step + 1); else { saveLocal("mna_seen", true); onGuest(); router.push("/home"); } }
  return <section className="flex min-h-dvh flex-col bg-cream px-6 pb-8 pt-10"><div className="flex justify-center"><BrandMark lockup /></div><div className="flex flex-1 items-center"><Card className="w-full px-7 py-10 text-center"><div className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-[#FFF0E8]"><Icon size={52} className="text-coral" /></div><h1 className="mt-7 text-2xl font-extrabold">{title}</h1><p className="mt-3 leading-7 text-[#826F62]">{text}</p></Card></div><div className="mb-5 flex justify-center gap-2">{cards.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-7 bg-coral" : "w-2 bg-[#E6D7C7]"}`} />)}</div><Button onClick={next}>{step === 2 ? "멍냥앨범 구경하기" : "다음"}</Button><Link className="mt-4 text-center text-sm font-semibold text-[#786458]" href="/login">이미 계정이 있어요 · 로그인</Link></section>;
}

function Auth({ mode, onGuest, onUser, setNotice }: { mode: "login" | "signup"; onGuest: () => void; onUser: (u: UserInfo) => void; setNotice: (n: Notice) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const router = useRouter();
  const signup = mode === "signup";
  async function signInWithKakao() {
    const sb = getSupabase();
    if (!sb) return setNotice({ type: "error", text: "Supabase 연결 후 카카오 로그인을 사용할 수 있어요." });
    setBusy(true);
    const { error } = await sb.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: `${window.location.origin}/home` } });
    if (error) { setNotice({ type: "error", text: "카카오 로그인을 시작하지 못했어요. 설정을 확인해주세요." }); setBusy(false); }
  }
  function browseAsGuest() { onGuest(); router.push("/home"); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setNotice({ type: "error", text: "올바른 이메일 주소를 입력해주세요." });
    if (password.length < 6) return setNotice({ type: "error", text: "비밀번호는 6자 이상이어야 해요." });
    setBusy(true);
    const sb = getSupabase();
    if (!sb) { const u = { id: "demo-user", email }; saveLocal("mna_user", u); onUser(u); router.push("/home"); setBusy(false); return; }
    const response = signup ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
    if (response.error) { setNotice({ type: "error", text: signup ? "회원가입에 실패했어요. 이메일을 확인해주세요." : "이메일 또는 비밀번호를 확인해주세요." }); setBusy(false); return; }
    if (!response.data.user) { setBusy(false); return; }
    if (signup && !response.data.session) { setNotice({ type: "success", text: "인증 메일을 보냈어요. 인증 후 로그인해주세요." }); router.push("/login"); }
    else { onUser({ id: response.data.user.id, email: response.data.user.email || email }); router.push("/home"); }
    setBusy(false);
  }
  return <section className="min-h-dvh bg-cream px-6 pb-10 pt-12"><div className="flex justify-center"><BrandMark lockup /></div><Card className="mt-8 px-6 py-7"><h1 className="text-2xl font-extrabold">{signup ? "간편하게 시작해보세요" : "다시 만나서 반가워요"}</h1><p className="mt-2 text-sm text-[#8B7768]">우리 아이의 특별한 순간을 멍냥앨범에 담아보세요.</p><button type="button" disabled={busy} onClick={signInWithKakao} className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 font-extrabold text-[#191919] disabled:opacity-60"><span aria-hidden="true" className="text-lg">●</span> 카카오로 3초 만에 시작하기</button><div className="my-6 flex items-center gap-3 text-xs text-[#A08D80]"><span className="h-px flex-1 bg-[#EBDDD0]" /><span>또는 이메일로 계속하기</span><span className="h-px flex-1 bg-[#EBDDD0]" /></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-bold">이메일<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" className="mt-2 h-14 w-full rounded-2xl border border-[#E9DACA] bg-[#FFFCF8] px-4 outline-none focus:border-coral" placeholder="name@example.com" /></label><label className="block text-sm font-bold">비밀번호<span className="relative mt-2 block"><input value={password} onChange={e => setPassword(e.target.value)} type={show ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} className="h-14 w-full rounded-2xl border border-[#E9DACA] bg-[#FFFCF8] px-4 pr-12 outline-none focus:border-coral" placeholder="6자 이상 입력" /><button type="button" aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"} onClick={() => setShow(!show)} className="absolute right-1 top-1 grid h-11 w-11 place-items-center">{show ? <EyeOff size={20} /> : <Eye size={20} />}</button></span></label><Button disabled={busy}>{busy ? "잠시만 기다려주세요" : signup ? "이메일로 회원가입" : "이메일로 로그인"}</Button></form></Card><button onClick={browseAsGuest} className="mt-5 min-h-12 w-full text-center text-sm font-bold text-[#786458]">가입 없이 구경하기</button><p className="mt-2 text-center text-sm text-[#7D6B5F]">{signup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"} <Link className="font-bold text-coral" href={signup ? "/login" : "/signup"}>{signup ? "로그인" : "회원가입"}</Link></p>{!isSupabaseConfigured() && <p className="mt-6 rounded-2xl bg-[#FFF0E8] p-3 text-center text-xs leading-5 text-[#865C48]">현재 미리보기 모드입니다. Supabase 환경변수를 연결하면 실제 계정으로 저장됩니다.</p>}</section>;
}

type Shared = {
  user: UserInfo | null;
  pets: Pet[];
  petImages: PetImage[];
  albumFolders: AlbumFolder[];
  artworks: Artwork[];
  setPets: React.Dispatch<React.SetStateAction<Pet[]>>;
  setPetImages: React.Dispatch<React.SetStateAction<PetImage[]>>;
  setAlbumFolders: React.Dispatch<React.SetStateAction<AlbumFolder[]>>;
  setArtworks: React.Dispatch<React.SetStateAction<Artwork[]>>;
  loadData: (u: UserInfo) => Promise<void>;
  setNotice: (n: Notice) => void;
};

function HomePage({ user, pets, artworks }: Shared) {
  const hero = pets[0];
  return <><header className="flex h-20 items-center justify-between px-5"><div className="flex items-center gap-2"><BrandMark /><strong className="text-xl tracking-[-.05em]">멍냥앨범</strong></div><div className="flex gap-1"><button aria-label="알림" className="grid h-11 w-11 place-items-center rounded-full bg-white"><Bell size={21} /></button><Link href="/mypage" aria-label="마이페이지" className="grid h-11 w-11 place-items-center rounded-full bg-beige"><UserRound size={20} /></Link></div></header><div className="px-5"><Card className="relative min-h-56 overflow-hidden border-0 bg-[#F6E8D8]">{hero?.cover_url ? <Image src={hero.cover_url} alt={`${hero.name} 대표 사진`} fill className="object-cover" unoptimized /> : <Image src={demoPhotos[0]} alt="강아지와 함께한 순간" fill className="object-cover" unoptimized />}<div className="absolute inset-0 bg-gradient-to-r from-[#4A2E1C]/45 via-transparent to-transparent" /><div className="absolute left-5 top-5 max-w-44 text-white"><p className="text-sm">오늘도 함께한</p><h1 className="mt-1 text-2xl font-extrabold leading-tight">행복한 순간 <Heart className="inline fill-coral text-coral" size={20} /></h1>{hero && <p className="mt-3 text-sm font-bold">{hero.name}와 함께</p>}</div></Card><Link href="/create" className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-coral text-lg font-extrabold text-white shadow-soft"><Sparkles size={22} /> AI 스튜디오 시작하기</Link></div><SectionTitle title="오늘의 추천" action="더보기" /><div className="hide-scrollbar flex gap-3 overflow-x-auto px-5 pb-2">{seedStyles.slice(0, 3).map((s, i) => <Card key={s.id} className="min-w-36 overflow-hidden"><div className="relative h-28"><Image src={demoPhotos[i]} alt="" fill className="object-cover" unoptimized /></div><div className="p-3"><p className="font-bold">{s.name}</p><p className="mt-1 text-[11px] text-[#8B7768]">{s.description}</p></div></Card>)}</div><SectionTitle title="내 반려동물" action={pets.length ? "추가" : undefined} href="/pets/new" />{pets.length ? <div className="flex gap-3 overflow-x-auto px-5">{pets.map(p => <Link href={`/pets/${p.id}`} key={p.id}><PetMini pet={p} /></Link>)}</div> : <Empty title="아직 등록된 아이가 없어요" text="프로필을 등록하면 AI 사진을 만들 수 있어요." href="/pets/new" cta="+ 반려동물 등록하기" />}<SectionTitle title="최근 만든 사진" action={artworks.length ? "전체보기" : undefined} href="/album" />{artworks.length ? <AlbumGrid artworks={artworks.slice(0, 4)} /> : <div className="mx-5 rounded-2xl bg-[#F7EEDF] p-5 text-center text-sm text-[#8B7768]">첫 AI 사진을 만들어 앨범을 채워보세요.</div>}<p className="sr-only">로그인 사용자: {user?.email}</p></>;
}

function SectionTitle({ title, action, href = "#" }: { title: string; action?: string; href?: string }) { return <div className="flex items-center justify-between px-5 pb-3 pt-8"><h2 className="text-lg font-extrabold">{title}</h2>{action && <Link className="text-xs font-semibold text-[#927C6C]" href={href}>{action} <ChevronRight className="inline" size={14} /></Link>}</div>; }
function PetMini({ pet }: { pet: Pet }) { return <Card className="w-28 p-3 text-center"><div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full bg-beige">{pet.cover_url ? <Image src={pet.cover_url} alt="" fill className="object-cover" unoptimized /> : <PawPrint className="absolute left-5 top-5 text-[#BC9678]" />}</div><p className="mt-2 truncate font-bold">{pet.name}</p><p className="text-[11px] text-[#8B7768]">{pet.species === "dog" ? "강아지" : "고양이"}</p></Card>; }

function PetForm({ user, pets, setPets, setPetImages, setNotice }: Shared) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState<string | null>(null); const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", species: "dog" as Species, breed: "", gender: "unknown" as Gender, birth_date: "", bio: "" });
  if (!user) return <><PageHeader title="반려동물 등록" /><Empty title="로그인 후 등록할 수 있어요" text="우리 아이의 사진과 앨범을 안전���게 보관하려면 로그인이 필요해요." href="/login" cta="로그인하고 계속하기" /></>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!user || !form.name.trim()) return setNotice({ type: "error", text: "반려동물 이름을 입력해주세요." }); setBusy(true);
    const id = uid(); const imageId = uid(); let coverPath: string | null = null; const sb = getSupabase();
    try {
      if (sb) {
        if (file) { if (file.size > 10 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("invalid-file"); coverPath = `${user.id}/${id}/${uid()}.${file.name.split(".").pop() || "jpg"}`; const up = await sb.storage.from("pet-uploads").upload(coverPath, file); if (up.error) throw up.error; }
        const row = { id, user_id: user.id, ...form, breed: form.breed || null, birth_date: form.birth_date || null, bio: form.bio || null, cover_image_path: coverPath };
        const ins = await sb.from("pets").insert(row); if (ins.error) throw ins.error;
        if (coverPath) { const insImg = await sb.from("pet_images").insert({ id: imageId, pet_id: id, user_id: user.id, storage_path: coverPath, is_primary: true }); if (insImg.error) throw insImg.error; }
      }
      const pet: Pet = { id, user_id: user.id, ...form, breed: form.breed || null, birth_date: form.birth_date || null, bio: form.bio || null, cover_image_path: coverPath, cover_url: preview, created_at: new Date().toISOString() };
      const next = [pet, ...pets]; setPets(next); if (!sb) saveLocal("mna_pets", next); if (coverPath && preview) setPetImages(prev => [{ id: imageId, pet_id: id, user_id: user.id, storage_path: coverPath, is_primary: true, folder_id: null, taken_at: new Date().toISOString(), created_at: new Date().toISOString(), url: preview }, ...prev]); setNotice({ type: "success", text: `${pet.name}의 프로필을 등록했어요.` }); router.push("/home");
    } catch { setNotice({ type: "error", text: "등록하지 못했어요. 이미지와 입력 내용을 확인해주세요." }); } finally { setBusy(false); }
  }
  return <><PageHeader title="반려동물 등록" /><form onSubmit={submit} className="space-y-5 px-5 py-6"><label className="mx-auto grid h-32 w-32 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-[#E5C6AF] bg-[#FFF0E8]">{preview ? <Image src={preview} alt="대표 사진 미리보기" width={128} height={128} className="h-full w-full object-cover" unoptimized /> : <span className="text-center text-xs font-bold text-[#9B6F56]"><Camera className="mx-auto mb-2" />대표 사진</span>}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} /></label><Field label="반려동물 이름 *"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 모찌" /></Field><Field label="동물 종류 *"><div className="grid grid-cols-2 gap-3"><Choice active={form.species === "dog"} onClick={() => setForm({ ...form, species: "dog" })}>🐶 강아지</Choice><Choice active={form.species === "cat"} onClick={() => setForm({ ...form, species: "cat" })}>🐱 고양이</Choice></div></Field><Field label="품종"><input value={form.breed} onChange={e => setForm({ ...form, breed: e.target.value })} placeholder="예: 말티즈" /></Field><Field label="성별"><div className="grid grid-cols-3 gap-2"><Choice active={form.gender === "male"} onClick={() => setForm({ ...form, gender: "male" })}>남아</Choice><Choice active={form.gender === "female"} onClick={() => setForm({ ...form, gender: "female" })}>여아</Choice><Choice active={form.gender === "unknown"} onClick={() => setForm({ ...form, gender: "unknown" })}>선택 안 함</Choice></div></Field><Field label="생일"><input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></Field><Field label="한 줄 소개"><textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="우리 아이를 소개해주세요" /></Field><Button disabled={busy}>{busy ? "등록하고 있어요" : "우리 아이 등록하기"}</Button></form></>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold [&_input]:mt-2 [&_input]:h-14 [&_input]:w-full [&_input]:rounded-2xl [&_input]:border [&_input]:border-[#E8D8C8] [&_input]:bg-white [&_input]:px-4 [&_input]:outline-none [&_textarea]:mt-2 [&_textarea]:w-full [&_textarea]:rounded-2xl [&_textarea]:border [&_textarea]:border-[#E8D8C8] [&_textarea]:bg-white [&_textarea]:p-4 [&_textarea]:outline-none">{label}{children}</label>; }
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`min-h-12 rounded-2xl border px-2 text-sm font-bold ${active ? "border-coral bg-[#FFF0E8] text-coral" : "border-[#E8D8C8] bg-white"}`}>{children}</button>; }

function PetProfile({ petId, pets, setPets, setNotice }: Shared & { petId: string }) {
  const pet = pets.find(p => p.id === petId); const [editing, setEditing] = useState(false); const [bio, setBio] = useState(pet?.bio || "");
  if (!pet) return <><PageHeader title="반려동물" /><Empty title="반려동물을 찾지 못했어요" text="삭제되었거나 접근할 수 없는 프로필입니다." href="/home" cta="홈으로" /></>;
  const currentPet = pet;
  async function save() { const sb = getSupabase(); if (sb) { const { error } = await sb.from("pets").update({ bio, updated_at: new Date().toISOString() }).eq("id", currentPet.id); if (error) return setNotice({ type: "error", text: "수정 내용을 저장하지 못했어요." }); } const next = pets.map(p => p.id === currentPet.id ? { ...p, bio } : p); setPets(next); if (!sb) saveLocal("mna_pets", next); setEditing(false); setNotice({ type: "success", text: "프로필을 수정했어요." }); }
  return <><PageHeader title="반려동물 프로필" /><section className="px-5 py-7 text-center"><div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-beige shadow-soft">{pet.cover_url ? <Image src={pet.cover_url} alt={pet.name} fill className="object-cover" unoptimized /> : <PawPrint className="absolute left-11 top-11 text-[#B88B69]" />}</div><h1 className="mt-4 text-2xl font-extrabold">{pet.name}</h1><p className="mt-1 text-sm text-[#8A7769]">{pet.breed || (pet.species === "dog" ? "강아지" : "고양이")} · {ageOf(pet.birth_date)}</p>{editing ? <><textarea className="mt-4 w-full rounded-2xl border border-[#E4D4C5] p-4" value={bio} onChange={e => setBio(e.target.value)} /><Button className="mt-3" onClick={save}>저장하기</Button></> : <><p className="mt-4 rounded-2xl bg-white p-4 text-sm">{pet.bio || "사랑스러운 우리 아이"}</p><button onClick={() => setEditing(true)} className="mt-3 text-sm font-bold text-coral">프로필 수정</button></>}<div className="mt-8 grid grid-cols-2 gap-3"><Link className="rounded-2xl bg-coral p-4 font-bold text-white" href="/create">AI 작품 만들기</Link><Link className="rounded-2xl bg-white p-4 font-bold" href="/album">AI 작품 보기</Link></div></section></>;
}

function CreateStart({ pets, setNotice }: Shared) {
  const router = useRouter(); const [selected, setSelected] = useState(readLocal<string>("mna_selected_pet", pets[0]?.id || ""));
  function next() { if (!selected) return setNotice({ type: "error", text: "먼저 반려동물을 선택해주세요." }); saveLocal("mna_selected_pet", selected); router.push("/create/upload"); }
  return <><PageHeader title="AI 스튜디오" />{pets.length ? <section className="px-5 py-6"><p className="text-sm text-[#8A7769]">사진의 주인공을 선택해주세요.</p><div className="mt-5 grid grid-cols-2 gap-3">{pets.map(p => <button key={p.id} onClick={() => setSelected(p.id)} className={`relative rounded-3xl border-2 bg-white p-4 text-center ${selected === p.id ? "border-coral" : "border-transparent"}`}><PetMini pet={p} />{selected === p.id && <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-coral text-white"><Check size={16} /></span>}</button>)}</div><Button className="mt-7" onClick={next}>다음 · 사진 선택</Button></section> : <Empty title="먼저 우리 아이를 등록해주세요" text="반려동물 프로필이 있어야 AI 사진을 만들 수 있어요." href="/pets/new" cta="반려동물 등록하기" />}</>;
}

function UploadPage({ user, pets, petImages, setPetImages, setNotice }: Shared) {
  const petId = readLocal<string>("mna_selected_pet", "");
  const pet = pets.find(p => p.id === petId);
  const albumImages = petImages.filter(img => img.pet_id === petId);
  const [source, setSource] = useState<"album" | "device">(albumImages.length ? "album" : "device");
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const selectedCount = files.length + selectedAlbum.length;

  function add(list: FileList | null) {
    if (!list) return;
    const valid = Array.from(list).filter(f => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length !== list.length) setNotice({ type: "error", text: "10MB 이하의 JPG, PNG, WEBP만 올릴 수 있어요." });
    setFiles(prev => [...prev, ...valid.map(file => ({ file, url: URL.createObjectURL(file) }))].slice(0, Math.max(0, 12 - selectedAlbum.length)));
  }

  function toggleAlbum(id: string) {
    setSelectedAlbum(prev => prev.includes(id) ? prev.filter(item => item !== id) : prev.length + files.length < 12 ? [...prev, id] : prev);
  }

  async function next() {
    if (!user) return router.push("/login");
    if (!pet || selectedCount < 1) return setNotice({ type: "error", text: "사진을 1장 이상 선택해주세요." });
    setBusy(true);
    const sb = getSupabase();
    const refs = albumImages.filter(img => selectedAlbum.includes(img.id)).map(img => ({ path: img.storage_path, url: img.url }));
    const uploaded: PetImage[] = [];
    try {
      for (const item of files) {
        if (!sb) throw new Error("storage-not-ready");
        const id = uid();
        const extension = item.file.type === "image/png" ? "png" : item.file.type === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/${pet.id}/${id}.${extension}`;
        const { error: uploadError } = await sb.storage.from("pet-uploads").upload(path, item.file, { contentType: item.file.type, cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { error: rowError } = await sb.from("pet_images").insert({ id, pet_id: pet.id, user_id: user.id, storage_path: path, is_primary: false });
        if (rowError) throw rowError;
        const { data, error: signedError } = await sb.storage.from("pet-uploads").createSignedUrl(path, 3600);
        if (signedError || !data?.signedUrl) throw signedError || new Error("signed-url-failed");
        const saved: PetImage = { id, pet_id: pet.id, user_id: user.id, storage_path: path, is_primary: false, folder_id: null, taken_at: new Date(item.file.lastModified).toISOString(), note: null, created_at: new Date().toISOString(), url: data.signedUrl };
        uploaded.push(saved);
        refs.push({ path, url: data.signedUrl });
      }
      setPetImages(prev => [...uploaded, ...prev]);
      saveLocal("mna_references", refs);
      setNotice({ type: "success", text: files.length ? `${files.length}장의 사진을 앨범에 저장했어요.` : "앨범에서 사진을 선택했어요." });
      router.push("/create/styles");
    } catch {
      setNotice({ type: "error", text: "사진을 저장하지 못했어요. 로그인과 저장 공간 설정을 확인해주세요." });
    } finally { setBusy(false); }
  }

  if (!user) return <><PageHeader title="사진 선택" /><Empty title="로그인 후 사진을 저장할 수 있어요" text="사진을 안전하게 보관하고 다시 사용하려면 로그인이 필요해요." href="/login" cta="로그인하고 계속하기" /></>;

  return <><PageHeader title="사진 선택" /><section className="px-5 py-6"><h1 className="text-xl font-extrabold">{pet?.name || "우리 아이"}의 사진을 골라주세요</h1><p className="mt-2 text-sm text-[#8A7769]">앨범 사진과 새 사진을 함께 선택할 수 있어요 · 최대 12장</p><div className="mt-5 grid grid-cols-2 rounded-2xl bg-[#F1E7DC] p-1"><button onClick={() => setSource("album")} className={`min-h-11 rounded-xl text-sm font-bold ${source === "album" ? "bg-white text-coral shadow-sm" : "text-[#826F62]"}`}>멍냥앨범</button><button onClick={() => setSource("device")} className={`min-h-11 rounded-xl text-sm font-bold ${source === "device" ? "bg-white text-coral shadow-sm" : "text-[#826F62]"}`}>기기에서 가져오기</button></div>{source === "album" ? albumImages.length ? <div className="mt-5 grid grid-cols-3 gap-2">{albumImages.map(img => { const active = selectedAlbum.includes(img.id); return <button key={img.id} onClick={() => toggleAlbum(img.id)} className={`relative aspect-square overflow-hidden rounded-2xl border-2 ${active ? "border-coral" : "border-transparent"}`}><Image src={img.url} alt="앨범 사진" fill className="object-cover" unoptimized />{active && <span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-coral text-white"><Check size={16} /></span>}</button>; })}</div> : <Card className="mt-5 px-5 py-8 text-center"><ImageIcon className="mx-auto text-[#C6A98F]" /><p className="mt-3 font-bold">저장된 원본 사진이 없어요</p><button onClick={() => setSource("device")} className="mt-3 text-sm font-bold text-coral">기기에서 첫 사진 가져오기</button></Card> : <><label className="mt-5 grid min-h-36 cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-[#E4BFA6] bg-[#FFF1E8] text-center"><span><Upload className="mx-auto mb-2 text-coral" /><b>기기에서 사진 선택</b><small className="mt-1 block text-[#8A7769]">선택한 사진은 멍냥앨범에 안전하게 저장돼요</small></span><input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => add(e.target.files)} /></label>{files.length > 0 && <div className="mt-5 grid grid-cols-3 gap-2">{files.map((f, i) => <div key={f.url} className="relative aspect-square overflow-hidden rounded-2xl"><Image src={f.url} alt={`새 사진 ${i + 1}`} fill className="object-cover" unoptimized /><button aria-label="사진 삭제" onClick={() => setFiles(files.filter((_, n) => n !== i))} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-xs text-white">×</button></div>)}</div>}</>}<Card className="mt-6 p-4"><p className="font-bold">좋은 결과를 위한 사진 가이드</p><ul className="mt-3 space-y-2 text-sm text-[#7F6A5E]"><li>✓ 얼굴이 잘 보이는 사진을 골라주세요</li><li>✓ 밝고 선명한 사진이 좋아요</li><li>✓ 다양한 각도를 함께 선택하면 더 좋아요</li></ul></Card><Button className="mt-6" disabled={busy || selectedCount < 1} onClick={next}>{busy ? "앨범에 저장하는 중" : `${selectedCount}장으로 계속하기`}</Button></section></>;
}

function StylesPage({ user, pets, setNotice }: Shared) {
  const [selected, setSelected] = useState<Style | null>(null); const router = useRouter(); const pet = pets.find(p => p.id === readLocal("mna_selected_pet", ""));
  async function generate() {
    if (!user || !pet || !selected) return setNotice({ type: "error", text: "스타일을 하나 선택해주세요." }); const refs = readLocal<{ path: string; url: string }[]>("mna_references", []); if (!refs.length) return router.push("/create/upload"); const id = uid(); const sb = getSupabase();
    if (sb) { const { error } = await sb.from("generations").insert({ id, user_id: user.id, pet_id: pet.id, style_id: selected.id, status: "processing" }); if (error) return setNotice({ type: "error", text: "생성 요청을 시작하지 못했어요." }); }
    saveLocal(`mna_pending_${id}`, { pet, style: selected, refs }); router.push(`/create/generating/${id}`);
  }
  return <><PageHeader title="스타일 선택" /><section className="px-5 py-6"><h1 className="text-xl font-extrabold">어떤 모습으로 변신할까요?</h1><p className="mt-2 text-sm text-[#8A7769]">{pet?.name || "우리 아이"}와 잘 어울리는 스타일을 골라보세요.</p><div className="mt-5 grid grid-cols-2 gap-3">{seedStyles.map((s, i) => <button key={s.id} onClick={() => setSelected(s)} className={`overflow-hidden rounded-3xl border-2 bg-white text-left transition ${selected?.id === s.id ? "border-coral" : "border-white"}`}><div className="relative aspect-[4/3]"><Image src={demoPhotos[i % 3]} alt="" fill className="object-cover" unoptimized /><div className={`absolute inset-0 grid place-items-center bg-coral/20 ${selected?.id === s.id ? "opacity-100" : "opacity-0"}`}><span className="grid h-9 w-9 place-items-center rounded-full bg-coral text-white"><Check /></span></div></div><div className="p-3"><p className="font-bold">{s.name}</p><p className="mt-1 text-xs leading-5 text-[#8A7769]">{s.description}</p></div></button>)}</div><Button className="mt-6" disabled={!selected} onClick={generate}>이 스타일로 만들기</Button></section></>;
}

function GeneratingPage({ generationId, user, pets, artworks, setArtworks, setNotice }: Shared & { generationId: string }) {
  const router = useRouter(); const [stage, setStage] = useState(0); const ran = useRef(false);
  useEffect(() => {
    if (ran.current || !user) return; ran.current = true; const pending = readLocal<{ pet: Pet; style: Style; refs: { path: string; url: string }[] } | null>(`mna_pending_${generationId}`, null); if (!pending) { router.replace("/create"); return; }
    const timers = [setTimeout(() => setStage(1), 900), setTimeout(() => setStage(2), 1800)];
    (async () => { try { const provider = new MockAIProvider(); const output = await provider.generate({ pet: pending.pet, style: pending.style, referenceImages: pending.refs.map(r => r.url) }); const sb = getSupabase(); let storagePath = output.sourceUrl; let url = output.sourceUrl; const imageId = uid();
      if (sb) { const blob = await (await fetch(output.sourceUrl)).blob(); storagePath = `${user.id}/${generationId}/${imageId}.${blob.type.includes("png") ? "png" : "jpg"}`; const up = await sb.storage.from("generated-images").upload(storagePath, blob, { contentType: blob.type }); if (up.error) throw up.error; const row = await sb.from("generation_images").insert({ id: imageId, generation_id: generationId, user_id: user.id, storage_path: storagePath, is_saved: false, is_favorite: false }); if (row.error) throw row.error; await sb.from("generations").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", generationId); const signed = await sb.storage.from("generated-images").createSignedUrl(storagePath, 3600); url = signed.data?.signedUrl || url; }
      const art: Artwork = { id: imageId, generation_id: generationId, pet_id: pending.pet.id, pet_name: pending.pet.name, style_name: pending.style.name, storage_path: storagePath, url, is_saved: false, is_favorite: false, folder_id: null, taken_at: new Date().toISOString(), note: null, created_at: new Date().toISOString() }; const next = [art, ...artworks]; setArtworks(next); saveLocal("mna_artworks", next); saveLocal(`mna_result_${generationId}`, art); router.replace(`/result/${generationId}`);
    } catch { const sb = getSupabase(); if (sb) await sb.from("generations").update({ status: "failed" }).eq("id", generationId); setNotice({ type: "error", text: "사진을 만들지 못했어요. 다시 시도해주세요." }); router.replace("/create/styles"); } })();
    return () => timers.forEach(clearTimeout);
  }, [artworks, generationId, pets, router, setArtworks, setNotice, user]);
  const labels = ["사진 확인 중", "스타일 적용 중", "마무리 중"];
  return <section className="flex min-h-dvh flex-col items-center justify-center bg-cream px-8 text-center"><div className="relative grid h-40 w-40 place-items-center rounded-full bg-[#FFF0E8]"><BrandMark /><Sparkles className="absolute right-6 top-7 animate-pulse-soft text-coral" /></div><h1 className="mt-8 text-2xl font-extrabold">우리 아이의 특별한 사진을<br />만들고 있어요</h1><div className="mt-8 w-full max-w-xs space-y-3">{labels.map((label, i) => <div key={label} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${i <= stage ? "bg-white text-cocoa" : "text-[#B6A69A]"}`}><span className={`grid h-6 w-6 place-items-center rounded-full ${i < stage ? "bg-sage text-white" : i === stage ? "animate-pulse-soft bg-coral text-white" : "bg-[#E8DED5]"}`}>{i < stage ? <Check size={14} /> : i + 1}</span>{label}</div>)}</div><p className="mt-7 text-xs leading-5 text-[#988579]">화면의 단계는 진행을 안내하기 위한 표시이며<br />실제 처리 시간과 다를 수 있어요.</p></section>;
}

function ResultPage({ generationId, artworks, setArtworks, setNotice }: Shared & { generationId: string }) {
  const art = artworks.find(a => a.generation_id === generationId) || readLocal<Artwork | null>(`mna_result_${generationId}`, null); const router = useRouter(); if (!art) return <Loading text="결과를 불러오고 있어요" />;
  const currentArt = art;
  async function save() { const sb = getSupabase(); if (sb) { const { error } = await sb.from("generation_images").update({ is_saved: true }).eq("id", currentArt.id); if (error) return setNotice({ type: "error", text: "앨범에 저장하지 못했어요." }); } const next = artworks.map(a => a.id === currentArt.id ? { ...a, is_saved: true } : a); if (!next.some(a => a.id === currentArt.id)) next.unshift({ ...currentArt, is_saved: true }); setArtworks(next); saveLocal("mna_artworks", next); setNotice({ type: "success", text: "앨범에 소중히 저장했어요." }); }
  async function share() { try { if (navigator.share) await navigator.share({ title: `${currentArt.pet_name}의 ${currentArt.style_name}`, text: "멍냥앨범에서 만든 우리 아이의 AI 사진", url: location.href }); else { await navigator.clipboard.writeText(location.href); setNotice({ type: "success", text: "결과 링크를 복사했어요." }); } } catch { /* user cancelled */ } }
  return <><PageHeader title="AI 사진 결과" /><section className="px-5 py-5"><Card className="overflow-hidden p-3"><div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-beige"><Image src={art.url} alt={`${art.pet_name}의 AI 결과`} fill className="object-cover" unoptimized /></div><div className="px-2 pb-2 pt-4"><h1 className="text-xl font-extrabold">{art.style_name}의 {art.pet_name}</h1><div className="mt-3 flex gap-2 text-xs"><span className="rounded-full bg-[#F7EDE3] px-3 py-1">#멍냥앨범</span><span className="rounded-full bg-[#F7EDE3] px-3 py-1">#AI사진</span></div></div></Card><div className="mt-4 grid grid-cols-3 gap-2"><button onClick={save} className="min-h-14 rounded-2xl bg-white text-sm font-bold"><ImagePlus className="mx-auto mb-1" size={19} />{art.is_saved ? "저장됨" : "앨범 저장"}</button><button onClick={share} className="min-h-14 rounded-2xl bg-white text-sm font-bold"><Share2 className="mx-auto mb-1" size={19} />공유</button><button onClick={() => router.push("/create/styles")} className="min-h-14 rounded-2xl bg-coral text-sm font-bold text-white"><Sparkles className="mx-auto mb-1" size={19} />다시 만들기</button></div><Link href={`/goods/${generationId}`} className="mt-6 flex items-center justify-between rounded-3xl border border-[#F2E2D4] bg-white p-5 shadow-soft"><div><p className="font-bold">이 사진으로 굿즈를 만들어보세요</p><p className="mt-1 text-xs text-[#8A7769]">액자 · 포토카드 · 포스터 · 스티커</p></div><span className="grid h-10 w-10 place-items-center rounded-full bg-coral text-white"><ChevronRight /></span></Link></section></>;
}

function GoodsCatalog({ artworks }: { artworks: Artwork[] }) {
  const latest = artworks[0];
  const products = [
    { id: "frame", name: "원목 액자", caption: "가장 소중한 순간을 집 안에", price: "29,900원부터", icon: Frame, tone: "bg-[#F5E2D0] text-[#A2643E]", badge: "인기" },
    { id: "tumbler", name: "포토 텀블러", caption: "매일 함께하는 우리 아이", price: "24,900원부터", icon: Coffee, tone: "bg-[#E6F0E6] text-[#688B6E]" },
    { id: "fourcut", name: "인생네컷", caption: "네 장으로 남기는 귀여운 표정", price: "5,900원부터", icon: Grid2X2, tone: "bg-[#FFE5E0] text-[#D96354]", badge: "NEW" },
    { id: "mug", name: "포토 머그컵", caption: "보기만 해도 기분 좋은 한 잔", price: "18,900원부터", icon: Coffee, tone: "bg-[#F5EAD2] text-[#A47732]" },
    { id: "poster", name: "아트 포스터", caption: "작품처럼 크게 간직하기", price: "14,900원부터", icon: ImageIcon, tone: "bg-[#E8E4F3] text-[#74649A]" },
    { id: "card", name: "포토카드 세트", caption: "언제나 지니고 다니는 마음", price: "9,900원부터", icon: CreditCard, tone: "bg-[#E2EEF3] text-[#527D8C]" },
    { id: "sticker", name: "리무버블 스티커", caption: "좋아하는 곳 어디에나 톡", price: "7,900원부터", icon: Palette, tone: "bg-[#FCE6EE] text-[#B65D7A]" },
    { id: "gift", name: "선물 패키지", caption: "특별한 날 마음까지 포장해요", price: "34,900원부터", icon: Package, tone: "bg-[#EDE4D9] text-[#876A50]" }
  ];

  return <>
    <header className="px-5 pb-5 pt-8">
      <p className="text-sm font-bold text-coral">우리 아이를 더 가까이</p>
      <h1 className="mt-1 text-2xl font-extrabold">멍냥 굿즈</h1>
    </header>
    <section className="px-5">
      <Link href="/goods/select" onClick={() => saveLocal("mna_goods_product", "frame")} className="relative block overflow-hidden rounded-[28px] bg-[#5A3826] p-5 text-white shadow-soft">
        <div className="relative z-10 max-w-[60%]">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">이번 주 추천</span>
          <h2 className="mt-4 text-xl font-extrabold leading-snug">사진 한 장으로<br />특별한 선물을</h2>
          <p className="mt-2 text-xs leading-5 text-white/75">제작 전 미리보기로<br />완성 모습을 확인하세요.</p>
        </div>
        <div className="absolute -bottom-8 -right-7 h-40 w-40 rotate-6 rounded-[32px] bg-[#F7E5D3] p-3 shadow-2xl">
          <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-white">
            <Image src={latest?.url || demoPhotos[1]} alt="반려동물 굿즈 미리보기" fill className="object-cover" unoptimized />
          </div>
        </div>
      </Link>

      <div className="mb-4 mt-7 flex items-end justify-between">
        <div><h2 className="text-xl font-extrabold">굿즈를 골라보세요</h2><p className="mt-1 text-sm text-[#8A7769]">내 사진으로 직접 만들어볼 수 있어요.</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map(({ id, name, caption, price, icon: Icon, tone, badge }) => <Link key={id} href="/goods/select" onClick={() => saveLocal("mna_goods_product", id)} className="group overflow-hidden rounded-3xl border border-[#F0E3D7] bg-white p-3 shadow-[0_5px_18px_rgba(91,57,35,.055)] transition-transform active:scale-[.98]">
          <div className={`relative grid aspect-square place-items-center overflow-hidden rounded-[20px] ${tone}`}>
            {badge && <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-1 text-[10px] font-extrabold text-coral">{badge}</span>}
            <Icon size={54} strokeWidth={1.45} />
            <PawPrint className="absolute -bottom-2 -right-1 opacity-10" size={58} />
          </div>
          <div className="px-1 pb-1 pt-3">
            <h3 className="font-extrabold">{name}</h3>
            <p className="mt-1 min-h-8 text-xs leading-4 text-[#8A7769]">{caption}</p>
            <p className="mt-2 text-sm font-extrabold text-coral">{price}</p>
          </div>
        </Link>)}
      </div>
      {!latest && <Card className="mt-6 p-5 text-center"><ImageIcon className="mx-auto text-coral" /><p className="mt-3 font-bold">앨범 사진으로 바로 만들 수 있어요</p><p className="mt-1 text-xs text-[#8A7769]">상품을 선택한 뒤 앨범이나 기기에서 사진을 골라주세요.</p></Card>}
    </section>
  </>;
}

function GoodsPhotoPicker({ user, pets, petImages, setPetImages, artworks, setNotice }: Shared) {
  const router = useRouter();
  const [source, setSource] = useState<"album" | "device">("album");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const originals = petImages.map(img => ({ id: img.id, url: img.url, path: img.storage_path, label: pets.find(p => p.id === img.pet_id)?.name || "원본 사진" }));
  const generated = artworks.filter(img => img.is_saved).map(img => ({ id: img.id, url: img.url, path: img.storage_path, label: `${img.pet_name} · AI 작품` }));
  const albumAssets = [...originals, ...generated];

  function choose(asset: { id: string; url: string; path: string; label: string }) {
    saveLocal("mna_goods_photo", asset);
    router.push("/goods/custom");
  }

  function chooseFile(next: File | undefined) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size > 10 * 1024 * 1024) return setNotice({ type: "error", text: "10MB 이하의 JPG, PNG, WEBP 사진을 선택해주세요." });
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function uploadForGoods() {
    const pet = pets.find(p => p.id === readLocal<string>("mna_selected_pet", "")) || pets[0];
    if (!user) return router.push("/login");
    if (!pet) return router.push("/pets/new");
    if (!file) return;
    const sb = getSupabase();
    if (!sb) return setNotice({ type: "error", text: "저장 공간에 연결하지 못했어요." });
    setBusy(true);
    try {
      const id = uid();
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${pet.id}/${id}.${extension}`;
      const uploaded = await sb.storage.from("pet-uploads").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (uploaded.error) throw uploaded.error;
      const row = await sb.from("pet_images").insert({ id, pet_id: pet.id, user_id: user.id, storage_path: path, is_primary: false });
      if (row.error) throw row.error;
      const signed = await sb.storage.from("pet-uploads").createSignedUrl(path, 3600);
      if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("signed-url-failed");
      const saved: PetImage = { id, pet_id: pet.id, user_id: user.id, storage_path: path, is_primary: false, folder_id: null, taken_at: new Date(file.lastModified).toISOString(), note: null, created_at: new Date().toISOString(), url: signed.data.signedUrl };
      setPetImages(prev => [saved, ...prev]);
      saveLocal("mna_goods_photo", { id, url: saved.url, path, label: pet.name });
      setNotice({ type: "success", text: "사진을 앨범에 저장했어요." });
      router.push("/goods/custom");
    } catch { setNotice({ type: "error", text: "사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }); }
    finally { setBusy(false); }
  }

  if (!user) return <><PageHeader title="굿즈 사진 선택" /><Empty title="로그인 후 사진을 선택할 수 있어요" text="앨범 사진을 안전하게 불러오려면 로그인이 필요해요." href="/login" cta="로그인하고 계속하기" /></>;

  return <><PageHeader title="굿즈 사진 선택" /><section className="px-5 py-6"><h1 className="text-xl font-extrabold">어떤 사진으로 만들까요?</h1><p className="mt-2 text-sm text-[#8A7769]">멍냥앨범에 저장된 사진을 다시 사용하거나 새 사진을 가져오세요.</p><div className="mt-5 grid grid-cols-2 rounded-2xl bg-[#F1E7DC] p-1"><button onClick={() => setSource("album")} className={`min-h-11 rounded-xl text-sm font-bold ${source === "album" ? "bg-white text-coral shadow-sm" : "text-[#826F62]"}`}>멍냥앨범</button><button onClick={() => setSource("device")} className={`min-h-11 rounded-xl text-sm font-bold ${source === "device" ? "bg-white text-coral shadow-sm" : "text-[#826F62]"}`}>기기에서 가져오기</button></div>{source === "album" ? albumAssets.length ? <div className="mt-5 grid grid-cols-3 gap-2">{albumAssets.map(asset => <button key={`${asset.id}-${asset.path}`} onClick={() => choose(asset)} className="relative aspect-square overflow-hidden rounded-2xl bg-beige"><Image src={asset.url} alt={asset.label} fill className="object-cover" unoptimized /><span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-2 py-1 text-left text-[10px] text-white">{asset.label}</span></button>)}</div> : <Card className="mt-5 px-5 py-8 text-center"><ImageIcon className="mx-auto text-[#C6A98F]" /><p className="mt-3 font-bold">앨범에 저장된 사진이 없어요</p><button onClick={() => setSource("device")} className="mt-3 text-sm font-bold text-coral">기기에서 사진 가져오기</button></Card> : <><label className="mt-5 grid min-h-44 cursor-pointer place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-[#E4BFA6] bg-[#FFF1E8] text-center">{preview ? <span className="relative block h-44 w-full"><Image src={preview} alt="굿즈 사진 미리보기" fill className="object-cover" unoptimized /></span> : <span><Upload className="mx-auto mb-2 text-coral" /><b>굿즈에 넣을 사진 선택</b><small className="mt-1 block text-[#8A7769]">선택한 사진은 멍냥앨범에도 저장돼요</small></span>}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => chooseFile(e.target.files?.[0])} /></label><Button className="mt-5" disabled={!file || busy} onClick={uploadForGoods}>{busy ? "앨범에 저장하는 중" : "이 사진으로 굿즈 만들기"}</Button></>}</section></>;
}

function GoodsPage({ generationId, artworks }: Shared & { generationId: string }) {
  const art = artworks.find(a => a.generation_id === generationId) || readLocal<Artwork | null>(`mna_result_${generationId}`, null); const custom = readLocal<{ url: string } | null>("mna_goods_photo", null); const [selected, setSelected] = useState(readLocal<string>("mna_goods_product", "frame")); const displayUrl = art?.url || custom?.url;
  const products = [{ id: "frame", name: "원목 액자", price: "29,900원", icon: "🖼️" }, { id: "poster", name: "아트 포스터", price: "14,900원", icon: "🎨" }, { id: "card", name: "포토카드 8장", price: "9,900원", icon: "💌" }, { id: "sticker", name: "스티커 세트", price: "7,900원", icon: "✨" }];
  return <><PageHeader title="우리 아이 굿즈" /><section className="px-5 py-6"><div className="rounded-3xl bg-[#F3E6D7] p-6"><div className="relative mx-auto aspect-square w-3/4 rounded-lg border-[12px] border-[#B8875D] bg-white p-2 shadow-soft"><div className="relative h-full w-full overflow-hidden">{displayUrl && <Image src={displayUrl} alt="굿즈 미리보기" fill className="object-cover" unoptimized />}</div></div><div className="mt-4 flex items-center justify-center gap-3"><p className="text-sm font-bold">실제 제작 전 미리보기</p><Link href="/goods/select" className="text-xs font-bold text-coral">사진 변경</Link></div></div><h1 className="mt-7 text-xl font-extrabold">어떤 모습으로 간직할까요?</h1><div className="mt-4 grid grid-cols-2 gap-3">{products.map(p => <button key={p.id} onClick={() => { setSelected(p.id); saveLocal("mna_goods_product", p.id); }} className={`rounded-3xl border-2 bg-white p-4 text-left ${selected === p.id ? "border-coral" : "border-transparent"}`}><span className="text-3xl">{p.icon}</span><p className="mt-3 font-bold">{p.name}</p><p className="mt-1 text-sm text-coral">{p.price}</p></button>)}</div><Card className="mt-6 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#E6F0E6] text-sage">✓</span><div><p className="font-bold">제작부터 배송까지 한 번에</p><p className="mt-1 text-xs text-[#8A7769]">사진 확인 후 안전하게 포장해 보내드려요.</p></div></div></Card><Button className="mt-6" disabled>주문 기능 준비 중</Button><p className="mt-3 text-center text-xs text-[#9B887A]">MVP에서는 상품 미리보기까지만 제공됩니다.</p></section></>;
}

function AlbumPage({ pets, petImages, artworks }: Shared) {
  return <>
    <header className="flex h-24 items-center justify-between px-5">
      <div><p className="text-sm font-bold text-coral">우리 아이별로 차곡차곡</p><h1 className="mt-1 text-2xl font-extrabold">멍냥앨범</h1></div>
      <Link href="/pets/new" aria-label="반려동물 추가" className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm"><PawPrint size={21} /></Link>
    </header>
    {pets.length ? <section className="px-5 pb-6">
      <p className="mb-4 text-sm text-[#8A7769]">프로필을 선택하면 그 아이의 사진과 폴더를 볼 수 있어요.</p>
      <div className="grid grid-cols-2 gap-3">
        {pets.map((pet, index) => {
          const originals = petImages.filter(img => img.pet_id === pet.id);
          const generated = artworks.filter(img => img.pet_id === pet.id && img.is_saved);
          const photos = [...originals.map(img => img.url), ...generated.map(img => img.url)];
          const cover = photos[0] || pet.cover_url || demoPhotos[index % demoPhotos.length];
          return <Link href={`/album/pet/${pet.id}`} key={pet.id} className="overflow-hidden rounded-[26px] border border-[#F0E1D4] bg-white shadow-[0_8px_24px_rgba(88,54,34,.07)] transition-transform active:scale-[.98]">
            <div className="relative aspect-[4/3] overflow-hidden bg-beige"><Image src={cover} alt={`${pet.name} 앨범`} fill className="object-cover" unoptimized /><div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" /><div className="absolute bottom-3 left-3 grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#F7E7D8]">{pet.cover_url ? <Image src={pet.cover_url} alt="" fill className="object-cover" unoptimized /> : <PawPrint size={18} />}</div></div>
            <div className="p-4"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{pet.name}</h2><ChevronRight size={18} className="text-[#A58D7B]" /></div><p className="mt-1 text-xs text-[#8A7769]">사진 {photos.length}장 · 폴더 앨범</p></div>
          </Link>;
        })}
      </div>
    </section> : <Empty title="먼저 우리 아이를 등록해주세요" text="반려동물 프로필마다 사진이 따로 정리돼요." href="/pets/new" cta="반려동물 등록하기" />}
  </>;
}

type AlbumAsset = { id: string; url: string; folderId: string | null; date: string; note: string | null; kind: "original" | "generated"; href?: string };

function AlbumPhotoButton({ asset, petName, organizing, selected, onOpen }: { asset: AlbumAsset; petName: string; organizing: boolean; selected: string[]; onOpen: () => void }) {
  const active = selected.includes(`${asset.kind}:${asset.id}`);
  return <button onClick={onOpen} className={`relative aspect-square overflow-hidden border-2 bg-beige ${active ? "border-coral" : "border-transparent"}`}><Image src={asset.url} alt={`${petName} 앨범 사진`} fill className="object-cover" unoptimized />{asset.kind === "generated" && <span className="absolute bottom-1 left-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">AI</span>}{organizing && <span className={`absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full ${active ? "bg-coral text-white" : "bg-white/90 text-[#9A8373]"}`}>{active ? <Check size={14} /> : <CheckSquare size={13} />}</span>}</button>;
}

function PetAlbumPage({ petId, user, pets, petImages, albumFolders, artworks, setPetImages, setAlbumFolders, setArtworks, setNotice }: Shared & { petId: string }) {
  const pet = pets.find(item => item.id === petId);
  const folders = albumFolders.filter(folder => folder.pet_id === petId);
  const [view, setView] = useState<"photos" | "folders">("photos");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [organizing, setOrganizing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [folderOpen, setFolderOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<AlbumFolder | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<AlbumAsset | null>(null);
  const [photoDate, setPhotoDate] = useState("");
  const [photoFolderId, setPhotoFolderId] = useState<string>("");
  const [photoNote, setPhotoNote] = useState("");
  const [coverFolder, setCoverFolder] = useState<AlbumFolder | null>(null);
  const [coverSource, setCoverSource] = useState<"album" | "device">("album");
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const folderHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const folderOrderRef = useRef<AlbumFolder[]>(folders);
  folderOrderRef.current = folders;

  const assets: AlbumAsset[] = [
    ...petImages.filter(img => img.pet_id === petId).map(img => ({ id: img.id, url: img.url, folderId: img.folder_id, date: img.taken_at || img.created_at, note: img.note || null, kind: "original" as const })),
    ...artworks.filter(img => img.pet_id === petId && img.is_saved).map(img => ({ id: img.id, url: img.url, folderId: img.folder_id, date: img.taken_at || img.created_at, note: img.note || null, kind: "generated" as const, href: `/result/${img.generation_id}` }))
  ];
  const filtered = assets.filter(asset => activeFolder === "all" ? true : activeFolder === "unfiled" ? !asset.folderId : asset.folderId === activeFolder).sort((a, b) => sort === "newest" ? +new Date(b.date) - +new Date(a.date) : +new Date(a.date) - +new Date(b.date));
  const grouped = filtered.reduce<Record<string, AlbumAsset[]>>((groups, asset) => { const key = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(asset.date)); (groups[key] ||= []).push(asset); return groups; }, {});

  async function uploadPhotos(list: FileList | null) {
    if (!list || !user || !pet) return;
    const valid = Array.from(list).filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024).slice(0, 30);
    if (!valid.length) return setNotice({ type: "error", text: "10MB 이하의 JPG, PNG, WEBP 사진을 선택해주세요." });
    const sb = getSupabase(); if (!sb) return setNotice({ type: "error", text: "저장 공간에 연결하지 못했어요." });
    setBusy(true); const added: PetImage[] = [];
    try {
      for (const file of valid) {
        const id = uid(); const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"; const path = `${user.id}/${pet.id}/${id}.${extension}`; const takenAt = new Date(file.lastModified).toISOString(); const folderId = activeFolder !== "all" && activeFolder !== "unfiled" ? activeFolder : null;
        const upload = await sb.storage.from("pet-uploads").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false }); if (upload.error) throw upload.error;
        let row = await sb.from("pet_images").insert({ id, pet_id: pet.id, user_id: user.id, storage_path: path, is_primary: false, folder_id: folderId, taken_at: takenAt });
        if (row.error?.code === "PGRST204") row = await sb.from("pet_images").insert({ id, pet_id: pet.id, user_id: user.id, storage_path: path, is_primary: false });
        if (row.error) throw row.error;
        const signed = await sb.storage.from("pet-uploads").createSignedUrl(path, 3600); if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("signed-url-failed");
        added.push({ id, pet_id: pet.id, user_id: user.id, storage_path: path, is_primary: false, folder_id: folderId, taken_at: takenAt, note: null, created_at: new Date().toISOString(), url: signed.data.signedUrl });
      }
      setPetImages(prev => [...added, ...prev]); setNotice({ type: "success", text: `${added.length}장의 사진을 ${pet.name} 앨범에 저장했어요.` });
    } catch { setNotice({ type: "error", text: "사진을 업로드하지 못했어요. 저장소 설정을 확인해주세요." }); }
    finally { setBusy(false); }
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault(); const name = folderName.trim(); if (!name || !user) return; const sb = getSupabase(); if (!sb) return;
    const folder: AlbumFolder = { id: uid(), user_id: user.id, pet_id: petId, name, cover_storage_path: null, cover_bucket: null, cover_url: null, sort_order: folders.length, created_at: new Date().toISOString() };
    const { error } = await sb.from("album_folders").insert(folder);
    if (error) return setNotice({ type: "error", text: "폴더를 만들지 못했어요. Supabase 앨범 설정을 확인해주세요." });
    setAlbumFolders(prev => [...prev, folder]); setFolderName(""); setFolderOpen(false); setNotice({ type: "success", text: `${name} 폴더를 만들었어요.` });
  }

  async function renameFolder(e: React.FormEvent) {
    e.preventDefault(); const name = editingFolderName.trim(); if (!editingFolder || !name || !user) return;
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from("album_folders").update({ name }).eq("id", editingFolder.id).eq("user_id", user.id);
    if (error) return setNotice({ type: "error", text: "폴더 이름을 수정하지 못했어요." });
    setAlbumFolders(prev => prev.map(folder => folder.id === editingFolder.id ? { ...folder, name } : folder));
    setEditingFolder(null); setEditingFolderName(""); setNotice({ type: "success", text: "폴더 이름을 수정했어요." });
  }

  async function savePhotoDetails(e: React.FormEvent) {
    e.preventDefault(); if (!previewAsset || !photoDate) return; const sb = getSupabase(); if (!sb) return;
    const takenAt = `${photoDate}T12:00:00.000Z`;
    const folderId = photoFolderId || null;
    const note = photoNote.trim() || null;
    const table = previewAsset.kind === "original" ? "pet_images" : "generation_images";
    const { error } = await sb.from(table).update({ taken_at: takenAt, folder_id: folderId, note }).eq("id", previewAsset.id);
    if (error) return setNotice({ type: "error", text: "사진 정보를 저장하지 못했어요." });
    if (previewAsset.kind === "original") setPetImages(prev => prev.map(img => img.id === previewAsset.id ? { ...img, taken_at: takenAt, folder_id: folderId, note } : img));
    else setArtworks(prev => prev.map(img => img.id === previewAsset.id ? { ...img, taken_at: takenAt, folder_id: folderId, note } : img));
    setPreviewAsset({ ...previewAsset, date: takenAt, folderId, note }); setNotice({ type: "success", text: "사진 정보를 저장했어요." });
  }

  async function saveFolderCover(folder: AlbumFolder, path: string, bucket: string, url: string) {
    const sb = getSupabase(); if (!sb || !user) return;
    const { error } = await sb.from("album_folders").update({ cover_storage_path: path, cover_bucket: bucket }).eq("id", folder.id).eq("user_id", user.id);
    if (error) return setNotice({ type: "error", text: "폴더 대표사진을 저장하지 못했어요." });
    setAlbumFolders(prev => prev.map(item => item.id === folder.id ? { ...item, cover_storage_path: path, cover_bucket: bucket, cover_url: url } : item));
    setCoverFolder(null); setNotice({ type: "success", text: "폴더 대표사진을 변경했어요." });
  }

  async function chooseAlbumCover(asset: AlbumAsset) {
    if (!coverFolder) return;
    const source = asset.kind === "original" ? petImages.find(img => img.id === asset.id) : artworks.find(img => img.id === asset.id);
    if (!source) return;
    await saveFolderCover(coverFolder, source.storage_path, asset.kind === "original" ? "pet-uploads" : "generated-images", asset.url);
  }

  async function uploadFolderCover(file: File | undefined) {
    if (!file || !coverFolder || !user || !pet) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) return setNotice({ type: "error", text: "10MB 이하의 JPG, PNG, WEBP 사진을 선택해주세요." });
    const sb = getSupabase(); if (!sb) return; setBusy(true);
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${pet.id}/folder-covers/${uid()}.${extension}`;
      const upload = await sb.storage.from("pet-uploads").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (upload.error) throw upload.error;
      const signed = await sb.storage.from("pet-uploads").createSignedUrl(path, 3600);
      if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("signed-url-failed");
      await saveFolderCover(coverFolder, path, "pet-uploads", signed.data.signedUrl);
    } catch { setNotice({ type: "error", text: "기기 사진을 대표사진으로 저장하지 못했어요." }); }
    finally { setBusy(false); }
  }

  function beginFolderHold(folderId: string) {
    if (folderHoldTimer.current) clearTimeout(folderHoldTimer.current);
    folderHoldTimer.current = setTimeout(() => setDraggingFolderId(folderId), 350);
  }

  function moveHeldFolder(event: React.PointerEvent, folderId: string) {
    if (!draggingFolderId || draggingFolderId !== folderId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-folder-id]");
    const targetId = target?.dataset.folderId;
    if (!targetId || targetId === draggingFolderId) return;
    const current = [...folderOrderRef.current];
    const from = current.findIndex(folder => folder.id === draggingFolderId);
    const to = current.findIndex(folder => folder.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1); current.splice(to, 0, moved);
    const reordered = current.map((folder, index) => ({ ...folder, sort_order: index }));
    folderOrderRef.current = reordered;
    setAlbumFolders(prev => [...prev.filter(folder => folder.pet_id !== petId), ...reordered]);
  }

  async function finishFolderHold() {
    if (folderHoldTimer.current) clearTimeout(folderHoldTimer.current);
    folderHoldTimer.current = null;
    if (!draggingFolderId) return;
    const sb = getSupabase(); const reordered = folderOrderRef.current; setDraggingFolderId(null);
    if (!sb) return;
    const results = await Promise.all(reordered.map((folder, index) => sb.from("album_folders").update({ sort_order: index }).eq("id", folder.id)));
    if (results.some(result => result.error)) setNotice({ type: "error", text: "폴더 순서를 저장하지 못했어요." });
    else setNotice({ type: "success", text: "폴더 순서를 변경했어요." });
  }

  function toggleAsset(asset: AlbumAsset) {
    if (!organizing) return setPreviewAsset(asset);
    const key = `${asset.kind}:${asset.id}`; setSelected(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  }

  async function moveSelected(folderId: string | null) {
    const sb = getSupabase(); if (!sb || !selected.length) return;
    const originalIds = selected.filter(key => key.startsWith("original:")).map(key => key.split(":")[1]);
    const generatedIds = selected.filter(key => key.startsWith("generated:")).map(key => key.split(":")[1]);
    const results = await Promise.all([originalIds.length ? sb.from("pet_images").update({ folder_id: folderId }).in("id", originalIds) : Promise.resolve({ error: null }), generatedIds.length ? sb.from("generation_images").update({ folder_id: folderId }).in("id", generatedIds) : Promise.resolve({ error: null })]);
    if (results.some(result => result.error)) return setNotice({ type: "error", text: "사진을 폴더로 옮기지 못했어요. 앨범 설정을 확인해주세요." });
    setPetImages(prev => prev.map(img => originalIds.includes(img.id) ? { ...img, folder_id: folderId } : img)); setArtworks(prev => prev.map(img => generatedIds.includes(img.id) ? { ...img, folder_id: folderId } : img)); setSelected([]); setOrganizing(false); setMoveOpen(false); setNotice({ type: "success", text: "선택한 사진을 정리했어요." });
  }

  if (!pet) return <><PageHeader title="앨범" /><Empty title="프로필을 찾지 못했어요" text="삭제되었거나 접근할 수 없는 앨범입니다." href="/album" cta="앨범으로 돌아가기" /></>;

  return <>
    <PageHeader title={`${pet.name}의 앨범`} />
    <section className="px-5 pb-5 pt-5">
      <div className="flex items-center gap-4"><div className="relative h-16 w-16 overflow-hidden rounded-full border-4 border-white bg-beige shadow-soft">{pet.cover_url ? <Image src={pet.cover_url} alt={pet.name} fill className="object-cover" unoptimized /> : <PawPrint className="absolute left-5 top-5 text-[#B88B69]" />}</div><div><h1 className="text-xl font-extrabold">{pet.name}의 모든 순간</h1><p className="mt-1 text-sm text-[#8A7769]">사진 {assets.length}장 · 폴더 {folders.length}개</p></div></div>
      <div className="mt-4 grid grid-cols-2 rounded-xl bg-[#EEE2D6] p-0.5"><button onClick={() => { setView("photos"); setActiveFolder("all"); }} className={`flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-sm font-extrabold transition ${view === "photos" ? "bg-white text-coral shadow-sm" : "text-[#806B5D]"}`}><ImageIcon size={16} />사진</button><button onClick={() => setView("folders")} className={`flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-sm font-extrabold transition ${view === "folders" ? "bg-white text-coral shadow-sm" : "text-[#806B5D]"}`}><Folder size={16} />폴더</button></div>
    </section>

    {view === "folders" ? <section className="px-5 pb-7">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">주요 폴더</h2><p className="mt-1 text-xs text-[#9A8373]">폴더를 길게 누른 뒤 옆으로 옮겨 순서를 바꿔보세요.</p></div><button onClick={() => setFolderOpen(true)} className="flex h-10 items-center gap-1.5 rounded-xl bg-coral px-3 text-sm font-extrabold text-white"><FolderPlus size={16} />새 폴더</button></div>
      <div className="grid grid-cols-3 gap-2.5">
        {(() => { const unfiled = assets.filter(asset => !asset.folderId).sort((a,b) => +new Date(b.date) - +new Date(a.date)); return <button onClick={() => { setActiveFolder("unfiled"); setView("photos"); }} className="relative aspect-[.82] overflow-hidden rounded-[18px] border border-[#EEDFD2] bg-[#F4E9DE] text-left">{unfiled[0] ? <Image src={unfiled[0].url} alt="미분류 대표사진" fill className="object-cover" unoptimized /> : <Folder className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#C7A98F]" fill="currentColor" size={38} />}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#4A2E1C]/80 to-transparent px-2.5 pb-3 pt-9 text-white"><b className="block truncate text-sm">미분류</b><small className="mt-0.5 block text-white/80">{unfiled.length}장</small></span></button>; })()}
        {folders.map(folder => { const folderAssets = assets.filter(asset => asset.folderId === folder.id).sort((a,b) => +new Date(b.date) - +new Date(a.date)); const coverUrl = folder.cover_url || folderAssets[0]?.url; return <div key={folder.id} data-folder-id={folder.id} onPointerDown={() => beginFolderHold(folder.id)} onPointerMove={e => moveHeldFolder(e, folder.id)} onPointerUp={finishFolderHold} onPointerCancel={finishFolderHold} className={`relative aspect-[.82] touch-pan-y overflow-hidden rounded-[18px] border bg-[#F5E8D9] transition ${draggingFolderId === folder.id ? "z-20 scale-105 border-coral shadow-xl" : "border-[#EEDFD2]"}`}><button onClick={() => { if (!draggingFolderId) { setActiveFolder(folder.id); setView("photos"); } }} className="relative h-full w-full text-left">{coverUrl ? <Image src={coverUrl} alt={`${folder.name} 대표사진`} fill className="object-cover" unoptimized /> : <Folder className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#E0A446]" fill="currentColor" size={38} />}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#3A2418]/85 to-transparent px-2.5 pb-3 pt-10 text-white"><b className="block truncate text-sm">{folder.name}</b><small className="mt-0.5 block text-white/80">{folderAssets.length}장</small></span></button><span className="pointer-events-none absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/35 text-white"><GripVertical size={14} /></span><button aria-label={`${folder.name} 대표사진 설정`} onPointerDown={e => e.stopPropagation()} onClick={() => { setCoverFolder(folder); setCoverSource("album"); }} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#6F5140] shadow-sm"><Camera size={15} /></button><button aria-label={`${folder.name} 이름 수정`} onPointerDown={e => e.stopPropagation()} onClick={() => { setEditingFolder(folder); setEditingFolderName(folder.name); }} className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-coral"><Pencil size={13} /></button></div>; })}
      </div>
    </section> : <section className="border-t border-[#F0E4D8] px-5 pb-32 pt-5">
      {filtered.length ? activeFolder === "all" ? <div className="space-y-7">{Object.entries(grouped).map(([day, dayAssets]) => <div key={day}><div className="mb-3 flex items-center gap-3"><h3 className="shrink-0 font-extrabold">{day}</h3><span className="h-px flex-1 bg-[#E8D9CC]" /><span className="text-xs text-[#9A8373]">{dayAssets.length}장</span></div><div className="grid grid-cols-4 gap-1">{dayAssets.map(asset => <AlbumPhotoButton key={`${asset.kind}:${asset.id}`} asset={asset} petName={pet.name} organizing={organizing} selected={selected} onOpen={() => { setPhotoDate(new Date(asset.date).toISOString().slice(0,10)); setPhotoFolderId(asset.folderId || ""); setPhotoNote(asset.note || ""); toggleAsset(asset); }} />)}</div></div>)}</div> : <div className="grid grid-cols-4 gap-1">{filtered.map(asset => <AlbumPhotoButton key={`${asset.kind}:${asset.id}`} asset={asset} petName={pet.name} organizing={organizing} selected={selected} onOpen={() => { setPhotoDate(new Date(asset.date).toISOString().slice(0,10)); setPhotoFolderId(asset.folderId || ""); setPhotoNote(asset.note || ""); toggleAsset(asset); }} />)}</div> : <Card className="px-5 py-9 text-center"><ImageIcon className="mx-auto text-[#C8AA90]" /><p className="mt-3 font-bold">아직 사진이 없어요</p><p className="mt-1 text-sm text-[#8A7769]">사진 추가 버튼으로 첫 순간을 담아보세요.</p></Card>}
      <div className="fixed bottom-[88px] left-1/2 z-30 flex w-[calc(100%-44px)] max-w-[392px] -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-white/55 bg-[#4A3A32]/75 p-1.5 text-white shadow-[0_12px_40px_rgba(59,39,27,.28)] backdrop-blur-xl">
        <label className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold"><ArrowUpDown size={15} /><select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="max-w-[68px] bg-transparent text-white outline-none"><option className="text-black" value="newest">최신순</option><option className="text-black" value="oldest">오래된순</option></select></label>
        <button onClick={() => { setOrganizing(!organizing); setSelected([]); }} className={`flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold transition ${organizing ? "bg-white text-[#33251E]" : "text-white"}`}><CheckSquare size={15} />{organizing ? "취소" : "정리"}</button>
        <label className={`flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold ${busy ? "pointer-events-none opacity-60" : ""}`}><Upload size={15} />{busy ? "추가 중" : "사진 추가"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => uploadPhotos(e.target.files)} /></label>
      </div>
    </section>}

    {organizing && selected.length > 0 && <div className="fixed bottom-[82px] left-1/2 z-30 flex w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 items-center justify-between rounded-2xl bg-[#4A2E1C] p-3 text-white shadow-2xl"><span className="pl-2 text-sm font-bold">{selected.length}장 선택</span><button onClick={() => setMoveOpen(true)} className="rounded-xl bg-coral px-4 py-3 text-sm font-extrabold">폴더로 이동</button></div>}

    <Dialog open={folderOpen} onOpenChange={setFolderOpen}><DialogContent className="max-w-[440px] rounded-3xl border-[#EEDFD2] bg-[#FFFAF4]"><DialogHeader><DialogTitle>새 폴더 만들기</DialogTitle><DialogDescription>{pet.name}의 사진을 원하는 주제로 정리해보세요.</DialogDescription></DialogHeader><form onSubmit={createFolder}><input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)} maxLength={24} placeholder="예: 봄날 산책, 생일 모음" className="h-14 w-full rounded-2xl border border-[#E7D6C7] bg-white px-4 outline-none focus:border-coral" /><Button className="mt-4" disabled={!folderName.trim()}>폴더 만들기</Button></form></DialogContent></Dialog>
    <Dialog open={Boolean(editingFolder)} onOpenChange={open => !open && setEditingFolder(null)}><DialogContent className="max-w-[440px] rounded-3xl border-[#EEDFD2] bg-[#FFFAF4]"><DialogHeader><DialogTitle>폴더 이름 수정</DialogTitle><DialogDescription>사진을 찾기 쉬운 이름으로 바꿔보세요.</DialogDescription></DialogHeader><form onSubmit={renameFolder}><input autoFocus value={editingFolderName} onChange={e => setEditingFolderName(e.target.value)} maxLength={24} className="h-14 w-full rounded-2xl border border-[#E7D6C7] bg-white px-4 outline-none focus:border-coral" /><Button className="mt-4" disabled={!editingFolderName.trim()}>이름 저장</Button></form></DialogContent></Dialog>
    <Dialog open={moveOpen} onOpenChange={setMoveOpen}><DialogContent className="max-w-[440px] rounded-3xl border-[#EEDFD2] bg-[#FFFAF4]"><DialogHeader><DialogTitle>어디에 정리할까요?</DialogTitle><DialogDescription>선택한 {selected.length}장의 사진을 옮길 폴더를 선택하세요.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2"><button onClick={() => moveSelected(null)} className="rounded-2xl border border-[#EAD9CA] bg-white p-4 text-left font-bold"><Folder className="mb-2 text-[#B99C85]" />미분류</button>{folders.map(folder => <button key={folder.id} onClick={() => moveSelected(folder.id)} className="rounded-2xl border border-[#EAD9CA] bg-white p-4 text-left font-bold"><Folder className="mb-2 text-[#E0A446]" fill="currentColor" /><span className="block truncate">{folder.name}</span></button>)}</div>{!folders.length && <button onClick={() => { setMoveOpen(false); setFolderOpen(true); }} className="text-sm font-bold text-coral">먼저 새 폴더 만들기</button>}</DialogContent></Dialog>
    <Dialog open={Boolean(coverFolder)} onOpenChange={open => !open && setCoverFolder(null)}><DialogContent className="max-w-[440px] rounded-3xl border-[#EEDFD2] bg-[#FFFAF4]"><DialogHeader><DialogTitle>대표사진 설정</DialogTitle><DialogDescription>{coverFolder?.name} 폴더를 알아보기 쉬운 사진으로 꾸며보세요.</DialogDescription></DialogHeader><div className="grid grid-cols-2 rounded-xl bg-[#EEE2D6] p-0.5"><button onClick={() => setCoverSource("album")} className={`h-9 rounded-[10px] text-sm font-bold ${coverSource === "album" ? "bg-white text-coral shadow-sm" : "text-[#806B5D]"}`}>앨범에서 선택</button><button onClick={() => setCoverSource("device")} className={`h-9 rounded-[10px] text-sm font-bold ${coverSource === "device" ? "bg-white text-coral shadow-sm" : "text-[#806B5D]"}`}>기기에서 선택</button></div>{coverSource === "album" ? assets.length ? <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto">{assets.map(asset => <button key={`cover-${asset.kind}-${asset.id}`} onClick={() => chooseAlbumCover(asset)} className="relative aspect-square overflow-hidden rounded-xl"><Image src={asset.url} alt="대표사진 후보" fill className="object-cover" unoptimized /></button>)}</div> : <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#8A7769]">앨범에 사진이 없어요.</p> : <label className={`grid min-h-36 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[#E4B69B] bg-[#FFF1E8] text-center text-coral ${busy ? "pointer-events-none opacity-60" : ""}`}><span><Upload className="mx-auto mb-2" /><b>{busy ? "업로드 중" : "대표사진 가져오기"}</b><small className="mt-1 block text-[#8A7769]">JPG, PNG, WEBP · 최대 10MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => uploadFolderCover(e.target.files?.[0])} /></label>}</DialogContent></Dialog>
    <Dialog open={Boolean(previewAsset)} onOpenChange={open => !open && setPreviewAsset(null)}><DialogContent className="max-w-[440px] rounded-3xl border-0 bg-[#251A14] p-3" showCloseButton><DialogTitle className="sr-only">사진 크게 보기</DialogTitle>{previewAsset && <><div className="relative aspect-[4/5] overflow-hidden rounded-2xl"><Image src={previewAsset.url} alt={`${pet.name} 사진 크게 보기`} fill className="object-contain" unoptimized /></div><form onSubmit={savePhotoDetails} className="mt-3 rounded-2xl bg-white p-3"><div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-[#715C4E]"><span className="mb-1.5 flex items-center gap-1"><CalendarDays size={14} className="text-coral" />날짜</span><input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)} className="h-11 w-full min-w-0 rounded-xl bg-[#FFF5ED] px-2 text-sm outline-none" /></label><label className="text-xs font-bold text-[#715C4E]"><span className="mb-1.5 flex items-center gap-1"><Folder size={14} className="text-coral" />폴더</span><select value={photoFolderId} onChange={e => setPhotoFolderId(e.target.value)} className="h-11 w-full min-w-0 rounded-xl bg-[#FFF5ED] px-2 text-sm outline-none"><option value="">미분류</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label></div><label className="mt-3 block text-xs font-bold text-[#715C4E]">메모<textarea value={photoNote} onChange={e => setPhotoNote(e.target.value)} maxLength={300} placeholder="이 순간에 대한 메모를 남겨보세요." className="mt-1.5 min-h-20 w-full resize-none rounded-xl bg-[#FFF5ED] p-3 text-sm outline-none" /></label><Button className="mt-3 min-h-11">변경사항 저장</Button></form></>}</DialogContent></Dialog>
  </>;
}
function AlbumGrid({ artworks }: { artworks: Artwork[] }) { return <div className="grid grid-cols-2 gap-2 px-5">{artworks.map(a => <Link key={a.id} href={`/result/${a.generation_id}`} className="relative aspect-square overflow-hidden rounded-2xl bg-beige"><Image src={a.url} alt="" fill className="object-cover" unoptimized /></Link>)}</div>; }

function MyPage({ user, pets, artworks, onLogout, setNotice }: Shared & { onLogout: () => void }) {
  const router = useRouter();
  async function logout() { const sb = getSupabase(); if (sb) await sb.auth.signOut(); else localStorage.removeItem("mna_user"); onLogout(); setNotice({ type: "success", text: "안전하게 로그아웃했어요." }); router.replace("/login"); }
  const menu = [["내 반려동물", "/home"], ["내 앨범", "/album"], ["계정 설정", "#"], ["FAQ", "#"]];
  return <><header className="px-5 pb-5 pt-8"><h1 className="text-2xl font-extrabold">마이페이지</h1></header><section className="px-5"><Card className="p-5"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-[#FFF0E8]"><UserRound className="text-coral" /></div><div className="min-w-0"><p className="font-extrabold">멍냥앨범 가족</p><p className="truncate text-sm text-[#8A7769]">{user?.email}</p></div></div><div className="mt-5 grid grid-cols-2 divide-x divide-[#EEE2D6] rounded-2xl bg-[#FFF8F0] py-4 text-center"><div><b className="text-xl">{pets.length}</b><p className="text-xs text-[#8A7769]">반려동물</p></div><div><b className="text-xl">{artworks.length}</b><p className="text-xs text-[#8A7769]">만든 사진</p></div></div></Card><Card className="mt-5 overflow-hidden">{menu.map(([label, href]) => <Link key={label} href={href} className="flex min-h-14 items-center justify-between border-b border-[#F2E7DD] px-5 last:border-0"><span className="font-bold">{label}</span><ChevronRight size={18} className="text-[#A18E80]" /></Link>)}</Card><button onClick={logout} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white font-bold text-[#8E5C4B]"><LogOut size={19} />로그아웃</button><p className="mt-8 text-center text-xs text-[#B09D8E]">MEONGNYANG ALBUM · MVP v1.0</p></section></>;
}

function NotFound() { return <div className="grid min-h-dvh place-items-center px-6 text-center"><div><PawPrint className="mx-auto text-coral" size={42} /><h1 className="mt-4 text-xl font-extrabold">페이지를 찾지 못했어요</h1><Link href="/home" className="mt-5 inline-flex rounded-2xl bg-coral px-6 py-3 font-bold text-white">홈으로 돌아가기</Link></div></div>; }
