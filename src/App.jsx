import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Plus, Trash2, Settings as SettingsIcon, BarChart3, Home as HomeIcon,
  ChevronLeft, ChevronRight, X, Pencil, AlertCircle, Download, Check,
  MapPin, Upload, FileSpreadsheet, ArrowRight
} from 'lucide-react';

/* =========== CONSTANTS =========== */
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const THAI_DAYS_SHORT = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

// Default branch schedule by day-of-week (0=Sun ... 6=Sat). Tue(2) & Wed(3) are weekly-custom.
const DEFAULT_SCHEDULE = {
  0: 'Esplanade',
  1: 'Promenade',
  4: 'Seacon Bangkae',
  5: 'Seacon Srinakarind',
  6: 'Terminal 21',
};
const DEFAULT_BRANCHES = ['Promenade', 'Seacon Bangkae', 'Seacon Srinakarind', 'Terminal 21', 'Esplanade'];

const CHART_COLORS = ['#2d4a3a', '#c9956a', '#8a5a44', '#4d6b5a', '#b58c5e', '#6b8e7a', '#d4a574', '#a67c52'];

/* =========== HELPERS =========== */
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayKey = () => toKey(new Date());
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
        if (cancelled) return;
        setProcedures(p);
        setEntries(e);
        setBranches(b);
        setSchedule(s);
        setWeeklyOverride(w);
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

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1500); };

  // Resolve today's branch
  const todayDow = new Date().getDay();
  const thisMonday = getMondayKey();
  const resolvedBranch = useMemo(() => {
    const override = weeklyOverride[thisMonday]?.[todayDow];
    if (override) return override;
    return schedule[todayDow] || null;
  }, [weeklyOverride, schedule, todayDow, thisMonday]);

  const setBranchForToday = (branchName) => {
    const next = { ...weeklyOverride };
    if (!next[thisMonday]) next[thisMonday] = {};
    next[thisMonday] = { ...next[thisMonday], [todayDow]: branchName };
    saveWeeklyOverride(next);
    if (!branches.includes(branchName)) saveBranches([...branches, branchName]);
  };

  const addEntry = (proc, opts = {}) => {
    const newEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      date: todayKey(),
      procedureId: proc.id,
      name: proc.name,
      price: Number(opts.price !== undefined ? opts.price : proc.price),
      branch: opts.branch !== undefined ? opts.branch : (resolvedBranch || 'ไม่ระบุ'),
      ts: Date.now(),
    };
    saveEntries([...entries, newEntry]);
    showToast(`บันทึก ${proc.name}`);
  };

  const deleteEntry = (id) => saveEntries(entries.filter(e => e.id !== id));

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
                onAddEntry={addEntry}
                onDeleteEntry={deleteEntry}
                onSelectBranch={setBranchForToday}
                onAddBranch={(name) => { if (!branches.includes(name)) saveBranches([...branches, name]); }}
                goToSettings={() => setTab('settings')}
              />
            )}
            {tab === 'summary' && (
              <SummaryTab
                entries={entries}
                viewMonth={viewMonth}
                setViewMonth={setViewMonth}
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
                onResetEntries={() => { saveEntries([]); showToast('ล้างรายการแล้ว'); }}
                onResetAll={() => {
                  saveEntries([]); saveProcedures([]);
                  saveBranches(DEFAULT_BRANCHES); saveSchedule(DEFAULT_SCHEDULE);
                  saveWeeklyOverride({});
                  showToast('รีเซ็ตทั้งหมดแล้ว');
                }}
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
    <button onClick={onClick} className={`tap-scale flex-1 flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition ${active ? 'accent-bg text-white' : 'text-stone-600'}`}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

/* =========== HOME =========== */
function HomeTab({ procedures, entries, branches, resolvedBranch, todayDow, onAddEntry, onDeleteEntry, onSelectBranch, onAddBranch, goToSettings }) {
  const [customFor, setCustomFor] = useState(null);
  const [customPrice, setCustomPrice] = useState('');
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

      {/* Branch setup banner for Tue/Wed */}
      {needsBranchSetup && (
        <div className="mt-4 rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fef3e8', border: '1px solid #f0d9b8' }}>
          <AlertCircle size={18} className="text-amber-700 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm warm-dark font-medium">เลือกสาขาสำหรับสัปดาห์นี้</div>
            <div className="text-xs muted mt-0.5">วัน{THAI_DAYS[todayDow]}เปลี่ยนทุกสัปดาห์</div>
            <button onClick={() => setShowBranchPicker(true)} className="tap-scale mt-2 text-xs accent-bg text-white px-3 py-1.5 rounded-full inline-flex items-center gap-1">
              เลือกตอนนี้ <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Procedures grid */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif-display text-2xl">หัตถการ</h2>
          <span className="text-xs muted">แตะเพื่อบันทึก</span>
        </div>

        {procedures.length === 0 ? (
          <div className="card rounded-2xl p-6 text-center">
            <AlertCircle className="mx-auto muted mb-2" size={20} />
            <p className="text-sm warm-dark mb-1">ยังไม่มีหัตถการ</p>
            <p className="text-xs muted mb-4">เพิ่มในตั้งค่า หรือ Import จาก Excel</p>
            <button onClick={goToSettings} className="tap-scale accent-bg text-white text-sm px-5 py-2.5 rounded-full inline-flex items-center gap-1.5">
              <Plus size={16} /> เริ่มเพิ่มหัตถการ
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {procedures.map(p => (
              <button
                key={p.id}
                onClick={() => onAddEntry(p)}
                className="tap-scale card rounded-2xl p-4 text-left transition hover:border-stone-300"
              >
                <div className="text-sm font-medium warm-dark line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-serif-display text-2xl accent">{formatMoney(p.price)}</span>
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
        )}
      </section>

      {/* Today's entries */}
      <section className="mt-8">
        <h2 className="font-serif-display text-2xl mb-3">รายการวันนี้</h2>
        {todayEntries.length === 0 ? (
          <p className="muted text-sm py-4">ยังไม่มีรายการ — แตะหัตถการด้านบนเพื่อเริ่ม</p>
        ) : (
          <ul className="card rounded-2xl divide-y divider overflow-hidden">
            {todayEntries.map(e => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm warm-dark truncate">{e.name}</div>
                  <div className="text-[11px] muted mt-0.5 flex items-center gap-1.5">
                    <span>{new Date(e.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                    {e.branch && <span>· {e.branch}</span>}
                  </div>
                </div>
                <div className="font-serif-display text-xl warm-dark mr-3">{formatMoney(e.price)}</div>
                <button onClick={() => onDeleteEntry(e.id)} className="tap-scale text-stone-400 hover:text-red-500 transition p-1">
                  <X size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Custom amount modal */}
      {customFor && (
        <Modal onClose={() => setCustomFor(null)}>
          <h3 className="font-serif-display text-2xl mb-1">
            {customFor.id === 'custom' ? 'บันทึกรายการ' : `บันทึก ${customFor.name}`}
          </h3>
          <p className="text-xs muted mb-4">กำหนดราคาเอง</p>

          {customFor.id === 'custom' && (
            <input
              type="text" placeholder="ชื่อรายการ"
              value={customFor.name}
              onChange={e => setCustomFor({ ...customFor, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-stone-50 border divider text-sm mb-3 focus:outline-none focus:border-stone-400"
            />
          )}
          <div className="relative">
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={customPrice}
              onChange={e => setCustomPrice(e.target.value)}
              autoFocus={customFor.id !== 'custom'}
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
                if (customFor.id === 'custom' && !customFor.name.trim()) return;
                onAddEntry(
                  { id: customFor.id === 'custom' ? `custom_${Date.now()}` : customFor.id, name: customFor.name, price },
                  { price }
                );
                setCustomFor(null); setCustomPrice('');
              }}
              className="flex-1 py-3 rounded-xl accent-bg text-white text-sm font-medium tap-scale"
            >บันทึก</button>
          </div>
        </Modal>
      )}

      {showBranchPicker && (
        <BranchPickerModal
          branches={branches}
          current={resolvedBranch}
          dayName={THAI_DAYS[todayDow]}
          onSelect={(name) => { onSelectBranch(name); setShowBranchPicker(false); }}
          onAddBranch={onAddBranch}
          onClose={() => setShowBranchPicker(false)}
        />
      )}
    </div>
  );
}

/* =========== BRANCH PICKER =========== */
function BranchPickerModal({ branches, current, dayName, onSelect, onAddBranch, onClose }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <Modal onClose={onClose}>
      <h3 className="font-serif-display text-2xl mb-1">เลือกสาขา</h3>
      <p className="text-xs muted mb-4">สำหรับวัน{dayName}นี้</p>

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
function SummaryTab({ entries, viewMonth, setViewMonth }) {
  const { year, month } = viewMonth;
  const monthEntries = entries.filter(e => {
    const [y,m] = e.date.split('-').map(Number);
    return y === year && m === month + 1;
  });
  const monthTotal = monthEntries.reduce((s,e) => s + Number(e.price), 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const avgPerDay = monthEntries.length > 0 ? monthTotal / daysInMonth : 0;

  // By procedure
  const byProcMap = {};
  monthEntries.forEach(e => {
    if (!byProcMap[e.name]) byProcMap[e.name] = { name: e.name, total: 0, count: 0 };
    byProcMap[e.name].total += Number(e.price);
    byProcMap[e.name].count += 1;
  });
  const procList = Object.values(byProcMap).sort((a,b) => b.total - a.total);

  // Donut chart data: top 6 + others
  const donutData = useMemo(() => {
    if (procList.length <= 7) return procList.map(p => ({ name: p.name, value: p.total }));
    const top = procList.slice(0, 6);
    const rest = procList.slice(6).reduce((s,p) => s + p.total, 0);
    return [...top.map(p => ({ name: p.name, value: p.total })), { name: 'อื่น ๆ', value: rest }];
  }, [procList]);

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
  const dayData = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${year}-${pad(month+1)}-${pad(i)}`;
      const total = monthEntries.filter(e => e.date === key).reduce((s,e) => s + Number(e.price), 0);
      arr.push({ day: i, total });
    }
    return arr;
  }, [year, month, daysInMonth, monthEntries]);

  // By date list
  const byDay = {};
  monthEntries.forEach(e => {
    if (!byDay[e.date]) byDay[e.date] = { date: e.date, total: 0, count: 0 };
    byDay[e.date].total += Number(e.price);
    byDay[e.date].count += 1;
  });
  const dayList = Object.values(byDay).sort((a,b) => b.date.localeCompare(a.date));

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
            <div className="muted">เฉลี่ย/วัน</div>
            <div className="warm-dark font-medium text-sm mt-0.5">{formatMoneyShort(avgPerDay)}</div>
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

          {/* By date list */}
          <section className="mt-8">
            <h2 className="font-serif-display text-2xl mb-3">บันทึกรายวัน</h2>
            <ul className="card rounded-2xl divide-y divider overflow-hidden">
              {dayList.map(d => (
                <li key={d.date} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm warm-dark">{formatThaiDateShort(d.date)}</div>
                    <div className="text-[11px] muted mt-0.5">{d.count} รายการ</div>
                  </div>
                  <div className="font-serif-display text-xl warm-dark">{formatMoney(d.total)}</div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/* =========== SETTINGS =========== */
function SettingsTab({ procedures, onSaveProcedures, branches, onSaveBranches, schedule, onSaveSchedule, entries, onResetEntries, onResetAll, showToast }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [confirmReset, setConfirmReset] = useState(null);
  const [importing, setImporting] = useState(null); // {items: [...]} | null
  const [importError, setImportError] = useState('');
  const [editingBranches, setEditingBranches] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null); // string | null
  const [copyStatus, setCopyStatus] = useState('');
  const fileRef = useRef(null);

  const startNew = () => { setEditing({ id: 'new' }); setName(''); setPrice(''); };
  const startEdit = (p) => { setEditing(p); setName(p.name); setPrice(String(p.price)); };
  const saveEdit = () => {
    const pn = Number(price);
    if (!name.trim() || isNaN(pn) || pn < 0) return;
    if (editing.id === 'new') {
      onSaveProcedures([...procedures, { id: `p_${Date.now()}`, name: name.trim(), price: pn }]);
    } else {
      onSaveProcedures(procedures.map(p => p.id === editing.id ? { ...p, name: name.trim(), price: pn } : p));
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
    const filename = `income_${todayKey()}.csv`;

    // 1) Try Web Share API with file (best on mobile)
    try {
      if (navigator.canShare && typeof File !== 'undefined') {
        const file = new File([csv], filename, { type: 'text/csv' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          showToast('เปิด share sheet แล้ว');
          return;
        }
      }
    } catch (e) { /* user cancelled or unsupported - fall through */ }

    // 2) Try direct download (works on desktop)
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      // We can't actually detect if download was blocked; show preview as backup
    } catch (e) { /* fall through */ }

    // 3) Always show the CSV in a modal as reliable fallback
    setCsvPreview(csv);
  };

  const copyCSV = async () => {
    if (!csvPreview) return;
    try {
      await navigator.clipboard.writeText(csvPreview);
      setCopyStatus('คัดลอกแล้ว');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch (e) {
      setCopyStatus('คัดลอกไม่ได้ — เลือกข้อความแล้วคัดลอกเอง');
      setTimeout(() => setCopyStatus(''), 2500);
    }
  };

  const removeBranch = (b) => {
    onSaveBranches(branches.filter(x => x !== b));
    // remove from schedule too
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
              <div className="min-w-0 flex-1">
                <div className="text-sm warm-dark truncate">{p.name}</div>
                <div className="font-serif-display text-lg accent mt-0.5">{formatMoney(p.price)} <span className="text-xs muted">บาท</span></div>
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
          <div className="relative mt-1">
            <input type="number" inputMode="decimal" placeholder="0" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-stone-50 border divider text-lg font-serif-display focus:outline-none focus:border-stone-400" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 muted text-sm">บาท</span>
          </div>
          <div className="flex gap-2 mt-5">
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

      {/* CSV preview / copy fallback */}
      {csvPreview && (
        <Modal onClose={() => { setCsvPreview(null); setCopyStatus(''); }}>
          <div className="flex items-center gap-2 mb-1">
            <Download size={20} className="accent" />
            <h3 className="font-serif-display text-2xl">ส่งออก CSV</h3>
          </div>
          <p className="text-xs muted mb-3">
            ถ้าดาวน์โหลดไม่ขึ้น ให้กด "คัดลอก" แล้ววางใน Notes แล้ว save เป็น .csv
            หรือวางใน Email ส่งหาตัวเอง
          </p>
          <textarea
            readOnly value={csvPreview}
            className="w-full h-48 px-3 py-2 rounded-xl bg-stone-50 border divider text-xs font-mono focus:outline-none"
            onFocus={(e) => e.target.select()}
          />
          {copyStatus && (
            <div className="text-xs accent mt-2">{copyStatus}</div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setCsvPreview(null); setCopyStatus(''); }} className="flex-1 py-3 rounded-xl border divider text-sm tap-scale">
              ปิด
            </button>
            <button onClick={copyCSV} className="flex-1 py-3 rounded-xl accent-bg text-white text-sm font-medium tap-scale">
              คัดลอก CSV
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
  } catch (err) {
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

      // Detect header row
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
        // try row 1, 2
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
      <div className="relative card rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
