import { Controller, Post, Body, Get, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('businaro')
export class BusinaroController {
  
  // --- 1. DASHBOARD DATA ---
  @Get('dashboard/stats')
  // FIX: Aggiunto ': any' a req per risolvere l'errore TypeScript "implicit any"
  async getDashboardStats(@Request() req: any) {
    // Qui dovresti interrogare il DB (Prisma) usando req.user per il tenant
    
    return {
      kpi: {
        overdueValue: 31211.00,
        oee: 87.5,
        leadTime: 12,
        totalValue: 214390.00
      },
      activeJobs: [
        { id: "#427-012", client: "Ferrari SpA", project: "Alberi Motore V8", value: 53154.00, status: "In Lavorazione", progress: 65, due: "2gg" },
        { id: "#426-001", client: "Dallara", project: "Telaio Carbonio Part", value: 27114.00, status: "Controllo Qualità", progress: 90, due: "4gg" },
        { id: "#424-112", client: "Leonardo", project: "Componenti Avionici", value: 61223.00, status: "Materiale Mancante", progress: 15, due: "16gg", warning: true },
        { id: "#417-020", client: "Brembo", project: "Pinze Freno Proto", value: 7311.00, status: "Pianificato", progress: 0, due: "19gg" },
      ]
    };
  }

  // --- 2. MAGAZZINO: PICKING ---
  @Post('warehouse/pick')
  async pickItem(@Body() body: { jobOrderCode: string; sku: string; quantity: number }) {
    console.log(`[WMS] Picking: ${body.quantity}x ${body.sku} per Commessa ${body.jobOrderCode}`);
    
    // LOGICA REALE:
    // 1. Trova JobOrder (se non esiste -> Errore)
    // 2. Trova Stock Item (se qta insufficiente -> Errore)
    // 3. Decrementa Stock, Crea Transazione
    
    // Simuliamo successo
    return { success: true, message: "Prelievo registrato" };
  }

  // --- 3. MAGAZZINO: MOVE ---
  @Post('warehouse/move')
  async moveItem(@Body() body: { fromLocationCode: string; toLocationCode: string; sku: string; quantity: number }) {
    console.log(`[WMS] Move: ${body.sku} da ${body.fromLocationCode} a ${body.toLocationCode}`);
    return { success: true, message: "Spostamento effettuato" };
  }

  // --- 4. ASSEMBLAGGIO: CONSUME ---
  @Post('assembly/consume')
  async consumeItem(@Body() body: { jobOrderCode: string; sku: string; quantity: number }) {
     console.log(`[ASSEMBLY] Consumo: ${body.sku} su ${body.jobOrderCode}`);
     
     if (body.quantity > 100) {
        throw new HttpException('Quantità eccessiva per singolo consumo', HttpStatus.BAD_REQUEST);
     }

     return { success: true, newStock: 45 }; // Ritorna stock residuo simulato
  }

  // --- 5. MACCHINE UTENSILI: TRANSFORM ---
  @Post('production/machine-tools/transform')
  async transformItem(@Body() body: { sourceSku: string; targetSku: string; quantity: number }) {
     console.log(`[CNC] Trasformazione: ${body.sourceSku} -> ${body.targetSku}`);
     return { success: true, produced: body.targetSku };
  }
}