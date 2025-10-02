import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ImagePathDrawer from "./ImagePathDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Upload, FileText, Settings, Image as ImageIcon, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { formatFileSize } from "@/lib/fileUtils";

const humanizationSchema = z.object({
  delayVariation: z.number().min(1).max(100).default(10),
  typingErrors: z.number().min(0).max(10).default(1),
  hesitationPauses: z.number().min(0).max(50).default(5),
  preserveStructure: z.boolean().default(true),
  timeExtensionFactor: z.number().min(1).max(5).default(1),
  minDelay: z.number().min(0).max(100).default(10),
  maxDelay: z.number().min(10).max(1000).default(100),
});

type HumanizationSettings = z.infer<typeof humanizationSchema>;

interface ImageFile {
  id: string;
  originalName: string;
  filename: string;
  drawnPath?: string | null;
}

export default function FileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showPathDrawer, setShowPathDrawer] = useState(false);
  const [pathCompleted, setPathCompleted] = useState(false);
  const [drawnPath, setDrawnPath] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available images
  const { data: images = [] } = useQuery<ImageFile[]>({
    queryKey: ['/api/images'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/images');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const form = useForm<HumanizationSettings>({
    resolver: zodResolver(humanizationSchema),
    defaultValues: {
      delayVariation: 10,
      typingErrors: 1,
      hesitationPauses: 5,
      preserveStructure: true,
      timeExtensionFactor: 1,
      minDelay: 10,
      maxDelay: 100,
    },
  });

  const savePathMutation = useMutation({
    mutationFn: async (data: { imageId: string; path: any; metadata: any }) => {
      const response = await apiRequest('POST', `/api/images/${data.imageId}/path`, {
        path: data.path,
        metadata: data.metadata
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });
      toast({
        title: "Path saved",
        description: "Your drawn path has been saved successfully.",
      });
      setPathCompleted(true);
      setShowPathDrawer(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save path",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; settings: HumanizationSettings; imageId?: string | null }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('humanizationSettings', JSON.stringify(data.settings));
      if (data.imageId) {
        formData.append('requiredImageId', data.imageId);
      }

      const response = await apiRequest('POST', '/api/files/upload', formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "MCR file uploaded successfully",
        description: "Your file is now being processed with humanization.",
      });
      resetUploadState();
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

  const resetUploadState = () => {
    setSelectedFile(null);
    setSelectedImageId(null);
    setShowPathDrawer(false);
    setPathCompleted(false);
    setDrawnPath(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImageId(imageId);
    const image = images.find(img => img.id === imageId);
    if (image?.drawnPath) {
      setPathCompleted(true);
    } else {
      setPathCompleted(false);
    }
  };

  const handleDrawPath = () => {
    if (!selectedImageId) return;
    setShowPathDrawer(true);
  };

  const handlePathComplete = (path: any, metadata: any) => {
    if (!selectedImageId) return;
    setDrawnPath({ path, metadata });
    savePathMutation.mutate({
      imageId: selectedImageId,
      path,
      metadata
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an MCR file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const settings = form.getValues();
    
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      await uploadMutation.mutateAsync({ 
        file: selectedFile, 
        settings, 
        imageId: selectedImageId || null 
      });
      clearInterval(progressInterval);
      setUploadProgress(100);
    } catch (error) {
      clearInterval(progressInterval);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.name.toLowerCase().endsWith('.mcr')) {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Only .mcr files are allowed",
        variant: "destructive",
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.mcr']
    },
    maxFiles: 1,
  });

  const selectedImage = images.find(img => img.id === selectedImageId);

  if (showPathDrawer && selectedImageId && selectedImage) {
    return (
      <ImagePathDrawer
        imageId={selectedImageId}
        imagePath={`/uploads/images/${selectedImage.filename}`}
        imageName={selectedImage.originalName}
        onPathComplete={handlePathComplete}
        onCancel={() => setShowPathDrawer(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Image */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Step 1: Select Image
          </CardTitle>
          <CardDescription>
            Choose an image that represents the workflow for your MCR file
          </CardDescription>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No images available. Please go to the "Image Upload" tab to upload an image first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Select value={selectedImageId || ""} onValueChange={handleImageSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an image..." />
                </SelectTrigger>
                <SelectContent>
                  {images.map((image) => (
                    <SelectItem key={image.id} value={image.id}>
                      {image.originalName} {image.drawnPath && "✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedImageId && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-6 h-6" />
                    <div>
                      <p className="font-medium">{selectedImage?.originalName}</p>
                      <p className="text-sm text-muted-foreground">
                        {pathCompleted ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Path completed
                          </span>
                        ) : (
                          <span className="text-orange-600">Path not drawn yet</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {!pathCompleted && (
                    <Button onClick={handleDrawPath}>
                      Draw Path
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Upload MCR File */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Step 2: Upload MCR File
          </CardTitle>
          <CardDescription>
            Upload your MCR file (mouse commands will be automatically removed)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pathCompleted ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please complete Step 1 first by selecting an image and drawing a path.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Upload MCR File</h3>
                    <p className="text-sm text-muted-foreground">
                      Drag and drop your .mcr file here, or click to browse
                    </p>
                  </div>
                  {selectedFile && (
                    <div className="mt-3 p-3 bg-muted rounded-md w-full max-w-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isUploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Uploading...</span>
                    <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Humanization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Step 3: Humanization Settings
          </CardTitle>
          <CardDescription>
            Configure minimal delays and timing (keyboard commands only)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="timeExtensionFactor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Extension Factor: {field.value.toFixed(1)}x</FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={5}
                        step={0.1}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Multiply all delays (1.0 = normal, 2.0 = double time)
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minDelay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Delay: {field.value}ms</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum delay between commands
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxDelay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Delay: {field.value}ms</FormLabel>
                    <FormControl>
                      <Slider
                        min={10}
                        max={1000}
                        step={10}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum delay between commands
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delayVariation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delay Variation: {field.value}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Randomness in delays (lower = more consistent)
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="typingErrors"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typing Errors: {field.value}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={10}
                        step={0.5}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Simulate realistic typing mistakes with automatic corrections (0 = no errors, 10 = frequent errors)
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hesitationPauses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hesitation Pauses: {field.value}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={50}
                        step={1}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Add natural hesitation pauses (simulates thinking or reading)
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>
          </Form>

          <div className="mt-6">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !pathCompleted || isUploading}
              className="w-full"
              size="lg"
            >
              {isUploading ? "Uploading..." : "Upload & Process MCR File"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
