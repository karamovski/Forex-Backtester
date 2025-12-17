import { useState } from "react";
import {
  Save,
  FolderOpen,
  Trash2,
  Check,
  X,
  Edit2,
  Settings2,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useBacktestStore } from "@/lib/backtest-store";
import {
  getSavedConfigs,
  saveConfig,
  deleteConfig,
  updateConfig,
  type SavedConfig,
} from "@/lib/saved-configs";
import { useToast } from "@/hooks/use-toast";

export default function Configs() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SavedConfig[]>(getSavedConfigs());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState("");
  const [newConfigDesc, setNewConfigDesc] = useState("");

  const {
    tickFormat,
    signalFormat,
    signalFormatPattern,
    strategy,
    risk,
    gmtOffset,
    setTickFormat,
    setSignalFormat,
    setSignalFormatPattern,
    setStrategy,
    setRisk,
    setGmtOffset,
  } = useBacktestStore();

  const refreshConfigs = () => {
    setConfigs(getSavedConfigs());
  };

  const handleSaveConfig = () => {
    if (!newConfigName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your configuration",
        variant: "destructive",
      });
      return;
    }

    saveConfig({
      name: newConfigName.trim(),
      description: newConfigDesc.trim(),
      tickFormat,
      signalFormat,
      signalFormatPattern,
      strategy,
      risk,
      gmtOffset,
    });

    setNewConfigName("");
    setNewConfigDesc("");
    setSaveDialogOpen(false);
    refreshConfigs();
    toast({
      title: "Configuration Saved",
      description: `"${newConfigName}" has been saved`,
    });
  };

  const handleLoadConfig = (config: SavedConfig) => {
    if (config.tickFormat) setTickFormat(config.tickFormat);
    if (config.signalFormat) setSignalFormat(config.signalFormat);
    if (config.signalFormatPattern) setSignalFormatPattern(config.signalFormatPattern);
    setStrategy(config.strategy);
    setRisk(config.risk);
    setGmtOffset(config.gmtOffset);

    toast({
      title: "Configuration Loaded",
      description: `"${config.name}" settings applied`,
    });
  };

  const handleDeleteConfig = (id: string, name: string) => {
    deleteConfig(id);
    refreshConfigs();
    toast({
      title: "Configuration Deleted",
      description: `"${name}" has been removed`,
    });
  };

  const startEditing = (config: SavedConfig) => {
    setEditingId(config.id);
    setEditName(config.name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateConfig(editingId, { name: editName.trim() });
      refreshConfigs();
    }
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const hasCurrentConfig = tickFormat || signalFormat || strategy.activeTPs.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Saved Configurations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Save and load your backtest settings for quick reuse
          </p>
        </div>
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!hasCurrentConfig} data-testid="button-save-config">
              <Save className="h-4 w-4" />
              Save Current
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Configuration</DialogTitle>
              <DialogDescription>
                Save your current tick format, signal format, strategy, and risk settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="config-name">Name</Label>
                <Input
                  id="config-name"
                  value={newConfigName}
                  onChange={(e) => setNewConfigName(e.target.value)}
                  placeholder="My Strategy Settings"
                  data-testid="input-config-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-desc">Description (optional)</Label>
                <Textarea
                  id="config-desc"
                  value={newConfigDesc}
                  onChange={(e) => setNewConfigDesc(e.target.value)}
                  placeholder="Description of this configuration..."
                  className="resize-none"
                  rows={3}
                  data-testid="input-config-desc"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveConfig} data-testid="button-confirm-save">
                Save Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-center">No Saved Configurations</h2>
            <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
              Configure your tick format, signals, strategy, and risk settings, then save them here for quick reuse.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => {
            const isEditing = editingId === config.id;
            return (
              <Card key={config.id} className="flex flex-col" data-testid={`config-card-${config.id}`}>
                <CardHeader className="pb-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{config.name}</CardTitle>
                        {config.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {config.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => startEditing(config)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {config.tickFormat && (
                      <Badge variant="secondary" className="text-xs">Tick Format</Badge>
                    )}
                    {config.signalFormat && (
                      <Badge variant="secondary" className="text-xs">Signal Format</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {config.strategy.activeTPs.length} TPs
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      ${config.risk.initialBalance.toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saved {new Date(config.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
                <div className="flex items-center gap-2 p-4 pt-0">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => handleLoadConfig(config)}
                    data-testid={`button-load-${config.id}`}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Load
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        data-testid={`button-delete-${config.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete configuration?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{config.name}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteConfig(config.id, config.name)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Current Settings Preview</CardTitle>
          <CardDescription>Your active configuration that will be saved</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-3 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Tick Format</div>
              <div className="text-sm font-medium mt-1">
                {tickFormat ? `Cols: ${tickFormat.dateColumn},${tickFormat.timeColumn},${tickFormat.bidColumn},${tickFormat.askColumn}` : "Not configured"}
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Signal Format</div>
              <div className="text-sm font-medium mt-1">
                {signalFormat ? "Configured" : "Not configured"}
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Active TPs</div>
              <div className="flex gap-1 mt-1">
                {strategy.activeTPs.map((tp) => (
                  <Badge key={tp} variant="secondary" className="text-xs">TP{tp}</Badge>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Risk Settings</div>
              <div className="text-sm font-medium mt-1">
                ${risk.initialBalance.toLocaleString()} / {risk.riskType === "percentage" ? `${risk.riskPercentage}%` : risk.riskType === "fixed_lot" ? `${risk.fixedLotSize} lots` : "Rule-based"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
