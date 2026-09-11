 AdminLayout.init({ activePage: 'services', breadcrumb: 'Services' });

  const { formatCurrency, skeletonCards } = AdminLayout;

  //  State 
  let editingServiceId  = null;
  let variantsServiceId = null;
  let deletingServiceId = null;
  let currentImageBase64 = null; // base64 of newly selected file
  let clearImageFlag     = false; // user clicked "remove image"

  //  Image upload handling 
  const imgFileInput    = document.getElementById('svc_image_file');
  const imgUploadArea   = document.getElementById('imgUploadArea');
  const imgPlaceholder  = document.getElementById('imgPlaceholder');
  const imgPreviewWrap  = document.getElementById('imgPreviewWrap');
  const imgPreview      = document.getElementById('imgPreview');
  const imgClearBtn     = document.getElementById('imgClearBtn');

  imgFileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      showModalMsg('serviceModalMsg', 'error', 'Image too large. Please choose a file under 5MB.');
      this.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageBase64 = e.target.result;
      clearImageFlag = false;
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  function setImagePreview(src) {
    imgPreview.src = src;
    imgPreviewWrap.classList.add('visible');
    imgPlaceholder.style.display = 'none';
    imgUploadArea.classList.add('has-image');
    imgClearBtn.style.display = 'inline-flex';
  }

  function clearImagePreview() {
    imgPreview.src = '';
    imgPreviewWrap.classList.remove('visible');
    imgPlaceholder.style.display = '';
    imgUploadArea.classList.remove('has-image');
    imgClearBtn.style.display = 'none';
    imgFileInput.value = '';
    currentImageBase64 = null;
  }

  imgClearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImageFlag = true;
    clearImagePreview();
  });

  // Reset image state when modal opens
  function resetImageState(existingImageUrl) {
    clearImageFlag     = false;
    currentImageBase64 = null;
    imgFileInput.value = '';

    if (existingImageUrl) {
      setImagePreview(existingImageUrl);
    } else {
      clearImagePreview();
    }
  }

  //  Helpers 
  function showModalMsg(msgId, type, text) {
    const el = document.getElementById(msgId);
    el.className = 'modal-msg ' + type;
    el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${text}`;
  }
  function hideModalMsg(msgId) {
    document.getElementById(msgId).className = 'modal-msg';
  }
  function openOverlay(id)  { document.getElementById(id).classList.remove('hidden'); }
  function closeOverlay(id) { document.getElementById(id).classList.add('hidden'); }
  function escHtml(str) {
    return String(str||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
  }

  //  Load Services 
  async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    grid.innerHTML = skeletonCards(3);
    });

    try {
      const res  = await fetch('/api/admin/services');
      const data = await res.json();
      cancelSkeleton();
      if (!data.success || !data.data.length) {
        grid.innerHTML = `<div class="full-width"><div class="empty-state">
          <i class="fas fa-spray-can"></i><p>No services yet. Add your first service.</p>
        </div></div>`;
        return;
      }

      grid.innerHTML = data.data.map(s => `
        <div class="service-card">
          <div class="service-card-header">
            <span class="service-name">${s.name}</span>
            <span class="service-price">from ${formatCurrency(s.price)}</span>
          </div>
          <div class="service-card-body">
            ${s.description ? `<p class="service-desc">${s.description}</p>` : ''}
            ${s.variants && s.variants.length
              ? `<ul class="variant-list">
                  ${s.variants.map(v => `
                    <li class="variant-item">
                      <span>${v.name}</span>
                      <strong>${formatCurrency(v.price)}</strong>
                    </li>`).join('')}
                </ul>`
              : '<p class="service-desc" style="font-style:italic;color:var(--color-admin-dim);">No variants yet</p>'}
          </div>
          <div class="service-card-footer">
            <button class="action-btn"
              data-id="${s.id}"
              data-name="${escHtml(s.name)}"
              data-desc="${escHtml(s.description||'')}"
              data-price="${s.price}"
              data-duration="${s.duration_hours||''}"
              data-img="${escHtml(s.image_url||'')}"
              onclick="openEditService(this)">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="action-btn"
              onclick="openVariants('${s.id}','${escHtml(s.name)}')">
              <i class="fas fa-tags"></i> Variants
            </button>
            <button class="action-btn danger"
              onclick="openDelete('${s.id}','${escHtml(s.name)}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>`).join('');
    } catch (err) {
      cancelSkeleton();
      console.error('Load services error:', err);
      grid.innerHTML = `<div class="full-width"><div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i><p>Failed to load services</p>
      </div></div>`;
    }
  }

  //  ADD SERVICE 
  document.getElementById('addServiceBtn').addEventListener('click', () => {
    editingServiceId = null;
    document.getElementById('serviceModalTitle').innerHTML = '<i class="fas fa-spray-can"></i> Add Service';
    document.getElementById('serviceModalSaveLabel').textContent = 'Save Service';
    document.getElementById('svc_name').value        = '';
    document.getElementById('svc_description').value = '';
    document.getElementById('svc_price').value       = '';
    document.getElementById('svc_duration').value    = '';
    resetImageState(null);
    hideModalMsg('serviceModalMsg');
    openOverlay('serviceModal');
    document.getElementById('svc_name').focus();
  });

  //  EDIT SERVICE 
  function openEditService(btn) {
    editingServiceId = btn.dataset.id;
    document.getElementById('serviceModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Service';
    document.getElementById('serviceModalSaveLabel').textContent = 'Update Service';
    document.getElementById('svc_name').value        = btn.dataset.name;
    document.getElementById('svc_description').value = btn.dataset.desc;
    document.getElementById('svc_price').value       = btn.dataset.price;
    document.getElementById('svc_duration').value    = btn.dataset.duration || '';
    resetImageState(btn.dataset.img || null);
    hideModalMsg('serviceModalMsg');
    openOverlay('serviceModal');
    document.getElementById('svc_name').focus();
  }

  // Close service modal
  ['serviceModalClose','serviceModalCancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => closeOverlay('serviceModal'));
  });
  document.getElementById('serviceModal').addEventListener('click', e => {
    if (e.target.id === 'serviceModal') closeOverlay('serviceModal');
  });

  //  SAVE SERVICE 
  document.getElementById('serviceModalSave').addEventListener('click', async () => {
    const name     = document.getElementById('svc_name').value.trim();
    const desc     = document.getElementById('svc_description').value.trim();
    const price    = document.getElementById('svc_price').value.trim();
    const duration = document.getElementById('svc_duration').value.trim();

    if (!name) {
      showModalMsg('serviceModalMsg', 'error', 'Service name is required.');
      document.getElementById('svc_name').focus();
      return;
    }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      showModalMsg('serviceModalMsg', 'error', 'Please enter a valid base price.');
      document.getElementById('svc_price').focus();
      return;
    }

    const btn = document.getElementById('serviceModalSave');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const payload = {
      name, price,
      description:    desc     || null,
      duration_hours: duration || null,
      image_base64:   currentImageBase64 || null,
      clear_image:    clearImageFlag,
    };

    try {
      const url    = editingServiceId ? `/api/admin/services/${editingServiceId}` : '/api/admin/services';
      const method = editingServiceId ? 'PUT' : 'POST';

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showModalMsg('serviceModalMsg', 'success', data.message || 'Saved!');
        setTimeout(() => { closeOverlay('serviceModal'); loadServices(); }, 900);
      } else {
        showModalMsg('serviceModalMsg', 'error', data.message || 'Failed to save service.');
      }
    } catch (err) {
      showModalMsg('serviceModalMsg', 'error', 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-save"></i> <span id="serviceModalSaveLabel">${editingServiceId?'Update Service':'Save Service'}</span>`;
    }
  });

  //  DELETE SERVICE 
  function openDelete(id, name) {
    deletingServiceId = id;
    document.getElementById('deleteModalMsg').textContent =
      `Are you sure you want to delete "${name}"? This cannot be undone.`;
    openOverlay('deleteModal');
  }

  document.getElementById('deleteModalCancel').addEventListener('click', () => closeOverlay('deleteModal'));
  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target.id === 'deleteModal') closeOverlay('deleteModal');
  });

  document.getElementById('deleteModalConfirm').addEventListener('click', async () => {
    if (!deletingServiceId) return;
    const btn = document.getElementById('deleteModalConfirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    try {
      const res  = await fetch(`/api/admin/services/${deletingServiceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { closeOverlay('deleteModal'); loadServices(); }
      else alert('Failed to delete: ' + (data.message || 'Unknown error'));
    } catch (err) {
      alert('Network error. Try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    }
  });

  //  VARIANTS MODAL 
  async function openVariants(serviceId, serviceName) {
    variantsServiceId = serviceId;
    document.getElementById('variantsModalServiceName').textContent = serviceName;
    document.getElementById('v_name').value     = '';
    document.getElementById('v_price').value    = '';
    document.getElementById('v_duration').value = '';
    hideModalMsg('variantsModalMsg');
    openOverlay('variantsModal');
    await loadVariants();
  }

  async function loadVariants() {
    const list = document.getElementById('variantsList');
    list.innerHTML = `<div class="empty-state" style="padding:12px 0"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>`;
    try {
      const res  = await fetch(`/api/admin/services/${variantsServiceId}/variants`);
      const data = await res.json();
      if (!data.success || !data.data.length) {
        list.innerHTML = `<div class="empty-state" style="padding:12px 0">
          <i class="fas fa-tags" style="font-size:20px;opacity:.3"></i>
          <p>No variants yet. Add one below.</p>
        </div>`;
        return;
      }
      list.innerHTML = data.data.map(v => `
        <div class="variant-modal-item">
          <div>
            <span class="v-name">${v.name}</span>
            ${v.duration_hours ? `<span class="v-dur" style="margin-left:8px;">~${v.duration_hours}h</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="v-price">${formatCurrency(v.price)}</span>
            <button class="v-del" onclick="deleteVariant('${v.id}','${escHtml(v.name)}')" title="Remove">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>`).join('');
    } catch (err) {
      list.innerHTML = `<div class="empty-state" style="padding:12px 0">
        <i class="fas fa-exclamation-triangle" style="font-size:20px;"></i><p>Failed to load</p>
      </div>`;
    }
  }

  document.getElementById('addVariantBtn').addEventListener('click', async () => {
    const name     = document.getElementById('v_name').value.trim();
    const price    = document.getElementById('v_price').value.trim();
    const duration = document.getElementById('v_duration').value.trim();

    if (!name || !price) {
      showModalMsg('variantsModalMsg', 'error', 'Variant name and price are required.');
      return;
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      showModalMsg('variantsModalMsg', 'error', 'Enter a valid price.');
      return;
    }

    const btn = document.getElementById('addVariantBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      const res  = await fetch(`/api/admin/services/${variantsServiceId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: parseFloat(price), duration_hours: duration||null }),
      });
      const data = await res.json();
      if (data.success) {
        showModalMsg('variantsModalMsg', 'success', `Variant "${name}" added!`);
        document.getElementById('v_name').value     = '';
        document.getElementById('v_price').value    = '';
        document.getElementById('v_duration').value = '';
        await loadVariants();
        loadServices();
      } else {
        showModalMsg('variantsModalMsg', 'error', data.message || 'Failed to add variant.');
      }
    } catch (err) {
      showModalMsg('variantsModalMsg', 'error', 'Network error. Try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-plus"></i>';
    }
  });

  async function deleteVariant(variantId, variantName) {
    if (!confirm(`Remove variant "${variantName}"?`)) return;
    try {
      const res  = await fetch(`/api/admin/services/${variantsServiceId}/variants/${variantId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { await loadVariants(); loadServices(); }
      else alert('Failed: ' + data.message);
    } catch (err) {
      alert('Network error. Try again.');
    }
  }

  ['variantsModalClose','variantsModalClose2'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => { closeOverlay('variantsModal'); loadServices(); });
  });
  document.getElementById('variantsModal').addEventListener('click', e => {
    if (e.target.id === 'variantsModal') { closeOverlay('variantsModal'); loadServices(); }
  });

  // Enter to add variant quickly
  ['v_name','v_price','v_duration'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('addVariantBtn').click();
    });
  });

  //  Init 
  loadServices();