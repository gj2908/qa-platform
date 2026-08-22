import { TriangleAlert } from "lucide-react";
import Button from "./Button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../shadcn/dialog";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onCancel()}>
      <DialogContent showClose={false} className="max-w-sm p-5" onPointerDownOutside={(e) => loading && e.preventDefault()}>
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-danger-subtle text-danger-subtle-fg">
            <TriangleAlert size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold leading-none tracking-normal text-ink-primary">{title}</DialogTitle>
            {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
