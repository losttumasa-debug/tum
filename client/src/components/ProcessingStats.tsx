import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";

interface ProcessingStats {
  totalFiles: number;
  completed: number;
  processing: number;
  failed: number;
  pending: number;
}

export default function ProcessingStats() {
  const { data: stats } = useQuery<ProcessingStats>({
    queryKey: ['/api/stats'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (!stats) {
    return null;
  }

  const statItems = [
    {
      label: "Total Files",
      value: stats.totalFiles,
      icon: Upload,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      testId: "stat-total-files"
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      testId: "stat-completed"
    },
    {
      label: "Processing",
      value: stats.processing,
      icon: Clock,
      bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600",
      testId: "stat-processing"
    },
    {
      label: "Failed",
      value: stats.failed,
      icon: XCircle,
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
      testId: "stat-failed"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${item.bgColor} rounded-md flex items-center justify-center`}>
                <item.icon className={`w-4 h-4 ${item.iconColor}`} />
              </div>
              <div>
                <p 
                  className="text-2xl font-semibold text-foreground" 
                  data-testid={item.testId}
                >
                  {item.value}
                </p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
