import { useState, useEffect } from "react";
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
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  Play, 
  Loader2,
  RefreshCw,
  Clock,
  Wand2,
  Keyboard
} from "lucide-react";
import { formatFileSize, formatTimeAgo } from "@/lib/fileUtils";
import type { McrFile } from "@shared/schema";
import ViewFileDialog from "./ViewFileDialog";
import KeyboardEditor from "./KeyboardEditor";

export default function FileManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<McrFile | null>(null);
  const [viewingFileContent, setViewingFileContent] = useState("");
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  const [isLengthenModalOpen, setIsLengthenModalOpen] = useState(false);
  const [lengtheningFile, setLengtheningFile] = useState<McrFile | null>(null);
  const [targetDurationInput, setTargetDurationInput] = useState("");

  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [cleaningFile, setCleaningFile] = useState<McrFile | null>(null);
  const [cleanupRemoveMouse, setCleanupRemoveMouse] = useState(true);
  const [cleanupRemoveZeroDelays, setCleanupRemoveZeroDelays] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<McrCommand[][] | null>(null);
  const [isKeyboardEditorOpen, setIsKeyboardEditorOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<McrFile | null>(null);
  const [keyboardExcludedKeys, setKeyboardExcludedKeys] = useState<string[]>([]);

  const { data: files = [], isLoading } = useQuery<McrFile[]>({
    queryKey: ['/api/files'],
    refetchInterval: 5000,
  });

  useEffect(() => {
    const fetchDurations = async () => {
      const newDurations: Record<string, number | null> = {};
      for (const file of files) {
        if (durations[file.id] === undefined) { // Fetch only if not already fetched
          try {
            const response = await apiRequest('GET', `/api/files/${file.id}/duration`);
            const data = await response.json();
            newDurations[file.id] = data.duration;
          } catch (error) {
            newDurations[file.id] = null; // Mark as failed
          }
        }
      }
      if (Object.keys(newDurations).length > 0) {
        setDurations(prev => ({ ...prev, ...newDurations }));
      }
    };

    if (files.length > 0) {
      fetchDurations();
    }
  }, [files]);

  const processMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest('POST', `/api/files/${fileId}/process`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Processing started",
        description: "Your file has been queued for processing.",
      });
    },
    onError: (error) => {
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const lengthenMutation = useMutation({
    mutationFn: async (variables: { fileId: string; targetDuration: number }) => {
      return apiRequest('POST', `/api/files/${variables.fileId}/lengthen`, { targetDuration: variables.targetDuration });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      // Manually reset duration for the updated file to force refetch
      setDurations(prev => ({ ...prev, [variables.fileId]: undefined }));
      toast({
        title: "File Lengthened",
        description: "The file has been successfully lengthened and saved.",
      });
      setIsLengthenModalOpen(false);
      setLengtheningFile(null);
      setTargetDurationInput("");
    },
    onError: (error) => {
      toast({
        title: "Lengthen failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
    
      const cleanupMutation = useMutation({
        mutationFn: async (variables: { fileId: string; removeMouse: boolean; removeZeroDelays: boolean }) => {
          return apiRequest('POST', `/api/files/${variables.fileId}/cleanup`, { removeMouse: variables.removeMouse, removeZeroDelays: variables.removeZeroDelays });
        },
        onSuccess: (_, variables) => {
          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
          queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
          setDurations(prev => ({ ...prev, [variables.fileId]: undefined }));
          toast({
            title: "File Cleanup Successful",
            description: "The file has been cleaned and saved.",
          });
          setIsCleanupModalOpen(false);
          setCleaningFile(null);
        },
        onError: (error) => {
          toast({
            title: "Cleanup failed",
            description: error.message,
            variant: "destructive",
          });
        },
      });

  const [newMergedFileName, setNewMergedFileName] = useState("");
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const mergeOptimizeMutation = useMutation({
    mutationFn: async (variables: { fileId1: string; fileId2: string; newFileName: string }) => {
      return apiRequest('POST', '/api/files/merge-optimized', variables);
    },
    onSuccess: () => {
      setIsMergeModalOpen(false);
      setSelectedForCompare([]);
      setNewMergedFileName("");
      // Add a small delay to ensure DB update is propagated before refetch
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
        toast({
          title: "Merge & Optimize Complete",
          description: "A new optimized MCR file has been created.",
        });
      }, 500); 
    },
    onError: (error) => {
      toast({
        title: "Merge & Optimize Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createFromPatternMutation = useMutation({
    mutationFn: async (variables: { pattern: McrCommand[]; originalName: string }) => {
      return apiRequest('POST', '/api/files/from-pattern', variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "File Created",
        description: "A new MCR file has been created from the pattern.",
      });
      setIsCompareModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateExcludedKeysMutation = useMutation({
    mutationFn: async (variables: { fileId: string; excludedKeys: string[] }) => {
      return apiRequest('POST', `/api/files/${variables.fileId}/excluded-keys`, { excludedKeys: variables.excludedKeys });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "Excluded keys updated",
        description: "The excluded keys have been successfully updated.",
      });
      setIsKeyboardEditorOpen(false);
      setEditingFile(null);
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message,
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

  const clearCompleted = async () => {
    const completedFiles = files.filter(f => f.status === 'completed');
    for (const file of completedFiles) {
      await deleteMutation.mutateAsync(file.id);
    }
  };

  const processAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    for (const file of pendingFiles) {
      await processMutation.mutateAsync(file.id);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null || ms === undefined) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string, progress?: number) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1"></div>
            Processing...
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1"></div>
            Failed
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1"></div>
            Pending
          </Badge>
        );
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>File Management</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMergeModalOpen(true)}
                disabled={selectedForCompare.length !== 2 || mergeOptimizeMutation.isPending}
                data-testid="compare-selected-button"
              >
                {mergeOptimizeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Optimize & Merge ({selectedForCompare.length}/2)
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearCompleted}
                disabled={!files.some(f => f.status === 'completed')}
                data-testid="clear-completed-button"
              >
                Clear Completed
              </Button>
              <Button 
                size="sm"
                onClick={processAll}
                disabled={!files.some(f => f.status === 'pending')}
                data-testid="process-all-button"
              >
                Process All
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {files.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No files uploaded</h3>
              <p className="text-muted-foreground">Upload your first MCR file to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {files.map((file) => (
                <div 
                  key={file.id} 
                  className="p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`file-item-${file.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={selectedForCompare.includes(file.id)}
                        onCheckedChange={(checked) => {
                          setSelectedForCompare(prev => {
                            if (checked) {
                              return prev.length < 2 ? [...prev, file.id] : prev;
                            } else {
                              return prev.filter(id => id !== file.id);
                            }
                          });
                        }}
                        aria-label={`Select ${file.originalName} for comparison`}
                      />
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
                          <span data-testid={`file-duration-${file.id}`}>
                            {formatDuration(durations[file.id])}
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
                        {file.sourceFileNames && file.sourceFileNames.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Created from: {file.sourceFileNames.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(file.status, file.processingProgress || undefined)}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {file.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadFile(file)}
                            title="Download"
                            data-testid={`download-button-${file.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {file.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCleaningFile(file);
                                setIsCleanupModalOpen(true);
                              }}
                              title="Cleanup Macro"
                              disabled={cleanupMutation.isPending}
                              data-testid={`cleanup-button-${file.id}`}
                            >
                              <Wand2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setLengtheningFile(file);
                                setIsLengthenModalOpen(true);
                              }}
                              title="Lengthen Macro"
                              disabled={lengthenMutation.isPending}
                              data-testid={`lengthen-button-${file.id}`}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => processMutation.mutate(file.id)}
                              title="Start Processing"
                              disabled={processMutation.isPending}
                              data-testid={`process-button-${file.id}`}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit Keystrokes"
                          onClick={() => {
                            setEditingFile(file);
                            setIsKeyboardEditorOpen(true);
                          }}
                        >
                          <Keyboard className="w-4 h-4" />
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
                  
                  {file.status === 'processing' && file.processingProgress != null && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Processing file...</span>
                        <span>{Math.round(file.processingProgress)}%</span>
                      </div>
                      <Progress value={file.processingProgress} className="h-1.5" />
                    </div>
                  )}
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

      <Dialog open={isLengthenModalOpen} onOpenChange={setIsLengthenModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Lengthen Macro</DialogTitle>
            <DialogDescription>
              Extend "{lengtheningFile?.originalName}" to a new duration. The current duration is {formatDuration(durations[lengtheningFile?.id || ''])}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="duration" className="text-right">
                New Duration (minutes)
              </Label>
              <Input
                id="duration"
                type="number"
                value={targetDurationInput}
                onChange={(e) => setTargetDurationInput(e.target.value)}
                className="col-span-3"
                placeholder="e.g., 5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLengthenModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (lengtheningFile && targetDurationInput) {
                  const durationInMs = parseFloat(targetDurationInput) * 60 * 1000;
                  lengthenMutation.mutate({ fileId: lengtheningFile.id, targetDuration: durationInMs });
                }
              }}
              disabled={lengthenMutation.isPending || !targetDurationInput}
            >
              {lengthenMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lengthen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCleanupModalOpen} onOpenChange={setIsCleanupModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cleanup Macro</DialogTitle>
            <DialogDescription>
              Apply cleanup actions to "{cleaningFile?.originalName}". This will modify the original file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="removeMouse"
                checked={cleanupRemoveMouse}
                onCheckedChange={(checked) => setCleanupRemoveMouse(!!checked)}
              />
              <label
                htmlFor="removeMouse"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remove all mouse commands
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="removeZeroDelays"
                checked={cleanupRemoveZeroDelays}
                onCheckedChange={(checked) => setCleanupRemoveZeroDelays(!!checked)}
              />
              <label
                htmlFor="removeZeroDelays"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remove DELAY : 0 commands
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCleanupModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (cleaningFile) {
                  cleanupMutation.mutate({ 
                    fileId: cleaningFile.id, 
                    removeMouse: cleanupRemoveMouse, 
                    removeZeroDelays: cleanupRemoveZeroDelays 
                  });
                }
              }}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Cleanup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMergeModalOpen} onOpenChange={setIsMergeModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Optimize & Merge Macros</DialogTitle>
            <DialogDescription>
              Create a new optimized macro from the two selected files.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newFileName" className="text-right">
                New File Name
              </Label>
              <Input
                id="newFileName"
                value={newMergedFileName}
                onChange={(e) => setNewMergedFileName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Optimized Macro"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (selectedForCompare.length === 2 && newMergedFileName) {
                  mergeOptimizeMutation.mutate({
                    fileId1: selectedForCompare[0],
                    fileId2: selectedForCompare[1],
                    newFileName: newMergedFileName,
                  });
                }
              }}
              disabled={mergeOptimizeMutation.isPending || !newMergedFileName}
            >
              {mergeOptimizeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Optimized Macro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isKeyboardEditorOpen} onOpenChange={setIsKeyboardEditorOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Excluded Keystrokes</DialogTitle>
            <DialogDescription>
              Select the keystrokes to exclude for the file "{editingFile?.originalName}".
            </DialogDescription>
          </DialogHeader>
          <KeyboardEditor onExcludedKeysChange={setKeyboardExcludedKeys} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsKeyboardEditorOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (editingFile) {
                  updateExcludedKeysMutation.mutate({ fileId: editingFile.id, excludedKeys: keyboardExcludedKeys });
                }
              }}
              disabled={updateExcludedKeysMutation.isPending}
            >
              {updateExcludedKeysMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
