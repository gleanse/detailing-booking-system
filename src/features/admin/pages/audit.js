  AdminLayout.init({ activePage: 'audit', breadcrumb: 'Audit Logs' });

  const { formatDateTime, skeletonTableRows } = AdminLayout;

  let auditLogs = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openAuditModal(index) {
    const l = auditLogs[index];
    if (!l) return;
    document.getElementById('auditAction').textContent  = l.action;
    document.getElementById('auditUser').textContent    = l.user_name || 'System';
    document.getElementById('auditTable').textContent   = l.target_table || '-';
    document.getElementById('auditTarget').textContent  = l.target_id || '-';
    document.getElementById('auditDetails').textContent = l.details || '-';
    document.getElementById('auditDate').textContent    = formatDateTime(l.created_at);
    document.getElementById('auditModal').style.display = 'flex';
  }

  function closeAuditModal() {
    document.getElementById('auditModal').style.display = 'none';
  }

  document.getElementById('auditModalClose').addEventListener('click', closeAuditModal);
  document.getElementById('auditModalDone').addEventListener('click', closeAuditModal);
  document.getElementById('auditModal').addEventListener('click', e => {
    if (e.target.id === 'auditModal') closeAuditModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAuditModal();
  });
  document.getElementById('auditTableBody').addEventListener('click', e => {
    const row = e.target.closest('tr.audit-row');
    if (row) openAuditModal(Number(row.dataset.index));
  });

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
      auditLogs = data.data;
      tbody.innerHTML = auditLogs.map((l, i) => `
        <tr class="audit-row" data-index="${i}" style="cursor:pointer;">
          <td><strong>${escapeHtml(l.action)}</strong></td>
          <td>${escapeHtml(l.user_name || 'System')}</td>
          <td><code style="font-size:11px;background:var(--color-admin-dark-3);padding:2px 6px;border-radius:4px;">${escapeHtml(l.target_table || '-')}</code></td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.details || '-')}</td>
          <td>${formatDateTime(l.created_at)}</td>
        </tr>`).join('');
    } catch (err) {
      cancelSkeleton();
      console.error('Load audit logs error:', err);
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load logs</p></div></td></tr>`;
    }
  }

  loadAuditLogs();
