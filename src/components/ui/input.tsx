import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils.ts";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-[#e5e5ea] bg-white px-3 text-[15px] text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus-visible:border-[#3d6f99]",
        className,
      )}
      {...props}
    />
  );
}
