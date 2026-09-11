 AdminLayout.init({ activePage: 'audit', breadcrumb: 'Audit Logs' });

  const { formatDateTime, skeletonTableRows } = AdminLayout;

  async function loadAuditLogs() {
    const tbody = document.getElementById('auditTableBody');
    const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    tbody.innerHTML = skeletonTableRows(5, 6);
    });
    try {
      const res  = await fetch('/api/admin/audit-logs');
      const data = await res.json();
      cancelSkeleton();
      if (!data.success || !data.data.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-clipboard-list"></i><p>No audit logs found</p></div></td></tr>`;
        return;
      }
      tbody.innerHTML = data.data.map(l => `
        <tr>
          <td><strong>${l.action}</strong></td>
          <td>${l.user_name || 'System'}</td>
          <td><code style="font-size:11px;background:var(--color-admin-dark-3);padding:2px 6px;border-radius:4px;">${l.target_table || '-'}</code></td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.details || '-'}</td>
          <td>${formatDateTime(l.created_at)}</td>
        </tr>`).join('');
    } catch (err) {
      cancelSkeleton();
      console.error('Load audit logs error:', err);
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load logs</p></div></td></tr>`;
    }
  }

  loadAuditLogs();