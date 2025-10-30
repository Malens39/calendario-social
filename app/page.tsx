import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, Check, X, FileUp, Calendar as CalendarIcon, Wand2, Copy, Maximize2, XCircle } from "lucide-react";

/**
 * Social Post Approval – Single-file React App (client-only)
 *
 * Features
 * - Upload images (LocalStorage only)
 * - Per-platform captions (IG/FB/X/LI/TT)
 * - Status workflow (Bozza/In revisione/Approvato/Da correggere)
 * - Notes, owner, schedule (local time, no UTC shift)
 * - Filters + search
 * - Board/Calendar view; calendar day → board filter
 * - Colored platform badges per day (green/yellow/red/gray)
 * - Export/Import JSON; Copy review summary
 *
 * Per richieste utente
 * - NIENTE lista dentro il calendario (quella che mostrava “Da…”) ✅
 * - NIENTE input libero “Aggiungi tag separati da virgola” ✅
 * - Mantieni bottoni tag predefiniti ✅
 * - Menu stato SOLO nei bottoni azione in fondo alla card ✅
 */

const PLATFORMS = ["Instagram", "Facebook", "X", "LinkedIn", "TikTok"] as const;
const STATUSES = ["Bozza", "In revisione", "Approvato", "Da correggere"] as const;

type Platform = typeof PLATFORMS[number];
type Status = typeof STATUSES[number];

type PostItem = {
  id: string;
  createdAt: number;
  imageUrl?: string;
  imageName?: string;
  platforms: Record<Platform, { enabled: boolean; caption: string }>;
  scheduledAt?: string; // "YYYY-MM-DDThh:mm" from <input type="datetime-local">
  owner?: string;
  notes?: string;
  status: Status;
  tags: string[]; // from preset chips only
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

function readFiles(files: FileList): Promise<Array<{ url: string; name: string }>> {
  const readers: Promise<{ url: string; name: string }>[] = [];
  for (const f of Array.from(files)) {
    readers.push(new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve({ url: String(fr.result), name: f.name });
      fr.onerror = reject;
      fr.readAsDataURL(f);
    }));
  }
  return Promise.all(readers);
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

// ---- Local date helpers (avoid UTC shifts) ----
function parseLocalDateTime(str: string): Date {
  if (!str) return new Date(NaN);
  const [ymd, hm = "00:00"] = str.split("T");
  const [y, m, d] = ymd.split("-").map(n=>parseInt(n,10));
  const [hh, mm] = hm.split(":").map(n=>parseInt(n,10));
  return new Date(y, (m||1)-1, d||1, hh||0, mm||0, 0, 0);
}
function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function dateKeyFromLocalString(str: string): string {
  return dateKeyLocal(parseLocalDateTime(str));
}

// ---- Tiny dev tests (run once; don't alter UI state) ----
function assert(cond: boolean, msg: string) { if (!cond) throw new Error("Test failed: "+msg); }

// ---- Status coloring (calendar platform chips) ----
// severity: 0 none/bozza, 1 green approved, 2 yellow review, 3 red fix
function statusToSeverity(s: Status): number {
  switch (s) {
    case "Approvato": return 1;
    case "In revisione": return 2;
    case "Da correggere": return 3;
    case "Bozza":
    default: return 0;
  }
}
function severityBadgeClasses(sev: number) {
  if (sev === 3) return "bg-red-100 text-red-800 border-red-300";
  if (sev === 2) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (sev === 1) return "bg-green-100 text-green-800 border-green-300";
  return "bg-gray-100 text-gray-600 border-gray-300";
}

export default function ApprovazionePostSocial() {
  const [items, setItems] = useLocalStorage<PostItem[]>("coem-social-approval-items", []);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "Tutti">("Tutti");
  const [platformFilter, setPlatformFilter] = useState<Platform | "Tutte">("Tutte");
  const [onlyScheduled, setOnlyScheduled] = useState(false);
  const [gridMode, setGridMode] = useState(true);
  const [view, setView] = useState<'board'|'calendar'>('board');
  const [cardSize, setCardSize] = useState<'compact'|'medium'|'large'>('large');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Dev sanity tests
  useEffect(() => {
    try {
      assert(platformInitial('Instagram')==='IG','platformInitial IG');
      assert(platformInitial('Facebook')==='FB','platformInitial FB');
      assert(platformInitial('TikTok')==='TT','platformInitial TT');
      const ch = chunk([1,2,3,4,5],2); assert(ch.length===3 && ch[0].length===2 && ch[2].length===1,'chunk');
      const wed = new Date('2025-10-29T12:00:00'); const mon = startOfWeek(wed); assert(mon.getDay()===1,'startOfWeek');
      assert(['a','b'].join("\n")==='a\nb','join\\n');
      assert(dateKeyFromLocalString('2025-03-01T00:30')==='2025-03-01','dateKey local 1');
      assert(dateKeyFromLocalString('2025-10-31T23:59')==='2025-10-31','dateKey local 2');
      console.debug('[DEV TESTS] ok');
    } catch(e) { console.warn(e); }
  }, []);

  function addFromFiles(files: FileList) {
    readFiles(files).then((rows) => {
      setItems(prev => [
        ...rows.map(({url,name}) => ({
          id: uid(), createdAt: Date.now(), imageUrl: url, imageName: name,
          platforms: PLATFORMS.reduce((acc,p)=>({ ...acc, [p]: { enabled: true, caption: "" } }), {} as PostItem['platforms']),
          status: 'Bozza' as Status, tags: [],
        })),
        ...prev,
      ]);
    });
  }

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (statusFilter!=="Tutti" && it.status!==statusFilter) return false;
      if (platformFilter!=="Tutte" && !it.platforms[platformFilter].enabled) return false;
      if (onlyScheduled && !it.scheduledAt) return false;
      if (selectedDate && (!it.scheduledAt || dateKeyFromLocalString(it.scheduledAt)!==selectedDate)) return false;
      const q = query.trim().toLowerCase(); if (!q) return true;
      const hay = [it.imageName||"", it.owner||"", it.notes||"", ...PLATFORMS.map(p=>it.platforms[p].caption), it.tags.join(" "), it.status].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, statusFilter, platformFilter, onlyScheduled, selectedDate, query]);

  function updateItem(id: string, patch: Partial<PostItem>) {
    setItems(prev => prev.map(it => it.id===id ? { ...it, ...patch } : it));
  }
  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id!==id));
  }

  function exportJSON() { download(`piano-social-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(items, null, 2)); }
  function importJSON(file: File) {
    const fr = new FileReader();
    fr.onload = () => { try { const data = JSON.parse(String(fr.result)); if (Array.isArray(data)) setItems(data); else alert('File JSON non valido'); } catch { alert('File JSON non valido'); } };
    fr.readAsText(file);
  }
  function copyReviewSummary() {
    const lines = items.map((it, idx) => {
      const caps = PLATFORMS.filter(p=>it.platforms[p].enabled).map(p=>`${p}: ${it.platforms[p].caption}`).join("\n");
      const when = it.scheduledAt ? parseLocalDateTime(it.scheduledAt).toLocaleString() : '—';
      return `#${idx+1} — ${it.imageName||'(senza nome)'}\nStato: ${it.status}\nProgrammazione: ${when}\nOwner: ${it.owner||'—'}\nTag: ${it.tags.join(', ')||'—'}\nNote: ${it.notes||''}\n${caps}`;
    });
    navigator.clipboard.writeText(lines.join("\n\n"));
  }

  const gridClass = useMemo(() => {
    if (!gridMode) return "space-y-3";
    switch (cardSize) {
      case 'compact': return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
      case 'medium': return "grid grid-cols-1 md:grid-cols-2 gap-4";
      case 'large':
      default: return "grid grid-cols-1 gap-4";
    }
  }, [gridMode, cardSize]);

  // Items to show in calendar respect header filters (except selectedDate, which belongs to board)
  const calendarItems = useMemo(() => {
    return items.filter(it => (statusFilter==="Tutti"||it.status===statusFilter)
      && (platformFilter==="Tutte"||it.platforms[platformFilter].enabled)
      && (!onlyScheduled || it.scheduledAt)
      && (query ? [it.imageName||"", it.owner||"", it.notes||"", ...PLATFORMS.map(p=>it.platforms[p].caption), it.tags.join(" "), it.status].join(" ").toLowerCase().includes(query.toLowerCase()) : true)
    );
  }, [items, statusFilter, platformFilter, onlyScheduled, query]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Sistema approvazione post social</h1>
            <p className="text-sm text-gray-500">Carica, revisiona e programma i contenuti in un unico posto.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportJSON} className="gap-2"><Download className="w-4 h-4"/>Esporta</Button>
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if (f) importJSON(f); if (importRef.current) importRef.current.value=""; }} />
            <Button variant="secondary" className="gap-2" onClick={()=>importRef.current?.click()}><Upload className="w-4 h-4"/>Importa</Button>
            <Button variant="secondary" className="gap-2" onClick={copyReviewSummary}><Copy className="w-4 h-4"/>Copia riepilogo</Button>
            <Dialog>
              <DialogTrigger asChild><Button className="gap-2"><FileUp className="w-4 h-4"/>Carica immagini</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Carica immagini</DialogTitle>
                  <DialogDescription>Seleziona una o più immagini (rimangono nel browser).</DialogDescription>
                </DialogHeader>
                <input type="file" accept="image/*" multiple className="w-full" onChange={e=>{ if (e.target.files) addFromFiles(e.target.files); }} />
                <p className="text-xs text-gray-500">Persistenza in LocalStorage. Nessun upload esterno.</p>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={view==='board'?'default':'secondary'} onClick={()=>setView('board')} className="gap-2"><Upload className="w-4 h-4"/>Bacheca</Button>
          <Button variant={view==='calendar'?'default':'secondary'} onClick={()=>setView('calendar')} className="gap-2"><CalendarIcon className="w-4 h-4"/>Calendario</Button>
          <Select value={cardSize} onValueChange={(v: 'compact'|'medium'|'large')=>setCardSize(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Dimensione card"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compatta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="large">Ampia</SelectItem>
            </SelectContent>
          </Select>
          {selectedDate && (
            <div className="flex items-center gap-2 px-2 py-1 border rounded-full text-xs bg-blue-50 text-blue-800">
              Giorno selezionato: {selectedDate}
              <button onClick={()=>setSelectedDate(null)} title="Rimuovi filtro data" className="inline-flex items-center"><XCircle className="w-4 h-4"/></button>
            </div>
          )}
          <div className="text-xs text-gray-500 flex items-center gap-1"><Maximize2 className="w-3 h-3"/> Dimensione Bacheca</div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-4">
        <FiltersBar
          query={query} setQuery={setQuery}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          platformFilter={platformFilter} setPlatformFilter={setPlatformFilter}
          onlyScheduled={onlyScheduled} setOnlyScheduled={setOnlyScheduled}
          gridMode={gridMode} setGridMode={setGridMode}
        />

        {view==='board' ? (
          filtered.length===0 ? (
            <EmptyState onDropFiles={files=>addFromFiles(files)} />
          ) : (
            <div className={classNames("mt-4", gridClass)}>
              {filtered.map(it => (
                <PostCard key={it.id} item={it} onChange={updateItem} onDelete={removeItem} />
              ))}
            </div>
          )
        ) : (
          <CalendarView items={calendarItems} onPickDate={(dayKey)=>{ setSelectedDate(dayKey); setView('board'); }} />
        )}
      </main>
    </div>
  );
}

function EmptyState({ onDropFiles }: { onDropFiles: (files: FileList) => void }) {
  const drop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files); };
  return (
    <div onDragOver={e=>e.preventDefault()} onDrop={drop} className="mt-10 border-2 border-dashed rounded-2xl p-10 text-center bg-white">
      <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><Upload className="w-6 h-6 text-gray-600"/></div>
      <h3 className="text-lg font-medium">Trascina qui le immagini da approvare</h3>
      <p className="text-sm text-gray-500">Oppure usa il pulsante “Carica immagini” in alto a destra.</p>
    </div>
  );
}

function FiltersBar(props: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="flex-1 flex gap-2">
            <Input placeholder="Cerca per testo, tag, owner…" value={props.query} onChange={e=>props.setQuery(e.target.value)} />
            <Select value={props.statusFilter} onValueChange={(v)=>props.setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutti">Tutti</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={props.platformFilter} onValueChange={(v)=>props.setPlatformFilter(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Piattaforma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutte">Tutte</SelectItem>
                {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600"><Switch checked={props.onlyScheduled} onCheckedChange={props.setOnlyScheduled}/> Solo programmati</label>
            <label className="flex items-center gap-2 text-sm text-gray-600"><Switch checked={props.gridMode} onCheckedChange={props.setGridMode}/> Griglia</label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ item, onChange, onDelete }: { item: PostItem; onChange: (id: string, patch: Partial<PostItem>)=>void; onDelete: (id: string)=>void }) {
  const [tab, setTab] = useState<Platform>("Instagram");
  const fileRef = useRef<HTMLInputElement>(null);

  function setPlatform(p: Platform, patch: Partial<PostItem["platforms"][Platform]>) {
    onChange(item.id, { platforms: { ...item.platforms, [p]: { ...item.platforms[p], ...patch } } });
  }
  function toggleTag(tag: string) {
    const has = item.tags.includes(tag);
    onChange(item.id, { tags: has ? item.tags.filter(t=>t!==tag) : [...item.tags, tag] });
  }

  return (
    <Card className="overflow-hidden">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.imageName || "post"} className="w-full aspect-video object-cover" />
      ) : (
        <div className="w-full aspect-video bg-gray-100 grid place-items-center text-gray-400">Nessuna immagine</div>
      )}
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-500 flex-1 truncate">{item.imageName || "(senza nome)"}</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if (!f) return; readFiles({0:f,length:1,item:()=>f} as unknown as FileList).then(([r])=> onChange(item.id, { imageUrl: r.url, imageName: f.name })); }} />
          <Button variant="secondary" size="sm" onClick={()=>fileRef.current?.click()}>Sostituisci</Button>
          <Button variant="ghost" size="sm" onClick={()=>onDelete(item.id)} className="text-red-600">Elimina</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input placeholder="Owner / referente" value={item.owner||""} onChange={e=>onChange(item.id, { owner: e.target.value })} />
              <Input type="datetime-local" value={item.scheduledAt||""} onChange={e=>onChange(item.id, { scheduledAt: e.target.value })} title="Programmazione" />
            </div>

            {/* RIMOSSO: select di stato in mezzo (lista tra data e note) */}

            <Textarea placeholder="Note / richieste di modifica" value={item.notes||""} onChange={e=>onChange(item.id, { notes: e.target.value })} />

            <div className="flex flex-wrap gap-2">
              {["istituzionale","emergenza","story","reel","galleria","paid"].map(t => (
                <button key={t} onClick={()=>toggleTag(t)} className={classNames("px-2 py-1 rounded-full text-xs border", item.tags.includes(t)?"bg-gray-900 text-white":"bg-white")}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <Tabs value={tab} onValueChange={v=>setTab(v as Platform)}>
              <TabsList className="flex flex-nowrap overflow-x-auto gap-1 no-scrollbar">
                {PLATFORMS.map(p => <TabsTrigger key={p} value={p} className="text-xs whitespace-nowrap">{p}</TabsTrigger>)}
              </TabsList>
              {PLATFORMS.map(p => (
                <TabsContent key={p} value={p}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={item.platforms[p].enabled} onCheckedChange={v=>setPlatform(p, { enabled: Boolean(v) })} />
                      Attiva {p}
                    </label>
                    <div className="text-xs text-gray-500">{platformHelp(p)}</div>
                  </div>
                  <Textarea
                    placeholder={`Didascalia per ${p}`}
                    value={item.platforms[p].caption}
                    onChange={e=>setPlatform(p, { caption: e.target.value })}
                    className="min-h-[140px]"
                  />
                  <PlatformPreview platform={p} caption={item.platforms[p].caption} imageUrl={item.imageUrl} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" onClick={()=>onChange(item.id, { status: "In revisione" })} className="gap-2"><Wand2 className="w-4 h-4"/>Invia in revisione</Button>
          <Button variant="outline" onClick={()=>onChange(item.id, { status: "Da correggere" })} className="gap-2"><X className="w-4 h-4"/>Segna da correggere</Button>
          <Button onClick={()=>onChange(item.id, { status: "Approvato" })} className="gap-2"><Check className="w-4 h-4"/>Approva</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function platformHelp(p: Platform) {
  switch (p) {
    case "Instagram": return "IG: tag e hashtag, max ~2.200 caratteri";
    case "Facebook": return "FB: link cliccabili ok";
    case "X": return "X: 280 caratteri (base)";
    case "LinkedIn": return "LI: tono professionale";
    case "TikTok": return "TikTok: caption breve";
  }
}

function CalendarView({ items, onPickDate }: { items: PostItem[]; onPickDate: (dayKey: string)=>void }) {
  const [cursor, setCursor] = useState(() => { const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const postsByDay = useMemo(() => {
    const map: Record<string, { items: PostItem[]; platformSeverity: Partial<Record<Platform, number>> }> = {};
    for (const it of items) {
      if (!it.scheduledAt) continue;
      const dayKey = dateKeyFromLocalString(it.scheduledAt);
      if (!map[dayKey]) map[dayKey] = { items: [], platformSeverity: {} };
      map[dayKey].items.push(it);
      for (const p of PLATFORMS) {
        if (!it.platforms[p].enabled) continue;
        const sev = statusToSeverity(it.status);
        map[dayKey].platformSeverity[p] = Math.max(map[dayKey].platformSeverity[p] ?? 0, sev);
      }
    }
    return map;
  }, [items]);

  const weeks = useMemo(() => {
    const year = cursor.getFullYear(); const month = cursor.getMonth();
    const first = new Date(year, month, 1); const start = startOfWeek(first);
    const days: Date[] = []; for (let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); days.push(d);} 
    return chunk(days,7);
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-medium capitalize">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={()=>setCursor(addMonths(cursor,-1))}>Mese prec.</Button>
          <Button variant="secondary" onClick={()=>setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Oggi</Button>
          <Button variant="secondary" onClick={()=>setCursor(addMonths(cursor,1))}>Mese succ.</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-1">{["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(d=> <div key={d} className="px-2">{d}</div>)}</div>

      <div className="grid grid-cols-7 gap-2">
        {weeks.flat().map((d, idx) => {
          const inMonth = d.getMonth()===cursor.getMonth();
          const dayKey = dateKeyLocal(d);
          const bucket = postsByDay[dayKey];
          return (
            <button key={idx} onClick={()=>onPickDate(dayKey)} className={classNames("text-left border rounded-xl p-2 min-h-[120px] bg-white transition hover:shadow", !inMonth && "opacity-40")}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium">{d.getDate()}</div>
                {bucket?.items?.length ? (<div className="text-[10px] px-1 rounded bg-gray-900 text-white">{bucket.items.length}</div>) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {PLATFORMS.map(p => {
                  const sev = bucket?.platformSeverity?.[p] ?? 0;
                  const cls = severityBadgeClasses(sev);
                  return <span key={p} className={classNames("text-[10px] border rounded px-1", cls)}>{platformInitial(p)}</span>;
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function platformInitial(p: Platform) {
  switch (p) {
    case 'Instagram': return 'IG';
    case 'Facebook': return 'FB';
    case 'X': return 'X';
    case 'LinkedIn': return 'LI';
    case 'TikTok': return 'TT';
  }
}

function startOfWeek(d: Date) { const day=(d.getDay()+6)%7; const out=new Date(d); out.setDate(d.getDate()-day); out.setHours(0,0,0,0); return out; }
function addMonths(d: Date, delta: number) { const out=new Date(d); out.setMonth(d.getMonth()+delta); return new Date(out.getFullYear(), out.getMonth(), 1); }
function chunk<T>(arr: T[], size: number) { const res: T[][]=[]; for(let i=0;i<arr.length;i+=size) res.push(arr.slice(i,i+size)); return res; }

function PlatformPreview({ platform, caption, imageUrl }: { platform: Platform; caption: string; imageUrl?: string }) {
  return (
    <div className="mt-2 border rounded-xl p-3 bg-gray-50">
      <div className="text-xs font-medium text-gray-600 mb-2">Anteprima {platform}</div>
      <div className="flex gap-3">
        <div className="w-24 h-24 bg-white border rounded-lg overflow-hidden flex-shrink-0">
          {imageUrl ? <img src={imageUrl} alt="preview" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-gray-400 text-xs">Nessuna immagine</div>}
        </div>
        <div className="flex-1 text-sm whitespace-pre-wrap">{caption ? caption : <span className="text-gray-400">Scrivi la didascalia…</span>}</div>
      </div>
    </div>
  );
}
