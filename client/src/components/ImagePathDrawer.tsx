import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Check, ArrowRight } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface ImagePathDrawerProps {
  imageId: string;
  imagePath: string;
  imageName: string;
  onPathComplete: (path: Point[], metadata: any) => void;
  onCancel?: () => void;
}

export default function ImagePathDrawer({ 
  imageId, 
  imagePath, 
  imageName, 
  onPathComplete,
  onCancel 
}: ImagePathDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [path, setPath] = useState<Point[]>([]);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    if (isImageLoaded && canvasRef.current && imageRef.current) {
      drawCanvas();
    }
  }, [path, isImageLoaded]);

  const handleImageLoad = () => {
    setIsImageLoaded(true);
    if (canvasRef.current && imageRef.current) {
      canvasRef.current.width = imageRef.current.naturalWidth;
      canvasRef.current.height = imageRef.current.naturalHeight;
      drawCanvas();
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    if (path.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      
      ctx.stroke();

      ctx.fillStyle = '#3b82f6';
      path.forEach((point, index) => {
        if (index === 0) {
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (index === path.length - 1) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    if (coords) {
      setPath([coords]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    if (coords) {
      setPath(prev => [...prev, coords]);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
  };

  const handleClearPath = () => {
    setPath([]);
  };

  const calculatePathMetadata = () => {
    if (path.length < 2) return null;

    let totalLength = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      totalPoints: path.length,
      totalLength: Math.round(totalLength),
      startPoint: path[0],
      endPoint: path[path.length - 1],
      createdAt: new Date().toISOString()
    };
  };

  const handleComplete = () => {
    if (path.length < 5) {
      alert('Please draw a longer path (at least 5 points)');
      return;
    }

    const metadata = calculatePathMetadata();
    if (metadata) {
      onPathComplete(path, metadata);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="w-5 h-5" />
          Draw Path on Image
        </CardTitle>
        <CardDescription>
          <strong>{imageName}</strong> - Draw a path representing the MCR execution flow. Start point (green), End point (red)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg overflow-hidden">
            <img
              ref={imageRef}
              src={imagePath}
              alt={imageName}
              onLoad={handleImageLoad}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="cursor-crosshair w-full h-auto max-h-[600px] object-contain"
              style={{ display: isImageLoaded ? 'block' : 'none' }}
            />
            {!isImageLoaded && (
              <div className="flex items-center justify-center p-12">
                <div className="text-muted-foreground">Loading image...</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                {path.length} points drawn
              </Badge>
              {path.length > 0 && (
                <Badge variant="secondary" className="text-sm">
                  Length: ~{calculatePathMetadata()?.totalLength}px
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              {path.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearPath}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
              
              {onCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleComplete}
                disabled={path.length < 5}
              >
                <Check className="w-4 h-4 mr-1" />
                Complete & Continue
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
            <strong>Instructions:</strong> Click and drag on the image to draw a path representing the execution flow of your MCR file. 
            The path will be used to validate and optimize the MCR commands. Minimum 5 points required.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
