"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Task = {
  id: string;
  name: string;
  dueDate: string;
  priority: "Alta" | "Media" | "Bassa" | "Urgente";
  notes: string;
  status: "todo" | "inprogress" | "review" | "done";
};

type ServiceGroup = {
  id: string;
  name: string;
  category: string;
  categoryColor: string;
  tasks: Task[];
};

const DATA: ServiceGroup[] = [
  {
    id: "smm",
    name: "Social Media Management",
    category: "Marketing",
    categoryColor: "bg-emerald-100 text-emerald-700",
    tasks: [
      { id: "t1", name: "Update client on progress", dueDate: "12/06/2026", priority: "Media", notes: "Send weekly progress...", status: "todo" }
    ]
  },
  {
    id: "web",
    name: "Website Design",
    category: "Digital Services",
    categoryColor: "bg-blue-100 text-blue-700",
    tasks: [
      { id: "t2", name: "Prepare project kickoff meeting", dueDate: "10/06/2026", priority: "Alta", notes: "Schedule and prepare...", status: "inprogress" }
    ]
  },
  {
    id: "itsup",
    name: "IT Support",
    category: "Technical Services",
    categoryColor: "bg-sky-100 text-sky-700",
    tasks: [
      { id: "t3", name: "Design homepage mockup", dueDate: "15/06/2026", priority: "Alta", notes: "Submit homepage design...", status: "review" }
    ]
  },
  {
    id: "copy",
    name: "Copywriting",
    category: "Content Creation",
    categoryColor: "bg-teal-100 text-teal-700",
    tasks: [
      { id: "t4", name: "Fix login bug", dueDate: "09/06/2026", priority: "Urgente", notes: "Resolved user login issue...", status: "done" }
    ]
  }
];

const STATUS_BADGES: Record<string, React.ReactNode> = {
  todo: <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-200">Da iniziare</Badge>,
  inprogress: <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">In corso</Badge>,
  review: <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200">In revisione</Badge>,
  done: <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">Completato</Badge>,
};

const PRIORITY_STYLES: Record<string, string> = {
  Alta: "bg-orange-100 text-orange-700 border-orange-200",
  Media: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Bassa: "bg-slate-100 text-slate-700 border-slate-200",
  Urgente: "bg-red-100 text-red-700 border-red-200 font-bold",
};

export default function DeliveryStatusPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    DATA.reduce((acc, curr) => ({ ...acc, [curr.id]: true }), {})
  );

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stato del servizio</h1>
          <p className="text-slate-500 text-sm">Monitoraggio avanzamento task per categoria di servizio.</p>
        </div>
      </div>

      <div className="space-y-8">
        {DATA.map((group) => (
          <div key={group.id} className="space-y-3">
            {/* Header Gruppo Servizio */}
            <div className="flex items-center gap-3">
              <button onClick={() => toggle(group.id)} className="p-1 hover:bg-slate-200 rounded-md transition-colors">
                {expanded[group.id] ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              </button>
              <h3 className="font-bold text-lg text-slate-800">{group.name}</h3>
              <Badge variant="secondary" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${group.categoryColor}`}>
                {group.category}
              </Badge>
            </div>

            {/* Lista Task */}
            {expanded[group.id] && (
              <div className="ml-8 pl-4 border-l-2 border-slate-200 space-y-4">
                {group.tasks.map((task) => (
                  <div key={task.id} className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      {STATUS_BADGES[task.status]}
                      <span className="text-xs text-slate-400 ml-1">{group.tasks.length}</span>
                    </div>
                    
                    <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
                      <div className="grid grid-cols-[1fr_150px_120px_1fr] items-center gap-4 p-4 text-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${task.status === 'done' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                          <span className="font-medium text-slate-700">{task.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="font-mono text-xs">{task.dueDate}</span>
                        </div>

                        <div>
                          <Badge variant="outline" className={`text-xs px-2 py-0.5 border ${PRIORITY_STYLES[task.priority]}`}>
                            {task.priority}
                          </Badge>
                        </div>

                        <div className="text-slate-500 truncate text-xs italic">
                          {task.notes}
                        </div>
                      </div>
                      <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-100">
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-400 hover:text-indigo-600 px-0">
                          <Plus className="h-3 w-3 mr-1" /> Add record
                        </Button>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}