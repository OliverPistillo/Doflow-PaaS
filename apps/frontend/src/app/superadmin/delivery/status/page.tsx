"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Clock, Loader2, RefreshCw, Trash2, Edit, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { TaskCreateSheet } from "./components/TaskCreateSheet";

// --- Tipi ---
type Task = {
  id: string;
  name: string;
  serviceName: string;
  category: string;
  dueDate: string;
  priority: string;
  notes: string;
  status: string;
};

type ServiceGroup = {
  id: string;
  name: string;
  category: string;
  categoryColor: string;
  tasks: Task[];
};

// Configurazioni UI
const CATEGORY_COLORS: Record<string, string> = {
  "Marketing": "bg-emerald-100 text-emerald-700",
  "Digital Services": "bg-blue-100 text-blue-700",
  "Technical Services": "bg-sky-100 text-sky-700",
  "Content Creation": "bg-teal-100 text-teal-700",
  "Default": "bg-slate-100 text-slate-700"
};

// Mapping visivo degli stati
const STATUS_LABELS: Record<string, string> = {
  todo: "Da iniziare",
  inprogress: "In corso",
  review: "In revisione",
  done: "Completato"
};

const PRIORITY_STYLES: Record<string, string> = {
  Alta: "bg-orange-50 text-orange-700 border-orange-200",
  Media: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Bassa: "bg-slate-50 text-slate-700 border-slate-200",
  Urgente: "bg-red-50 text-red-700 border-red-200 font-bold",
};

export default function DeliveryStatusPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { ConfirmDialog, confirm } = useConfirm();
  
  // Stati per la modale (Sheet)
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // 1. Caricamento Dati
  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Task[]>("/superadmin/delivery/tasks");
      setTasks(res);
      
      const allGroups = new Set(res.map(t => t.serviceName));
      const initialExpanded: Record<string, boolean> = {};
      allGroups.forEach(g => initialExpanded[g] = true);
      setExpanded(prev => ({...initialExpanded, ...prev}));
    } catch (e) {
      console.error("Errore caricamento tasks", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // 2. Aggiornamento Stato
  const updateStatus = async (taskId: string, newStatus: string) => {
    // Aggiornamento OTTIMISTICO (cambia subito nel frontend)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      await apiFetch(`/superadmin/delivery/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      console.error("Errore aggiornamento stato", e);
      alert("Impossibile aggiornare lo stato. Ricarico i dati.");
      loadTasks(); // Se fallisce, ricarica i dati reali
    }
  };

  // 3. Gestione Eliminazione
  const deleteTask = async (taskId: string) => {
    const ok = await confirm({
      title: "Eliminare questo task?",
      description: "L'operazione è irreversibile.",
      confirmLabel: "Elimina",
      variant: "destructive",
    });
    if (!ok) return;
    try {
        await apiFetch(`/superadmin/delivery/tasks/${taskId}`, { method: "DELETE" });
        setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch(e) {
        console.error(e);
        alert("Errore eliminazione");
    }
  };

  // 4. Gestione Apertura Modifica
  const openEdit = (task: Task) => {
    setEditingTask(task);
    setIsSheetOpen(true);
  };

  const openCreate = () => {
    setEditingTask(null);
    setIsSheetOpen(true);
  };

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // 5. Raggruppamento Dati
  const groupedData: ServiceGroup[] = Object.values(
    tasks.reduce((acc, task) => {
      const key = task.serviceName;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          name: key,
          category: task.category,
          categoryColor: CATEGORY_COLORS[task.category] || CATEGORY_COLORS["Default"],
          tasks: []
        };
      }
      acc[key].tasks.push(task);
      return acc;
    }, {} as Record<string, ServiceGroup>)
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <ConfirmDialog />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stato del servizio</h1>
          <p className="text-slate-500 text-sm">Monitoraggio avanzamento task per categoria di servizio.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadTasks}>
                <RefreshCw className="h-4 w-4 mr-2" /> Aggiorna
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nuovo Task
            </Button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {loading && tasks.length === 0 ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600 h-8 w-8" /></div>
        ) : groupedData.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500 font-medium">Nessun task attivo.</p>
                <Button onClick={openCreate} variant="outline" className="mt-4">Crea il primo Task</Button>
            </div>
        ) : (
            groupedData.map((group) => (
            <div key={group.id} className="space-y-3">
                {/* Header Gruppo Servizio */}
                <div className="flex items-center gap-3 select-none group/header" onClick={() => toggle(group.id)}>
                    <button className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 group-hover/header:text-slate-700">
                        {expanded[group.id] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <h3 className="font-bold text-lg text-slate-800 cursor-pointer">{group.name}</h3>
                    <Badge variant="secondary" className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${group.categoryColor}`}>
                        {group.category}
                    </Badge>
                    <span className="text-xs text-slate-400 ml-auto mr-4">{group.tasks.length} task</span>
                </div>

                {/* Lista Task */}
                {expanded[group.id] && (
                <div className="ml-9 pl-4 border-l-2 border-slate-200 space-y-4 animate-in slide-in-from-top-1 duration-300">
                    {group.tasks.map((task) => (
                    <div key={task.id} className="space-y-2">
                        
                        {/* Selector Stato (sopra la card per accesso rapido) */}
                        <div className="flex items-center gap-2 mb-1">
                           <Select 
                              value={task.status} 
                              onValueChange={(val) => updateStatus(task.id, val)}
                           >
                             <SelectTrigger className={`h-7 w-[140px] text-xs border-slate-200 font-medium ${
                                task.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' : 
                                task.status === 'inprogress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-white text-slate-700'
                             }`}>
                               <SelectValue placeholder="Stato" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="todo">Da iniziare</SelectItem>
                               <SelectItem value="inprogress">In corso</SelectItem>
                               <SelectItem value="review">In revisione</SelectItem>
                               <SelectItem value="done">Completato</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                        
                        <Card className="p-0 overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow group/card">
                            <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_150px_120px_1fr] items-center gap-4 p-4 text-sm">
                                
                                {/* Task Name */}
                                <div className="flex items-center gap-3">
                                    <div className={`w-1 h-8 rounded-full transition-colors ${
                                        task.status === 'done' ? 'bg-green-500' : 
                                        task.status === 'inprogress' ? 'bg-blue-500' :
                                        task.status === 'review' ? 'bg-amber-500' :
                                        'bg-slate-300'
                                    }`}></div>
                                    <span className={`font-medium text-base cursor-pointer hover:text-indigo-600 ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`} onClick={() => openEdit(task)}>
                                        {task.name}
                                    </span>
                                </div>
                                
                                {/* Date */}
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="font-mono text-xs">
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('it-IT') : '-'}
                                    </span>
                                </div>

                                {/* Priority */}
                                <div>
                                    <Badge variant="outline" className={`text-xs px-2 py-0.5 ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES['Media']}`}>
                                        {task.priority}
                                    </Badge>
                                </div>

                                {/* Notes */}
                                <div className="text-slate-500 truncate text-xs italic hidden md:block max-w-[200px]">
                                    {task.notes}
                                </div>
                            </div>
                            
                            {/* Footer azioni */}
                            <div className="px-4 py-1.5 bg-slate-50/50 border-t border-slate-100 flex justify-end items-center gap-2">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs text-slate-500 hover:text-indigo-600 px-2"
                                    onClick={() => openEdit(task)}
                                >
                                    <Edit className="h-3.5 w-3.5 mr-1" /> Modifica
                                </Button>
                                <div className="h-4 w-px bg-slate-200"></div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs text-slate-400 hover:text-red-600 px-2"
                                    onClick={() => deleteTask(task.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
                                </Button>
                            </div>
                        </Card>
                    </div>
                    ))}
                </div>
                )}
            </div>
            ))
        )}
      </div>

      {/* Componente Sheet Unico per Create/Edit */}
      <TaskCreateSheet 
        isOpen={isSheetOpen} 
        onClose={() => { setIsSheetOpen(false); setEditingTask(null); }} 
        onSuccess={loadTasks} 
        taskToEdit={editingTask}
      />

    </div>
  );
}