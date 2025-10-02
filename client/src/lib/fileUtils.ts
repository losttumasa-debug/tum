export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  } else {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }
}

export function validateMcrFile(file: File): { valid: boolean; error?: string } {
  if (!file.name.toLowerCase().endsWith('.mcr')) {
    return { valid: false, error: 'File must have .mcr extension' };
  }
  
  if (file.size > 10 * 1024 * 1024) { // 10MB
    return { valid: false, error: 'File size must be less than 10MB' };
  }
  
  if (file.size === 0) {
    return { valid: false, error: 'File cannot be empty' };
  }
  
  return { valid: true };
}

export function extractMcrMetadata(content: string): {
  totalCommands: number;
  estimatedDuration: number;
  keyboardCommands: number;
  mouseCommands: number;
  delays: number;
} {
  const lines = content.split('\n');
  let keyboardCommands = 0;
  let mouseCommands = 0;
  let delays = 0;
  let totalDelay = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    if (trimmed.startsWith('Keyboard :')) {
      keyboardCommands++;
    } else if (trimmed.startsWith('Mouse :')) {
      mouseCommands++;
    } else if (trimmed.startsWith('DELAY :')) {
      delays++;
      const match = trimmed.match(/DELAY : (\d+)/);
      if (match) {
        totalDelay += parseInt(match[1]);
      }
    }
  }

  return {
    totalCommands: keyboardCommands + mouseCommands + delays,
    estimatedDuration: totalDelay,
    keyboardCommands,
    mouseCommands,
    delays
  };
}
