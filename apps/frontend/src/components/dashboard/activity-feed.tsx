'use client';

import { useNotifications } from '@/hooks/useNotifications';
import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, FileText, Shield, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ActivityItem = {
  id: string;
  action: string;
  actor_email: string;
  timestamp: string;
  metadata?: any;
};

// Helper per icone dinamiche
function getIconForAction(action: string) {
  if (action.includes('FILE')) return <FileText className="h-4 w-4 text-blue-500" />;
  if (action.includes('LOGIN') || action.includes('AUTH')) return <Shield className="h-4 w-4 text-green-500" />;
  return <Activity className="h-4 w-4 text-slate-500" />;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const { events } = useNotifications();

  // Ascolta WebSocket
  useEffect(() => {
    const lastEvent = events[events.length - 1];
    // Controlla se l'evento è un aggiornamento del feed
    if (lastEvent?.type === 'tenant_notification' && (lastEvent.payload as any).type === 'activity_feed_update') {
      const newActivity = (lastEvent.payload as any).payload;
      
      // Aggiungi in cima e mantieni solo gli ultimi 20
      setActivities(prev => {
        // Evita duplicati basati su ID se arrivano burst
        if (prev.some(a => a.id === newActivity.id)) return prev;
        return [
            {
                id: newActivity.id,
                action: newActivity.action,
                actor_email: newActivity.actor_email,
                timestamp: newActivity.created_at,
                metadata: newActivity.metadata
            }, 
            ...prev
        ].slice(0, 20);
      });
    }
  }, [events]);

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-4">
            {activities.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">In attesa di eventi...</p>
            )}
            {activities.map((act) => (
              <div key={act.id} className="flex gap-3 items-start pb-3 border-b border-slate-100 last:border-0">
                <div className="mt-1 bg-slate-50 p-1.5 rounded-full border">
                    {getIconForAction(act.action)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {act.actor_email}
                  </p>
                  <p className="text-xs text-slate-500">
                    ha eseguito <span className="font-mono text-xs font-semibold bg-slate-100 px-1 rounded">{act.action}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}