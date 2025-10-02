import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

import { Upload, FileText, Settings } from "lucide-react";
import { formatFileSize } from "@/lib/fileUtils";

const humanizationSchema = z.object({
  delayVariation: z.number().min(1).max(100).default(25),
  typingErrors: z.number().min(0).max(10).default(2),
  hesitationPauses: z.number().min(0).max(50).default(15),
  preserveStructure: z.boolean().default(true),
  removeMouseOnUpload: z.boolean().default(false),
});

type HumanizationSettings = z.infer<typeof humanizationSchema>;

export default function FileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<HumanizationSettings>({
    resolver: zodResolver(humanizationSchema),
    defaultValues: {
      delayVariation: 25,
      typingErrors: 2,
      hesitationPauses: 15,
      preserveStructure: true,
      excludedKeys: [],
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; settings: HumanizationSettings }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('humanizationSettings', JSON.stringify(data.settings));

      const response = await apiRequest('POST', '/api/files/upload', formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "File uploaded successfully",
        description: "Your MCR file has been uploaded and queued for processing.",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const settings = { ...form.getValues() };

    for (const file of selectedFiles) {
      // Simulate progress for better UX for each file
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);
      await uploadMutation.mutateAsync({ file, settings });
      clearInterval(progressInterval); // Clear interval after each file upload
      setUploadProgress(0); // Reset progress for next file
    }

    setSelectedFiles([]);
    setFileNames([]);
    setIsUploading(false);
    toast({
      title: "All files uploaded",
      description: "All selected MCR files have been uploaded and queued for processing.",
    });
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles: File[] = [];
      const validFileNames: string[] = [];

      acceptedFiles.forEach(file => {
        if (!file.name.toLowerCase().endsWith('.mcr')) {
          toast({
            title: "Invalid file type",
            description: `File ${file.name}: Please upload a .mcr file.`,
            variant: "destructive",
          });
          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `File ${file.name}: Please upload a file smaller than 10MB.`,
            variant: "destructive",
          });
          return;
        }
        validFiles.push(file);
        validFileNames.push(file.name);
      });

      setSelectedFiles(prev => [...prev, ...validFiles]);
      setFileNames(prev => [...prev, ...validFileNames]);
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.mcr'],
    },
    multiple: true,
  });

  const handleManualUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mcr';
    input.multiple = true; // Allow multiple file selection
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        onDrop(Array.from(files));
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary'
            }`}
            data-testid="file-dropzone"
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Upload MCR Files</h3>
                <p className="text-muted-foreground mb-4">
                  Drag and drop your .mcr files here, or click to browse
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={(e) => { e.stopPropagation(); handleManualUpload(); }}
                    disabled={isUploading}
                    data-testid="select-files-button"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Select Files
                  </Button>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                    disabled={isUploading || selectedFiles.length === 0}
                    data-testid="upload-selected-files-button"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Selected Files ({selectedFiles.length})
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Supported formats: .mcr • Max file size: 10MB
              </div>
            </div>
          </div>

          {fileNames.length > 0 && (
            <div className="mt-4 p-4 border rounded-lg bg-secondary/20">
              <p className="text-sm font-medium mb-2">Archivos seleccionados:</p>
              <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                {fileNames.map((name, index) => (
                  <li key={index}>{name}</li>
                ))}
              </ul>
              <Button
                onClick={() => {
                  setSelectedFiles([]);
                  setFileNames([]);
                }}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Clear Selected Files
              </Button>
            </div>
          )}

          {isUploading && (
            <div className="mt-6 space-y-3" data-testid="upload-progress">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Uploading file...</span>
                <span data-testid="upload-percentage">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Humanization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Humanization Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="delayVariation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delay Variation</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={1}
                            max={100}
                            step={1}
                            className="w-full"
                            data-testid="delay-variation-slider"
                          />
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>1%</span>
                            <span className="font-medium" data-testid="delay-variation-value">
                              {field.value}%
                            </span>
                            <span>100%</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Add random variations to timing delays
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="typingErrors"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Typing Errors</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={0}
                            max={10}
                            step={0.1}
                            className="w-full"
                            data-testid="typing-errors-slider"
                          />
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>0%</span>
                            <span className="font-medium" data-testid="typing-errors-value">
                              {field.value.toFixed(1)}%
                            </span>
                            <span>10%</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Simulate occasional typing mistakes
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="hesitationPauses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hesitation Pauses</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={0}
                            max={50}
                            step={1}
                            className="w-full"
                            data-testid="hesitation-pauses-slider"
                          />
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>0%</span>
                            <span className="font-medium" data-testid="hesitation-pauses-value">
                              {field.value}%
                            </span>
                            <span>50%</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Add natural pauses before actions
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preserveStructure"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="preserve-structure-checkbox"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Preserve original structure</FormLabel>
                        <FormDescription>
                          Maintain the overall timing structure of the original file
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="removeMouseOnUpload"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="remove-mouse-checkbox"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Remove mouse commands</FormLabel>
                        <FormDescription>
                          Strip all mouse-related commands from the file upon upload.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>

      
    </div>
  );
}
