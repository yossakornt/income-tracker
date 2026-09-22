import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Plus, Trash2, Settings as SettingsIcon, BarChart3, Home as HomeIcon,
  ChevronLeft, ChevronRight, X, Pencil, AlertCircle, Download, Check,
  MapPin, Upload, FileSpreadsheet, History, Users, Database
} from 'lucide-react';

/* =========== CONSTANTS =========== */
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

// Default branch schedule by day-of-week (0=Sun ... 6=Sat).
const DEFAULT_SCHEDULE = {
  0: 'Esplanade',
  1: 'Promenade',
  4: 'Seacon Bangkae',
  5: 'Seacon Srinakarind',
  6: 'Terminal 21',
};
const DEFAULT_BRANCHES = ['Promenade', 'Seacon Bangkae', 'Seacon Srinakarind', 'Terminal 21', 'Esplanade'];
const CHART_COLORS = ['#2d4a3a', '#c9956a', '#8a5a44', '#4d6b5a', '#b58c5e', '#6b8e7a', '#d4a574', '#a67c52'];

// Colors used to group entries per person (entry.color = index, or null = no group)
const GROUP_COLORS = [
  { dot: '#3b82f6', bg: '#e8f0fe', name: 'ฟ้า' },
  { dot: '#e11d74', bg: '#fde8f1', name: 'ชมพู' },
  { dot: '#f59e0b', bg: '#fef3dc', name: 'ส้ม' },
  { dot: '#10b981', bg: '#e1f7ee', name: 'เขียว' },
  { dot: '#8b5cf6', bg: '#efe9fe', name: 'ม่วง' },
  { dot: '#ef4444', bg: '#fde8e8', name: 'แดง' },
];
// Colors selectable for procedure buttons
const PROC_COLORS = ['#2d4a3a', '#c9956a', '#8a5a44', '#3b6ea5', '#b5476b', '#7a5ea8', '#c47d1c', '#4d8b8b'];

const BACKUP_VERSION = 1;

/* =========== HELPERS =========== */
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayKey = () => toKey(new Date());
const keyToDate = (k) => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const addDaysKey = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return toKey(d); };
const getMondayKey = (date = new Date()) => {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toKey(d);
};
const formatThaiDate = (k) => {
  const [y,m,d] = k.split('-').map(Number);
  const date = new Date(y,m-1,d);
  return `${THAI_DAYS[date.getDay()]} ${d} ${THAI_MONTHS[m-1]} ${y+543}`;
};
const formatThaiDateShort = (k) => {
  const [,m,d] = k.split('-').map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m-1]}`;
};
const formatMoney = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const formatMoneyShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1000000) return (v/1000000).toFixed(1)+'M';
  if (v >= 1000) return (v/1000).toFixed(v >= 10000 ? 0 : 1)+'k';
  return String(Math.round(v));
};
const groupColor = (c) => (c === null || c === undefined ? null : GROUP_COLORS[c % GROUP_COLORS.length]);

// Try the native share sheet, then a download link. Returns true if shared.
async function shareOrDownload(text, filename, mime) {
  try {
    if (navigator.canShare && typeof File !== 'undefined') {
      const file = new File([text], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return true;
      }
    }
  } catch { /* user cancelled or unsupported - fall through */ }

  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* fall through */ }
  return false;
}

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700;800&display=swap');
.font-serif-display { font-family: 'Instrument Serif', serif; font-weight: 400; letter-spacing: -0.01em; }
.font-body { font-family: 'Manrope', sans-serif; }
.app-bg { background: #f5f0e6; }
.card { background: #ffffff; border: 1px solid #e8dfcd; }
.accent { color: #2d4a3a; }
.accent-bg { background: #2d4a3a; }
.accent-light-bg { background: #e3ede5; }
.divider { border-color: #ebe1cd; }
.muted { color: #8a8074; }
.warm-dark { color: #1f1a14; }
.tap-scale:active { transform: scale(0.97); }
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { scrollbar-width: none; }
`;

/* =========== APP =========== */
export default function App() {
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [procedures, setProcedures] = useState([]);
  const [entries, setEntries] = useState([]);
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [weeklyOverride, setWeeklyOverride] = useState({});
  const [confirmations, setConfirmations] = useState({});
  const [activeColor, setActiveColor] = useState(0);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!document.getElementById('income-tracker-fonts')) {
      const style = document.createElement('style');
      style.id = 'income-tracker-fonts';
      style.innerHTML = FONT_STYLE;
      document.head.appendChild(style);
    }
  }, []);

  // Load persisted data
  useEffect(() => {
    let cancelled = false;
    const safeGet = (key, fallback) => {
      if (typeof window === 'undefined') return fallback;
      try {
        const val = window.localStorage.getItem(key);
        if (!val) return fallback;
        return JSON.parse(val);
      } catch { return fallback; }
    };
    function load() {
      try {
        const p = safeGet('procedures', []);
        const e = safeGet('entries', []);
        const b = safeGet('branches', DEFAULT_BRANCHES);
        const s = safeGet('schedule', DEFAULT_SCHEDULE);
        const w = safeGet('weeklyOverride', {});
        const c = safeGet('confirmations', {});
        const ac = safeGet('activeColor', 0);
        if (cancelled) return;
        setProcedures(p);
        setEntries(e);
        setBranches(b);
        setSchedule(s);
        setWeeklyOverride(w);
        setConfirmations(c);
        setActiveColor(ac);
      } catch (err) {
        console.error('Load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const persist = (key, val) => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.error('save failed', key, e); }
  };
  const saveProcedures = (next) => { setProcedures(next); persist('procedures', next); };
  const saveEntries = (next) => { setEntries(next); persist('entries', next); };
  const saveBranches = (next) => { setBranches(next); persist('branches', next); };
  const saveSchedule = (next) => { setSchedule(next); persist('schedule', next); };
  const saveWeeklyOverride = (next) => { setWeeklyOverride(next); persist('weeklyOverride', next); };
  const saveConfirmations = (next) => { setConfirmations(next); persist('confirmations', next); };
  const saveActiveColor = (next) => { setActiveColor(next); persist('activeColor', next); };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1500); };

  const todayDow = new Date().getDay();
  const thisMonday = getMondayKey();
  const resolvedBranch = useMemo(() => {
    const override = weeklyOverride[thisMonday]?.[todayDow];
    if (override) return override;
    return schedule[todayDow] || null;
  }, [weeklyOverride, schedule, todayDow, thisMonday]);

  // Branch for any date: weekly override first, then the default schedule.
  const resolveBranchFor = (dateKey) => {
    const d = keyToDate(dateKey);
    const dow = d.getDay();
    return weeklyOverride[getMondayKey(d)]?.[dow] || schedule[dow] || null;
  };

  const setBranchForToday = (branchName) => {
    const next = { ...weeklyOverride };
    if (!next[thisMonday]) next[thisMonday] = {};
    next[thisMonday] = { ...next[thisMonday], [todayDow]: branchName };
    saveWeeklyOverride(next);
    if (!branches.includes(branchName)) saveBranches([...branches, branchName]);
  };

  const addBranch = (name) => { if (!branches.includes(name)) saveBranches([...branches, name]); };

  const addEntry = (proc, opts = {}) => {
    const date = opts.date || todayKey();
    const newEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      date,
      procedureId: proc.id,
      name: proc.name,
      price: Number(opts.price !== undefined ? opts.price : proc.price),
      branch: opts.branch !== undefined ? opts.branch : (resolvedBranch || 'ไม่ระบุ'),
      ts: Date.now(),
      color: activeColor,
      isChecked: false, // For branch reconciliation
      ...(date !== todayKey() ? { backfilled: true } : {}),
    };
    saveEntries([...entries, newEntry]);
    showToast(`บันทึก ${proc.name}`);
  };

  const deleteEntry = (id) => saveEntries(entries.filter(e => e.id !== id));
  const updateEntry = (id, patch) => saveEntries(entries.map(e => e.id === id ? { ...e, ...patch } : e));

  const exportBackup = () => JSON.stringify({
    app: 'income-tracker',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    procedures, entries, branches, schedule, weeklyOverride, confirmations, activeColor,
  }, null, 2);

  const importBackup = (data) => {
    saveProcedures(data.procedures || []);
    saveEntries(data.entries || []);
    saveBranches(data.branches || DEFAULT_BRANCHES);
    saveSchedule(data.schedule || DEFAULT_SCHEDULE);
    saveWeeklyOverride(data.weeklyOverride || {});
    saveConfirmations(data.confirmations || {});
    saveActiveColor(typeof data.activeColor === 'number' ? data.activeColor : 0);
    showToast('นำเข้าข้อมูลแล้ว');
  };

  return (
    <div className="font-body warm-dark min-h-screen app-bg" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <style>{FONT_STYLE}</style>

      <div className="max-w-md mx-auto pb-28">
        <header className="px-6 pt-8 pb-4">
          <div className="flex items-baseline justify-between">
            <h1 className="font-serif-display text-3xl warm-dark">สมุดรายได้</h1>
            <span className="text-xs muted tracking-wide uppercase">Income Ledger</span>
          </div>
          <div className="mt-1 h-px divider border-t" />
        </header>

        {loading ? (
          <div className="px-6 py-20 text-center muted">กำลังโหลด...</div>
        ) : (
          <>
            {tab === 'home' && (
              <HomeTab
                procedures={procedures}
                entries={entries}
                branches={branches}
                resolvedBranch={resolvedBranch}
                todayDow={todayDow}
                activeColor={activeColor}
                onChangeColor={saveActiveColor}
                onAddEntry={addEntry}
                onDeleteEntry={deleteEntry}
                onUpdateEntry={updateEntry}
                onSelectBranch={setBranchForToday}
                onAddBranch={addBranch}
                goToSettings={() => setTab('settings')}
              />
            )}
            {tab === 'history' && (
              <HistoryTab
                procedures={procedures}
                entries={entries}
                branches={branches}
                resolveBranchFor={resolveBranchFor}
                activeColor={activeColor}
                onChangeColor={saveActiveColor}
                onAddEntry={addEntry}
                onDeleteEntry={deleteEntry}
                onUpdateEntry={updateEntry}
                onSaveEntries={saveEntries}
                onAddBranch={addBranch}
              />
            )}
            {tab === 'summary' && (
              <SummaryTab
                entries={entries}
                viewMonth={viewMonth}
                setViewMonth={setViewMonth}
                onSaveEntries={saveEntries}
                confirmations={confirmations}
                onSaveConfirmations={saveConfirmations}
              />
            )}
            {tab === 'settings' && (
              <SettingsTab
                procedures={procedures}
                onSaveProcedures={saveProcedures}
                branches={branches}
                onSaveBranches={saveBranches}
                schedule={schedule}
                onSaveSchedule={saveSchedule}
                entries={entries}
                onResetEntries={() => { saveEntries([]); saveConfirmations({}); showToast('ล้างรายการแล้ว'); }}
                onResetAll={() => {
                  saveEntries([]); saveProcedures([]);
                  saveBranches(DEFAULT_BRANCHES); saveSchedule(DEFAULT_SCHEDULE);
                  saveWeeklyOverride({}); saveConfirmations({}); saveActiveColor(0);
                  showToast('รีเซ็ตทั้งหมดแล้ว');
                }}
                onExportBackup={exportBackup}
                onImportBackup={importBackup}
                showToast={showToast}
              />
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 accent-bg text-white px-4 py-2 rounded-full text-sm shadow-lg flex items-center gap-2">
          <Check size={14} /> {toast}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-md mx-auto px-4 pb-4">
          <div className="card rounded-2xl flex justify-around p-1.5 shadow-lg" style={{ boxShadow: '0 8px 24px rgba(31,26,20,0.08)' }}>
            <NavBtn icon={<HomeIcon size={20} />} label="วันนี้" active={tab==='home'} onClick={() => setTab('home')} />
            <NavBtn icon={<History size={20} />} label="ย้อนหลัง" active={tab==='history'} onClick={() => setTab('history')} />
            <NavBtn icon={<BarChart3 size={20} />} label="สรุป" active={tab==='summary'} onClick={() => setTab('summary')} />
            <NavBtn icon={<SettingsIcon size={20} />} label="ตั้งค่า" active={tab==='settings'} onClick={() => setTab('settings')} />
          </div>
        </div>
      </nav>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`tap-scale flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl transition ${active ? 'accent-bg text-white' : 'text-stone-600'}`}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

/* =========== SHARED: GROUP COLOR PICKER =========== */
// Picks the color given to newly added entries, so entries can be grouped per person.
function GroupColorBar({ activeColor, onChange }) {
  const next = () => onChange(((activeColor ?? -1) + 1) % GROUP_COLORS.length);
  return (
    <div className="card rounded-2xl px-3 py-2.5 flex items-center gap-2">
      <Users size={14} className="muted shrink-0" />
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-hide">
        {GROUP_COLORS.map((c, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            aria-label={`สี${c.name}`}
            className="tap-scale w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
            style={{ background: c.dot, boxShadow: activeColor === i ? `0 0 0 2px #fff, 0 0 0 4px ${c.dot}` : 'none' }}
          >
            {activeColor === i && <Check size={14} className="text-white" />}
          </button>
        ))}
      </div>
      <button onClick={next} className="tap-scale shrink-0 text-xs accent-bg text-white px-3 py-1.5 rounded-full">
        คนถัดไป
      </button>
    </div>
  );
}

/* =========== SHARED: PROCEDURE GRID =========== */
function ProcedureGrid({ procedures, onAdd, goToSettings }) {
  const [customFor, setCustomFor] = useState(null);
  const [customPrice, setCustomPrice] = useState('');

  if (procedures.length === 0) {
    return (
      <div className="card rounded-2xl p-6 text-center">
        <AlertCircle className="mx-auto muted mb-2" size={20} />
        <p className="text-sm warm-dark mb-1">ยังไม่มีหัตถการ</p>
        <p className="text-xs muted mb-4">เพิ่มในตั้งค่า หรือ Import จาก Excel</p>
        {goToSettings && (
          <button onClick={goToSettings} className="tap-scale accent-bg text-white text-sm px-5 py-2.5 rounded-full inline-flex items-center gap-1.5">
            <Plus size={16} /> เริ่มเพิ่มหัตถการ
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {procedures.map(p => (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            className="tap-scale card rounded-2xl p-4 text-left transition hover:border-stone-300"
            style={p.color ? { borderLeft: `5px solid ${p.color}` } : undefined}
          >
            <div className="text-sm font-medium warm-dark line-clamp-2 min-h-[2.5rem]">{p.name}</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-serif-display text-2xl accent" style={p.color ? { color: p.color } : undefined}>{formatMoney(p.price)}</span>
              <span className="text-[10px] muted">บาท</span>
            </div>
          </button>
        ))}
        <button
          onClick={() => { setCustomFor({ id: 'custom', name: '', price: 0 }); setCustomPrice(''); }}
          className="tap-scale rounded-2xl p-4 border border-dashed divider text-left muted hover:bg-white/40 transition"
        >
          <div className="text-sm font-medium">รายการอื่น ๆ</div>
          <div className="mt-2 text-xs">กำหนดเอง</div>
        </button>
      </div>

      {customFor && (
        <Modal onClose={() => setCustomFor(null)}>
          <h3 className="font-serif-display text-2xl mb-1">บันทึกรายการ</h3>
          <p className="text-xs muted mb-4">กำหนดราคาเอง</p>
          <input
            type="text" placeholder="ชื่อรายการ"
            value={customFor.name}
            onChange={e => setCustomFor({ ...customFor, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-stone-50 border divider text-sm mb-3 focus:outline-none focus:border-stone-400"
          />
          <div className="relative">
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={customPrice}
              onChange={e => setCustomPrice(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-stone-50 border divider text-lg font-serif-display focus:outline-none focus:border-stone-400"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 muted text-sm">บาท</span>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setCustomFor(null)} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">ยกเลิก</button>
            <button
              onClick={() => {
                const price = Number(customPrice);
                if (!customPrice || isNaN(price) || price <= 0) return;
                if (!customFor.name.trim()) return;
                onAdd({ id: `custom_${Date.now()}`, name: customFor.name.trim(), price }, { price });
                setCustomFor(null); setCustomPrice('');
              }}
              className="flex-1 py-3 rounded-xl accent-bg text-white text-sm font-medium tap-scale"
            >บันทึก</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* =========== SHARED: ENTRY LIST =========== */
function EntryList({ entries, onDelete, onUpdate, emptyText }) {
  if (entries.length === 0) return <p className="muted text-sm py-4">{emptyText}</p>;

  // Per-color subtotals (per person)
  const groups = {};
  entries.forEach(e => {
    const k = e.color === null || e.color === undefined ? 'none' : String(e.color);
    if (!groups[k]) groups[k] = { color: e.color, total: 0, count: 0 };
    groups[k].total += Number(e.price);
    groups[k].count += 1;
  });
  const groupList = Object.values(groups);

  // Tap the dot to cycle this entry's color: 0 → 1 → ... → none → 0
  const cycleColor = (e) => {
    const c = e.color;
    const next = c === null || c === undefined ? 0 : (c + 1 >= GROUP_COLORS.length ? null : c + 1);
    onUpdate(e.id, { color: next });
  };

  return (
    <>
      {groupList.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {groupList.map((g, i) => {
            const gc = groupColor(g.color);
            return (
              <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
                style={{ background: gc ? gc.bg : '#f1ece2' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: gc ? gc.dot : '#b8ad9c' }} />
                <span className="warm-dark">{g.count} รายการ · {formatMoney(g.total)}</span>
              </div>
            );
          })}
        </div>
      )}
      <ul className="card rounded-2xl divide-y divider overflow-hidden">
        {entries.map(e => {
          const gc = groupColor(e.color);
          return (
            <li key={e.id} className="flex items-center justify-between pl-3 pr-4 py-3"
              style={gc ? { background: gc.bg, boxShadow: `inset 4px 0 0 ${gc.dot}` } : undefined}>
              <button onClick={() => cycleColor(e)} aria-label="เปลี่ยนสี"
                className="tap-scale w-5 h-5 rounded-full shrink-0 mr-3 border-2 border-white"
                style={{ background: gc ? gc.dot : '#d6cdbd' }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm warm-dark truncate">{e.name}</div>
                <div className="text-[11px] muted mt-0.5 flex items-center gap-1.5">
                  {e.backfilled
                    ? <span>เพิ่มย้อนหลัง</span>
                    : <span>{new Date(e.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>}
                  {e.branch && <span>· {e.branch}</span>}
                </div>
              </div>
              <div className="font-serif-display text-xl warm-dark mr-3">{formatMoney(e.price)}</div>
              <button onClick={() => onDelete(e.id)} className="tap-scale text-stone-400 hover:text-red-500 transition p-1">
                <X size={18} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] muted mt-2">แตะวงกลมสีหน้ารายการเพื่อเปลี่ยนสี</p>
    </>
  );
}

/* =========== HOME =========== */
function HomeTab({ procedures, entries, branches, resolvedBranch, todayDow, activeColor, onChangeColor, onAddEntry, onDeleteEntry, onUpdateEntry, onSelectBranch, onAddBranch, goToSettings }) {
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  const tk = todayKey();
  const todayEntries = entries.filter(e => e.date === tk).sort((a,b) => b.ts - a.ts);
  const todayTotal = todayEntries.reduce((s,e) => s + Number(e.price), 0);
  const todayCount = todayEntries.length;

  const needsBranchSetup = !resolvedBranch && (todayDow === 2 || todayDow === 3);

  return (
    <div className="px-6">
      <p className="muted text-sm mb-1">{formatThaiDate(tk)}</p>

      {/* Branch chip */}
      <button
        onClick={() => setShowBranchPicker(true)}
        className="tap-scale mt-2 inline-flex items-center gap-2 card rounded-full pl-3 pr-4 py-1.5"
      >
        <MapPin size={14} className="accent" />
        <span className="text-sm warm-dark">
          {resolvedBranch || (needsBranchSetup ? 'ยังไม่ได้เลือกสาขา' : 'เลือกสาขา')}
        </span>
        <ChevronRight size={14} className="muted" />
      </button>

      {/* Total card */}
      <div className="mt-4 card rounded-3xl p-6 relative overflow-hidden">
        <div className="flex items-baseline justify-between">
          <span className="text-xs muted uppercase tracking-widest">รายได้วันนี้</span>
          <span className="text-xs muted">{todayCount} รายการ</span>
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="font-serif-display text-6xl warm-dark leading-none">{formatMoney(todayTotal)}</span>
          <span className="ml-2 muted text-lg font-serif-display">บาท</span>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full accent-light-bg opacity-50" />
      </div>

      {/* Procedures grid */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif-display text-2xl">หัตถการ</h2>
          <span className="text-xs muted">แตะเพื่อบันทึก</span>
        </div>
        {procedures.length > 0 && (
          <div className="mb-3">
            <GroupColorBar activeColor={activeColor} onChange={onChangeColor} />
          </div>
        )}
        <ProcedureGrid procedures={procedures} onAdd={onAddEntry} goToSettings={goToSettings} />
      </section>

      {/* Today's entries */}
      <section className="mt-8">
        <h2 className="font-serif-display text-2xl mb-3">รายการวันนี้</h2>
        <EntryList
          entries={todayEntries}
          onDelete={onDeleteEntry}
          onUpdate={onUpdateEntry}
          emptyText="ยังไม่มีรายการ — แตะหัตถการด้านบนเพื่อเริ่ม"
        />
      </section>

      {showBranchPicker && (
        <BranchPickerModal
          branches={branches}
          current={resolvedBranch}
          subtitle={`สำหรับวัน${THAI_DAYS[todayDow]}นี้`}
          onSelect={(name) => { onSelectBranch(name); setShowBranchPicker(false); }}
          onAddBranch={onAddBranch}
          onClose={() => setShowBranchPicker(false)}
        />
      )}
    </div>
  );
}

/* =========== HISTORY (backfill / edit past days) =========== */
function HistoryTab({ procedures, entries, branches, resolveBranchFor, activeColor, onChangeColor, onAddEntry, onDeleteEntry, onUpdateEntry, onSaveEntries, onAddBranch }) {
  const tk = todayKey();
  const [date, setDate] = useState(() => addDaysKey(tk, -1));
  const [branch, setBranch] = useState(() => resolveBranchFor(addDaysKey(tk, -1)));
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  const changeDate = (k) => {
    if (!k || k > tk) return;
    setDate(k);
    // Prefer the branch already used on that day, else the schedule
    const existing = entries.find(e => e.date === k && e.branch);
    setBranch(existing ? existing.branch : resolveBranchFor(k));
  };

  const dayEntries = entries.filter(e => e.date === date).sort((a,b) => b.ts - a.ts);
  const dayTotal = dayEntries.reduce((s,e) => s + Number(e.price), 0);
  const mismatched = dayEntries.some(e => e.branch !== branch);

  const applyBranchToDay = () => {
    onSaveEntries(entries.map(e => e.date === date ? { ...e, branch: branch || 'ไม่ระบุ' } : e));
  };

  return (
    <div className="px-6">
      {/* Date switcher */}
      <div className="flex items-center justify-between card rounded-2xl px-2 py-2">
        <button onClick={() => changeDate(addDaysKey(date, -1))} className="tap-scale p-2 rounded-lg hover:bg-stone-50"><ChevronLeft size={18} /></button>
        <label className="text-center relative cursor-pointer">
          <div className="font-serif-display text-xl warm-dark">{formatThaiDateShort(date)} {keyToDate(date).getFullYear() + 543}</div>
          <div className="text-[11px] muted -mt-0.5">วัน{THAI_DAYS[keyToDate(date).getDay()]} · แตะเพื่อเลือกวัน</div>
          <input
            type="date" value={date} max={tk}
            onChange={e => changeDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <button onClick={() => changeDate(addDaysKey(date, 1))} disabled={date >= tk} className="tap-scale p-2 rounded-lg hover:bg-stone-50 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      {/* Branch chip */}
      <button
        onClick={() => setShowBranchPicker(true)}
        className="tap-scale mt-3 inline-flex items-center gap-2 card rounded-full pl-3 pr-4 py-1.5"
      >
        <MapPin size={14} className="accent" />
        <span className="text-sm warm-dark">{branch || 'เลือกสาขา'}</span>
        <ChevronRight size={14} className="muted" />
      </button>
      {mismatched && dayEntries.length > 0 && (
        <button onClick={applyBranchToDay} className="tap-scale ml-2 text-xs accent underline">
          ใช้สาขานี้กับทุกรายการของวันนี้
        </button>
      )}

      {/* Total card */}
      <div className="mt-4 card rounded-3xl p-6 relative overflow-hidden">
        <div className="flex items-baseline justify-between">
          <span className="text-xs muted uppercase tracking-widest">รายได้วันนั้น</span>
          <span className="text-xs muted">{dayEntries.length} รายการ</span>
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="font-serif-display text-5xl warm-dark leading-none">{formatMoney(dayTotal)}</span>
          <span className="ml-2 muted text-lg font-serif-display">บาท</span>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full accent-light-bg opacity-50" />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif-display text-2xl">เพิ่มรายการย้อนหลัง</h2>
        </div>
        {procedures.length > 0 && (
          <div className="mb-3">
            <GroupColorBar activeColor={activeColor} onChange={onChangeColor} />
          </div>
        )}
        <ProcedureGrid
          procedures={procedures}
          onAdd={(p, opts = {}) => onAddEntry(p, { ...opts, date, branch: branch || 'ไม่ระบุ' })}
        />
      </section>

      <section className="mt-8">
        <h2 className="font-serif-display text-2xl mb-3">รายการของวันนั้น</h2>
        <EntryList
          entries={dayEntries}
          onDelete={onDeleteEntry}
          onUpdate={onUpdateEntry}
          emptyText="ไม่มีรายการในวันนี้"
        />
      </section>

      {showBranchPicker && (
        <BranchPickerModal
          branches={branches}
          current={branch}
          subtitle={`สำหรับ${formatThaiDate(date)}`}
          onSelect={(name) => { setBranch(name); setShowBranchPicker(false); }}
          onAddBranch={onAddBranch}
          onClose={() => setShowBranchPicker(false)}
        />
      )}
    </div>
  );
}

/* =========== BRANCH PICKER =========== */
function BranchPickerModal({ branches, current, subtitle, onSelect, onAddBranch, onClose }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <Modal onClose={onClose}>
      <h3 className="font-serif-display text-2xl mb-1">เลือกสาขา</h3>
      <p className="text-xs muted mb-4">{subtitle}</p>
      <ul className="space-y-2 max-h-72 overflow-y-auto scrollbar-hide">
        {branches.map(b => (
          <li key={b}>
            <button
              onClick={() => onSelect(b)}
              className={`tap-scale w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between ${current === b ? 'accent-bg text-white border-transparent' : 'card'}`}
            >
              <span className="text-sm">{b}</span>
              {current === b && <Check size={16} />}
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="ชื่อสาขาใหม่"
            className="flex-1 px-3 py-2.5 rounded-xl bg-stone-50 border divider text-sm focus:outline-none focus:border-stone-400"
          />
          <button
            onClick={() => {
              const n = newName.trim();
              if (!n) return;
              onAddBranch(n); onSelect(n);
            }}
            className="tap-scale accent-bg text-white px-4 rounded-xl text-sm"
          >เพิ่ม</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="tap-scale mt-3 w-full py-2.5 rounded-xl border border-dashed divider text-sm muted flex items-center justify-center gap-1">
          <Plus size={14} /> เพิ่มสาขาใหม่
        </button>
      )}
    </Modal>
  );
}

/* =========== SUMMARY =========== */
function SummaryTab({ entries, viewMonth, setViewMonth, onSaveEntries, confirmations, onSaveConfirmations }) {
  const { year, month } = viewMonth;
  const monthKey = `${year}-${pad(month+1)}`;
  const monthEntries = entries.filter(e => {
    const [y,m] = e.date.split('-').map(Number);
    return y === year && m === month + 1;
  });
  const monthTotal = monthEntries.reduce((s,e) => s + Number(e.price), 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Average per actual working days (days that have at least one entry)
  const uniqueDaysWorked = new Set(monthEntries.map(e => e.date)).size;
  const avgPerDay = uniqueDaysWorked > 0 ? monthTotal / uniqueDaysWorked : 0;

  // By procedure
  const byProcMap = {};
  monthEntries.forEach(e => {
    if (!byProcMap[e.name]) byProcMap[e.name] = { name: e.name, total: 0, count: 0 };
    byProcMap[e.name].total += Number(e.price);
    byProcMap[e.name].count += 1;
  });
  const procList = Object.values(byProcMap).sort((a,b) => b.total - a.total);

  // Donut chart data: top 6 + others
  const donutData = procList.length <= 7
    ? procList.map(p => ({ name: p.name, value: p.total }))
    : [
        ...procList.slice(0, 6).map(p => ({ name: p.name, value: p.total })),
        { name: 'อื่น ๆ', value: procList.slice(6).reduce((s,p) => s + p.total, 0) },
      ];

  // By branch
  const byBranchMap = {};
  monthEntries.forEach(e => {
    const b = e.branch || 'ไม่ระบุ';
    if (!byBranchMap[b]) byBranchMap[b] = { name: b, total: 0, count: 0 };
    byBranchMap[b].total += Number(e.price);
    byBranchMap[b].count += 1;
  });
  const branchList = Object.values(byBranchMap).sort((a,b) => b.total - a.total);
  const maxBranch = Math.max(...branchList.map(b => b.total), 1);

  // By day of month
  const dayData = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const key = `${year}-${pad(month+1)}-${pad(i)}`;
    const total = monthEntries.filter(e => e.date === key).reduce((s,e) => s + Number(e.price), 0);
    dayData.push({ day: i, total });
  }

  // By date list (Daily Record) - Grouped with Branches
  const byDay = {};
  monthEntries.forEach(e => {
    if (!byDay[e.date]) byDay[e.date] = { date: e.date, total: 0, count: 0, branches: new Set() };
    byDay[e.date].total += Number(e.price);
    byDay[e.date].count += 1;
    if (e.branch) byDay[e.date].branches.add(e.branch);
  });
  const dayList = Object.values(byDay).sort((a,b) => b.date.localeCompare(a.date));

  // By Branch, Then Day (For reconciliation)
  const branchDayMap = {};
  monthEntries.forEach(e => {
    const b = e.branch || 'ไม่ระบุ';
    if (!branchDayMap[b]) branchDayMap[b] = {};
    if (!branchDayMap[b][e.date]) branchDayMap[b][e.date] = { date: e.date, total: 0, entries: [] };

    branchDayMap[b][e.date].total += Number(e.price);
    branchDayMap[b][e.date].entries.push(e);
  });

  const branchSummaryList = Object.keys(branchDayMap).sort().map(bName => {
    // Sort days ascending (1, 2, 3...)
    const days = Object.values(branchDayMap[bName]).sort((a,b) => a.date.localeCompare(b.date));
    const branchTotal = days.reduce((sum, d) => sum + d.total, 0);
    return { name: bName, total: branchTotal, days };
  });

  const toggleBranchDay = (bName, date, setChecked) => {
    const idsToToggle = branchDayMap[bName][date].entries.map(e => e.id);
    const nextEntries = entries.map(e =>
      idsToToggle.includes(e.id) ? { ...e, isChecked: setChecked } : e
    );
    onSaveEntries(nextEntries);
  };

  const getConf = (bName) => confirmations[monthKey]?.[bName] || {};
  const setConf = (bName, patch) => {
    const monthConf = confirmations[monthKey] || {};
    onSaveConfirmations({
      ...confirmations,
      [monthKey]: { ...monthConf, [bName]: { ...(monthConf[bName] || {}), ...patch } },
    });
  };

  const prevMonth = () => { let m = month - 1, y = year; if (m < 0) { m = 11; y -= 1; } setViewMonth({ year: y, month: m }); };
  const nextMonth = () => { let m = month + 1, y = year; if (m > 11) { m = 0; y += 1; } setViewMonth({ year: y, month: m }); };
  const isCurrentMonth = () => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth();
  };

  const hasData = monthEntries.length > 0;

  return (
    <div className="px-6">
      {/* Month switcher */}
      <div className="flex items-center justify-between card rounded-2xl px-2 py-2">
        <button onClick={prevMonth} className="tap-scale p-2 rounded-lg hover:bg-stone-50"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <div className="font-serif-display text-xl warm-dark">{THAI_MONTHS[month]}</div>
          <div className="text-[11px] muted -mt-0.5">{year + 543}</div>
        </div>
        <button onClick={nextMonth} disabled={isCurrentMonth()} className="tap-scale p-2 rounded-lg hover:bg-stone-50 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      {/* Total card */}
      <div className="mt-4 card rounded-3xl p-6 relative overflow-hidden">
        <span className="text-xs muted uppercase tracking-widest">รวมรายได้</span>
        <div className="mt-3 flex items-baseline">
          <span className="font-serif-display text-6xl warm-dark leading-none">{formatMoney(monthTotal)}</span>
          <span className="ml-2 muted text-lg font-serif-display">บาท</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="muted">รายการ</div>
            <div className="warm-dark font-medium text-sm mt-0.5">{monthEntries.length}</div>
          </div>
          <div>
            <div className="muted">เฉลี่ย/วันที่ทำงาน</div>
            <div className="warm-dark font-medium text-sm mt-0.5">{formatMoney(Math.round(avgPerDay))}</div>
            <div className="muted text-[10px]">ทำงาน {uniqueDaysWorked} วัน</div>
          </div>
          <div>
            <div className="muted">สาขา</div>
            <div className="warm-dark font-medium text-sm mt-0.5">{branchList.length}</div>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full accent-light-bg opacity-40" />
      </div>

      {!hasData && (
        <p className="muted text-sm py-8 text-center">ไม่มีรายการในเดือนนี้</p>
      )}

      {hasData && (
        <>
          {/* Branch Reconciliation List */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif-display text-2xl">สรุปยอดแยกสาขา</h2>
              <span className="text-xs muted">แตะวันเพื่อติ๊กเช็ค</span>
            </div>
            <div className="space-y-4">
              {branchSummaryList.map(b => {
                const conf = getConf(b.name);
                const reported = conf.reported;
                const hasReported = reported !== undefined && reported !== '' && !isNaN(Number(reported));
                const diff = hasReported ? Number(reported) - b.total : 0;
                const allDaysChecked = b.days.every(d => d.entries.every(e => e.isChecked));
                return (
                  <div key={b.name} className={`card rounded-2xl overflow-hidden shadow-sm ${conf.confirmed ? 'ring-2 ring-green-600' : ''}`}>
                    <div className={`px-4 py-3 border-b divider ${conf.confirmed ? 'bg-green-50' : 'bg-stone-50/80'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm warm-dark flex items-center gap-1.5">
                          {conf.confirmed && <Check size={14} className="text-green-700" />}
                          {b.name}
                        </span>
                        <span className={`font-serif-display text-lg ${conf.confirmed ? 'text-green-800' : 'accent'}`}>{formatMoney(b.total)}</span>
                      </div>
                      <div className="text-[11px] muted mt-0.5">
                        วันที่ {b.days.map(d => Number(d.date.slice(8))).join(', ')} · {b.days.length} วัน
                      </div>
                    </div>
                    <ul className="divide-y divider">
                      {b.days.map(d => {
                        const allChecked = d.entries.every(e => e.isChecked);
                        return (
                          <li
                            key={d.date}
                            onClick={() => toggleBranchDay(b.name, d.date, !allChecked)}
                            className={`flex items-center justify-between px-4 py-3 tap-scale transition-colors cursor-pointer ${allChecked ? 'bg-green-50/50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${allChecked ? 'bg-green-600 text-white' : 'border divider bg-white'}`}>
                                {allChecked && <Check size={14} />}
                              </div>
                              <div>
                                <div className={`text-sm transition-all ${allChecked ? 'text-green-800 line-through opacity-80' : 'warm-dark'}`}>
                                  วัน{THAI_DAYS[keyToDate(d.date).getDay()]}ที่ {formatThaiDateShort(d.date)}
                                </div>
                                <div className="text-[11px] muted mt-0.5">{d.entries.length} รายการ</div>
                              </div>
                            </div>
                            <div className={`font-serif-display text-xl transition-all ${allChecked ? 'text-green-800 opacity-80' : 'warm-dark'}`}>
                              {formatMoney(d.total)}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Confirm against the list sent by the branch */}
                    <div className="px-4 py-3 border-t divider bg-stone-50/50">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number" inputMode="decimal"
                            placeholder="ยอดตาม list ของสาขา"
                            value={reported ?? ''}
                            disabled={conf.confirmed}
                            onChange={e => setConf(b.name, { reported: e.target.value })}
                            className="w-full px-3 py-2 pr-10 rounded-lg bg-white border divider text-sm focus:outline-none focus:border-stone-400 disabled:opacity-60"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 muted text-xs">บาท</span>
                        </div>
                        <button
                          onClick={() => setConf(b.name, { confirmed: !conf.confirmed, confirmedAt: !conf.confirmed ? Date.now() : null })}
                          className={`tap-scale shrink-0 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${conf.confirmed ? 'bg-green-600 text-white' : 'accent-bg text-white'}`}
                        >
                          <Check size={14} /> {conf.confirmed ? 'ยืนยันแล้ว' : 'ยืนยันยอด'}
                        </button>
                      </div>
                      {hasReported && (
                        <div className={`text-xs mt-2 ${diff === 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {diff === 0
                            ? '✓ ยอดตรงกัน'
                            : `ไม่ตรง: สาขา${diff > 0 ? 'มากกว่า' : 'น้อยกว่า'}ที่บันทึก ${formatMoney(Math.abs(diff))} บาท`}
                        </div>
                      )}
                      {!hasReported && !conf.confirmed && allDaysChecked && (
                        <div className="text-xs muted mt-2">ติ๊กครบทุกวันแล้ว กดยืนยันยอดได้เลย</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* By date list */}
          <section className="mt-8">
            <h2 className="font-serif-display text-2xl mb-3">บันทึกรายวัน</h2>
            <ul className="card rounded-2xl divide-y divider overflow-hidden">
              {dayList.map(d => (
                <li key={d.date} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-sm warm-dark">
                      วัน{THAI_DAYS[keyToDate(d.date).getDay()]} {formatThaiDateShort(d.date)}
                    </div>
                    <div className="text-[11px] mt-0.5 flex items-center gap-1 accent">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{d.branches.size > 0 ? Array.from(d.branches).join(', ') : 'ไม่ระบุสาขา'}</span>
                    </div>
                    <div className="text-[11px] muted">{d.count} รายการ</div>
                  </div>
                  <div className="font-serif-display text-xl warm-dark">{formatMoney(d.total)}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* Donut: by procedure */}
          <section className="mt-8">
            <h2 className="font-serif-display text-2xl mb-3">สัดส่วนหัตถการ</h2>
            <div className="card rounded-3xl p-5">
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      paddingAngle={2} stroke="none"
                    >
                      {donutData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatMoney(v) + ' บาท'}
                      contentStyle={{ background: '#fff', border: '1px solid #e8dfcd', borderRadius: 12, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[10px] muted uppercase tracking-widest">รวม</div>
                  <div className="font-serif-display text-2xl warm-dark">{formatMoneyShort(monthTotal)}</div>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {donutData.map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="warm-dark truncate">{d.name}</span>
                    </div>
                    <div className="muted whitespace-nowrap">
                      {formatMoney(d.value)} ({((d.value/monthTotal)*100).toFixed(0)}%)
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Bar: by branch */}
          <section className="mt-8">
            <h2 className="font-serif-display text-2xl mb-3">รายได้ตามสาขา</h2>
            <div className="card rounded-3xl p-5 space-y-3">
              {branchList.map((b, i) => (
                <div key={b.name}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm warm-dark truncate flex-1 pr-2">{b.name}</span>
                    <span className="font-serif-display text-lg warm-dark">{formatMoney(b.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(b.total/maxBranch)*100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                    <span className="text-[11px] muted whitespace-nowrap">{b.count} ครั้ง</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bar: by day of month */}
          <section className="mt-8">
            <h2 className="font-serif-display text-2xl mb-3">รายได้รายวัน</h2>
            <div className="card rounded-3xl p-5">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayData} margin={{ top: 5, right: 0, left: -28, bottom: 0 }}>
                    <XAxis
                      dataKey="day" tick={{ fontSize: 9, fill: '#8a8074' }}
                      interval={2} axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#8a8074' }}
                      tickFormatter={formatMoneyShort}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => formatMoney(v) + ' บาท'}
                      labelFormatter={(l) => `วันที่ ${l}`}
                      contentStyle={{ background: '#fff', border: '1px solid #e8dfcd', borderRadius: 12, fontSize: 12 }}
                      cursor={{ fill: 'rgba(45,74,58,0.05)' }}
                    />
                    <Bar dataKey="total" fill="#2d4a3a" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* =========== SETTINGS =========== */
function SettingsTab({ procedures, onSaveProcedures, branches, onSaveBranches, schedule, onSaveSchedule, entries, onResetEntries, onResetAll, onExportBackup, onImportBackup, showToast }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [color, setColor] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [importing, setImporting] = useState(null); // {items: [...]} | null
  const [importError, setImportError] = useState('');
  const [editingBranches, setEditingBranches] = useState(false);
  const [textPreview, setTextPreview] = useState(null); // {title, text} | null
  const [copyStatus, setCopyStatus] = useState('');
  const [backupImport, setBackupImport] = useState(null); // {text, data, error} | null
  const fileRef = useRef(null);
  const backupFileRef = useRef(null);

  const startNew = () => { setEditing({ id: 'new' }); setName(''); setPrice(''); setColor(null); };
  const startEdit = (p) => { setEditing(p); setName(p.name); setPrice(String(p.price)); setColor(p.color || null); };
  const saveEdit = () => {
    const pn = Number(price);
    if (!name.trim() || isNaN(pn) || pn < 0) return;
    if (editing.id === 'new') {
      onSaveProcedures([...procedures, { id: `p_${Date.now()}`, name: name.trim(), price: pn, color }]);
    } else {
      onSaveProcedures(procedures.map(p => p.id === editing.id ? { ...p, name: name.trim(), price: pn, color } : p));
    }
    setEditing(null);
  };
  const remove = (id) => { onSaveProcedures(procedures.filter(p => p.id !== id)); setEditing(null); };

  const onPickFile = () => fileRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportError('');
    parseExcel(f, (items) => {
      if (items.length === 0) {
        setImportError('ไม่พบข้อมูลที่ใช้ได้ (ต้องมีคอลัมน์ชื่อและราคา)');
        return;
      }
      setImporting({ items });
    }, (err) => setImportError(err));
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importing) return;
    const existing = new Set(procedures.map(p => p.name.toLowerCase()));
    const newOnes = importing.items
      .filter(it => !existing.has(it.name.toLowerCase()))
      .map((it, i) => ({ id: `p_${Date.now()}_${i}`, name: it.name, price: it.price }));
    onSaveProcedures([...procedures, ...newOnes]);
    showToast(`นำเข้า ${newOnes.length} รายการ`);
    setImporting(null);
  };

  const exportCSV = async () => {
    if (entries.length === 0) return;
    const header = 'วันที่,รายการ,ราคา,สาขา\n';
    const rows = [...entries].sort((a,b) => a.date.localeCompare(b.date)).map(e =>
      `${e.date},"${e.name.replace(/"/g,'""')}",${e.price},"${(e.branch||'').replace(/"/g,'""')}"`
    ).join('\n');
    const csv = '\uFEFF' + header + rows;
    if (await shareOrDownload(csv, `income_${todayKey()}.csv`, 'text/csv')) {
      showToast('เปิด share sheet แล้ว');
      return;
    }
    setTextPreview({ title: 'ส่งออก CSV', text: csv, hint: 'ถ้าดาวน์โหลดไม่ขึ้น ให้กด "คัดลอก" แล้ววางใน Notes แล้ว save เป็น .csv หรือวางใน Email ส่งหาตัวเอง' });
  };

  const exportBackup = async () => {
    const json = onExportBackup();
    if (await shareOrDownload(json, `income_backup_${todayKey()}.json`, 'application/json')) {
      showToast('เปิด share sheet แล้ว');
      return;
    }
    setTextPreview({ title: 'สำรองข้อมูล', text: json, hint: 'ถ้าดาวน์โหลดไม่ขึ้น ให้กด "คัดลอก" แล้วส่งข้อความนี้ไปเครื่องใหม่ (เช่น LINE/Email ถึงตัวเอง) แล้ววางในหน้า "นำเข้าข้อมูล"' });
  };

  const parseBackup = (text) => {
    try {
      const data = JSON.parse(text.replace(/^\uFEFF/, ''));
      if (!data || !Array.isArray(data.entries) || !Array.isArray(data.procedures)) {
        return { text, data: null, error: 'ไฟล์ไม่ใช่ข้อมูลสำรองของแอปนี้' };
      }
      return { text, data, error: '' };
    } catch {
      return { text, data: null, error: 'อ่านข้อมูลไม่ได้ — ตรวจสอบว่าคัดลอกมาครบ' };
    }
  };

  const onBackupFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setBackupImport(parseBackup(String(reader.result)));
    reader.onerror = () => setBackupImport({ text: '', data: null, error: 'อ่านไฟล์ไม่สำเร็จ' });
    reader.readAsText(f);
    e.target.value = '';
  };

  const copyText = async () => {
    if (!textPreview) return;
    try {
      await navigator.clipboard.writeText(textPreview.text);
      setCopyStatus('คัดลอกแล้ว');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch {
      setCopyStatus('คัดลอกไม่ได้ — เลือกข้อความแล้วคัดลอกเอง');
      setTimeout(() => setCopyStatus(''), 2500);
    }
  };

  const removeBranch = (b) => {
    onSaveBranches(branches.filter(x => x !== b));
    const nextSched = { ...schedule };
    Object.keys(nextSched).forEach(k => { if (nextSched[k] === b) delete nextSched[k]; });
    onSaveSchedule(nextSched);
  };

  const setDayDefault = (dow, branchName) => {
    const next = { ...schedule };
    if (branchName) next[dow] = branchName;
    else delete next[dow];
    onSaveSchedule(next);
  };

  return (
    <div className="px-6">
      {/* Procedures */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif-display text-2xl">หัตถการ</h2>
        <div className="flex gap-2">
          <button onClick={onPickFile} className="tap-scale card text-sm px-3 py-2 rounded-full inline-flex items-center gap-1 warm-dark">
            <Upload size={14} /> Excel
          </button>
          <button onClick={startNew} className="tap-scale accent-bg text-white text-sm px-4 py-2 rounded-full inline-flex items-center gap-1">
            <Plus size={14} /> เพิ่ม
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" />
      {importError && (
        <div className="rounded-xl px-3 py-2 mb-3 text-xs text-red-700" style={{ background: '#fdecea' }}>{importError}</div>
      )}

      {procedures.length === 0 ? (
        <p className="muted text-sm py-4">ยังไม่มีรายการ — เพิ่มเอง หรือนำเข้าจาก Excel</p>
      ) : (
        <ul className="card rounded-2xl divide-y divider overflow-hidden">
          {procedures.map(p => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className="w-3 h-3 rounded-full shrink-0 mr-3" style={{ background: p.color || '#e8dfcd' }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm warm-dark truncate">{p.name}</div>
                <div className="font-serif-display text-lg accent mt-0.5" style={p.color ? { color: p.color } : undefined}>{formatMoney(p.price)} <span className="text-xs muted">บาท</span></div>
              </div>
              <button onClick={() => startEdit(p)} className="tap-scale p-2 text-stone-500 hover:text-stone-800">
                <Pencil size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Branch schedule */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif-display text-2xl">สาขาประจำวัน</h2>
          <button onClick={() => setEditingBranches(!editingBranches)} className="tap-scale text-xs muted">
            {editingBranches ? 'เสร็จ' : 'แก้ไข'}
          </button>
        </div>
        <div className="card rounded-2xl divide-y divider overflow-hidden">
          {[1,2,3,4,5,6,0].map(dow => (
            <div key={dow} className="flex items-center justify-between px-4 py-3">
              <div className="text-sm warm-dark w-20">วัน{THAI_DAYS[dow]}</div>
              {editingBranches ? (
                <select
                  value={schedule[dow] || ''}
                  onChange={e => setDayDefault(dow, e.target.value)}
                  className="flex-1 ml-3 px-3 py-2 rounded-lg bg-stone-50 border divider text-sm focus:outline-none"
                >
                  <option value="">— ถามทุกสัปดาห์ —</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              ) : (
                <div className="text-sm muted flex-1 text-right">
                  {schedule[dow] || <span className="italic">ถามทุกสัปดาห์</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Branches list */}
      <section className="mt-10">
        <h2 className="font-serif-display text-2xl mb-3">สาขาทั้งหมด</h2>
        <div className="card rounded-2xl divide-y divider overflow-hidden">
          {branches.map(b => (
            <div key={b} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm warm-dark">{b}</span>
              <button onClick={() => removeBranch(b)} className="tap-scale text-stone-400 hover:text-red-500 p-1">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] muted mt-2">เพิ่มสาขาใหม่ได้จากปุ่ม "เลือกสาขา" บนหน้าหลัก</p>
      </section>

      {/* Backup / move device */}
      <section className="mt-10">
        <h2 className="font-serif-display text-2xl mb-3">ย้ายเครื่อง / สำรองข้อมูล</h2>
        <div className="card rounded-2xl divide-y divider overflow-hidden">
          <button onClick={exportBackup} className="tap-scale w-full flex items-center justify-between px-4 py-4">
            <div className="text-left">
              <div className="text-sm warm-dark">ส่งออกข้อมูลทั้งหมด (Export)</div>
              <div className="text-[11px] muted mt-0.5">หัตถการ รายการ สาขา สี และการยืนยันยอด</div>
            </div>
            <Download size={18} className="muted" />
          </button>
          <button onClick={() => setBackupImport({ text: '', data: null, error: '' })} className="tap-scale w-full flex items-center justify-between px-4 py-4">
            <div className="text-left">
              <div className="text-sm warm-dark">นำเข้าข้อมูล (Import)</div>
              <div className="text-[11px] muted mt-0.5">จากไฟล์ .json ที่ export ไว้ — แทนที่ข้อมูลในเครื่องนี้</div>
            </div>
            <Database size={18} className="muted" />
          </button>
        </div>
        <input ref={backupFileRef} type="file" accept=".json,application/json,text/plain" onChange={onBackupFileChange} className="hidden" />
      </section>

      {/* Data */}
      <section className="mt-10">
        <h2 className="font-serif-display text-2xl mb-3">ข้อมูล</h2>
        <div className="card rounded-2xl divide-y divider overflow-hidden">
          <button onClick={exportCSV} disabled={entries.length === 0} className="tap-scale w-full flex items-center justify-between px-4 py-4 disabled:opacity-40">
            <div className="text-left">
              <div className="text-sm warm-dark">ส่งออกเป็น CSV</div>
              <div className="text-[11px] muted mt-0.5">เปิดใน Excel หรือ Google Sheets ได้</div>
            </div>
            <Download size={18} className="muted" />
          </button>
          <button onClick={() => setConfirmReset('entries')} disabled={entries.length === 0} className="tap-scale w-full text-left px-4 py-4 disabled:opacity-40">
            <div className="text-sm text-red-700">ล้างรายการบันทึก</div>
            <div className="text-[11px] muted mt-0.5">{entries.length} รายการ — เก็บหัตถการและสาขาไว้</div>
          </button>
          <button onClick={() => setConfirmReset('all')} className="tap-scale w-full text-left px-4 py-4">
            <div className="text-sm text-red-700">รีเซ็ตทั้งหมด</div>
            <div className="text-[11px] muted mt-0.5">ลบทุกอย่างและคืนค่าเริ่มต้น</div>
          </button>
        </div>
      </section>

      <p className="text-[11px] muted text-center mt-10">ข้อมูลถูกบันทึกในเครื่อง · ไม่หายเมื่อปิด</p>

      {/* Edit procedure */}
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 className="font-serif-display text-2xl mb-4">
            {editing.id === 'new' ? 'เพิ่มหัตถการ' : 'แก้ไข'}
          </h3>
          <label className="text-xs muted">ชื่อรายการ</label>
          <input type="text" placeholder="เช่น ขูดหินปูน" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-stone-50 border divider text-sm mt-1 mb-4 focus:outline-none focus:border-stone-400" />
          <label className="text-xs muted">ราคา (บาท)</label>
          <div className="relative mt-1 mb-4">
            <input type="number" inputMode="decimal" placeholder="0" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-stone-50 border divider text-lg font-serif-display focus:outline-none focus:border-stone-400" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 muted text-sm">บาท</span>
          </div>
          <label className="text-xs muted">สีปุ่ม</label>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => setColor(null)}
              className="tap-scale w-8 h-8 rounded-full border-2 border-dashed divider flex items-center justify-center"
              aria-label="ไม่มีสี"
            >
              {color === null && <Check size={14} className="muted" />}
            </button>
            {PROC_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="tap-scale w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none' }}
              >
                {color === c && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-6">
            {editing.id !== 'new' && (
              <button onClick={() => remove(editing.id)} className="px-4 py-3 rounded-xl border border-red-200 text-red-700 text-sm tap-scale">
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={() => setEditing(null)} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">ยกเลิก</button>
            <button onClick={saveEdit} className="flex-1 py-3 rounded-xl accent-bg text-white text-sm font-medium tap-scale">บันทึก</button>
          </div>
        </Modal>
      )}

      {/* Import preview */}
      {importing && (
        <Modal onClose={() => setImporting(null)}>
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet size={20} className="accent" />
            <h3 className="font-serif-display text-2xl">นำเข้า {importing.items.length} รายการ</h3>
          </div>
          <p className="text-xs muted mb-4">รายการที่ซ้ำชื่อเดิมจะถูกข้าม</p>

          <ul className="max-h-72 overflow-y-auto scrollbar-hide space-y-1 mb-4">
            {importing.items.slice(0, 50).map((it, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-50 text-sm">
                <span className="warm-dark truncate flex-1 pr-2">{it.name}</span>
                <span className="font-serif-display accent">{formatMoney(it.price)}</span>
              </li>
            ))}
            {importing.items.length > 50 && (
              <li className="text-center text-xs muted py-2">และอีก {importing.items.length - 50} รายการ…</li>
            )}
          </ul>

          <div className="flex gap-2">
            <button onClick={() => setImporting(null)} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">ยกเลิก</button>
            <button onClick={confirmImport} className="flex-1 py-3 rounded-xl accent-bg text-white text-sm font-medium tap-scale">นำเข้า</button>
          </div>
        </Modal>
      )}

      {/* Backup import */}
      {backupImport && (
        <Modal onClose={() => setBackupImport(null)}>
          <div className="flex items-center gap-2 mb-1">
            <Database size={20} className="accent" />
            <h3 className="font-serif-display text-2xl">นำเข้าข้อมูล</h3>
          </div>
          {backupImport.data ? (
            <>
              <p className="text-xs muted mb-4">
                ข้อมูลในเครื่องนี้จะถูก<b className="text-red-700">แทนที่ทั้งหมด</b>ด้วยข้อมูลจากไฟล์
              </p>
              <ul className="text-sm space-y-1.5 mb-5 rounded-xl bg-stone-50 px-4 py-3">
                <li className="flex justify-between"><span className="muted">หัตถการ</span><span>{backupImport.data.procedures.length}</span></li>
                <li className="flex justify-between"><span className="muted">รายการบันทึก</span><span>{backupImport.data.entries.length}</span></li>
                <li className="flex justify-between"><span className="muted">สาขา</span><span>{(backupImport.data.branches || []).length}</span></li>
                {backupImport.data.exportedAt && (
                  <li className="flex justify-between"><span className="muted">สำรองเมื่อ</span><span>{new Date(backupImport.data.exportedAt).toLocaleString('th-TH')}</span></li>
                )}
              </ul>
              <div className="flex gap-2">
                <button onClick={() => setBackupImport(null)} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">ยกเลิก</button>
                <button
                  onClick={() => { onImportBackup(backupImport.data); setBackupImport(null); }}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium tap-scale"
                >แทนที่ข้อมูล</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs muted mb-3">เลือกไฟล์ .json ที่ export ไว้ หรือวางข้อความสำรองลงในช่องด้านล่าง</p>
              <button onClick={() => backupFileRef.current?.click()} className="tap-scale w-full py-3 rounded-xl accent-bg text-white text-sm font-medium flex items-center justify-center gap-1.5 mb-3">
                <Upload size={16} /> เลือกไฟล์
              </button>
              <textarea
                value={backupImport.text}
                onChange={e => setBackupImport({ ...backupImport, text: e.target.value, error: '' })}
                placeholder="หรือวางข้อความสำรองที่นี่"
                className="w-full h-32 px-3 py-2 rounded-xl bg-stone-50 border divider text-xs font-mono focus:outline-none"
              />
              {backupImport.error && <div className="text-xs text-red-700 mt-2">{backupImport.error}</div>}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setBackupImport(null)} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">ยกเลิก</button>
                <button
                  onClick={() => setBackupImport(parseBackup(backupImport.text))}
                  disabled={!backupImport.text.trim()}
                  className="flex-1 py-3 rounded-xl border divider text-sm tap-scale disabled:opacity-40"
                >ตรวจสอบข้อความ</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Text preview / copy fallback (CSV & backup) */}
      {textPreview && (
        <Modal onClose={() => { setTextPreview(null); setCopyStatus(''); }}>
          <div className="flex items-center gap-2 mb-1">
            <Download size={20} className="accent" />
            <h3 className="font-serif-display text-2xl">{textPreview.title}</h3>
          </div>
          <p className="text-xs muted mb-3">{textPreview.hint}</p>
          <textarea
            readOnly value={textPreview.text}
            className="w-full h-48 px-3 py-2 rounded-xl bg-stone-50 border divider text-xs font-mono focus:outline-none"
            onFocus={(e) => e.target.select()}
          />
          {copyStatus && (
            <div className="text-xs accent mt-2">{copyStatus}</div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setTextPreview(null); setCopyStatus(''); }} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">
              ปิด
            </button>
            <button onClick={copyText} className="flex-1 py-3 rounded-xl accent-bg text-white text-sm font-medium tap-scale">
              คัดลอก
            </button>
          </div>
        </Modal>
      )}

      {/* Reset confirm */}
      {confirmReset && (
        <Modal onClose={() => setConfirmReset(null)}>
          <h3 className="font-serif-display text-2xl mb-2">ยืนยันการลบ</h3>
          <p className="text-sm muted mb-5">
            {confirmReset === 'entries' ? 'ลบรายการบันทึกทั้งหมด? ย้อนกลับไม่ได้' : 'ลบทุกอย่างและคืนค่าเริ่มต้น? ย้อนกลับไม่ได้'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmReset(null)} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">ยกเลิก</button>
            <button
              onClick={() => {
                if (confirmReset === 'entries') onResetEntries(); else onResetAll();
                setConfirmReset(null);
              }}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium tap-scale"
            >ลบ</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========== EXCEL PARSER =========== */
async function parseExcel(file, onResult, onError) {
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch {
    return onError('โหลดตัวอ่าน Excel ไม่ได้');
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (rows.length < 1) return onError('ไฟล์ว่าง');

      const nameKw = ['ชื่อ','รายการ','หัตถการ','name','procedure','item','service'];
      const priceKw = ['ราคา','ค่ามือ','price','fee','amount','cost','ราคาขาย'];

      const findCols = (headerRow) => {
        const lower = headerRow.map(h => String(h).toLowerCase().trim());
        let n = lower.findIndex(h => nameKw.some(k => h.includes(k.toLowerCase())));
        let p = lower.findIndex(h => priceKw.some(k => h.includes(k.toLowerCase())));
        return { n, p };
      };

      let headerIdx = 0;
      let cols = findCols(rows[0]);
      if (cols.n === -1 || cols.p === -1) {
        for (let i = 1; i < Math.min(rows.length, 5); i++) {
          const c = findCols(rows[i]);
          if (c.n !== -1 && c.p !== -1) { headerIdx = i; cols = c; break; }
        }
      }
      let { n: nameIdx, p: priceIdx } = cols;
      if (nameIdx === -1) nameIdx = 0;
      if (priceIdx === -1) priceIdx = 1;

      const items = rows.slice(headerIdx + 1)
        .map(row => {
          const name = String(row[nameIdx] || '').trim();
          const priceRaw = String(row[priceIdx] || '').replace(/[^0-9.-]/g, '');
          const price = Number(priceRaw);
          return { name, price };
        })
        .filter(it => it.name && !isNaN(it.price) && it.price >= 0);

      onResult(items);
    } catch (err) {
      onError('อ่านไฟล์ไม่ได้: ' + err.message);
    }
  };
  reader.onerror = () => onError('อ่านไฟล์ไม่สำเร็จ');
  reader.readAsArrayBuffer(file);
}

/* =========== MODAL =========== */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" />
      <div className="relative card rounded-3xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
