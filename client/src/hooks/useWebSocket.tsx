import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { McrFile } from '@shared/schema';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//localhost:5000/ws`;
    
    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'fileUploaded':
              queryClient.invalidateQueries({ queryKey: ['/api/files'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              break;
              
            case 'processingStarted':
              queryClient.invalidateQueries({ queryKey: ['/api/files'] });
              toast({
                title: "Processing started",
                description: "Your file is being processed.",
              });
              break;
              
            case 'processingProgress':
              queryClient.setQueryData<McrFile[]>(['/api/files'], (oldData) => {
                if (!oldData) return [];
                return oldData.map(file => 
                  file.id === data.fileId 
                    ? { ...file, processingProgress: data.progress, status: 'processing' } 
                    : file
                );
              });
              break;
              
            case 'processingCompleted':
              queryClient.invalidateQueries({ queryKey: ['/api/files'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              toast({
                title: "Processing completed",
                description: "Your file has been successfully humanized and is ready for download.",
              });
              break;
              
            case 'processingFailed':
              queryClient.invalidateQueries({ queryKey: ['/api/files'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              toast({
                title: "Processing failed",
                description: data.error || "An error occurred during processing.",
                variant: "destructive",
              });
              break;
              
            case 'fileDeleted':
              queryClient.invalidateQueries({ queryKey: ['/api/files'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              break;
              
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient, toast]);

  return wsRef.current;
}
