import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ListChecks } from "lucide-react";
import { formatTimeAgo } from "@/lib/fileUtils";
import type { ProcessingQueue } from "@shared/schema";

export default function ProcessingQueueView() {
  const { data: queue = [], isLoading } = useQuery<ProcessingQueue[]>({
    queryKey: ['/api/queue'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">Completed</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'queued':
      default:
        return <Badge variant="secondary">Queued</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Processing Queue</CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <div className="p-8 text-center">
            <ListChecks className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Queue is empty</h3>
            <p className="text-muted-foreground">No files are currently being processed or waiting.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Step</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.fileId}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>{item.currentStep || 'N/A'}</TableCell>
                  <TableCell>{item.startedAt ? formatTimeAgo(new Date(item.startedAt)) : '-'}</TableCell>
                  <TableCell>{item.completedAt ? formatTimeAgo(new Date(item.completedAt)) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
