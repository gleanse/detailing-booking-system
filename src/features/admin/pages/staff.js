 AdminLayout.init({ activePage: 'staff', breadcrumb: 'Staff Accounts' });

  const { statusBadge, formatDate, skeletonTableRows } = AdminLayout;

  //  Helpers 
  function openOverlay(id)  { document.getElementById(id).classList.remove('hidden'); }
  function closeOverlay(id) { document.getElementById(id).classList.add('hidden'); }

  function showMsg(type, text) {
    const el = document.getElementById('addStaffMsg');
    el.className = 'modal-msg ' + type;
    el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${text}`;
  }
  function hideMsg() { document.getElementById('addStaffMsg').className = 'modal-msg'; }

  function setErr(id, msg) {
    const el = document.getElementById(id + 'Err');
    if (el) el.textContent = msg;
    const input = document.getElementById(id);
    if (input) input.classList.toggle('is-error', !!msg);
  }
  function clearErr(id) { setErr(id, ''); }

  //  Password Strength 
  document.getElementById('staff_password').addEventListener('input', function () {
    const val = this.value;
    const fill  = document.getElementById('staffStrengthFill');
    const label = document.getElementById('staffStrengthLabel');
    let score = 0;
    if (val.length >= 8)         score++;
    if (/[A-Z]/.test(val))       score++;
    if (/[0-9]/.test(val))       score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    if (!val) { fill.className = 'strength-fill'; fill.style.width='0%'; label.textContent='Password strength'; return; }
    if (score <= 1) { fill.className='strength-fill weak';   label.textContent='Weak'; }
    else if (score<=2){ fill.className='strength-fill medium'; label.textContent='Medium'; }
    else              { fill.className='strength-fill strong'; label.textContent='Strong'; }
  });

  //  Password Toggle 
  document.getElementById('toggleStaffPw').addEventListener('click', function () {
    const input = document.getElementById('staff_password');
    const icon  = document.getElementById('staffPwIcon');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
  });

  //  Load Staff Table 
  async function loadStaff() {
    const tbody = document.getElementById('staffTableBody');
    const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    tbody.innerHTML = skeletonTableRows(5, 5);
    });
    try {
      const res  = await fetch('/api/admin/staff');
      const data = await res.json();
      cancelSkeleton();
      if (!data.success || !data.data.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-users"></i><p>No staff accounts found. Click "Add Account" to create one.</p></div></td></tr>`;
        return;
      }
      tbody.innerHTML = data.data.map(u => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="user-avatar" style="width:32px;height:32px;font-size:12px;border-radius:8px;">
                ${(u.name || '?')[0].toUpperCase()}
              </div>
              <strong>${u.name}</strong>
            </div>
          </td>
          <td>${u.email}</td>
          <td>${statusBadge(u.role)}</td>
          <td>${formatDate(u.created_at)}</td>
          <td>
            <button class="action-btn danger"
              onclick="openDeleteStaff('${u.id}', '${(u.name||'').replace(/'/g,"\\'")}')">
              <i class="fas fa-user-times"></i> Remove
            </button>
          </td>
        </tr>`).join('');
    } catch (err) {
      cancelSkeleton();
      console.error('Load staff error:', err);
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load staff</p></div></td></tr>`;
    }
  }

  //  Open Add Modal 
  document.getElementById('addStaffBtn').addEventListener('click', () => {
    // Reset form
    ['staff_name','staff_email','staff_password','staff_confirm'].forEach(id => {
      document.getElementById(id).value = '';
      document.getElementById(id).classList.remove('is-error');
    });
    document.getElementById('staff_role').value = '';
    ['staff_name','staff_email','staff_role','staff_password','staff_confirm'].forEach(id => clearErr(id));
    document.getElementById('staffStrengthFill').className = 'strength-fill';
    document.getElementById('staffStrengthFill').style.width = '0%';
    document.getElementById('staffStrengthLabel').textContent = 'Password strength';
    // Reset pw toggle
    document.getElementById('staff_password').type = 'password';
    document.getElementById('staffPwIcon').className = 'fas fa-eye';
    hideMsg();
    openOverlay('addStaffModal');
    document.getElementById('staff_name').focus();
  });

  ['addStaffModalClose','addStaffModalCancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => closeOverlay('addStaffModal'));
  });
  document.getElementById('addStaffModal').addEventListener('click', e => {
    if (e.target.id === 'addStaffModal') closeOverlay('addStaffModal');
  });

  //  Save New Account 
  document.getElementById('addStaffModalSave').addEventListener('click', async () => {
    const name     = document.getElementById('staff_name').value.trim();
    const email    = document.getElementById('staff_email').value.trim();
    const role     = document.getElementById('staff_role').value;
    const password = document.getElementById('staff_password').value;
    const confirm  = document.getElementById('staff_confirm').value;

    let valid = true;

    if (!name || name.length < 2)              { setErr('staff_name',     'Name must be at least 2 characters'); valid=false; } else clearErr('staff_name');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('staff_email', 'Enter a valid email address'); valid=false; } else clearErr('staff_email');
    if (!role)                                 { setErr('staff_role',     'Please select a role');              valid=false; } else clearErr('staff_role');
    if (!password || password.length < 8)      { setErr('staff_password', 'Password must be at least 8 characters'); valid=false; } else clearErr('staff_password');
    if (!confirm)                              { setErr('staff_confirm',  'Please confirm the password');       valid=false; }
    else if (confirm !== password)             { setErr('staff_confirm',  'Passwords do not match');            valid=false; }
    else                                         clearErr('staff_confirm');

    if (!valid) return;

    const btn = document.getElementById('addStaffModalSave');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
      const res  = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.toLowerCase(), role, password }),
      });
      const data = await res.json();

      if (data.success) {
        showMsg('success', `Account for ${name} created successfully!`);
        setTimeout(() => { closeOverlay('addStaffModal'); loadStaff(); }, 1000);
      } else {
        showMsg('error', data.message || 'Failed to create account.');
      }
    } catch (err) {
      showMsg('error', 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    }
  });

  //  Delete Staff 
  let deletingStaffId = null;

  function openDeleteStaff(id, name) {
    deletingStaffId = id;
    document.getElementById('deleteStaffMsg').textContent =
      `Remove the account for "${name}"? This cannot be undone.`;
    openOverlay('deleteStaffModal');
  }

  document.getElementById('deleteStaffCancel').addEventListener('click', () => closeOverlay('deleteStaffModal'));
  document.getElementById('deleteStaffModal').addEventListener('click', e => {
    if (e.target.id === 'deleteStaffModal') closeOverlay('deleteStaffModal');
  });

  document.getElementById('deleteStaffConfirm').addEventListener('click', async () => {
    if (!deletingStaffId) return;
    const btn = document.getElementById('deleteStaffConfirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';

    try {
      const res  = await fetch(`/api/admin/staff/${deletingStaffId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        closeOverlay('deleteStaffModal');
        loadStaff();
      } else {
        alert('Failed to remove: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error. Try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-user-times"></i> Remove';
      deletingStaffId = null;
    }
  });

  loadStaff();