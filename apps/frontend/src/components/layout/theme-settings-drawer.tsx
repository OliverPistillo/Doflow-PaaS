"use client";

/**
 * ThemeSettingsDrawer — Ported from shadcn-admin/config-drawer
 * Selectors: Theme (light/dark/system), Sidebar style, Layout collapsible
 */

import { type SVGProps } from "react";
import { Settings, CircleCheck, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { Root as RadioGroup, Item as RadioItem } from "@radix-ui/react-radio-group";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar";
import {
  useAppSettings,
  type SidebarVariant,
  type SidebarCollapsible,
} from "@/contexts/AppSettingsContext";
import { cn } from "@/lib/utils";

// ─── SVG Icons (ported from shadcn-admin) ─────────────────────────────────────

function IconThemeSystem(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14"
      className={cn("overflow-hidden rounded-[6px]", props.className)} {...props}>
      <path opacity={0.2} d="M0 0.03H22.88V51.17H0z"/>
      <circle cx={6.7} cy={7.04} r={3.54} fill="#fff" opacity={0.8}/>
      <path d="M18.12 6.39h-5.87c-.6 0-1.09-.45-1.09-1s.49-1 1.09-1h5.87c.6 0 1.09.45 1.09 1s-.49 1-1.09 1zM16.55 9.77h-4.24c-.55 0-1-.45-1-1s.45-1 1-1h4.24c.55 0 1 .45 1 1s-.45 1-1 1z" fill="#fff" opacity={0.75}/>
      <path d="M18.32 17.37H4.59c-.69 0-1.25-.47-1.25-1.05s.56-1.05 1.25-1.05h13.73c.69 0 1.25.47 1.25 1.05s-.56 1.05-1.25 1.05z" fill="#fff" opacity={0.72}/>
      <rect x={33.36} y={19.73} width={2.75} height={3.42} rx={0.33} opacity={0.31}/>
      <rect x={29.64} y={16.57} width={2.75} height={6.58} rx={0.33} opacity={0.4}/>
      <rect x={37.16} y={14.44} width={2.75} height={8.7} rx={0.33} opacity={0.26}/>
      <rect x={41.19} y={10.75} width={2.75} height={12.4} rx={0.33} opacity={0.37}/>
      <circle cx={62.74} cy={16.32} r={8} opacity={0.25}/>
      <path d="M62.74 16.32l4.1-6.87c1.19.71 2.18 1.72 2.86 2.92s1.04 2.57 1.04 3.95h-8z" opacity={0.45}/>
      <rect x={29.64} y={27.75} width={41.62} height={18.62} rx={1.69} opacity={0.3}/>
    </svg>
  );
}

function IconThemeLight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <rect x={0.53} y={0.5} width={78.83} height={50.14} rx={3.5} fill="#d9d9d9"/>
      <path d="M22.88 0h52.97c2.21 0 4 1.79 4 4v43.14c0 2.21-1.79 4-4 4H22.88V0z" fill="#ecedef"/>
      <circle cx={6.7} cy={7.04} r={3.54} fill="#fff"/>
      <path d="M18.32 17.37H4.59c-.69 0-1.25-.47-1.25-1.05s.56-1.05 1.25-1.05h13.73c.69 0 1.25.47 1.25 1.05s-.56 1.05-1.25 1.05z" fill="#fff"/>
      <rect x={29.64} y={27.75} width={41.62} height={18.62} rx={1.69} fill="#fff"/>
      <circle cx={62.74} cy={16.32} r={8} fill="#fff"/>
    </svg>
  );
}

function IconThemeDark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <rect x={0.53} y={0.5} width={78.83} height={50.14} rx={3.5} fill="#1d2b3f"/>
      <path d="M22.88 0h52.97c2.21 0 4 1.79 4 4v43.14c0 2.21-1.79 4-4 4H22.88V0z" fill="#0d1628"/>
      <circle cx={6.7} cy={7.04} r={3.54} fill="#426187"/>
      <rect x={29.64} y={27.75} width={41.62} height={18.62} rx={1.69} fill="#17273f"/>
      <circle cx={62.74} cy={16.32} r={8} fill="#2f5491" opacity={0.5}/>
    </svg>
  );
}

function IconSidebarInset(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <rect x={23.39} y={5.57} width={50.22} height={40} rx={2} opacity={0.2} strokeLinecap="round" strokeMiterlimit={10}/>
      <path fill="none" opacity={0.72} strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2px" d="M5.08 17.05L17.31 17.05"/>
      <path fill="none" opacity={0.48} strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2px" d="M5.08 24.25L15.6 24.25"/>
      <g strokeLinecap="round" strokeMiterlimit={10}>
        <circle cx={7.04} cy={9.57} r={2.54} opacity={0.8}/>
        <path fill="none" opacity={0.8} strokeWidth="2px" d="M11.59 8.3L17.31 8.3"/>
      </g>
    </svg>
  );
}

function IconSidebarFloating(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <rect x={5.89} y={5.15} width={19.74} height={40} rx={2} opacity={0.8} strokeLinecap="round" strokeMiterlimit={10}/>
      <g stroke="#fff" strokeLinecap="round" strokeMiterlimit={10}>
        <path fill="none" opacity={0.72} strokeWidth="2px" d="M9.81 18.36L22.04 18.36"/>
        <circle cx={11.76} cy={10.88} r={2.54} fill="#fff" opacity={0.8}/>
      </g>
      <rect x={29.94} y={19.28} width={43.11} height={25.87} rx={2} opacity={0.3} strokeLinecap="round" strokeMiterlimit={10}/>
    </svg>
  );
}

function IconSidebarSidebar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <path d="M23.42.51h51.99c2.21 0 4 1.79 4 4v42.18c0 2.21-1.79 4-4 4H23.42s-.04-.02-.04-.04V.55s.02-.04.04-.04z" opacity={0.2} strokeLinecap="round" strokeMiterlimit={10}/>
      <path fill="none" opacity={0.72} strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2px" d="M5.56 14.88L17.78 14.88"/>
      <path fill="none" opacity={0.48} strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2px" d="M5.56 22.09L16.08 22.09"/>
      <g strokeLinecap="round" strokeMiterlimit={10}>
        <circle cx={7.51} cy={7.4} r={2.54} opacity={0.8}/>
        <path fill="none" opacity={0.8} strokeWidth="2px" d="M12.06 6.14L17.78 6.14"/>
      </g>
    </svg>
  );
}

function IconLayoutDefault(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <g strokeLinecap="round" strokeMiterlimit={10}>
        <rect x={5.84} y={5.02} width={19.14} height={40} rx={2} opacity={0.8}/>
        <g stroke="#fff">
          <path fill="none" opacity={0.72} strokeWidth="2px" d="M9.02 17.39L21.25 17.39"/>
          <circle cx={10.98} cy={9.91} r={2.54} fill="#fff" opacity={0.8}/>
        </g>
      </g>
      <rect x={29.63} y={24.22} width={21.8} height={19.95} rx={2.11} opacity={0.4}/>
      <path d="M75.1 6.68v1.45c0 .63-.49 1.14-1.09 1.14H30.72c-.6 0-1.09-.51-1.09-1.14V6.68c0-.62.49-1.14 1.09-1.14h43.29c.6 0 1.09.52 1.09 1.14z" opacity={0.9}/>
    </svg>
  );
}

function IconLayoutCompact(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <rect x={5.84} y={5.2} width={4} height={40} rx={2} strokeLinecap="round" strokeMiterlimit={10}/>
      <g stroke="#fff" strokeLinecap="round" strokeMiterlimit={10}>
        <circle cx={7.81} cy={7.25} r={1.16} fill="#fff" opacity={0.8}/>
        <path fill="none" opacity={0.66} strokeWidth="2px" d="M7.26 11.56L8.37 11.56"/>
      </g>
      <rect x={14.93} y={24.22} width={32.68} height={19.95} rx={2.11} opacity={0.4} strokeLinecap="round" strokeMiterlimit={10}/>
      <rect x={14.93} y={5.89} width={59.16} height={2.73} rx={0.64} opacity={0.9} strokeLinecap="round" strokeMiterlimit={10}/>
    </svg>
  );
}

function IconLayoutFull(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79.86 51.14" {...props}>
      <rect x={5.84} y={5.89} width={68.26} height={2.73} rx={0.64} opacity={0.9} strokeLinecap="round" strokeMiterlimit={10}/>
      <rect x={5.84} y={24.22} width={37.71} height={19.95} rx={2.11} opacity={0.4} strokeLinecap="round" strokeMiterlimit={10}/>
      <path fill="none" opacity={0.75} strokeLinecap="round" strokeMiterlimit={10} strokeWidth="3px" d="M6.85 14.49L15.02 14.49"/>
    </svg>
  );
}

// ─── RadioGroupItem — uguale al pattern di shadcn-admin ───────────────────────

function ConfigOption({
  value,
  label,
  icon: Icon,
  isTheme = false,
}: {
  value:   string;
  label:   string;
  icon:    (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  isTheme?: boolean;
}) {
  return (
    <RadioItem
      value={value}
      className="group outline-none transition duration-200 ease-in"
      aria-label={`Seleziona ${label}`}
    >
      <div className={cn(
        "relative rounded-[6px] ring-[1px] ring-border cursor-pointer",
        "group-data-[state=checked]:shadow-lg group-data-[state=checked]:ring-primary",
        "group-focus-visible:ring-2 transition-all",
      )}>
        <CircleCheck className={cn(
          "size-5 fill-primary stroke-white",
          "group-data-[state=unchecked]:hidden",
          "absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 z-10",
        )} />
        <Icon className={cn(
          "w-full h-auto",
          !isTheme && "fill-primary stroke-primary group-data-[state=unchecked]:fill-muted-foreground group-data-[state=unchecked]:stroke-muted-foreground",
        )} />
      </div>
      <div className="mt-1 text-center text-xs text-muted-foreground group-data-[state=checked]:text-foreground group-data-[state=checked]:font-medium">
        {label}
      </div>
    </RadioItem>
  );
}

// ─── Titolo sezione con reset opzionale ───────────────────────────────────────

function SectionTitle({
  title,
  showReset,
  onReset,
}: {
  title:      string;
  showReset?: boolean;
  onReset?:   () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
      {title}
      {showReset && onReset && (
        <button
          onClick={onReset}
          className="h-4 w-4 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
          aria-label="Reset"
        >
          <RotateCcw className="size-2.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ThemeSettingsDrawer() {
  const { theme, setTheme } = useTheme();
  const { setOpen: setSidebarOpen } = useSidebar();
  const {
    sidebarVariant, setSidebarVariant,
    sidebarCollapsible, setSidebarCollapsible,
    resetSettings,
  } = useAppSettings();

  const handleReset = () => {
    setSidebarOpen(true);
    setTheme("system");
    resetSettings();
  };

  // Layout radio value: 'default' = sidebar aperta, altrimenti il collapsible
  // (stesso pattern di shadcn-admin)
  const layoutValue = sidebarCollapsible === "none" ? "default" : sidebarCollapsible;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Impostazioni aspetto"
        >
          <Settings className="h-4 w-4" />
        </button>
      </SheetTrigger>

      <SheetContent className="flex flex-col gap-0 px-0">
        <SheetHeader className="px-6 pb-4 text-start border-b">
          <SheetTitle>Impostazioni Aspetto</SheetTitle>
          <SheetDescription>
            Personalizza tema, sidebar e layout dell&apos;interfaccia.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

          {/* ── TEMA ── */}
          <div>
            <SectionTitle
              title="Tema"
              showReset={theme !== "system"}
              onReset={() => setTheme("system")}
            />
            <RadioGroup
              value={theme ?? "system"}
              onValueChange={setTheme}
              className="grid grid-cols-3 gap-3"
            >
              <ConfigOption value="system" label="Sistema" icon={IconThemeSystem} isTheme />
              <ConfigOption value="light"  label="Chiaro"  icon={IconThemeLight}  isTheme />
              <ConfigOption value="dark"   label="Scuro"   icon={IconThemeDark}   isTheme />
            </RadioGroup>
          </div>

          {/* ── SIDEBAR STILE ── */}
          <div>
            <SectionTitle
              title="Sidebar"
              showReset={sidebarVariant !== "inset"}
              onReset={() => setSidebarVariant("inset")}
            />
            <RadioGroup
              value={sidebarVariant}
              onValueChange={(v) => setSidebarVariant(v as SidebarVariant)}
              className="grid grid-cols-3 gap-3"
            >
              <ConfigOption value="inset"    label="Inset"    icon={IconSidebarInset}    />
              <ConfigOption value="floating" label="Floating" icon={IconSidebarFloating} />
              <ConfigOption value="sidebar"  label="Sidebar"  icon={IconSidebarSidebar}  />
            </RadioGroup>
          </div>

          {/* ── LAYOUT ── */}
          <div>
            <SectionTitle
              title="Layout"
              showReset={sidebarCollapsible !== "icon"}
              onReset={() => {
                setSidebarOpen(true);
                setSidebarCollapsible("icon");
              }}
            />
            <RadioGroup
              value={layoutValue}
              onValueChange={(v) => {
                if (v === "default") {
                  setSidebarOpen(true);
                  setSidebarCollapsible("none");
                } else {
                  setSidebarOpen(false);
                  setSidebarCollapsible(v as SidebarCollapsible);
                }
              }}
              className="grid grid-cols-3 gap-3"
            >
              <ConfigOption value="none"      label="Default"  icon={IconLayoutDefault} />
              <ConfigOption value="icon"      label="Compatto" icon={IconLayoutCompact} />
              <ConfigOption value="offcanvas" label="Pieno"    icon={IconLayoutFull}    />
            </RadioGroup>
          </div>

        </div>

        <SheetFooter className="px-6 pt-4 border-t">
          <Button variant="destructive" onClick={handleReset} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            Ripristina impostazioni
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
