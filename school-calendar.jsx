import { useState, useEffect, useCallback } from "react";

// ── 定数 ──────────────────────────────────────────────
const DAYS = ["月", "火", "水", "木", "金"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri"];

const DEFAULT_SCHEDULE = {
  mon: { am: ["","",""], pm: ["","","",""] },
  tue: { am: ["","",""], pm: ["","","",""] },
  wed: { am: ["","",""], pm: ["","","",""] },
  thu: { am: ["","",""], pm: ["","","",""] },
  fri: { am: ["","",""], pm: ["","","",""] },
};

const AM_TIMES = ["8:30〜10:00","10:10〜11:40","11:50〜13:20"];
const PM_TIMES = ["13:30〜15:00","15:10〜16:40","16:50〜18:20","18:30〜20:00"];

const SUBJECT_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#f97316","#ec4899","#14b8a6","#84cc16",
];

// ── ユーティリティ ────────────────────────────────────
function toIso(date) { return date.toISOString().slice(0, 10); }

function getTodayKey(date) {
  const d = date.getDay();
  return (d === 0 || d === 6) ? null : DAY_KEYS[d - 1];
}

function getTimeMode(date) {
  const t = date.getHours() * 60 + date.getMinutes();
  if (t < 12 * 60) return "am";
  if (t < 16 * 60) return "pm";
  return "after";
}

function getCurrentPeriod(date) {
  const t = date.getHours() * 60 + date.getMinutes();
  const slots = [
    [8*60+30, 10*60], [10*60+10, 11*60+40], [11*60+50, 13*60+20],
    [13*60+30, 15*60], [15*60+10, 16*60+40], [16*60+50, 18*60+20],
    [18*60+30, 20*60],
  ];
  for (let i = 0; i < slots.length; i++) {
    if (t >= slots[i][0] && t <= slots[i][1]) return i;
  }
  return -1;
}

function getSubjectColor(subject, colorMap) {
  return colorMap[subject] || "#64748b";
}

function fmtDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const wd = ["日","月","火","水","木","金","土"][d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}（${wd}）`;
}

function shiftIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function getWeekDates(now) {
  const dow = now.getDay();
  return DAYS.map((_, di) => {
    const d = new Date(now);
    d.setDate(now.getDate() + (di + 1 - dow));
    return toIso(d);
  });
}

// ── ストレージ ────────────────────────────────────────
function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJson(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── PeriodCard ────────────────────────────────────────
function PeriodCard({ subject, periodNum, timeStr, active, colorMap }) {
  const color = getSubjectColor(subject, colorMap);
  return (
    <div style={{
      ...S.periodCard,
      ...(active ? { ...S.periodCardActive, borderColor: color, boxShadow: `0 0 16px ${color}55` } : {}),
      ...(subject ? { borderLeftColor: color, borderLeftWidth: 3 } : {}),
    }}>
      <div style={S.periodCardNum}>{periodNum}限</div>
      <div style={S.periodCardTime}>{timeStr}</div>
      <div style={{ ...S.periodCardSubject, color: subject ? color : "#334155" }}>{subject || "—"}</div>
      {active && <div style={S.activeDot} />}
    </div>
  );
}

// ── ViewTab ───────────────────────────────────────────
function ViewTab({ now, schedule, items, overrides, colorMap, amCount, pmCount }) {
  const todayIso = toIso(now);
  const todayKey = getTodayKey(now);
  const timeMode = getTimeMode(now);
  const period   = getCurrentPeriod(now);
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  const [todos, setTodos] = useState(() => loadJson("sc_todos", []));
  const [todoInput, setTodoInput] = useState("");

  const saveTodos = (t) => { setTodos(t); saveJson("sc_todos", t); };

  const getSubject = useCallback((dayKey, idx, isAm) => {
    const slot = isAm ? "am" : "pm";
    const oKey = `${todayIso}_${dayKey}_${slot}_${idx}`;
    if (overrides[oKey] !== undefined) return overrides[oKey];
    return schedule[dayKey]?.[slot]?.[idx] || "";
  }, [todayIso, overrides, schedule]);

  const todaySubjects = todayKey
    ? [
        ...Array.from({length: amCount}, (_, i) => getSubject(todayKey, i, true)),
        ...Array.from({length: pmCount}, (_, i) => getSubject(todayKey, i, false)),
      ].filter(Boolean)
    : [];

  const todayItems = (() => {
    const all = new Set();
    todaySubjects.forEach(s => (items[s] || []).forEach(it => all.add(it)));
    return Array.from(all);
  })();

  const todayTodos = todos
    .filter(t => t.date === todayIso)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  const dayNames = ["日","月","火","水","木","金","土"];
  const todayStr = `${now.getMonth()+1}月${now.getDate()}日（${dayNames[now.getDay()]}）`;

  const modeLabel = { am: "☀️ 午前の授業", pm: "🌙 午後の授業", after: "🌃 放課後" };
  const modeBadgeColor = { am: "#f59e0b", pm: "#818cf8", after: "#10b981" };

  const weekDates = getWeekDates(now);
  const nowTotal = now.getHours() * 60 + now.getMinutes();

  return (
    <div style={S.tabPane}>
      {/* ヘッダー */}
      <div style={S.dateHeader}>
        <div style={S.dateText}>{todayStr}</div>
        <div style={S.timeText}>
          {String(now.getHours()).padStart(2,"0")}:{String(now.getMinutes()).padStart(2,"0")}
        </div>
      </div>

      {/* モードバッジ */}
      {!isWeekend && (
        <div style={{ ...S.modeBadge, background: modeBadgeColor[timeMode]+"22", borderColor: modeBadgeColor[timeMode], color: modeBadgeColor[timeMode] }}>
          {modeLabel[timeMode]}
        </div>
      )}

      {/* メインコンテンツ */}
      {isWeekend ? (
        <div style={S.weekendMsg}>🎉 今日は休日です</div>
      ) : timeMode === "am" ? (
        <>
          <div style={S.sessionBlock}>
            <div style={S.sessionLabel}>☀️ 午前</div>
            <div style={S.periodCards}>
              {Array.from({length: amCount}, (_, i) => (
                <PeriodCard key={i} subject={getSubject(todayKey, i, true)} periodNum={i+1}
                  timeStr={AM_TIMES[i]} active={period === i} colorMap={colorMap} />
              ))}
            </div>
          </div>
          {todayItems.length > 0 && (
            <div style={S.itemsSection}>
              <div style={S.sessionLabel}>🎒 今日の持ち物</div>
              <div style={S.itemsGrid}>
                {todayItems.map((it, i) => <div key={i} style={S.itemBadge}>{it}</div>)}
              </div>
            </div>
          )}
        </>
      ) : timeMode === "pm" ? (
        <>
          <div style={S.sessionBlock}>
            <div style={S.sessionLabel}>🌙 午後</div>
            <div style={S.periodCards}>
              {Array.from({length: pmCount}, (_, i) => (
                <PeriodCard key={i} subject={getSubject(todayKey, i, false)} periodNum={amCount+i+1}
                  timeStr={PM_TIMES[i]} active={period === amCount+i} colorMap={colorMap} />
              ))}
            </div>
          </div>
          {todayItems.length > 0 && (
            <div style={S.itemsSection}>
              <div style={S.sessionLabel}>🎒 今日の持ち物</div>
              <div style={S.itemsGrid}>
                {todayItems.map((it, i) => <div key={i} style={S.itemBadge}>{it}</div>)}
              </div>
            </div>
          )}
        </>
      ) : (
        /* 放課後 */
        <div style={S.section}>
          <div style={S.sessionLabel}>✅ 今日のやること</div>
          <div style={S.row}>
            <input style={S.input} placeholder="タスクを追加..." value={todoInput}
              onChange={e => setTodoInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && todoInput.trim()) {
                saveTodos([...todos, { text: todoInput.trim(), done: false, id: Date.now(), date: todayIso, time: "" }]);
                setTodoInput("");
              }}} />
            <button style={S.btn} onClick={() => {
              if (!todoInput.trim()) return;
              saveTodos([...todos, { text: todoInput.trim(), done: false, id: Date.now(), date: todayIso, time: "" }]);
              setTodoInput("");
            }}>追加</button>
          </div>
          {todayTodos.length === 0
            ? <div style={S.emptyTodo}>お疲れ様！今日のタスクはありません 🎉</div>
            : (
              <div style={S.todoList}>
                {todayTodos.map(todo => (
                  <div key={todo.id} style={{ ...S.todoItem, ...(todo.done ? S.todoItemDone : {}) }}>
                    <button style={{ ...S.checkbox, ...(todo.done ? S.checkboxDone : {}) }}
                      onClick={() => saveTodos(todos.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))}>
                      {todo.done ? "✓" : ""}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: todo.done ? "#475569" : "#e2e8f0", fontSize: 14, textDecoration: todo.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todo.text}</div>
                      {todo.time && <div style={S.todoTime}>🕐 {todo.time}</div>}
                    </div>
                    <button style={S.removeBtn} onClick={() => saveTodos(todos.filter(t => t.id !== todo.id))}>×</button>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* 一日全体ビュー */}
      {!isWeekend && (
        <div style={S.allDaySection}>
          <div style={S.sessionLabel}>📋 今日の全授業</div>
          <div style={S.allDayGrid}>
            <div style={S.allDayCol}>
              <div style={S.allDayColHeader}>☀️ 午前</div>
              {Array.from({length: amCount}, (_, i) => {
                const s = getSubject(todayKey, i, true);
                const color = s ? getSubjectColor(s, colorMap) : "#1e293b";
                const isActive = period === i;
                return (
                  <div key={i} style={{ ...S.allDayCard, borderColor: isActive ? color : "#1e293b", background: s ? color+"18" : "#0a1628", boxShadow: isActive ? `0 0 10px ${color}44` : "none" }}>
                    <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>{AM_TIMES[i]}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s ? color : "#334155" }}>{s || "—"}</div>
                    {isActive && <div style={{ ...S.activeDot, position: "absolute", top: 6, right: 6 }} />}
                  </div>
                );
              })}
            </div>
            <div style={S.allDayCol}>
              <div style={S.allDayColHeader}>🌙 午後</div>
              {Array.from({length: pmCount}, (_, i) => {
                const s = getSubject(todayKey, i, false);
                const color = s ? getSubjectColor(s, colorMap) : "#1e293b";
                const isActive = period === amCount + i;
                return (
                  <div key={i} style={{ ...S.allDayCard, borderColor: isActive ? color : "#1e293b", background: s ? color+"18" : "#0a1628", boxShadow: isActive ? `0 0 10px ${color}44` : "none" }}>
                    <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>{PM_TIMES[i]}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s ? color : "#334155" }}>{s || "—"}</div>
                    {isActive && <div style={{ ...S.activeDot, position: "absolute", top: 6, right: 6 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 週間メモビュー */}
      <div style={S.weeklySection}>
        <div style={S.sessionLabel}>📆 今週の予定</div>
        <div style={S.weeklyGrid}>
          {DAYS.map((d, di) => {
            const dateStr = weekDates[di];
            const isToday = dateStr === todayIso;
            const dayTodos = todos
              .filter(t => t.date === dateStr)
              .sort((a, b) => {
                if (!a.time && !b.time) return 0;
                if (!a.time) return 1;
                if (!b.time) return -1;
                return a.time.localeCompare(b.time);
              });
            return (
              <div key={di} style={{ ...S.weekCol, ...(isToday ? S.weekColToday : {}) }}>
                <div style={{ ...S.weekDayLabel, ...(isToday ? S.weekDayToday : {}) }}>{d}</div>
                {dayTodos.length === 0 ? (
                  <div style={S.weekEmpty}>—</div>
                ) : dayTodos.map(todo => {
                  const tp = todo.time ? todo.time.split(":").map(Number) : null;
                  const tTotal = tp ? tp[0]*60+tp[1] : null;
                  const isPast = isToday && tTotal !== null && tTotal < nowTotal;
                  return (
                    <div key={todo.id} style={{
                      ...S.weekTodoCell,
                      opacity: todo.done ? 0.35 : isPast ? 0.6 : 1,
                      textDecoration: todo.done ? "line-through" : "none",
                      borderLeft: `2px solid ${todo.done ? "#1e293b" : isToday ? "#38bdf8" : "#334155"}`,
                      background: isToday ? "#0f1f35" : "#0f172a",
                    }}>
                      {todo.time && (
                        <div style={{ fontSize: 8, color: isPast ? "#334155" : "#38bdf8", marginBottom: 1 }}>{todo.time}</div>
                      )}
                      <div style={{ fontSize: 9, color: todo.done ? "#334155" : isPast ? "#475569" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {todo.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── InputTab ──────────────────────────────────────────
function InputTab({ now, schedule, setSchedule, items, setItems, overrides, setOverrides, colorMap, setColorMap, amCount, setAmCount, pmCount, setPmCount }) {
  const [editDay, setEditDay] = useState(DAY_KEYS[0]);
  const [itemSubject, setItemSubject] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [overrideDate, setOverrideDate] = useState(toIso(now));
  const [overrideSlot, setOverrideSlot] = useState("am");
  const [overridePeriod, setOverridePeriod] = useState(0);
  const [overrideSubject, setOverrideSubject] = useState("");

  const ensureColor = (subject) => {
    if (!subject || colorMap[subject]) return;
    const used = Object.values(colorMap);
    const color = SUBJECT_COLORS.find(c => !used.includes(c)) || SUBJECT_COLORS[used.length % SUBJECT_COLORS.length];
    setColorMap(prev => ({ ...prev, [subject]: color }));
  };

  const allSubjects = () => {
    const s = new Set();
    for (const day of DAY_KEYS)
      for (const slot of ["am","pm"])
        (schedule[day]?.[slot] || []).forEach(sub => sub && s.add(sub));
    return Array.from(s);
  };

  return (
    <div style={S.tabPane}>
      {/* コマ数 */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>⚙️ コマ数設定</h3>
        <div style={S.row}>
          <label style={S.label}>午前</label>
          <select style={S.select} value={amCount} onChange={e => setAmCount(Number(e.target.value))}>
            {[2,3].map(n => <option key={n} value={n}>{n}コマ</option>)}
          </select>
          <label style={{ ...S.label, marginLeft: 12 }}>午後</label>
          <select style={S.select} value={pmCount} onChange={e => setPmCount(Number(e.target.value))}>
            {[3,4].map(n => <option key={n} value={n}>{n}コマ</option>)}
          </select>
        </div>
      </section>

      {/* 通常時間割 */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>📅 通常時間割</h3>
        <div style={S.dayTabs}>
          {DAYS.map((d, i) => (
            <button key={i} style={{ ...S.dayTab, ...(editDay === DAY_KEYS[i] ? S.dayTabActive : {}) }}
              onClick={() => setEditDay(DAY_KEYS[i])}>{d}曜</button>
          ))}
        </div>
        <div style={S.periodGroup}>
          <div style={S.periodLabel}>☀️ 午前</div>
          {Array.from({length: amCount}, (_, i) => (
            <div key={i} style={S.periodRow}>
              <span style={S.periodNum}>{i+1}限</span>
              <input style={S.input} placeholder="教科名" value={schedule[editDay]?.am?.[i] || ""}
                onChange={e => {
                  const v = e.target.value;
                  setSchedule(prev => { const n = JSON.parse(JSON.stringify(prev)); n[editDay].am[i] = v; return n; });
                  if (v) ensureColor(v);
                }} />
            </div>
          ))}
        </div>
        <div style={S.periodGroup}>
          <div style={S.periodLabel}>🌙 午後</div>
          {Array.from({length: pmCount}, (_, i) => (
            <div key={i} style={S.periodRow}>
              <span style={S.periodNum}>{amCount+i+1}限</span>
              <input style={S.input} placeholder="教科名" value={schedule[editDay]?.pm?.[i] || ""}
                onChange={e => {
                  const v = e.target.value;
                  setSchedule(prev => { const n = JSON.parse(JSON.stringify(prev)); n[editDay].pm[i] = v; return n; });
                  if (v) ensureColor(v);
                }} />
            </div>
          ))}
        </div>
      </section>

      {/* 特別授業 */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>✏️ 特別授業（その日限り）</h3>
        <div style={S.row}>
          <input type="date" style={S.input} value={overrideDate} onChange={e => setOverrideDate(e.target.value)} />
        </div>
        <div style={S.row}>
          <select style={S.select} value={overrideSlot} onChange={e => setOverrideSlot(e.target.value)}>
            <option value="am">午前</option>
            <option value="pm">午後</option>
          </select>
          <select style={S.select} value={overridePeriod} onChange={e => setOverridePeriod(Number(e.target.value))}>
            {Array.from({length: overrideSlot === "am" ? amCount : pmCount}, (_, i) => (
              <option key={i} value={i}>{(overrideSlot==="am" ? i+1 : amCount+i+1)}限</option>
            ))}
          </select>
        </div>
        <div style={S.row}>
          <input style={S.input} placeholder="授業名（空欄で削除）" value={overrideSubject}
            onChange={e => setOverrideSubject(e.target.value)} />
          <button style={S.btn} onClick={() => {
            const d = new Date(overrideDate + "T00:00:00").getDay();
            if (d === 0 || d === 6) return;
            const dk = DAY_KEYS[d-1];
            const oKey = `${overrideDate}_${dk}_${overrideSlot}_${overridePeriod}`;
            setOverrides(prev => {
              const n = { ...prev };
              if (overrideSubject === "") delete n[oKey];
              else { n[oKey] = overrideSubject; ensureColor(overrideSubject); }
              return n;
            });
            setOverrideSubject("");
          }}>登録</button>
        </div>
      </section>

      {/* 持ち物 */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>🎒 持ち物登録</h3>

        {/* 教科タブ */}
        {allSubjects().length === 0 ? (
          <div style={{ color: "#475569", fontSize: 13, marginBottom: 10 }}>時間割に教科を登録すると、ここに教科タブが表示されます。</div>
        ) : (
          <>
            <div style={S.subjectTabBar}>
              {allSubjects().map(s => {
                const color = getSubjectColor(s, colorMap);
                const active = itemSubject === s;
                return (
                  <button key={s} onClick={() => setItemSubject(active ? "" : s)}
                    style={{ ...S.subjectTabBtn, borderColor: active ? color : "#1e293b", background: active ? color+"22" : "#0f172a", color: active ? color : "#64748b" }}>
                    {s}
                  </button>
                );
              })}
            </div>

            {/* 選択中教科の持ち物 */}
            {itemSubject && (
              <div style={{ ...S.itemPanel, borderColor: getSubjectColor(itemSubject, colorMap)+"66" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input style={S.input} placeholder={`${itemSubject}の持ち物を追加...`} value={itemInput}
                    onChange={e => setItemInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && itemInput.trim()) {
                      setItems(prev => ({ ...prev, [itemSubject]: [...(prev[itemSubject]||[]), itemInput.trim()] }));
                      setItemInput("");
                    }}} />
                  <button style={S.btn} onClick={() => {
                    if (!itemInput.trim()) return;
                    setItems(prev => ({ ...prev, [itemSubject]: [...(prev[itemSubject]||[]), itemInput.trim()] }));
                    setItemInput("");
                  }}>追加</button>
                </div>
                {(items[itemSubject]||[]).length === 0 ? (
                  <div style={{ color: "#334155", fontSize: 12 }}>まだ登録された持ち物はありません</div>
                ) : (
                  <div style={S.itemList}>
                    {(items[itemSubject]||[]).map((it, i) => (
                      <div key={i} style={S.itemChip}>
                        {it}
                        <button style={S.removeBtn} onClick={() => setItems(prev => ({ ...prev, [itemSubject]: prev[itemSubject].filter((_,j) => j !== i) }))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── MemoTab ───────────────────────────────────────────
function MemoTab({ now, notes, setNotes }) {
  const todayIso = toIso(now);
  const [todos, setTodos] = useState(() => loadJson("sc_todos", []));
  const [filterDate, setFilterDate] = useState(todayIso);
  const [newText, setNewText] = useState("");
  const [newDate, setNewDate] = useState(todayIso);
  const [newTime, setNewTime] = useState("");
  const [showTime, setShowTime] = useState(false);

  const saveTodos = (t) => { setTodos(t); saveJson("sc_todos", t); };

  const addTodo = () => {
    if (!newText.trim()) return;
    saveTodos([...todos, { text: newText.trim(), done: false, id: Date.now(), date: newDate, time: newTime }]);
    setNewText("");
    setNewTime("");
    setShowTime(false);
  };

  const filtered = todos
    .filter(t => t.date === filterDate)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  const undone = filtered.filter(t => !t.done);
  const done   = filtered.filter(t => t.done);

  return (
    <div style={S.tabPane}>
      <section style={S.section}>
        {/* 日付ナビ */}
        <div style={S.dateNav}>
          <button style={S.navBtn} onClick={() => setFilterDate(d => shiftIso(d, -1))}>‹</button>
          <div style={S.dateNavCenter}>
            <span style={S.dateNavLabel}>{fmtDateLabel(filterDate)}</span>
            {filterDate !== todayIso && (
              <button style={S.todayBtn} onClick={() => setFilterDate(todayIso)}>今日</button>
            )}
          </div>
          <input type="date" style={S.datePickerHidden} value={filterDate}
            onChange={e => setFilterDate(e.target.value)} id="memo-date-pick" />
          <label htmlFor="memo-date-pick" style={S.calIconBtn}>📅</label>
          <button style={S.navBtn} onClick={() => setFilterDate(d => shiftIso(d, 1))}>›</button>
        </div>

        {/* 追加フォーム */}
        <div style={S.addForm}>
          <div style={S.row}>
            <input style={S.input} placeholder="タスクを追加..." value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTodo()} />
            <button style={S.btn} onClick={addTodo}>追加</button>
          </div>
          <div style={S.addMeta}>
            <div style={S.addMetaLeft}>
              <span style={S.metaLabel}>日付</span>
              <input type="date" style={S.metaDate} value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <button style={{ ...S.timeToggle, ...(showTime ? S.timeToggleOn : {}) }}
              onClick={() => { setShowTime(v => !v); if (showTime) setNewTime(""); }}>
              🕐 {showTime ? "時刻あり" : "時刻なし"}
            </button>
            {showTime && (
              <input type="time" style={S.metaTime} value={newTime} onChange={e => setNewTime(e.target.value)} />
            )}
          </div>
        </div>

        {/* リスト */}
        {filtered.length === 0 ? (
          <div style={S.emptyTodo}>この日のタスクはありません</div>
        ) : (
          <div style={S.todoList}>
            {undone.map(todo => (
              <div key={todo.id} style={S.todoItem}>
                <button style={S.checkbox}
                  onClick={() => saveTodos(todos.map(t => t.id === todo.id ? { ...t, done: true } : t))}>
                  {""}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e2e8f0", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todo.text}</div>
                  {todo.time && <div style={S.todoTime}>🕐 {todo.time}</div>}
                </div>
                <button style={S.removeBtn} onClick={() => saveTodos(todos.filter(t => t.id !== todo.id))}>×</button>
              </div>
            ))}
            {done.length > 0 && (
              <>
                <div style={S.doneDivider}>完了済み {done.length}件</div>
                {done.map(todo => (
                  <div key={todo.id} style={{ ...S.todoItem, opacity: 0.45 }}>
                    <button style={{ ...S.checkbox, ...S.checkboxDone }}
                      onClick={() => saveTodos(todos.map(t => t.id === todo.id ? { ...t, done: false } : t))}>✓</button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#475569", fontSize: 14, textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todo.text}</div>
                      {todo.time && <div style={S.todoTime}>🕐 {todo.time}</div>}
                    </div>
                    <button style={S.removeBtn} onClick={() => saveTodos(todos.filter(t => t.id !== todo.id))}>×</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <section style={S.section}>
        <h3 style={S.sectionTitle}>📝 フリーメモ</h3>
        <textarea style={S.textarea} placeholder="自由にメモを書いてください..." value={notes}
          onChange={e => setNotes(e.target.value)} />
      </section>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────
export default function SchoolCalendar() {
  const [tab, setTab] = useState("view");
  const [now, setNow] = useState(new Date());
  const [schedule, setSchedule]   = useState(() => loadJson("sc_schedule", DEFAULT_SCHEDULE));
  const [items, setItems]         = useState(() => loadJson("sc_items", {}));
  const [overrides, setOverrides] = useState(() => loadJson("sc_overrides", {}));
  const [notes, setNotes]         = useState(() => localStorage.getItem("sc_notes") || "");
  const [colorMap, setColorMap]   = useState(() => loadJson("sc_colors", {}));
  const [amCount, setAmCount]     = useState(() => loadJson("sc_amcount", 3));
  const [pmCount, setPmCount]     = useState(() => loadJson("sc_pmcount", 3));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { saveJson("sc_schedule", schedule); }, [schedule]);
  useEffect(() => { saveJson("sc_items", items); }, [items]);
  useEffect(() => { saveJson("sc_overrides", overrides); }, [overrides]);
  useEffect(() => { localStorage.setItem("sc_notes", notes); }, [notes]);
  useEffect(() => { saveJson("sc_colors", colorMap); }, [colorMap]);
  useEffect(() => { saveJson("sc_amcount", amCount); }, [amCount]);
  useEffect(() => { saveJson("sc_pmcount", pmCount); }, [pmCount]);

  return (
    <div style={S.app}>
      <div style={S.container}>
        <div style={S.header}>
          <span style={S.logoIcon}>⟡</span>
          <span style={S.logoText}>SchoolPlanner</span>
        </div>

        <div style={S.tabBar}>
          {[
            { key: "view",  label: "📋 予定" },
            { key: "input", label: "✏️ 入力" },
            { key: "memo",  label: "📝 メモ" },
          ].map(t => (
            <button key={t.key}
              style={{ ...S.tabBtn, ...(tab === t.key ? S.tabBtnActive : {}) }}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        <div style={S.content}>
          {tab === "view" && (
            <ViewTab now={now} schedule={schedule} items={items} overrides={overrides}
              colorMap={colorMap} amCount={amCount} pmCount={pmCount} />
          )}
          {tab === "input" && (
            <InputTab now={now} schedule={schedule} setSchedule={setSchedule}
              items={items} setItems={setItems} overrides={overrides} setOverrides={setOverrides}
              colorMap={colorMap} setColorMap={setColorMap}
              amCount={amCount} setAmCount={setAmCount} pmCount={pmCount} setPmCount={setPmCount} />
          )}
          {tab === "memo" && (
            <MemoTab now={now} notes={notes} setNotes={setNotes} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── スタイル ──────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#050c1a", fontFamily: "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", color: "#e2e8f0" },
  container: { maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { padding: "18px 20px 0", display: "flex", alignItems: "center", gap: 8 },
  logoIcon: { fontSize: 20, color: "#38bdf8" },
  logoText: { fontSize: 17, fontWeight: 700, letterSpacing: "0.05em", background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  tabBar: { display: "flex", margin: "14px 16px 0", background: "#0f172a", borderRadius: 12, padding: 4, border: "1px solid #1e293b" },
  tabBtn: { flex: 1, padding: "9px 0", border: "none", borderRadius: 9, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.2s" },
  tabBtnActive: { background: "linear-gradient(135deg,#1e3a5f,#1e1b4b)", color: "#e2e8f0", boxShadow: "0 2px 8px rgba(56,189,248,0.15)" },
  content: { flex: 1, overflowY: "auto", padding: "0 0 40px" },
  tabPane: { padding: "14px 16px" },
  dateHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14 },
  dateText: { fontSize: 15, fontWeight: 700, color: "#94a3b8" },
  timeText: { fontSize: 28, fontWeight: 800, color: "#38bdf8", fontVariantNumeric: "tabular-nums" },
  modeBadge: { display: "inline-block", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid", marginBottom: 14, letterSpacing: "0.05em" },
  weekendMsg: { textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 18 },
  sessionBlock: { marginBottom: 10 },
  sessionLabel: { fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" },
  periodCards: { display: "flex", flexDirection: "column", gap: 6 },
  periodCard: { background: "#0f172a", borderRadius: 10, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #1e293b", borderLeft: "3px solid #1e293b", transition: "all 0.3s", position: "relative" },
  periodCardActive: { background: "#0f1f35", border: "1px solid" },
  periodCardNum: { fontSize: 11, color: "#475569", fontWeight: 700, minWidth: 22 },
  periodCardTime: { fontSize: 11, color: "#334155", minWidth: 90 },
  periodCardSubject: { fontSize: 15, fontWeight: 700, flex: 1 },
  activeDot: { width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" },
  itemsSection: { marginTop: 14 },
  itemsGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  itemBadge: { background: "#1e293b", color: "#94a3b8", padding: "4px 10px", borderRadius: 20, fontSize: 12, border: "1px solid #334155" },
  allDaySection: { marginTop: 18, marginBottom: 4 },
  allDayGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  allDayCol: { display: "flex", flexDirection: "column", gap: 5 },
  allDayColHeader: { fontSize: 11, color: "#475569", fontWeight: 700, marginBottom: 2 },
  allDayCard: { border: "1px solid", borderRadius: 8, padding: "7px 10px", position: "relative", transition: "all 0.3s" },
  weeklySection: { marginTop: 20 },
  weeklyGrid: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 },
  weekCol: { display: "flex", flexDirection: "column", gap: 3, padding: "4px 2px", borderRadius: 6 },
  weekColToday: { background: "#0f1f35", outline: "1px solid #1e3a5f" },
  weekDayLabel: { fontSize: 11, textAlign: "center", color: "#475569", fontWeight: 700, paddingBottom: 4 },
  weekDayToday: { color: "#38bdf8" },
  weekTodoCell: { padding: "4px 5px", borderRadius: 4, transition: "opacity 0.3s" },
  weekEmpty: { fontSize: 10, color: "#1e293b", textAlign: "center", padding: "4px 0" },
  emptyTodo: { textAlign: "center", padding: "24px 0", color: "#475569", fontSize: 14 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" },
  row: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  label: { fontSize: 12, color: "#94a3b8", alignSelf: "center", whiteSpace: "nowrap" },
  select: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, color: "#e2e8f0", padding: "8px 10px", fontSize: 13, outline: "none" },
  input: { flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none", minWidth: 80 },
  btn: { background: "linear-gradient(135deg,#1d4ed8,#4f46e5)", border: "none", borderRadius: 7, color: "#fff", padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  todoList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  todoItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b" },
  todoItemDone: { opacity: 0.5 },
  checkbox: { width: 20, height: 20, borderRadius: 6, border: "2px solid #334155", background: "none", cursor: "pointer", color: "#38bdf8", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxDone: { borderColor: "#38bdf8", background: "#1e3a5f" },
  todoTime: { fontSize: 11, color: "#38bdf8", marginTop: 2 },
  doneDivider: { fontSize: 11, color: "#334155", textAlign: "center", padding: "6px 0 2px", borderTop: "1px solid #1e293b", marginTop: 4 },
  removeBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 },
  dayTabs: { display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" },
  dayTab: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, color: "#64748b", padding: "6px 12px", cursor: "pointer", fontSize: 13 },
  dayTabActive: { background: "#1e3a5f", borderColor: "#38bdf8", color: "#38bdf8" },
  periodGroup: { marginBottom: 10 },
  periodLabel: { fontSize: 11, color: "#475569", marginBottom: 6, fontWeight: 600 },
  periodRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  periodNum: { fontSize: 12, color: "#475569", minWidth: 24 },
  itemGroup: { marginTop: 10 },
  subjectTabBar: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  subjectTabBtn: { border: "1px solid", borderRadius: 20, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },
  itemPanel: { background: "#0a1628", border: "1px solid", borderRadius: 10, padding: "12px" },
  subjectTag: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid", marginBottom: 6 },
  itemList: { display: "flex", flexWrap: "wrap", gap: 6 },
  itemChip: { background: "#1e293b", color: "#94a3b8", padding: "4px 10px", borderRadius: 20, fontSize: 12, display: "flex", alignItems: "center", gap: 6 },
  dateNav: { display: "flex", alignItems: "center", gap: 6, marginBottom: 12, background: "#0f172a", borderRadius: 10, padding: "8px 10px", border: "1px solid #1e293b" },
  navBtn: { background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1 },
  dateNavCenter: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  dateNavLabel: { fontSize: 15, fontWeight: 700, color: "#e2e8f0" },
  todayBtn: { background: "#1e3a5f", border: "none", borderRadius: 6, color: "#38bdf8", fontSize: 11, padding: "2px 8px", cursor: "pointer" },
  datePickerHidden: { position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" },
  calIconBtn: { fontSize: 16, cursor: "pointer", padding: "0 2px" },
  addForm: { marginBottom: 12 },
  addMeta: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 },
  addMetaLeft: { display: "flex", alignItems: "center", gap: 6 },
  metaLabel: { fontSize: 11, color: "#475569" },
  metaDate: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, color: "#94a3b8", padding: "4px 8px", fontSize: 12, outline: "none" },
  metaTime: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, color: "#94a3b8", padding: "4px 8px", fontSize: 12, outline: "none", width: 90 },
  timeToggle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, color: "#475569", padding: "4px 10px", fontSize: 12, cursor: "pointer" },
  timeToggleOn: { borderColor: "#38bdf8", color: "#38bdf8", background: "#0f1f35" },
  textarea: { width: "100%", minHeight: 160, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, color: "#e2e8f0", padding: "12px", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7, fontFamily: "inherit" },
};
