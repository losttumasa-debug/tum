import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  Play, 
  Loader2,
  RefreshCw
} from "lucide-react";
import { formatFileSize, formatTimeAgo } from "@/lib/fileUtils";
import type { McrFile } from "@shared/schema";
import ViewFileDialog from "./ViewFileDialog";
import { useState } from "react"; // Added useState for modal

export default function DownloadsView() {
  console.log('DownloadsView rendered');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<McrFile | null>(null);
  const [viewingFileContent, setViewingFileContent] = useState("");

  const { data: files = [], isLoading } = useQuery<McrFile[]>({
    queryKey: ['/api/files'],
    refetchInterval: 5000,
  });

  // Filter files to only show completed ones
  const completedFiles = files.filter(file => file.status === 'completed');

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest('DELETE', `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "File deleted",
        description: "The file has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const viewContentMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiRequest('GET', `/api/files/${fileId}/content`);
      return response.json() as Promise<{ content: string }>;
    },
    onSuccess: (data) => {
      setViewingFileContent(data.content);
      setIsViewModalOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to load file content: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const downloadFile = async (file: McrFile) => {
    try {
      const response = await fetch(`/api/files/${file.id}/download`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Download failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `humanized_${file.originalName}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleViewClick = (file: McrFile) => {
    setViewingFile(file);
    viewContentMutation.mutate(file.id);
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>Downloads</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {completedFiles.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No completed files to download</h3>
              <p className="text-muted-foreground">Processed files will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {completedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className="p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`file-item-${file.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground" data-testid={`file-name-${file.id}`}>
                          {file.originalName}
                        </h4>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span data-testid={`file-size-${file.id}`}>
                            {formatFileSize(file.size)}
                          </span>
                          <span data-testid={`file-upload-time-${file.id}`}>
                            {formatTimeAgo(new Date(file.uploadedAt))}
                          </span>
                          {file.originalCommands && (
                            <span data-testid={`file-commands-${file.id}`}>
                              {file.originalCommands.toLocaleString()} commands
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => downloadFile(file)}
                          title="Download"
                          data-testid={`download-button-${file.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View Details"
                          disabled={viewContentMutation.isPending && viewingFile?.id === file.id}
                          onClick={() => handleViewClick(file)}
                          data-testid={`view-button-${file.id}`}
                        >
                          {viewContentMutation.isPending && viewingFile?.id === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              data-testid={`delete-button-${file.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete File</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{file.originalName}"? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(file.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {viewingFile && (
        <ViewFileDialog
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          content={viewingFileContent}
          fileName={viewingFile.originalName}
        />
      )}
    </>
  );
}
