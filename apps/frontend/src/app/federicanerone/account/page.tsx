"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { apiFetch } from "@/lib/api"; // --- MODIFICA VIP: Importato apiFetch ---
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Camera, 
  Loader2, 
  Lock, 
  Monitor, 
  LayoutTemplate, 
  Download, 
  Trash2,
  AlertTriangle 
} from "lucide-react";

// --- AGGIUNTA VIP: TIPO ---
type VipPeriod = "monthly" | "quarterly" | "semiannual" | "annual";

export default function AccountPage() {
  const [loading, setLoading] = React.useState(false);
  const { setTheme, theme } = useTheme();

  // --- STATO GENERALE ---
  const [fullName, setFullName] = React.useState("Federica Nerone");
  const [email, setEmail] = React.useState("m@example.com");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // --- STATO PASSWORD ---
  const [currentPwd, setCurrentPwd] = React.useState("");
  const [newPwd, setNewPwd] = React.useState("");
  const [confirmPwd, setConfirmPwd] = React.useState("");

  // --- STATO PREFERENZE ---
  const [defaultView, setDefaultView] = React.useState("calendar");

  // --- AGGIUNTA VIP: STATO ---
  const [vipPeriod, setVipPeriod] = React.useState<VipPeriod>("annual");
  const [vipThresholdEur, setVipThresholdEur] = React.useState("500"); // euro

  // --- MODIFICA VIP: Carica impostazioni dal DB al mount ---
  React.useEffect(() => {
    apiFetch<{ thresholdEur: number; period: string }>('/federicanerone/settings')
      .then((data) => {
        if (data) {
          setVipThresholdEur(data.thresholdEur.toString());
          setVipPeriod(data.period as VipPeriod);
        }
      })
      .catch((err) => console.error("Errore caricamento settings", err));
  }, []);

  // Handler Upload Foto
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  // Handler Salvataggio Generale
  const handleSaveGeneral = async () => {
    setLoading(true);
    try {
      console.log("Saving profile:", { fullName, email, file: selectedFile?.name });
      await new Promise((resolve) => setTimeout(resolve, 1000)); 
      alert("Profilo aggiornato con successo!");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Handler Cambio Password
  const handleChangePassword = async () => {
    if (newPwd !== confirmPwd) {
      alert("Le nuove password non coincidono.");
      return;
    }
    setLoading(true);
    try {
      console.log("Changing password...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Password modificata!");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- AGGIUNTA VIP: HANDLER REALE ---
  const handleSaveVipSettings = async () => {
    const n = Number(vipThresholdEur);
    if (!Number.isFinite(n) || n <= 0) {
      alert("Inserisci una soglia VIP valida (numero > 0).");
      return;
    }
  
    setLoading(true);
    try {
      // API call reale
      await apiFetch('/federicanerone/settings', {
        method: 'PUT',
        body: JSON.stringify({ thresholdEur: n, period: vipPeriod }),
      });
      alert("Impostazioni VIP salvate correttamente!");
    } catch (error) {
      console.error(error);
      alert("Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  // Handler Export Dati
  const handleExportData = () => {
    alert("Il download dei tuoi dati (JSON) inizierà a breve.");
  };

  // Handler Elimina Account
  const handleDeleteAccount = () => {
    const confirmText = prompt("Per confermare, scrivi 'CANCELLA' in maiuscolo:");
    if (confirmText === "CANCELLA") {
      alert("Account eliminato. Verrai reindirizzato al login.");
      // Qui logicamente faresti il logout e redirect
    } else if (confirmText !== null) {
      alert("Testo di conferma non valido.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Impostazioni Account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestisci il tuo profilo, la sicurezza e le preferenze dell'applicazione.
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="general">Generale</TabsTrigger>
          <TabsTrigger value="security">Sicurezza</TabsTrigger>
          <TabsTrigger value="preferences">Preferenze</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: GENERALE --- */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profilo Personale</CardTitle>
              <CardDescription>
                Informazioni visibili pubblicamente e dati di contatto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Foto Profilo */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-24 w-24 border-2 border-muted">
                    <AvatarImage src={previewUrl || avatarUrl} className="object-cover" />
                    <AvatarFallback className="text-2xl">FN</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white h-8 w-8" />
                  </div>
                </div>

                <div className="space-y-2 text-center sm:text-left">
                  <h3 className="font-medium">Foto Profilo</h3>
                  <p className="text-xs text-muted-foreground">
                    Clicca sull'immagine per caricarne una nuova.
                    <br /> Max 2MB (JPG, PNG).
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  {previewUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUrl(null);
                        setSelectedFile(null);
                      }}
                    >
                      Rimuovi anteprima
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Campi Input */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Nome Completo</Label>
                  <Input
                    id="fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/20 px-6 py-4">
              <Button onClick={handleSaveGeneral} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva Modifiche
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* --- TAB 2: SICUREZZA --- */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Password e Sicurezza</CardTitle>
              <CardDescription>
                Aggiorna la tua password per mantenere l'account sicuro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-pwd">Password Attuale</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="current-pwd"
                    type="password"
                    className="pl-9"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pwd">Nuova Password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-pwd"
                    type="password"
                    className="pl-9"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pwd">Conferma Nuova Password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-pwd"
                    type="password"
                    className="pl-9"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t bg-muted/20 px-6 py-4">
              <Button onClick={handleChangePassword} disabled={loading || !currentPwd || !newPwd}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aggiorna Password
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* --- TAB 3: PREFERENZE --- */}
        <TabsContent value="preferences" className="space-y-6">
          
          {/* Card: Interfaccia */}
          <Card>
            <CardHeader>
              <CardTitle>Aspetto e Interfaccia</CardTitle>
              <CardDescription>
                Personalizza la visualizzazione della piattaforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Tema */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base flex items-center gap-2">
                    <Monitor className="h-4 w-4" /> Tema
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Scegli tra tema chiaro o scuro.
                  </p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Seleziona tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Chiaro</SelectItem>
                    <SelectItem value="dark">Scuro</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />

              {/* Vista Default */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base flex items-center gap-2">
                    <LayoutTemplate className="h-4 w-4" /> Vista Iniziale
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Scegli la vista predefinita per gli appuntamenti.
                  </p>
                </div>
                <Select value={defaultView} onValueChange={setDefaultView}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Seleziona vista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar">Calendario</SelectItem>
                    <SelectItem value="list">Lista Elenco</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </CardContent>
          </Card>

          {/* --- AGGIUNTA VIP: CARD UI --- */}
          <Card>
            <CardHeader>
              <CardTitle>Clienti VIP</CardTitle>
              <CardDescription>
                Imposta come viene calcolato il badge VIP (frequenza e soglia di spesa).
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Frequenza</Label>
                  <Select value={vipPeriod} onValueChange={(v) => setVipPeriod(v as VipPeriod)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona frequenza" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensile</SelectItem>
                      <SelectItem value="quarterly">Trimestrale</SelectItem>
                      <SelectItem value="semiannual">Semestrale</SelectItem>
                      <SelectItem value="annual">Annuale</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    La spesa verrà considerata su questo periodo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Soglia VIP (EUR)</Label>
                  <Input
                    inputMode="decimal"
                    value={vipThresholdEur}
                    onChange={(e) => setVipThresholdEur(e.target.value)}
                    placeholder="Es. 500"
                  />
                  <p className="text-xs text-muted-foreground">
                    Superata la soglia nel periodo scelto, il cliente diventa VIP.
                  </p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-end border-t bg-muted/20 px-6 py-4">
              <Button onClick={handleSaveVipSettings} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva VIP
              </Button>
            </CardFooter>
          </Card>
          {/* --- FINE CARD VIP --- */}

          {/* Card: Zona Pericolo */}
          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-500 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Zona Pericolo
              </CardTitle>
              <CardDescription>
                Azioni irreversibili o relative alla privacy dei dati.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Esporta i tuoi dati</Label>
                  <p className="text-sm text-muted-foreground">
                    Scarica una copia di tutti i tuoi dati in formato JSON (GDPR).
                  </p>
                </div>
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="mr-2 h-4 w-4" />
                  Esporta
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base text-red-600">Elimina Account</Label>
                  <p className="text-sm text-muted-foreground">
                    Rimuove permanentemente l'account e tutti i dati associati.
                  </p>
                </div>
                <Button variant="destructive" onClick={handleDeleteAccount}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Elimina Account
                </Button>
              </div>

            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}