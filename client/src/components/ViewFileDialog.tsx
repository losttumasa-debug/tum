import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ViewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  fileName: string;
}

export default function ViewFileDialog({ isOpen, onClose, content, fileName }: ViewFileDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Viewing: {fileName}</DialogTitle>
          <DialogDescription>
            Content of the processed MCR file.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 w-full rounded-md border p-4">
          <pre className="text-sm"><code>{content}</code></pre>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
