import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import type { McrFile, McrCommand } from '@shared/schema';

const keyboardLayout = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['CapsLock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Meta', 'Alt', 'Space', 'Alt', 'Meta', 'ContextMenu', 'Ctrl'],
];

const specialKeys: { [key: string]: string } = {
  'Backspace': 'w-20',
  'Tab': 'w-16',
  'CapsLock': 'w-20',
  'Enter': 'w-24',
  'Shift': 'w-28',
  'Ctrl': 'w-14',
  'Meta': 'w-14',
  'Alt': 'w-14',
  'Space': 'w-64',
  'ContextMenu': 'w-14',
};

export default function KeyboardEditor({ onExcludedKeysChange }: { onExcludedKeysChange: (keys: string[]) => void }) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [commands, setCommands] = useState<McrCommand[]>([]);
  const [excludedKeys, setExcludedKeys] = useState<string[]>([]);

  const { data: files, isLoading: isLoadingFiles } = useQuery<McrFile[]>({
    queryKey: ['/api/files'],
  });

  const { data: parsedCommands, isLoading: isLoadingCommands } = useQuery<McrCommand[]>({
    queryKey: ['/api/files', selectedFileId, 'parsed-content'],
    queryFn: async () => {
      if (!selectedFileId) return [];
      const response = await apiRequest('GET', `/api/files/${selectedFileId}/parsed-content`);
      return response.json();
    },
    enabled: !!selectedFileId,
  });

  // Update commands when a new file is loaded
  React.useEffect(() => {
    if (parsedCommands) {
      setCommands(parsedCommands);
    }
  }, [parsedCommands]);

  const handleToggleExcludeKey = (key: string) => {
    setExcludedKeys(prev => {
      const newExcludedKeys = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      onExcludedKeysChange(newExcludedKeys);
      return newExcludedKeys;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Visual Keyboard Editor</CardTitle>
        <div className="flex items-center space-x-2">
          <Select onValueChange={setSelectedFileId} value={selectedFileId || ""}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select an MCR file" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingFiles ? (
                <SelectItem value="loading" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading files...
                </SelectItem>
              ) : (
                files?.map((file) => (
                  <SelectItem key={file.id} value={file.id}>
                    {file.originalName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-1 p-4 bg-gray-100 rounded-lg shadow-inner">
          {keyboardLayout.map((row, rowIndex) => (
            <div key={rowIndex} className="flex space-x-1">
              {row.map((key, keyIndex) => (
                <Button
                  key={keyIndex}
                  variant={excludedKeys.includes(key) ? "destructive" : "outline"}
                  className={`h-10 flex items-center justify-center text-sm font-mono ${specialKeys[key] || 'w-10'}`}
                  onClick={() => handleToggleExcludeKey(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          ))}
        </div>

        {selectedFileId && isLoadingCommands && (
          <div className="mt-4 text-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" /> Loading commands...
          </div>
        )}

        
      </CardContent>
    </Card>
  );
}
