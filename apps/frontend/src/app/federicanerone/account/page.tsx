"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api"; // Assumo tu abbia questa lib
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Camera, Save, Loader2 } from "lucide-react";

export default function AccountPage() {
  const [loading, setLoading] = React.useState(false);
  
  // Stato del form
  const [fullName, setFullName] = React.useState("Federica Nerone"); // Valore iniziale mock o da API
  const [email, setEmail] = React.useState("m@example.com");
  
  // Stato immagine
  const [avatarUrl, setAvatarUrl] = React.useState(""); 
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Ref per l'input file nascosto
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Crea un URL temporaneo per l'anteprima
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Se c'è un file selezionato, caricalo
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        
        // Esempio chiamata API upload (adatta al tuo backend)
        // const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
        // const data = await res.json();
        
        console.log("Simulazione upload file:", selectedFile.name);
      }

      // 2. Aggiorna dati anagrafici
      const payload = {
        full_name: fullName,
        email: email,
      };
      
      // await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify(payload) });
      console.log("Simulazione salvataggio dati:", payload);

      alert("Profilo aggiornato con successo!");
      
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Gestisci le tue informazioni personali e la foto profilo.
        </p>
      </div>

      <Separator />

      {/* CARD PROFILO E IMMAGINE */}
      <Card>
        <CardHeader>
          <CardTitle>Profilo</CardTitle>
          <CardDescription>
            Queste informazioni saranno visibili sulla piattaforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* SEZIONE FOTO PROFILO */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-24 w-24 border-2 border-muted">
                {/* Mostra anteprima se esiste, altrimenti url corrente */}
                <AvatarImage src={previewUrl || avatarUrl} className="object-cover" />
                <AvatarFallback className="text-2xl">FN</AvatarFallback>
              </Avatar>
              
              {/* Overlay hover con icona fotocamera */}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white h-8 w-8" />
              </div>
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <h3 className="font-medium">Foto Profilo</h3>
              <p className="text-xs text-muted-foreground">
                Clicca sull'immagine per modificarla. <br/>
                JPG, PNG o WEBP. Max 2MB.
              </p>
              <div className="flex gap-2 justify-center sm:justify-start">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Carica nuova foto
                </Button>
                {previewUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewUrl(null);
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Rimuovi anteprima
                  </Button>
                )}
              </div>
              {/* Input file nascosto */}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <Separator />

          {/* SEZIONE DATI ANAGRAFICI */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullname">Nome Completo</Label>
              <Input 
                id="fullname" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Es. Federica Nerone" 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="m@example.com" 
              />
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex justify-end border-t bg-muted/20 px-6 py-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salva Modifiche
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}