import { useEffect, useState } from 'react';
import { getMachines, getServiceRecords, getMaintenanceTasks, getStaffList, getBreakdowns } from '../../utils/api';
import { Machine, ServiceRecord, MaintenanceTask, StaffMember, BreakdownReport, User } from '../../types';

interface Props { user: User; }

// ─── Tiny SVG bar chart ───────────────────────────────────────────────────────
function BarChart({ data, maxValue, color }: { data: { label: string; value: number }[]; maxValue: number; color: string }) {
  if (!data.length) return null;
  const max = maxValue || 1;
  const barW = Math.max(24, Math.floor(300 / data.length) - 8);
  const chartH = 120;
  const chartW = data.length * (barW + 8) + 8;

  return (
    <svg width={chartW} height={chartH + 32} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * chartH);
        const x = 4 + i * (barW + 8);
        const y = chartH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h || 2} rx={4} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
              {d.value}
            </text>
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={9} fill="var(--text-muted)" width={barW}>
              {d.label.length > 8 ? d.label.slice(0, 8) + '…' : d.label}
            </text>
          </g>
        );
      })}
      {/* baseline */}
      <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="var(--border)" strokeWidth={1} />
    </svg>
  );
}

// ─── Donut / ring chart ───────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52, cx = 68, cy = 68, stroke = 28;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const slices = segments.map(seg => {
    const dash = (seg.value / total) * circumference;
    const gap = circumference - dash;
    const start = offset;
    offset += dash;
    return { ...seg, dash, gap, start };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={136} height={136}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.start + circumference / 4}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--text-primary)">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 'auto' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Staff performance horizontal bar ────────────────────────────────────────
function StaffBar({ name, role, assigned, completed, rate }: { name: string; role: string; assigned: number; completed: number; rate: number }) {
  const color = rate === 100 ? '#22c55e' : rate >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
          {role && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--bg-surface)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 20, border: '1px solid var(--border)' }}>{role}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>📋 {assigned} assigned</span>
          <span>✅ {completed} done</span>
          <span style={{ fontWeight: 700, fontSize: 14, color }}>{rate}%</span>
        </div>
      </div>
      <div style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 99, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
      </div>
    </div>
  );
}

export default function AdminReports({ user }: Props) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownReport[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  const load = async () => {
    setLoading(true);
    try {
      const [{ machines: md }, { staff }, { tasks: td }, { breakdowns: bd }] = await Promise.all([
        getMachines(), getStaffList(), getMaintenanceTasks(), getBreakdowns()
      ]);
      setMachines(md);
      setStaffList(staff);
      setTasks(td);
      setBreakdowns(bd);

      const allServices: ServiceRecord[] = [];
      for (const m of md) {
        const { services: sd } = await getServiceRecords(m.id);
        allServices.push(...sd);
      }
      setServices(allServices);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Generating Reports…</span></div>;

  // ── Filter services by month ──────────────────────────────────────────────
  const filteredServices = services.filter(s => (s.serviceDate || '').startsWith(reportMonth));

  // ── Staff performance: count completions from tasks AND breakdowns ─────────
  // A "completion" for a staff member counts only when:
  //   – they are assigned to the item
  //   – their completions record has completion_level === 100
  //   – the submittedAt date falls in the selected month
  const staffPerformance = staffList.map(staff => {
    // ── Tasks ──
    const myTasks = tasks.filter(t => t.assignedTo?.some(a => a.id === staff.id));
    const completedTasksThisMonth = myTasks.filter(t => {
      const comp = t.completions?.[staff.id];
      return comp?.completion_level === 100 && (comp.submittedAt || '').startsWith(reportMonth);
    });
    // Tasks assigned this month (scheduled or created this month)
    const assignedTasksThisMonth = myTasks.filter(t =>
      (t.scheduledDate || '').startsWith(reportMonth) || (t.createdAt || '').startsWith(reportMonth)
    );

    // ── Breakdowns ──
    const myBreakdowns = breakdowns.filter(b => b.assignedTo?.some(a => a.id === staff.id));
    const completedBreakdownsThisMonth = myBreakdowns.filter(b => {
      const comp = b.completions?.[staff.id];
      return comp?.completion_level === 100 && (comp.submittedAt || '').startsWith(reportMonth);
    });
    const assignedBreakdownsThisMonth = myBreakdowns.filter(b =>
      (b.reportedAt || '').startsWith(reportMonth) || (b.updatedAt || '').startsWith(reportMonth)
    );

    const totalAssigned = assignedTasksThisMonth.length + assignedBreakdownsThisMonth.length;
    const totalCompleted = completedTasksThisMonth.length + completedBreakdownsThisMonth.length;
    const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

    return {
      ...staff,
      assignedTasks: assignedTasksThisMonth.length,
      completedTasks: completedTasksThisMonth.length,
      assignedBreakdowns: assignedBreakdownsThisMonth.length,
      completedBreakdowns: completedBreakdownsThisMonth.length,
      totalAssigned,
      totalCompleted,
      completionRate,
    };
  }).filter(sp => sp.totalAssigned > 0 || sp.totalCompleted > 0);

  // ── Summary KPIs ─────────────────────────────────────────────────────────
  const monthBreakdowns = breakdowns.filter(b => (b.reportedAt || '').startsWith(reportMonth));
  const resolvedBreakdowns = monthBreakdowns.filter(b => b.status === 'Resolved');
  const monthTasks = tasks.filter(t => (t.createdAt || t.scheduledDate || '').startsWith(reportMonth));
  const completedTasks = monthTasks.filter(t => t.status === 'Completed');

  // ── Chart data: services per machine ─────────────────────────────────────
  const servicesPerMachine = machines
    .map(m => ({
      label: m.name,
      value: filteredServices.filter(s => s.machineId === m.id).length,
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const maxSvc = Math.max(...servicesPerMachine.map(d => d.value), 1);

  // ── CSV exports ───────────────────────────────────────────────────────────
  const downloadServicesCSV = () => {
    const headers = ['Date', 'Machine', 'Technician', 'Description'];
    const rows = filteredServices.map(s => {
      const machine = machines.find(m => m.id === s.machineId);
      return [new Date(s.serviceDate).toLocaleDateString(), `"${(machine?.name || 'Unknown').replace(/"/g, '""')}"`,
        `"${s.technician.replace(/"/g, '""')}"`, `"${(s.description || '').replace(/"/g, '""')}"`].join(',');
    });
    triggerCSV([headers.join(','), ...rows].join('\n'), `Services_Report_${reportMonth}.csv`);
  };

  const triggerCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  };

  const monthLabel = new Date(reportMonth + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const downloadFullReportPDF = () => {
    const previousTitle = document.title;
    document.title = `Monthly_Report_${reportMonth}`;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
  };

  return (
    <div>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body * { visibility: hidden; }
          #monthly-report-export-area, #monthly-report-export-area * { visibility: visible; }
          #monthly-report-export-area {
            --bg-card: #fff;
            --bg-surface: #f1f5f9;
            --text-primary: #0f172a;
            --text-secondary: #334155;
            --text-muted: #64748b;
            --border: #cbd5e1;
            --border-strong: #94a3b8;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #0f172a !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          #monthly-report-export-area .card,
          #monthly-report-export-area .table-wrapper,
          #monthly-report-export-area .stat-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
          }
          #monthly-report-export-area .stat-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          #monthly-report-export-area svg {
            max-width: 100%;
          }
          .report-controls, .report-actions, .btn, .form-input, label {
            display: none !important;
          }
        }
      `}</style>
      {error && <div className="alert alert-danger mb-4">{error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}

      {/* Header */}
      <div id="monthly-report-export-area">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>📊 Monthly Reports</h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{monthLabel} — Service history, staff performance & analytics</div>
          </div>
          <div className="report-controls flex items-center gap-2">
            <label style={{ fontSize: 13, fontWeight: 500 }}>Report Month:</label>
            <input type="month" className="form-input" value={reportMonth} onChange={e => setReportMonth(e.target.value)} style={{ width: 'auto', padding: '6px 12px' }} />
            <button className="btn btn-ghost btn-sm" onClick={downloadFullReportPDF}>⬇️ Download PDF</button>
          </div>
        </div>

      {/* ── KPI Summary Cards ───────────────────────────────────────────────── */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 28 }}>
        <div className="stat-card blue">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Services Done</div>
            <div className="stat-value">{filteredServices.length}</div>
          </div>
          <div className="stat-icon">🔧</div>
        </div>
        <div className="stat-card red">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Breakdowns</div>
            <div className="stat-value">{monthBreakdowns.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{resolvedBreakdowns.length} resolved</div>
          </div>
          <div className="stat-icon">⚠️</div>
        </div>
        <div className="stat-card green">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Tasks</div>
            <div className="stat-value">{monthTasks.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{completedTasks.length} completed</div>
          </div>
          <div className="stat-icon">📋</div>
        </div>
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      {(filteredServices.length > 0 || monthBreakdowns.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 28 }}>

          {/* Breakdown status donut */}
          {monthBreakdowns.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>⚠️ Breakdown Status</div>
              <DonutChart segments={[
                { label: 'Resolved', value: resolvedBreakdowns.length, color: '#22c55e' },
                { label: 'In Progress', value: monthBreakdowns.filter(b => b.status === 'In Progress').length, color: '#f59e0b' },
                { label: 'Pending', value: monthBreakdowns.filter(b => b.status === 'Pending').length, color: '#ef4444' },
              ].filter(s => s.value > 0)} />
            </div>
          )}

          {/* Task status donut */}
          {monthTasks.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>📋 Task Status</div>
              <DonutChart segments={[
                { label: 'Completed', value: completedTasks.length, color: '#22c55e' },
                { label: 'In Progress', value: monthTasks.filter(t => t.status === 'In Progress').length, color: '#f59e0b' },
                { label: 'Pending', value: monthTasks.filter(t => t.status === 'Pending').length, color: '#6366f1' },
              ].filter(s => s.value > 0)} />
            </div>
          )}

          {/* Services per machine bar */}
          {servicesPerMachine.length > 0 && (
            <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>🔧 Services by Machine</div>
              <BarChart data={servicesPerMachine} maxValue={maxSvc} color="#6366f1" />
            </div>
          )}

        </div>
      )}

      {/* ── Staff Performance ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div className="flex justify-between items-center mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>👤 Staff Performance — {monthLabel}</h3>
        </div>

        {staffPerformance.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No staff activity found for {monthLabel}.
          </div>
        ) : (
          <div className="card" style={{ padding: '8px 20px' }}>
            {staffPerformance
              .sort((a, b) => b.completionRate - a.completionRate)
              .map(sp => (
                <StaffBar
                  key={sp.id}
                  name={sp.name}
                  role={sp.role}
                  assigned={sp.totalAssigned}
                  completed={sp.totalCompleted}
                  rate={sp.completionRate}
                />
              ))}
          </div>
        )}
      </div>

      {/* ── Services Performed Table ─────────────────────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>🔧 Services Performed — {monthLabel}</h3>
          <button className="report-actions btn btn-ghost btn-sm" onClick={downloadServicesCSV} disabled={filteredServices.length === 0}>
            ⬇️ Download CSV
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Machine</th>
                <th>Technician</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No services performed this month.</td></tr>
              ) : filteredServices.map(s => {
                const machine = machines.find(m => m.id === s.machineId);
                return (
                  <tr key={s.id}>
                    <td>{new Date(s.serviceDate).toLocaleDateString()}</td>
                    <td className="cell-primary">{machine?.name || 'Unknown'}</td>
                    <td>{s.technician}</td>
                    <td style={{ maxWidth: 260 }}><span title={s.description}>{s.description && s.description.length > 60 ? s.description.slice(0, 60) + '…' : s.description}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
}
