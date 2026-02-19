"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, CheckCircle2, Circle, Clock, AlertCircle,
  MoreHorizontal, Star, Trash2, CalendarDays, Filter,
  ArrowUpDown, Loader2, ChevronDown, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type TaskStatus   = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Task {
  id:          string;
  title:       string;
  description: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  assignee:    string;
  due_date:    string;
  tags:        string[];
  starred:     boolean;
  created_at:  string;
}

// ─── Demo data (sostituire con API reali) ───────────────────────────────────

const DEMO_TASKS: Task[] = [
  { id: "t1", title: "Redesign landing page", description: "Aggiornare il layout e i componenti della landing page", status: "in_progress", priority: "high", assignee: "Marco R.", due_date: "2026-02-22", tags: ["Design", "Frontend"], starred: true, created_at: "2026-02-10T10:00:00Z" },
  { id: "t2", title: "Setup CI/CD pipeline", description: "Configurare GitHub Actions per deploy automatico", status: "done", priority: "medium", assignee: "Giulia B.", due_date: "2026-02-18", tags: ["DevOps"], starred: false, created_at: "2026-02-08T09:00:00Z" },
  { id: "t3", title: "Scrivere documentazione API", description: "Documentare tutti gli endpoint REST con Swagger", status: "todo", priority: "low", assignee: "Luca P.", due_date: "2026-02-25", tags: ["Docs"], starred: false, created_at: "2026-02-12T14:00:00Z" },
  { id: "t4", title: "Migrazione database PostgreSQL", description: "Migrare le tabelle principali dalla vecchia struttura", status: "in_progress", priority: "high", assignee: "Sara M.", due_date: "2026-02-20", tags: ["Backend", "DB"], starred: true, created_at: "2026-02-05T08:00:00Z" },
  { id: "t5", title: "User onboarding flow", description: "Creare il flusso di onboarding per nuovi utenti", status: "todo", priority: "high", assignee: "Marco R.", due_date: "2026-02-28", tags: ["UX", "Frontend"], starred: false, created_at: "2026-02-14T11:00:00Z" },
  { id: "t6", title: "Performance audit", description: "Analisi delle performance dell'applicazione", status: "todo", priority: "medium", assignee: "Giulia B.", due_date: "2026-03-01", tags: ["DevOps"], starred: false, created_at: "2026-02-15T16:00:00Z" },
  { id: "t7", title: "Sistema template email", description: "Creare template email personalizzabili per le notifiche", status: "done", priority: "low", assignee: "Luca P.", due_date: "2026-02-15", tags: ["Backend"], starred: false, created_at: "2026-02-01T10:00:00Z" },
  { id: "t8", title: "Fix responsive mobile", description: "Correggere i problemi di layout su schermi piccoli", status: "in_progress", priority: "medium", assignee: "Sara M.", due_date: "2026-02-21", tags: ["Frontend"], starred: true, created_at: "2026-02-11T13:00:00Z" },
  { id: "t9", title: "Integrazione pagamenti Stripe", description: "Collegare il sistema di billing con Stripe", status: "todo", priority: "urgent", assignee: "Marco R.", due_date: "2026-02-19", tags: ["Backend", "Billing"], starred: true, created_at: "2026-02-13T09:00:00Z" },
  { id: "t10", title: "Test end-to-end", description: "Scrivere test E2E con Playwright per i flussi principali", status: "todo", priority: "medium", assignee: "Giulia B.", due_date: "2026-03-05", tags: ["Testing"], starred: false, created_at: "2026-02-16T15:00:00Z" },
];

// ─── Config ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string; bgColor: string }> = {
  todo:        { label: "Da fare",     icon: Circle,       color: "text-muted-foreground", bgColor: "bg-muted" },
  in_progress: { label: "In corso",    icon: Clock,        color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  done:        { label: "Completato",  icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  low:    { label: "Bassa",   color: "text-sky-600 dark:text-sky-400",     bgColor: "bg-sky-100 dark:bg-sky-900/30" },
  medium: { label: "Media",   color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  high:   { label: "Alta",    color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  urgent: { label: "Urgente", color: "text-red-600 dark:text-red-400",      bgColor: "bg-red-100 dark:bg-red-900/30" },
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks]                 = useState<Task[]>(DEMO_TASKS);
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState<"all" | TaskStatus>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | TaskPriority>("all");
  const [showCreate, setShowCreate]       = useState(false);
  const [newTask, setNewTask]             = useState({ title: "", description: "", priority: "medium" as TaskPriority, assignee: "", due_date: "" });
  const { toast } = useToast();

  // ── Filtered tasks ──
  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Stats ──
  const counts = {
    all:         tasks.length,
    todo:        tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done:        tasks.filter((t) => t.status === "done").length,
  };
  const completionPct = tasks.length > 0 ? Math.round((counts.done / tasks.length) * 100) : 0;

  // ── Actions ──
  const toggleStar = (id: string) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, starred: !t.starred } : t));

  const cycleStatus = (id: string) => {
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const idx = STATUS_ORDER.indexOf(t.status);
        return { ...t, status: STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] };
      }),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    toast({ title: "Task eliminato" });
  };

  const handleCreate = () => {
    if (!newTask.title.trim()) return;
    const task: Task = {
      id:          `t${Date.now()}`,
      title:       newTask.title,
      description: newTask.description,
      status:      "todo",
      priority:    newTask.priority,
      assignee:    newTask.assignee || "Non assegnato",
      due_date:    newTask.due_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      tags:        [],
      starred:     false,
      created_at:  new Date().toISOString(),
    };
    setTasks((ts) => [task, ...ts]);
    setNewTask({ title: "", description: "", priority: "medium", assignee: "", due_date: "" });
    setShowCreate(false);
    toast({ title: "Task creato", description: task.title });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Task</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestisci e monitora le attività del team
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="mr-1.5 h-4 w-4" /> Nuovo Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold">{counts.all}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Totali</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-muted-foreground">{counts.todo}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Da fare</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.in_progress}</div>
            <p className="text-xs text-muted-foreground mt-0.5">In corso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{counts.done}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Completati</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{completionPct}%</span>
                <Progress value={completionPct} className="h-1.5 w-16 mt-1 [&>div]:bg-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
          <TabsList>
            <TabsTrigger value="all">Tutti ({counts.all})</TabsTrigger>
            <TabsTrigger value="todo">Da fare</TabsTrigger>
            <TabsTrigger value="in_progress">In corso</TabsTrigger>
            <TabsTrigger value="done">Completati</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as typeof filterPriority)}>
          <SelectTrigger className="w-[140px]">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            <SelectValue placeholder="Priorità" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Bassa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Priorità</TableHead>
              <TableHead>Assegnato</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nessun task trovato
                </TableCell>
              </TableRow>
            )}
            {filtered.map((task) => {
              const sc = STATUS_CONFIG[task.status];
              const pc = PRIORITY_CONFIG[task.priority];
              const StatusIcon = sc.icon;
              const isOverdue = task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);

              return (
                <TableRow key={task.id} className="group">
                  <TableCell>
                    <button onClick={() => toggleStar(task.id)} className="opacity-60 hover:opacity-100 transition-opacity">
                      <Star className={`h-4 w-4 ${task.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </div>
                      {task.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {task.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => cycleStatus(task.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${sc.color} ${sc.bgColor} hover:opacity-80`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {sc.label}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${pc.color} ${pc.bgColor}`}>
                      {pc.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                          {task.assignee.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{task.assignee}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm flex items-center gap-1.5 ${isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(task.due_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => cycleStatus(task.id)}>
                          Cambia stato
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStar(task.id)}>
                          {task.starred ? "Rimuovi stella" : "Aggiungi stella"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteTask(task.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nuovo Task</DialogTitle>
            <DialogDescription>Crea una nuova attività per il team.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Titolo *</Label>
              <Input
                id="task-title"
                placeholder="Es. Implementare feature X"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-desc">Descrizione</Label>
              <Textarea
                id="task-desc"
                placeholder="Descrivi il task..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Priorità</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as TaskPriority })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-due">Scadenza</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-assignee">Assegna a</Label>
              <Input
                id="task-assignee"
                placeholder="Nome collaboratore"
                value={newTask.assignee}
                onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annulla</Button>
            <Button
              onClick={handleCreate}
              disabled={!newTask.title.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Crea Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
