"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PlusCircle, Trash2, Sun, Moon, ChevronDown, RefreshCw, GripVertical, Flame, Target, LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CryptoHolding {
  id: string;
  name: string;
  symbol: string;
  quantity: number;
  price?: number;
  image?: string;
}

interface MensuelSchedule {
  date: string;   // "YYYY-MM"
  montant: number;
  label?: string;
}

interface Cagnotte {
  id: number;
  name: string;
  montant: number;
  mensuel: number;
  taux: number;
  visible?: boolean;
  type?: "epargne" | "immobilier" | "crypto";
  prixBien?: number;
  tauxPret?: number;
  dureePret?: number;
  holdings?: CryptoHolding[];
  mensuelSchedule?: MensuelSchedule[];
  color?: string;
}

const PALETTE = ["#6366f1","#10b981","#f59e0b","#ec4899","#3b82f6","#8b5cf6","#14b8a6","#f97316"];
const PRESET_COLORS = [
  "#6366f1","#3b82f6","#06b6d4","#10b981","#14b8a6","#22c55e",
  "#84cc16","#eab308","#f97316","#ef4444","#ec4899","#a855f7",
  "#8b5cf6","#f43f5e","#0ea5e9","#64748b",
];

function getColor(c: { color?: string }, idx: number): string {
  return c.color ?? PALETTE[idx % PALETTE.length];
}
const YEAR_OPTIONS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30];
const MONTHS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

const TAUX_PRESETS = {
  epargne: [
    { label: "Livret A", value: 3 },
    { label: "Conservateur", value: 5 },
    { label: "Historique", value: 8 },
    { label: "Optimiste", value: 12 },
  ],
  immobilier: [
    { label: "Pessimiste", value: 1 },
    { label: "Modéré", value: 3 },
    { label: "Optimiste", value: 5 },
  ],
  crypto: [
    { label: "Pessimiste", value: 20 },
    { label: "Historique", value: 40 },
    { label: "Optimiste", value: 80 },
    { label: "Bull run", value: 150 },
  ],
};

const POPULAR_CRYPTOS = [
  { id: "bitcoin",      name: "Bitcoin",      symbol: "BTC",  image: "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png" },
  { id: "ethereum",     name: "Ethereum",     symbol: "ETH",  image: "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png" },
  { id: "solana",       name: "Solana",       symbol: "SOL",  image: "https://assets.coingecko.com/coins/images/4128/thumb/solana.png" },
  { id: "binancecoin",  name: "BNB",          symbol: "BNB",  image: "https://assets.coingecko.com/coins/images/825/thumb/bnb-icon2_2x.png" },
  { id: "ripple",       name: "XRP",          symbol: "XRP",  image: "https://assets.coingecko.com/coins/images/44/thumb/xrp-symbol-white-128.png" },
  { id: "cardano",      name: "Cardano",      symbol: "ADA",  image: "https://assets.coingecko.com/coins/images/975/thumb/cardano.png" },
  { id: "avalanche-2",  name: "Avalanche",    symbol: "AVAX", image: "https://assets.coingecko.com/coins/images/12559/thumb/Avalanche_Circle_RedWhite_Trans.png" },
  { id: "polkadot",     name: "Polkadot",     symbol: "DOT",  image: "https://assets.coingecko.com/coins/images/12171/thumb/polkadot.png" },
  { id: "chainlink",    name: "Chainlink",    symbol: "LINK", image: "https://assets.coingecko.com/coins/images/877/thumb/chainlink-new-logo.png" },
  { id: "uniswap",      name: "Uniswap",      symbol: "UNI",  image: "https://assets.coingecko.com/coins/images/12504/thumb/uni.jpg" },
  { id: "connect-token-wct", name: "WalletConnect", symbol: "WCT", image: "/wct.png" },
];

async function fetchCryptoPrices(ids: string[]): Promise<Record<string, { price: number; image?: string }>> {
  if (!ids.length) return {};
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?ids=${ids.join(",")}&vs_currency=eur`
  );
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  return Object.fromEntries(arr.map((c: any) => [c.id, { price: c.current_price ?? 0, image: c.image }]));
}

const DEFAULT_CAGNOTTES: Cagnotte[] = [
  { id: 1, name: "Bourse", montant: 10000, mensuel: 300, taux: 7 },
  { id: 2, name: "Livret A", montant: 5000, mensuel: 100, taux: 3 },
];

function computeMensualite(capital: number, tauxAnnuel: number, dureeAns: number): number {
  const r = tauxAnnuel / 100 / 12;
  const n = dureeAns * 12;
  if (r === 0) return capital / n;
  return capital * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function projectMonthly(montant: number, mensuel: number, tauxAnnuel: number, years: number): number[] {
  const pts: number[] = [montant];
  const monthly = tauxAnnuel / 100 / 12;
  let val = montant;
  for (let m = 1; m <= years * 12; m++) { val = val * (1 + monthly) + mensuel; pts.push(val); }
  return pts;
}

function getCurrentMensuel(c: Cagnotte): number {
  if (!c.mensuelSchedule?.length) return c.mensuel;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let result = c.mensuel;
  for (const s of [...c.mensuelSchedule].sort((a, b) => a.date.localeCompare(b.date))) {
    if (s.date <= ym) result = s.montant;
  }
  return result;
}

function addMonths(baseYear: number, baseMonth: number, n: number): string {
  const total = baseMonth + n;
  const y = baseYear + Math.floor(total / 12);
  const mo = total % 12;
  return `${y}-${String(mo + 1).padStart(2, "0")}`;
}

function projectMonthlyWithSchedule(
  montant: number, mensuelBase: number, schedule: MensuelSchedule[], taux: number, years: number
): number[] {
  const monthly = taux / 100 / 12;
  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth(); // 0-indexed
  const sorted = [...schedule].sort((a, b) => a.date.localeCompare(b.date));
  let val = montant;
  const pts: number[] = [montant];
  for (let m = 1; m <= years * 12; m++) {
    const ym = addMonths(baseYear, baseMonth, m);
    let mensuel = mensuelBase;
    for (const s of sorted) { if (s.date <= ym) mensuel = s.montant; }
    val = val * (1 + monthly) + mensuel;
    pts.push(val);
  }
  return pts;
}

function projectImmobilier(apport: number, prixBien: number, tauxPret: number, tauxAppre: number, dureePret: number, years: number): number[] {
  const capital = prixBien - apport;
  const r = tauxPret / 100 / 12;
  const n = dureePret * 12;
  const ra = tauxAppre / 100 / 12;
  const pts: number[] = [apport];
  for (let m = 1; m <= years * 12; m++) {
    const valeurBien = prixBien * Math.pow(1 + ra, m);
    let capitalRestant: number;
    if (m >= n) {
      capitalRestant = 0;
    } else if (r > 0) {
      capitalRestant = capital * (Math.pow(1 + r, n) - Math.pow(1 + r, m)) / (Math.pow(1 + r, n) - 1);
    } else {
      capitalRestant = capital - (capital / n) * m;
    }
    pts.push(Math.max(0, valeurBien - capitalRestant));
  }
  return pts;
}

function projectCagnotte(
  c: Cagnotte,
  years: number,
  opts?: { noInterest?: boolean; noSavings?: boolean }
): number[] {
  const taux = opts?.noInterest ? 0 : c.taux;
  const mensuel = opts?.noSavings ? 0 : c.mensuel;
  const schedule = opts?.noSavings ? [] : (c.mensuelSchedule ?? []);
  if (c.type === "immobilier" && c.prixBien !== undefined && c.tauxPret !== undefined && c.dureePret !== undefined) {
    return projectImmobilier(c.montant, c.prixBien, c.tauxPret, taux, c.dureePret, years);
  }
  if (schedule.length) {
    return projectMonthlyWithSchedule(c.montant, mensuel, schedule, taux, years);
  }
  return projectMonthly(c.montant, mensuel, taux, years);
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(".", ",") + " M€";
  return Math.round(n).toLocaleString("fr-FR") + " €";
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M€";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k€";
  return Math.round(n) + "€";
}

function monthLabel(monthIndex: number, startYear: number, startMonth: number = 0): string {
  const total = startMonth + monthIndex;
  const year = startYear + Math.floor(total / 12);
  const month = total % 12;
  return `${MONTHS_FR[month]} ${year}`;
}

// Number input that allows clearing (avoids the "stuck at 0" bug)
function NumberInput({ value, onChange, className, ...props }: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  [k: string]: any;
}) {
  const [local, setLocal] = useState(value === 0 ? "" : String(value));
  const prevRef = useRef(value);
  if (prevRef.current !== value) {
    prevRef.current = value;
    if (parseFloat(local) !== value) setLocal(value === 0 ? "" : String(value));
  }
  return (
    <Input
      {...props}
      type="number"
      className={className}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        const n = parseFloat(e.target.value);
        onChange(isNaN(n) ? 0 : n);
      }}
    />
  );
}

function TauxField({
  label, value, onChange, presets, step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  presets: { label: string; value: number }[];
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.value)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              value === p.value
                ? "bg-green-400 text-black border-green-400"
                : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
            }`}
          >
            {p.label} · {p.value}%
          </button>
        ))}
      </div>
      <div className="relative">
        <NumberInput value={value} onChange={onChange} step={step} className="pr-8" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
      </div>
    </div>
  );
}

function YearDropdown({ value, onChange, options }: { value: number; onChange: (y: number) => void; options: number[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-0.5 font-semibold text-foreground hover:text-muted-foreground transition-colors duration-150"
      >
        {value} an{value > 1 ? "s" : ""}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 rounded-md border bg-card shadow-lg py-1 min-w-[110px]" style={{ backgroundColor: "hsl(var(--card))" }}>
            {options.map((y) => (
              <button key={y} onClick={() => { onChange(y); setOpen(false); }}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors ${y === value ? "font-semibold text-primary" : "text-foreground"}`}>
                {y} an{y > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg text-sm min-w-[200px]">
      <p className="font-semibold text-foreground mb-2 capitalize">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: entry.fill }} />
            <span className="text-muted-foreground text-xs">{entry.name}</span>
          </div>
          <span className="text-xs font-medium">{fmt(entry.value)}</span>
        </div>
      ))}
      <Separator className="my-1.5" />
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground font-medium">Total</span>
        <span className="text-xs font-bold">{fmt(payload.reduce((s: number, e: any) => s + e.value, 0))}</span>
      </div>
    </div>
  );
}

function MensuelTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg text-sm min-w-[160px]">
      <p className="font-semibold text-foreground mb-1 capitalize">{label}</p>
      <p className="text-foreground font-bold">{fmt(data.total)}<span className="text-xs font-normal text-muted-foreground">/mois</span></p>
      {data.changeLabel && (
        <p className="text-xs text-primary mt-1.5 font-medium">↑ {data.changeLabel}</p>
      )}
    </div>
  );
}

interface AddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (c: Omit<Cagnotte, "id">) => void;
}

function ColorDot({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="h-3 w-3 rounded-full block transition-transform hover:scale-125 focus:outline-none"
        style={{ background: color }}
        aria-label="Changer la couleur"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 rounded-lg border bg-card shadow-xl p-2.5 w-[136px]" style={{ backgroundColor: "hsl(var(--card))" }}>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${color === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="h-6 w-full rounded cursor-pointer border-0"
              title="Couleur personnalisée"
            />
          </div>
        </>
      )}
    </div>
  );
}

const MONTHS_SHORT_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];

function ScheduleField({
  schedule, mensuelBase, onChange,
}: {
  schedule: MensuelSchedule[];
  mensuelBase: number;
  onChange: (s: MensuelSchedule[]) => void;
}) {
  const today = new Date();
  const minYear = today.getFullYear();

  function add() {
    const lastDate = schedule.length
      ? schedule[schedule.length - 1].date
      : `${minYear}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    onChange([...schedule, { date: lastDate, montant: mensuelBase, label: "" }]);
  }

  return (
    <div className="space-y-1.5">
      {schedule.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun changement programmé.</p>
      ) : (
        [...schedule]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((s, i) => {
            const origIdx = schedule.indexOf(s);
            const [yearStr, monthStr] = s.date.split("-");
            const year = parseInt(yearStr);
            const month = monthStr;
            return (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={s.label ?? ""}
                  onChange={(e) => onChange(schedule.map((x, ii) => ii === origIdx ? { ...x, label: e.target.value } : x))}
                  placeholder="Nom"
                  className="rounded-md border bg-background px-2 py-1.5 text-sm flex-1 min-w-0 text-foreground placeholder:text-muted-foreground"
                />
                <select
                  value={month}
                  onChange={(e) => onChange(schedule.map((x, ii) => ii === origIdx ? { ...x, date: `${yearStr}-${e.target.value}` } : x))}
                  className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground flex-shrink-0"
                >
                  {MONTHS_SHORT_FR.map((m, idx) => (
                    <option key={idx} value={String(idx + 1).padStart(2, "0")}>{m}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={year}
                  min={minYear}
                  max={minYear + 30}
                  onChange={(e) => onChange(schedule.map((x, ii) => ii === origIdx ? { ...x, date: `${e.target.value}-${month}` } : x))}
                  className="rounded-md border bg-background px-2 py-1.5 text-sm w-16 text-foreground"
                />
                <div className="relative flex-shrink-0">
                  <NumberInput
                    value={s.montant}
                    min={0}
                    onChange={(v) => onChange(schedule.map((x, ii) => ii === origIdx ? { ...x, montant: v } : x))}
                    placeholder="0"
                    className="w-28 pr-12"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€/mois</span>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(schedule.filter((_, ii) => ii !== origIdx))}
                  className="p-1.5 rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
      )}
      <button type="button" onClick={add} className="text-xs text-primary hover:underline">
        + Ajouter un changement
      </button>
    </div>
  );
}

function CryptoForm({
  holdings, taux, mensuel, mensuelSchedule, onHoldingsChange, onTauxChange, onMensuelChange, onScheduleChange,
}: {
  holdings: CryptoHolding[];
  taux: number;
  mensuel: number;
  mensuelSchedule: MensuelSchedule[];
  onHoldingsChange: (h: CryptoHolding[]) => void;
  onTauxChange: (t: number) => void;
  onMensuelChange: (v: number) => void;
  onScheduleChange: (s: MensuelSchedule[]) => void;
}) {
  const [loading, setLoading] = useState(false);

  const totalValue = holdings.reduce((s, h) => s + h.quantity * (h.price ?? 0), 0);

  // Refs to always have current values in the effect without causing re-runs
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;
  const onHoldingsChangeRef = useRef(onHoldingsChange);
  onHoldingsChangeRef.current = onHoldingsChange;

  // Auto-fetch whenever a holding has no price yet
  const missingIds = holdings.filter((h) => h.price === undefined).map((h) => h.id).join(",");
  useEffect(() => {
    if (!missingIds) return;
    const ids = missingIds.split(",");
    setLoading(true);
    fetchCryptoPrices(ids)
      .then((data) => onHoldingsChangeRef.current(holdingsRef.current.map((h) => ({
        ...h,
        price: h.price ?? data[h.id]?.price,
        image: h.image ?? data[h.id]?.image,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [missingIds]);

  function addHolding() {
    onHoldingsChange([...holdings, { id: "bitcoin", name: "Bitcoin", symbol: "BTC", quantity: 0 }]);
  }

  function removeHolding(i: number) {
    onHoldingsChange(holdings.filter((_, ii) => ii !== i));
  }

  function updateHolding(i: number, patch: Partial<CryptoHolding>) {
    onHoldingsChange(holdings.map((h, ii) => (ii === i ? { ...h, ...patch } : h)));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {holdings.map((h, i) => {
          const meta = POPULAR_CRYPTOS.find((x) => x.id === h.id);
          const logoSrc = h.image ?? meta?.image;
          return (
          <div key={i} className="flex items-center gap-2">
            {logoSrc
              ? <img src={logoSrc} alt={h.symbol} className="h-5 w-5 rounded-full flex-shrink-0 object-contain" />
              : <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0">{h.symbol[0]}</span>
            }
            {/* Custom select with controlled chevron */}
            <div className="relative flex-1 min-w-0">
              <select
                value={h.id}
                onChange={(e) => {
                  const c = POPULAR_CRYPTOS.find((x) => x.id === e.target.value)!;
                  updateHolding(i, { id: c.id, name: c.name, symbol: c.symbol, price: undefined, image: undefined });
                }}
                className="w-full appearance-none rounded-md border bg-background px-3 pr-7 py-2 text-sm"
              >
                {POPULAR_CRYPTOS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <NumberInput
              value={h.quantity} min={0} step={0.0001}
              placeholder="Qté"
              className="w-16 text-right flex-shrink-0"
              onChange={(v) => updateHolding(i, { quantity: v })}
            />
            <span className="text-xs text-muted-foreground w-14 text-right flex-shrink-0">
              {h.price !== undefined && h.quantity > 0 ? fmt(h.quantity * h.price) : "—"}
            </span>
            <button
              onClick={() => removeHolding(i)}
              className="p-1.5 rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 flex-shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          );
        })}
        <button onClick={addHolding} className="text-sm text-primary hover:underline">
          + Ajouter une crypto
        </button>
      </div>

      {holdings.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {totalValue > 0 && (
            <div className="rounded-md bg-muted px-3 py-1.5 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Valeur totale</span>
              <span className="text-sm font-semibold">{fmt(totalValue)}</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Versement mensuel DCA (€)</Label>
        <NumberInput value={mensuel} min={0} placeholder="0" onChange={onMensuelChange} />
      </div>

      <TauxField
        label="Taux de rendement annuel"
        value={taux}
        onChange={onTauxChange}
        presets={TAUX_PRESETS.crypto}
        step={1}
      />

      <div className="space-y-2 border-t pt-3">
        <Label className="text-sm font-medium">Évolution du versement mensuel</Label>
        <ScheduleField schedule={mensuelSchedule} mensuelBase={mensuel} onChange={onScheduleChange} />
      </div>
    </div>
  );
}

function AddDialog({ open, onOpenChange, onAdd }: AddDialogProps) {
  const [type, setType] = useState<"epargne" | "immobilier" | "crypto">("epargne");
  const [draft, setDraft] = useState({ name: "", montant: 0, mensuel: 0, taux: 5, prixBien: 300000, tauxPret: 3.5, dureePret: 20 });
  const [holdings, setHoldings] = useState<CryptoHolding[]>([]);
  const [schedules, setSchedules] = useState<MensuelSchedule[]>([]);

  useMemo(() => {
    if (open) {
      setType("epargne");
      setDraft({ name: "", montant: 0, mensuel: 0, taux: 5, prixBien: 300000, tauxPret: 3.5, dureePret: 20 });
      setHoldings([]);
      setSchedules([]);
    }
  }, [open]);

  function field(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: key === "name" ? value : parseFloat(value) || 0 }));
  }

  const mensualiteCalc = type === "immobilier"
    ? computeMensualite(draft.prixBien - draft.montant, draft.tauxPret, draft.dureePret)
    : null;

  const totalCrypto = holdings.reduce((s, h) => s + h.quantity * (h.price ?? 0), 0);

  function handleSave() {
    const sched = schedules.length ? schedules : undefined;
    if (type === "epargne") {
      onAdd({ name: draft.name || "Nouveau placement", montant: draft.montant, mensuel: draft.mensuel, taux: draft.taux, mensuelSchedule: sched });
    } else if (type === "immobilier") {
      const mensuel = computeMensualite(draft.prixBien - draft.montant, draft.tauxPret, draft.dureePret);
      onAdd({
        name: draft.name || "Résidence principale", type: "immobilier",
        montant: draft.montant, mensuel, taux: draft.taux,
        prixBien: draft.prixBien, tauxPret: draft.tauxPret, dureePret: draft.dureePret,
      });
    } else {
      onAdd({
        name: draft.name || "Crypto", type: "crypto",
        montant: totalCrypto, mensuel: draft.mensuel, taux: draft.taux,
        holdings, mensuelSchedule: sched,
      });
    }
    onOpenChange(false);
  }

  const TYPE_LABELS: Record<string, string> = { epargne: "Épargne", immobilier: "Immobilier", crypto: "Crypto" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un placement</DialogTitle>
        </DialogHeader>
        {/* Type selector */}
        <div className="flex rounded-lg border bg-muted p-1 gap-1">
          {(["epargne", "immobilier", "crypto"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${type === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="space-y-4 py-1 overflow-y-auto max-h-[65vh]">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input
              value={draft.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder={type === "epargne" ? "ex. Bourse, Livret A…" : type === "immobilier" ? "ex. Résidence principale…" : "ex. Mon portefeuille crypto…"}
            />
          </div>

          {type === "immobilier" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Prix du bien (€)</Label>
                  <NumberInput value={draft.prixBien} min={0} onChange={(v) => setDraft((p) => ({ ...p, prixBien: v }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Apport (€)</Label>
                  <NumberInput value={draft.montant} min={0} onChange={(v) => setDraft((p) => ({ ...p, montant: v }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Taux du prêt</Label>
                  <div className="relative">
                    <NumberInput value={draft.tauxPret} step={0.1} onChange={(v) => setDraft((p) => ({ ...p, tauxPret: v }))} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Durée (ans)</Label>
                  <NumberInput value={draft.dureePret} min={1} max={30} onChange={(v) => setDraft((p) => ({ ...p, dureePret: v }))} />
                </div>
              </div>
              <TauxField
                label="Taux d'appréciation annuel"
                value={draft.taux}
                onChange={(v) => setDraft((p) => ({ ...p, taux: v }))}
                presets={TAUX_PRESETS.immobilier}
              />
              {mensualiteCalc !== null && (
                <div className="rounded-md bg-muted px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Mensualité calculée</span>
                  <span className="text-sm font-semibold">{fmt(mensualiteCalc)}/mois</span>
                </div>
              )}
            </>
          )}

          {type === "epargne" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Montant actuel (€)</Label>
                  <NumberInput value={draft.montant} min={0} onChange={(v) => setDraft((p) => ({ ...p, montant: v }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Versement mensuel (€)</Label>
                  <NumberInput value={draft.mensuel} min={0} onChange={(v) => setDraft((p) => ({ ...p, mensuel: v }))} />
                </div>
              </div>
              <TauxField
                label="Taux de rendement annuel"
                value={draft.taux}
                onChange={(v) => setDraft((p) => ({ ...p, taux: v }))}
                presets={TAUX_PRESETS.epargne}
              />
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-medium">Évolution du versement mensuel</Label>
                <ScheduleField schedule={schedules} mensuelBase={draft.mensuel} onChange={setSchedules} />
              </div>
            </>
          )}

          {type === "crypto" && (
            <CryptoForm
              holdings={holdings}
              taux={draft.taux}
              mensuel={draft.mensuel}
              mensuelSchedule={schedules}
              onHoldingsChange={setHoldings}
              onTauxChange={(t) => setDraft((prev) => ({ ...prev, taux: t }))}
              onMensuelChange={(v) => setDraft((prev) => ({ ...prev, mensuel: v }))}
              onScheduleChange={setSchedules}
            />
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="bg-green-400 hover:bg-green-500 text-black">Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CagnotteDialogProps {
  cagnotte: Cagnotte | null; color: string; canDelete: boolean; open: boolean;
  onOpenChange: (open: boolean) => void; onSave: (updated: Cagnotte) => void; onDelete: (id: number) => void;
}

function CagnotteDialog({ cagnotte, color, canDelete, open, onOpenChange, onSave, onDelete }: CagnotteDialogProps) {
  const [draft, setDraft] = useState<Cagnotte | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && cagnotte) { setDraft({ ...cagnotte }); setConfirmDelete(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cagnotte?.id]);
  if (!draft) return null;

  const isImmo = draft.type === "immobilier";
  const isCrypto = draft.type === "crypto";

  function field(key: keyof Cagnotte, value: string) {
    setDraft((prev) => prev ? ({ ...prev, [key]: key === "name" ? value : parseFloat(value) || 0 }) : prev);
  }

  const mensualiteCalc = isImmo && draft.prixBien && draft.tauxPret && draft.dureePret
    ? computeMensualite(draft.prixBien - draft.montant, draft.tauxPret, draft.dureePret)
    : null;

  const dialogTitle = isImmo ? "Modifier le bien immobilier" : isCrypto ? "Modifier le portefeuille crypto" : "Modifier le placement";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: color }} />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 overflow-y-auto max-h-[65vh]">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input value={draft.name} onChange={(e) => field("name", e.target.value)} placeholder="Nom du placement" />
          </div>

          {isImmo && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Prix du bien (€)</Label>
                  <NumberInput value={draft.prixBien ?? 0} min={0} onChange={(v) => setDraft((p) => p ? { ...p, prixBien: v } : p)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Apport (€)</Label>
                  <NumberInput value={draft.montant} min={0} onChange={(v) => setDraft((p) => p ? { ...p, montant: v } : p)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Taux du prêt</Label>
                  <div className="relative">
                    <NumberInput value={draft.tauxPret ?? 0} step={0.1} onChange={(v) => setDraft((p) => p ? { ...p, tauxPret: v } : p)} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Durée (ans)</Label>
                  <NumberInput value={draft.dureePret ?? 20} min={1} max={30} onChange={(v) => setDraft((p) => p ? { ...p, dureePret: v } : p)} />
                </div>
              </div>
              <TauxField
                label="Taux d'appréciation annuel"
                value={draft.taux}
                onChange={(v) => setDraft((p) => p ? { ...p, taux: v } : p)}
                presets={TAUX_PRESETS.immobilier}
              />
              {mensualiteCalc !== null && (
                <div className="rounded-md bg-muted px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Mensualité calculée</span>
                  <span className="text-sm font-semibold">{fmt(mensualiteCalc)}/mois</span>
                </div>
              )}
            </>
          )}

          {isCrypto && (
            <CryptoForm
              holdings={draft.holdings ?? []}
              taux={draft.taux}
              mensuel={draft.mensuel}
              mensuelSchedule={draft.mensuelSchedule ?? []}
              onHoldingsChange={(h) => {
                const total = h.reduce((s, x) => s + x.quantity * (x.price ?? 0), 0);
                setDraft((prev) => prev ? { ...prev, holdings: h, montant: total > 0 ? total : prev.montant } : prev);
              }}
              onTauxChange={(t) => setDraft((prev) => prev ? { ...prev, taux: t } : prev)}
              onMensuelChange={(v) => setDraft((prev) => prev ? { ...prev, mensuel: v } : prev)}
              onScheduleChange={(s) => setDraft((prev) => prev ? { ...prev, mensuelSchedule: s } : prev)}
            />
          )}

          {!isImmo && !isCrypto && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Montant actuel (€)</Label>
                  <NumberInput value={draft.montant} min={0} onChange={(v) => setDraft((p) => p ? { ...p, montant: v } : p)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Versement mensuel (€)</Label>
                  <NumberInput value={draft.mensuel} min={0} onChange={(v) => setDraft((p) => p ? { ...p, mensuel: v } : p)} />
                </div>
              </div>
              <TauxField
                label="Taux de rendement annuel"
                value={draft.taux}
                onChange={(v) => setDraft((p) => p ? { ...p, taux: v } : p)}
                presets={TAUX_PRESETS.epargne}
              />
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-medium">Évolution du versement mensuel</Label>
                <ScheduleField
                  schedule={draft.mensuelSchedule ?? []}
                  mensuelBase={draft.mensuel}
                  onChange={(s) => setDraft((p) => p ? { ...p, mensuelSchedule: s } : p)}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2">
          <div>
            {canDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />Supprimer
              </button>
            )}
            {canDelete && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confirmer ?</span>
                <button
                  onClick={() => { onDelete(draft.id); onOpenChange(false); }}
                  className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium bg-red-500 text-white transition-colors hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                >Oui</button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Non</Button>
              </div>
            )}
          </div>
          <Button onClick={() => { onSave(draft); onOpenChange(false); }} className="bg-green-400 hover:bg-green-500 text-black">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogoutButton() {
  const { signOut } = useClerk();
  return (
    <Button variant="outline" size="icon" onClick={() => signOut({ redirectUrl: "/sign-in" })} aria-label="Se déconnecter">
      <LogOut className="h-4 w-4" />
    </Button>
  );
}

interface FireResult { capital: number; monthsLeft: number | null; date: string | null; already: boolean; }

function FireCard({ fireResult, fireTarget, onFireTargetChange, fireRate, onFireRateChange, totalNow }: {
  fireResult: FireResult; fireTarget: number; onFireTargetChange: (n: number) => void;
  fireRate: number; onFireRateChange: (n: number) => void; totalNow: number;
}) {
  const FIRE_RATES = [3, 3.5, 4, 5];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base">Objectif FIRE</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Dépenses mensuelles souhaitées</p>
            <div className="relative">
              <NumberInput value={fireTarget} onChange={onFireTargetChange} className="pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">€</span>
            </div>
            <p className="text-xs text-muted-foreground">Capital cible : <span className="font-semibold text-foreground">{fmt(fireResult.capital)}</span></p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Taux de retrait annuel</p>
            <div className="relative">
              <NumberInput value={fireRate} onChange={onFireRateChange} className="pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FIRE_RATES.map((r) => (
                <button key={r} onClick={() => onFireRateChange(r)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${fireRate === r ? "bg-green-400 text-black border-green-400 font-semibold" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
                  {r}%
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {fireResult.already ? (
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="font-bold text-green-500 text-lg">Objectif atteint !</p>
                  <p className="text-xs text-muted-foreground">Ton patrimoine actuel couvre déjà cet objectif.</p>
                </div>
              </div>
            ) : fireResult.date ? (
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold capitalize">{fireResult.date}</p>
                  <p className="text-xs text-muted-foreground">
                    dans {Math.floor(fireResult.monthsLeft! / 12)} ans{fireResult.monthsLeft! % 12 > 0 ? ` et ${fireResult.monthsLeft! % 12} mois` : ""}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progression</span>
                    <span>{Math.min(100, Math.round(totalNow / fireResult.capital * 100))}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${Math.min(100, totalNow / fireResult.capital * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(totalNow)}</span>
                    <span>{fmt(fireResult.capital)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-5 w-5" />
                <p className="text-sm">Objectif hors de portée dans les 50 prochaines années avec les projections actuelles.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function loadState() {
  try {
    const raw = localStorage.getItem("patrimoine-v1");
    if (!raw) return null;
    return JSON.parse(raw) as { cagnottes: Cagnotte[]; years: number; nextId: number; dark: boolean; fireTarget?: number; fireRate?: number };
  } catch { return null; }
}

export default function Dashboard() {
  const [loaded, setLoaded] = useState(false);
  const [cagnottes, setCagnottes] = useState<Cagnotte[]>(DEFAULT_CAGNOTTES);
  const [years, setYears] = useState(20);
  const [nextId, setNextId] = useState(10);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [activeChart, setActiveChart] = useState<"projection" | "mensuel">("projection");
  const [enableInterest, setEnableInterest] = useState(true);
  const [enableSavings, setEnableSavings] = useState(true);
  const [fireTarget, setFireTarget] = useState<number>(3000);
  const [fireRate, setFireRate] = useState<number>(4);
  const dragSrcRef = useRef<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/data");
        const { data } = await res.json();
        if (data) {
          if (data.cagnottes) setCagnottes(data.cagnottes);
          if (data.years) setYears(data.years);
          if (data.nextId) setNextId(data.nextId);
          if (typeof data.dark === "boolean") setDark(data.dark);
          if (data.fireTarget) setFireTarget(data.fireTarget);
          if (data.fireRate) setFireRate(data.fireRate);
          if (typeof data.enableInterest === "boolean") setEnableInterest(data.enableInterest);
          if (typeof data.enableSavings === "boolean") setEnableSavings(data.enableSavings);
        }
      } catch {}
      setLoaded(true);
    }
    load();
  }, []);

  // Persist to Supabase on every change
  useEffect(() => {
    if (!loaded) return;
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cagnottes, years, nextId, dark, fireTarget, fireRate, enableInterest, enableSavings }),
    }).catch(() => {});
  }, [cagnottes, years, nextId, dark, fireTarget, fireRate, enableInterest, enableSavings, loaded]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Auto-refresh crypto prices: once data is loaded, then every 60s
  const cagnottesRef = useRef(cagnottes);
  useEffect(() => { cagnottesRef.current = cagnottes; }, [cagnottes]);
  useEffect(() => {
    if (!loaded) return;
    async function refreshCrypto() {
      const current = cagnottesRef.current;
      const cryptos = current.filter((c) => c.type === "crypto" && c.holdings?.length);
      if (!cryptos.length) return;
      const allIds = [...new Set(cryptos.flatMap((c) => c.holdings!.map((h) => h.id)))];
      try {
        const data = await fetchCryptoPrices(allIds);
        setCagnottes((prev) => prev.map((c) => {
          if (c.type !== "crypto" || !c.holdings?.length) return c;
          const updatedHoldings = c.holdings.map((h) => ({
            ...h,
            price: data[h.id]?.price ?? h.price,
            image: h.image ?? data[h.id]?.image,
          }));
          const total = updatedHoldings.reduce((s, h) => s + h.quantity * (h.price ?? 0), 0);
          return { ...c, holdings: updatedHoldings, montant: total > 0 ? total : c.montant };
        }));
      } catch {}
    }
    refreshCrypto();
    const id = setInterval(refreshCrypto, 60_000);
    return () => clearInterval(id);
  }, [loaded]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const editingCagnotte = cagnottes.find((c) => c.id === editingId) ?? null;
  const editingIndex = cagnottes.findIndex((c) => c.id === editingId);

  const visibleCagnottes = cagnottes.filter((c) => c.visible !== false);

  const chartData = useMemo(() => {
    const totalMonths = years * 12;
    const projOpts = { noInterest: !enableInterest, noSavings: !enableSavings };
    const allPoints = Array.from({ length: totalMonths + 1 }, (_, m) => {
      const row: Record<string, number | string> = { month: monthLabel(m, currentYear, currentMonth) };
      visibleCagnottes.forEach((c) => {
        const pts = projectCagnotte(c, years, projOpts);
        row[c.name] = Math.round(pts[m] ?? 0);
      });
      return row;
    });
    const maxBars = 60;
    if (allPoints.length <= maxBars) return allPoints;
    const step = Math.ceil(allPoints.length / maxBars);
    return allPoints.filter((_, i) => i % step === 0 || i === allPoints.length - 1);
  }, [cagnottes, years, currentYear, currentMonth, enableInterest, enableSavings]);

  const mensuelCagnottes = visibleCagnottes.filter((c) => c.type !== "immobilier");

  const chartDataMensuel = useMemo(() => {
    const totalMonths = years * 12;
    const allPoints = Array.from({ length: totalMonths + 1 }, (_, m) => {
      const ym = addMonths(currentYear, currentMonth, m);
      let total = 0;
      const changeLabels: string[] = [];
      mensuelCagnottes.forEach((c) => {
        const sorted = [...(c.mensuelSchedule ?? [])].sort((a, b) => a.date.localeCompare(b.date));
        let mensuel = c.mensuel;
        for (const s of sorted) {
          if (s.date <= ym) mensuel = s.montant;
          if (s.date === ym && s.label) changeLabels.push(s.label);
        }
        total += mensuel;
      });
      return {
        month: monthLabel(m, currentYear, currentMonth),
        total,
        changeLabel: changeLabels.length > 0 ? changeLabels.join(", ") : null,
      };
    });
    const maxPoints = 60;
    if (allPoints.length <= maxPoints) return allPoints;
    const step = Math.ceil(allPoints.length / maxPoints);
    return allPoints.filter((p, i) => i % step === 0 || i === allPoints.length - 1 || !!p.changeLabel);
  }, [cagnottes, years, currentYear, currentMonth]);

  const totalNow = visibleCagnottes.reduce((s, c) => s + c.montant, 0);
  const lastRow = chartData[chartData.length - 1];
  const totalFuture = lastRow ? visibleCagnottes.reduce((s, c) => s + ((lastRow[c.name] as number) || 0), 0) : 0;
  const mensuelTotal = visibleCagnottes.filter((c) => c.type !== "immobilier").reduce((s, c) => s + getCurrentMensuel(c), 0);

  const fireResult = useMemo(() => {
    const fireCapital = fireTarget * 12 / (fireRate / 100);
    if (totalNow >= fireCapital) return { capital: fireCapital, monthsLeft: 0, date: null, already: true };
    const MAX_MONTHS = 50 * 12;
    for (let m = 1; m <= MAX_MONTHS; m++) {
      const ym = addMonths(currentYear, currentMonth, m);
      let total = 0;
      visibleCagnottes.forEach((c) => {
        const pts = projectMonthlyWithSchedule(c.montant, c.mensuel, c.mensuelSchedule ?? [], c.taux, Math.ceil(m / 12) + 1);
        total += pts[m] ?? pts[pts.length - 1];
      });
      if (total >= fireCapital) {
        return { capital: fireCapital, monthsLeft: m, date: monthLabel(m, currentYear, currentMonth), already: false };
      }
    }
    return { capital: fireCapital, monthsLeft: null, date: null, already: false };
  }, [fireTarget, fireRate, cagnottes, currentYear, currentMonth]);

  function openEdit(id: number) { setEditingId(id); setDialogOpen(true); }

  function addCagnotte(data: Omit<Cagnotte, "id">) {
    const newId = nextId;
    setCagnottes((prev) => [...prev, { id: newId, ...data }]);
    setNextId((n) => n + 1);
  }

  function toggleVisible(id: number) {
    setCagnottes((prev) => prev.map((c) => c.id === id ? { ...c, visible: c.visible === false ? true : false } : c));
  }

  function saveCagnotte(updated: Cagnotte) {
    // Recalculate mensualité for immobilier
    if (updated.type === "immobilier" && updated.prixBien && updated.tauxPret && updated.dureePret) {
      updated.mensuel = computeMensualite(updated.prixBien - updated.montant, updated.tauxPret, updated.dureePret);
    }
    setCagnottes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function deleteCagnotte(id: number) { setCagnottes((prev) => prev.filter((c) => c.id !== id)); }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">Mon Patrimoine</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setDark((d) => !d)} aria-label="Changer le thème">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <LogoutButton />
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">

          {/* Left: Placements */}
          <div className="space-y-2">
            {/* Patrimoine actuel */}
            <div className="rounded-lg border bg-card px-3 py-3 mb-1">
              <p className="text-xs text-muted-foreground mb-0.5">Patrimoine actuel</p>
              <p className="text-xl font-bold">{fmt(totalNow)}</p>
            </div>
            {cagnottes.map((c, i) => {
              const color = getColor(c, i);
              const isVisible = c.visible !== false;
              const isDragging = dragIdx === i;
              const isOver = dragOverIdx === i;
              return (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => { dragSrcRef.current = i; setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnter={(e) => { e.preventDefault(); if (dragSrcRef.current !== i) setDragOverIdx(i); }}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragSrcRef.current;
                    if (from === null || from === i) { setDragOverIdx(null); return; }
                    const next = [...cagnottes];
                    const [item] = next.splice(from, 1);
                    next.splice(i, 0, item);
                    setCagnottes(next);
                    dragSrcRef.current = null; setDragIdx(null); setDragOverIdx(null);
                  }}
                  onDragEnd={() => { dragSrcRef.current = null; setDragIdx(null); setDragOverIdx(null); }}
                  className={`flex items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-colors hover:bg-accent select-none
                    ${isDragging ? "opacity-40" : ""}
                    ${isOver && dragIdx !== i ? "border-primary" : ""}`}
                >
                  {/* drag handle */}
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                  {/* color picker */}
                  <ColorDot color={color} onChange={(newColor) =>
                    setCagnottes((prev) => prev.map((x) => x.id === c.id ? { ...x, color: newColor } : x))
                  } />
                  {/* title + amount */}
                  <button onClick={() => openEdit(c.id)} className="flex-1 flex items-center justify-between min-w-0 text-left gap-2">
                    <span className="font-bold tracking-tight text-foreground truncate">{c.name}</span>
                    <span className="text-sm text-muted-foreground flex-shrink-0">{fmt(c.montant)}</span>
                  </button>
                  {/* visibility toggle */}
                  <button
                    onClick={() => toggleVisible(c.id)}
                    className={`flex items-center flex-shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${isVisible ? "bg-green-400" : "bg-border"}`}
                    aria-label={isVisible ? "Masquer du graphique" : "Afficher dans le graphique"}
                  >
                    <span className={`h-4 w-4 rounded-full bg-white dark:bg-black shadow-sm transition-transform duration-200 ${isVisible ? "translate-x-[16px]" : "translate-x-0"}`} />
                  </button>
                </div>
              );
            })}
            <Button variant="outline" className="w-full mt-1" onClick={() => setAddDialogOpen(true)}>
              <PlusCircle className="h-4 w-4" />
              Ajouter un placement
            </Button>
          </div>

          {/* Right: Chart */}
          <Card className="flex flex-col h-full">
            <CardHeader>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                    {activeChart === "projection" ? "Projection dans" : "Épargne mensuelle dans"}
                    <YearDropdown value={years} onChange={setYears} options={YEAR_OPTIONS} />
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {activeChart === "projection"
                      ? fmt(totalFuture)
                      : <>{fmt(mensuelTotal)}<span className="text-sm font-normal text-muted-foreground">/mois</span></>
                    }
                  </p>
                </div>
                <div className="flex rounded-md border bg-muted p-0.5 gap-0.5 text-xs">
                  {([["projection", "Projection"], ["mensuel", "Épargne mensuelle"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActiveChart(key)}
                      className={`px-3 py-1 rounded transition-colors font-medium ${activeChart === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {activeChart === "projection" && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setEnableInterest((v) => !v)}
                      className={`flex items-center flex-shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${enableInterest ? "bg-green-400" : "bg-border"}`}
                      aria-label="Activer les intérêts composés"
                    >
                      <span className={`h-4 w-4 rounded-full bg-white dark:bg-black shadow-sm transition-transform duration-200 ${enableInterest ? "translate-x-[16px]" : "translate-x-0"}`} />
                    </button>
                    <span className={enableInterest ? "text-foreground" : "text-muted-foreground"}>Intérêts composés</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setEnableSavings((v) => !v)}
                      className={`flex items-center flex-shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${enableSavings ? "bg-green-400" : "bg-border"}`}
                      aria-label="Activer l'épargne mensuelle"
                    >
                      <span className={`h-4 w-4 rounded-full bg-white dark:bg-black shadow-sm transition-transform duration-200 ${enableSavings ? "translate-x-[16px]" : "translate-x-0"}`} />
                    </button>
                    <span className={enableSavings ? "text-foreground" : "text-muted-foreground"}>Épargne mensuelle</span>
                  </label>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 pb-4 min-h-0">
              <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                {activeChart === "projection" ? (
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={Math.floor(chartData.length / 8)} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={60} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "13px", paddingTop: "16px" }}
                      formatter={(value) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>}
                      payload={visibleCagnottes.map((c) => ({ value: c.name, type: "circle" as const, color: getColor(c, cagnottes.indexOf(c)) }))}
                    />
                    {[...visibleCagnottes].reverse().map((c, i) => (
                      <Bar key={c.id} dataKey={c.name} stackId="stack" fill={getColor(c, cagnottes.indexOf(c))}
                        radius={i === 0 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                ) : (
                  <LineChart data={chartDataMensuel} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={Math.floor(chartDataMensuel.length / 8)} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={60} domain={[0, (max: number) => Math.round(max * 1.25)]} />
                    <Tooltip content={<MensuelTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
                    <Line
                      type="stepAfter"
                      dataKey="total"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!payload.changeLabel) return <circle key={`d-${cx}`} cx={cx} cy={cy} r={0} fill="none" />;
                        return <circle key={`d-${cx}`} cx={cx} cy={cy} r={5} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      name="Total mensuel"
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* FIRE Card */}
        <div className="lg:col-start-2">
          <FireCard
            fireResult={fireResult}
            fireTarget={fireTarget}
            onFireTargetChange={setFireTarget}
            fireRate={fireRate}
            onFireRateChange={setFireRate}
            totalNow={totalNow}
          />
        </div>
      </div>

      <AddDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={addCagnotte} />
      <CagnotteDialog
        cagnotte={editingCagnotte}
        color={editingCagnotte ? getColor(editingCagnotte, editingIndex >= 0 ? editingIndex : 0) : PALETTE[0]}
        canDelete={cagnottes.length > 1}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={saveCagnotte}
        onDelete={deleteCagnotte}
      />
    </div>
  );
}
