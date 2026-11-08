"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
export const Dialog=DialogPrimitive.Root;
export const DialogTrigger=DialogPrimitive.Trigger;
export const DialogClose=DialogPrimitive.Close;
export const DialogTitle=DialogPrimitive.Title;
export const DialogDescription=DialogPrimitive.Description;
export function DialogContent({children}: {children:React.ReactNode}) {return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="modal-backdrop"/><DialogPrimitive.Content className="modal dialog-content">{children}<DialogPrimitive.Close className="dialog-close" aria-label="Close dialog">×</DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;}
