import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/20" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[min(100%-2rem,40rem)] w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.08)] outline-none">
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="rounded-full p-1 text-neutral-500 hover:bg-black/5"
              aria-label="关闭"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-[#6e6e73]">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">对话框</DialogPrimitive.Description>
          )}
          <div className="mt-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
