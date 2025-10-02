import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FileUpload from "@/components/FileUpload";
import FileManagement from "@/components/FileManagement";
import ProcessingStats from "@/components/ProcessingStats";
import ProcessingQueueView from "@/components/ProcessingQueueView";
import DownloadsView from "@/components/DownloadsView";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { 
  Upload,
  Files,
  Activity,
  Download,
  FileText,
  Moon,
  Sun,
  User,
  Keyboard
} from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("upload");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  console.log('Active Tab:', activeTab);

  // WebSocket for real-time updates
  useWebSocket();

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const sidebarItems = [
    { id: "upload", label: "Upload Files", icon: Upload },
    { id: "management", label: "File Management", icon: Files },
    { id: "queue", label: "Processing Queue", icon: Activity },
    { id: "downloads", label: "Downloads", icon: Download },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-lg text-foreground">MCR Humanizer</h1>
                <p className="text-sm text-muted-foreground">File Processing</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="flex-1 p-4">
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveTab(item.id)}
                    isActive={activeTab === item.id}
                    data-testid={`nav-${item.id}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span data-testid="connection-status">Connected</span>
            </div>
          </div>
        </Sidebar>

        <SidebarInset className="flex-1">
          <header className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {activeTab === "upload" && "MCR File Upload"}
                    {activeTab === "management" && "File Management"}
                    {activeTab === "queue" && "Processing Queue"}
                    {activeTab === "downloads" && "Downloads"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "upload" && "Upload and humanize your macro files"}
                    {activeTab === "management" && "Manage your uploaded files"}
                    {activeTab === "queue" && "Monitor processing status"}
                    {activeTab === "downloads" && "Download processed files"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={toggleTheme}
                  data-testid="theme-toggle"
                >
                  {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </Button>
                <div className="flex items-center gap-2 p-2 rounded-md border border-border">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium" data-testid="user-name">User</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              {activeTab === "upload" && (
                <>
                  <FileUpload />
                  <ProcessingStats />
                </>
              )}
              
              {activeTab === "management" && (
                <>
                  <ProcessingStats />
                  <FileManagement />
                </>
              )}

              {activeTab === "queue" && (
                <ProcessingQueueView />
              )}

              {activeTab === "downloads" && (
                <DownloadsView />
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
