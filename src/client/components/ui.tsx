import * as DialogPrimitive from "@radix-ui/react-dialog"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react"
import { useT } from "../lib/i18n"
import { X } from "lucide-react"

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`dwt-button ${className}`} {...props} />
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`dwt-input ${className}`} {...props} />
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`dwt-select ${className}`} {...props} />
}

export function Dialog({ children, ...props }: DialogPrimitive.DialogProps) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>
}

export function DialogContent({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dwt-dialog-overlay" />
      <DialogPrimitive.Content className="dwt-dialog-content">
        {children}
        <DialogPrimitive.Close className="dwt-dialog-close" aria-label={t("close")}>
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description
