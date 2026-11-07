import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils.ts";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-11 w-full resize-none rounded-xl border border-[#e5e5ea] bg-white px-3 py-2.5 text-[15px] leading-relaxed text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus-visible:border-[#3d6f99]",
        className,
      )}
      {...props}
    />
  );
}
