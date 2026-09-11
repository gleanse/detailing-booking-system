AdminLayout.init({ activePage: 'payments', breadcrumb: 'Payments' });

  const { statusBadge, formatCurrency, formatDateTime, skeletonTableRows } = AdminLayout; 
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  async function loadPayments() {
    const tbody = document.getElementById('paymentsTableBody');

    const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    tbody.innerHTML = skeletonTableRows(8, 6);
   }); 

    try {
      const res  = await fetch('/api/admin/payments');
      const data = await res.json();
      cancelSkeleton();
      if (!data.success || !data.data.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-receipt"></i><p>No payment records</p></div></td></tr>`;
        return;
      }
      let totalPaid = 0, totalBalance = 0;
      tbody.innerHTML = data.data.map(p => {
        totalPaid    += Number(p.amount_paid || 0);
        totalBalance += Number(p.remaining_balance || 0);
        return `
          <tr>
            <td><strong>${p.reference_code || '-'}</strong></td>
            <td>${p.guest_name || p.user_name || '-'}</td>
            <td>${formatCurrency(p.amount)}</td>
            <td><strong style="color:#10b981">${formatCurrency(p.amount_paid)}</strong></td>
            <td>${p.remaining_balance > 0
              ? `<strong style="color:var(--color-admin-warning)">${formatCurrency(p.remaining_balance)}</strong>`
              : '-'}</td>
            <td>${p.payment_type === 'full'
              ? '<span class="status-badge status-confirmed">Full</span>'
              : '<span class="status-badge status-pending">Down Payment</span>'}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${formatDateTime(p.paid_at)}</td>
          </tr>`;
      }).join('');
      setText('statPaidTotal',   formatCurrency(totalPaid));
      setText('statUnpaidTotal', formatCurrency(totalBalance));
    } catch (err) {
      cancelSkeleton();
      console.error('Load payments error:', err);
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load payments</p></div></td></tr>`;
    }
  }

  loadPayments();