"use client";

import React, { useEffect, useState } from "react";
import { Activity, Search } from "lucide-react";
import { tenantFetch } from "@/lib/tenant-fetch";
import { Input } from "@/components/ui/input";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulazione fetch o endpoint reale se esiste
    // tenantFetch("/api/superadmin/audit").then(...)
    setTimeout(() => {
        setLogs([
            { id: 1, action: "LOGIN_SUCCESS", actor: "admin@businaro.it", target: "-", time: new Date().toISOString(), ip: "192.168.1.1" },
            { id: 2, action: "TENANT_CREATED", actor: "superadmin", target: "Nuova Azienda Srl", time: new Date(Date.now() - 3600000).toISOString(), ip: "10.0.0.1" },
            { id: 3, action: "RESET_PASSWORD", actor: "superadmin", target: "user@federica.it", time: new Date(Date.now() - 86400000).toISOString(), ip: "10.0.0.1" },
        ]);
        setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Audit Log Globale</h1>
          <p className="text-slate-500 font-medium">Tracciamento azioni di sicurezza e modifiche sistema.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         {/* Toolbar */}
         <div className="p-4 border-b border-slate-100 flex gap-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cerca azione, email o IP..." className="pl-9 bg-slate-50 border-slate-200" />
            </div>
         </div>

         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
               <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Azione</th>
                  <th className="px-6 py-4">Chi (Actor)</th>
                  <th className="px-6 py-4">Target</th>
                  <th className="px-6 py-4">IP Address</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {loading ? (
                   <tr><td colSpan={5} className="p-8 text-center text-slate-400">Caricamento log...</td></tr>
               ) : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                        {new Date(log.time).toLocaleString()}
                     </td>
                     <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                           {log.action}
                        </span>
                     </td>
                     <td className="px-6 py-4 font-medium text-indigo-600">{log.actor}</td>
                     <td className="px-6 py-4 text-slate-600">{log.target}</td>
                     <td className="px-6 py-4 text-slate-400 font-mono text-xs">{log.ip}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}