import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={twMerge("min-h-12 w-full rounded-2xl bg-coral px-5 py-3 font-bold text-white transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge("rounded-3xl border border-[#F2E6D9] bg-white shadow-soft", className)} {...props} />;
}
