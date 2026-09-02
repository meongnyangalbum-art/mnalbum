import Image from "next/image";

export function BrandMark({ lockup = false }: { lockup?: boolean }) {
  return <div aria-label="멍냥앨범" className={lockup ? "brand-lockup" : "brand-mark brand-mark--icon"}>
    <Image src="/brand-reference.png" width={945} height={1675} alt="강아지와 고양이가 앨범에서 얼굴을 내미는 멍냥앨범 심볼" priority />
  </div>;
}
