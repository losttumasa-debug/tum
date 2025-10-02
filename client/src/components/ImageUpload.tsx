import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Image as ImageIcon, 
  Upload, 
  FileImage, 
  Eye, 
  Wand2, 
  Trash2, 
  Loader2,
  Scan,
  FileCode
} from "lucide-react";
import { formatFileSize, formatTimeAgo } from "@/lib/fileUtils";

interface ImageFile {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  uploadedAt: Date | string;
}

interface ImageAnalysis {
  imageId: string;
  text: string;
  confidence: number;
  uiElements: Array<{
    type: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  analyzedAt: string;
}

export default function ImageUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: images = [] } = useQuery<ImageFile[]>({
    queryKey: ['/api/images'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/images');
        return await response.json();
      } catch (error) {
        return [];
      }
    },
    refetchInterval: 5000,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/bmp': ['.bmp']
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await apiRequest('POST', '/api/images/upload', formData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });
      toast({
        title: "Image uploaded successfully",
        description: "Your image has been uploaded and is ready for analysis.",
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
      setIsUploading(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const response = await apiRequest('POST', `/api/images/${imageId}/analyze`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });
      toast({
        title: "Analysis started",
        description: "Image analysis is in progress. This may take a few moments.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateMcrMutation = useMutation({
    mutationFn: async ({ imageId, usePatterns }: { imageId: string, usePatterns: boolean }) => {
      const response = await apiRequest('POST', `/api/images/${imageId}/generate-mcr`, {
        usePatterns,
        fileName: `generated_from_image_${Date.now()}.mcr`
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "MCR file generated",
        description: "Your MCR file has been generated from the image and is ready to download.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      return apiRequest('DELETE', `/api/images/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });
      toast({
        title: "Image deleted",
        description: "The image has been successfully deleted.",
      });
      setShowDeleteDialog(false);
      setImageToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    uploadMutation.mutate(selectedFile, {
      onSettled: () => {
        clearInterval(interval);
        setUploadProgress(100);
      }
    });
  };

  const handleAnalyze = (imageId: string) => {
    analyzeMutation.mutate(imageId);
  };

  const handleGenerateMcr = (imageId: string, usePatterns: boolean = false) => {
    generateMcrMutation.mutate({ imageId, usePatterns });
  };

  const handleDeleteClick = (imageId: string) => {
    setImageToDelete(imageId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (imageToDelete) {
      deleteMutation.mutate(imageToDelete);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Image Upload & Analysis
          </CardTitle>
          <CardDescription>
            Upload screenshots or images to generate MCR files using OCR and AI analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Upload Image</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your image here, or click to browse
                </p>
              </div>
              {selectedFile && (
                <div className="mt-4 p-4 bg-muted rounded-md w-full max-w-md">
                  <div className="flex items-center gap-3">
                    <FileImage className="w-8 h-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  {previewUrl && (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="mt-4 max-h-48 mx-auto rounded border"
                    />
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Supported formats: PNG, JPG, JPEG, BMP • Max file size: 20MB
              </p>
            </div>
          </div>

          {isUploading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {selectedFile && !isUploading && (
            <div className="mt-6 flex gap-3">
              <Button 
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="flex-1"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 w-4 h-4" />
                    Upload Image
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Images List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Images</CardTitle>
          <CardDescription>
            Analyze images with OCR and generate MCR files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="text-center py-12">
              <FileImage className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No images uploaded yet</h3>
              <p className="text-sm text-muted-foreground">
                Upload an image to get started with OCR analysis
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{image.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(image.size)} • {formatTimeAgo(image.uploadedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAnalyze(image.id)}
                          disabled={analyzeMutation.isPending}
                        >
                          {analyzeMutation.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Scan className="w-3 h-3 mr-1" />
                          )}
                          Analyze
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateMcr(image.id, false)}
                          disabled={generateMcrMutation.isPending}
                        >
                          {generateMcrMutation.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <FileCode className="w-3 h-3 mr-1" />
                          )}
                          Generate MCR
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateMcr(image.id, true)}
                          disabled={generateMcrMutation.isPending}
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          Smart MCR
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(image.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
