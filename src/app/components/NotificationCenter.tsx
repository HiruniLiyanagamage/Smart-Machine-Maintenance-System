import { useEffect, useRef, useState, useCallback } from 'react';
import { User } from '../../types';

interface AppNotification {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  category: 'machine' | 'breakdown' | 'parts' | 'task';
}

const STORAGE_KEY = 'smms_notif_read';

const getReadIds = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
};
const saveReadIds = (ids: Set<string>) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const buildNotifications = (user: User): AppNotification[] => {
  const notes: AppNotification[] = [];
  const now = new Date().toISOString();
  const role: 'Admin' | 'Staff' = user.user_metadata?.role || (user as any).role || 'Staff';
  const isAdmin = role === 'Admin';
  const myEmail = user.email?.toLowerCase();

  // ── Machines ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    try {
      const machines: any[] = JSON.parse(localStorage.getItem('machines') || '[]');
      machines.forEach(m => {
        if (m.condemned || !m.nextServiceDate) return;
        const days = Math.ceil((new Date(m.nextServiceDate).getTime() - Date.now()) / 86400000);
        if (days < 0) {
          notes.push({
            id: `notif-overdue-${m.id}`, type: 'critical', icon: '🚨',
            title: 'Overdue Service',
            body: `${m.name} (${m.location}) is ${Math.abs(days)} day(s) overdue for service.`,
            time: m.updatedAt || now, read: false, category: 'machine',
          });
        } else if (days <= 7) {
          notes.push({
            id: `notif-soon-${m.id}`, type: 'warning', icon: '⏰',
            title: 'Service Due Soon',
            body: `${m.name} needs service in ${days} day(s) — ${new Date(m.nextServiceDate).toLocaleDateString()}.`,
            time: m.updatedAt || now, read: false, category: 'machine',
          });
        }
      });
    } catch { /* */ }
  }

  // ── Spare Parts ────────────────────────────────────────────────────────────
  if (isAdmin) {
    try {
      const parts: any[] = JSON.parse(localStorage.getItem('parts') || '[]');
      parts.forEach(p => {
        if (p.currentStock <= p.minimumStock) {
          notes.push({
            id: `notif-lowstock-${p.id}`, type: 'critical', icon: '📦',
            title: 'Critical Low Stock',
            body: `${p.name} (#${p.partNumber}): ${p.currentStock} remaining (min: ${p.minimumStock}). Reorder from ${p.supplier || 'supplier'}.`,
            time: p.updatedAt || now, read: false, category: 'parts',
          });
        } else if (p.currentStock <= p.minimumStock * 1.5) {
          notes.push({
            id: `notif-runninglow-${p.id}`, type: 'warning', icon: '⚠️',
            title: 'Running Low',
            body: `${p.name} stock is ${p.currentStock} (min: ${p.minimumStock}). Consider restocking soon.`,
            time: p.updatedAt || now, read: false, category: 'parts',
          });
        }
      });
    } catch { /* */ }
  }

  // ── Breakdowns ─────────────────────────────────────────────────────────────
  try {
    const bds: any[] = JSON.parse(localStorage.getItem('breakdowns') || '[]');
    bds.forEach(b => {
      if (b.status === 'Resolved') return;
      if (!isAdmin) {
        // filter: only breakdowns assigned to me
        const isAssigned = Array.isArray(b.assignedTo)
          ? b.assignedTo.some((a: any) => a.email?.toLowerCase() === myEmail || a.id === user.id)
          : b.assignedTo?.toLowerCase() === myEmail;
        if (!isAssigned) return;
      }
      const isCrit = b.priority === 'Critical';
      const isHigh = b.priority === 'High';
      if (isCrit || isHigh || b.status === 'Pending') {
        notes.push({
          id: `notif-bd-${b.id}`,
          type: isCrit ? 'critical' : isHigh ? 'warning' : 'info',
          icon: isCrit ? '🔴' : isHigh ? '🟠' : '⚠️',
          title: `${b.priority} Breakdown — ${b.status}`,
          body: `${b.machineName}: ${b.description.substring(0, 90)}${b.description.length > 90 ? '...' : ''}`,
          time: b.reportedAt || now, read: false, category: 'breakdown',
        });
      }
    });
  } catch { /* */ }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  try {
    const tasks: any[] = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks.forEach(t => {
      if (t.status === 'Completed') return;
      if (!isAdmin) {
        // filter: only tasks assigned to me
        const isAssigned = (t.assignedTo || []).some((a: any) => a.email?.toLowerCase() === myEmail || a.id === user.id);
        if (!isAssigned) return;
      }
      const daysLeft = Math.ceil((new Date(t.scheduledDate).getTime() - Date.now()) / 86400000);
      if (t.priority === 'Critical' || daysLeft <= 2) {
        notes.push({
          id: `notif-task-${t.id}`,
          type: t.priority === 'Critical' ? 'critical' : 'warning',
          icon: '📋',
          title: `Task Due${daysLeft < 0 ? ' (Overdue)' : daysLeft === 0 ? ' Today' : ` in ${daysLeft}d`}`,
          body: `"${t.title}" on ${t.machineName} — assigned to ${(t.assignedTo || []).map((s: any) => s.name).join(', ')}.`,
          time: t.createdAt || now, read: false, category: 'task',
        });
      }
    });
  } catch { /* */ }

  const readIds = getReadIds();
  return notes
    .map(n => ({ ...n, read: readIds.has(n.id) }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
};

const typeColors: Record<string, string> = {
  critical: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  success: 'var(--success)',
};

interface Props {
  user: User;
}

export default function NotificationCenter({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    if (user) {
      setNotifications(buildNotifications(user));
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => {
    const ids = getReadIds(); ids.add(id); saveReadIds(ids);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    const ids = getReadIds();
    notifications.forEach(n => ids.add(n.id));
    saveReadIds(ids);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    const ids = getReadIds(); ids.add(id); saveReadIds(ids);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const displayed = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  const catLabel = (cat: AppNotification['category']) => {
    if (cat === 'machine') return '⚙️ Machine';
    if (cat === 'breakdown') return '🔥 Breakdown';
    if (cat === 'parts') return '🔩 Inventory';
    return '📋 Task';
  };

  return (
    <div className="notif-root" ref={panelRef}>
      {/* Bell button */}
      <button
        className={`notif-bell${unreadCount > 0 ? ' has-unread' : ''}`}
        onClick={() => { setOpen(o => !o); if (!open) refresh(); }}
        title="Notifications"
        aria-label={`${unreadCount} unread notifications`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="notif-panel">
          {/* Header */}
          <div className="notif-header">
            <div>
              <div className="notif-header-title">🔔 Notifications</div>
              <div className="notif-header-sub">{unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="notif-filter-tabs">
                <button
                  className={`notif-filter-tab${filter === 'all' ? ' active' : ''}`}
                  onClick={() => setFilter('all')}
                >All</button>
                <button
                  className={`notif-filter-tab${filter === 'unread' ? ' active' : ''}`}
                  onClick={() => setFilter('unread')}
                >
                  Unread {unreadCount > 0 && <span className="notif-tab-count">{unreadCount}</span>}
                </button>
              </div>
              {unreadCount > 0 && (
                <button className="notif-mark-all" onClick={markAllRead} title="Mark all as read">
                  ✓ All
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="notif-list">
            {displayed.length === 0 ? (
              <div className="notif-empty">
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 600 }}>{filter === 'unread' ? 'No unread notifications' : 'All caught up!'}</div>
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>
                  System will refresh every 60 seconds
                </div>
              </div>
            ) : displayed.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.read ? ' read' : ''}`}
                style={{ '--notif-color': typeColors[n.type] } as React.CSSProperties & { '--notif-color': string }}
                onClick={() => markRead(n.id)}
              >
                <div className="notif-item-icon">{n.icon}</div>
                <div className="notif-item-content">
                  <div className="notif-item-header-row">
                    <span className="notif-item-title">{n.title}</span>
                    <span className="notif-item-time">{relativeTime(n.time)}</span>
                  </div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-cat">
                    <span className={`notif-cat-badge ${n.type}`}>{catLabel(n.category)}</span>
                    {!n.read && <span className="notif-unread-dot" />}
                  </div>
                </div>
                <button
                  className="notif-dismiss"
                  onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                  title="Dismiss"
                >✕</button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="notif-footer">
            <button className="notif-refresh-btn" onClick={() => refresh()}>
              🔄 Refresh
            </button>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Auto-refreshes every 60s</span>
          </div>
        </div>
      )}
    </div>
  );
}
