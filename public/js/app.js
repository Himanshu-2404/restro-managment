(() => {
  const app = document.querySelector('#app');
  const state = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    screen: 'pos',
    authMode: 'login',
    timer: null,
    cart: [],
    menuCategory: 'all',
    selectedTableId: null,
    posStarted: false,
    posOrderType: 'pickup',
    posCheckout: false,
    posCustomer: { name: '', phone: '', address: '', customerId: null },
    posDiscount: 0,
    posRoundOff: 0,
    posPaymentMethod: 'cash',
    customerLookupRequest: 0,
    requestId: 0
  };
  const managerRoles = ['Admin', 'Manager'];
  const navItems = [
    { id: 'pos', label: 'Point of sale', icon: '▦' },
    { id: 'kot', label: 'Kitchen orders', icon: '♨' },
    { id: 'history', label: 'Order history', icon: '◷' },
    { id: 'menu', label: 'Menu management', icon: '☷', managersOnly: true },
    { id: 'tables', label: 'Tables', icon: '▤', managersOnly: true },
    { id: 'staff', label: 'Team', icon: '♙', managersOnly: true },
    { id: 'settings', label: 'Settings', icon: '⚙', managersOnly: true }
  ];
  const masterFields = {
    departments: [{ name: 'name', label: 'Department name', type: 'text', required: true }],
    job_types: [{ name: 'name', label: 'Job type', type: 'text', required: true }],
    roles: [{ name: 'name', label: 'Role name', type: 'text', required: true }],
    categories: [
      { name: 'name', label: 'Category name', type: 'text', required: true },
      { name: 'parent_id', label: 'Parent category', type: 'reference', table: 'categories', optional: true }
    ],
    table_places: [{ name: 'name', label: 'Area name', type: 'text', required: true }],
    tables: [
      { name: 'name', label: 'Table name', type: 'text', required: true },
      { name: 'place_id', label: 'Dining area', type: 'reference', table: 'table_places', optional: true },
      { name: 'capacity', label: 'Seats', type: 'number', value: 4, required: true },
      { name: 'status', label: 'Status', type: 'select', options: [['free', 'Free'], ['occupied', 'Occupied']] }
    ],
    items: [
      { name: 'name', label: 'Item name', type: 'text', required: true },
      { name: 'category_id', label: 'Category', type: 'reference', table: 'categories', required: true },
      { name: 'base_price', label: 'Price', type: 'number', min: 0, step: '0.01', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'image_url', label: 'Picture URL or local path', type: 'text', placeholder: 'https://... or /images/menu/photo.jpg' },
      { name: 'is_veg', label: 'Food type', type: 'select', options: [['1', 'Vegetarian'], ['0', 'Non-vegetarian']] },
      { name: 'available', label: 'Availability', type: 'select', options: [['1', 'Available'], ['0', 'Unavailable']] }
    ],
    item_variations: [
      { name: 'item_id', label: 'Menu item', type: 'reference', table: 'items', required: true },
      { name: 'name', label: 'Variation name', type: 'text', required: true },
      { name: 'price', label: 'Price', type: 'number', min: 0, step: '0.01', required: true }
    ],
    item_addons: [
      { name: 'item_id', label: 'Menu item', type: 'reference', table: 'items', required: true },
      { name: 'name', label: 'Add-on name', type: 'text', required: true },
      { name: 'price', label: 'Price', type: 'number', min: 0, step: '0.01', required: true }
    ],
    employees: [
      { name: 'name', label: 'Employee name', type: 'text', required: true },
      { name: 'email', label: 'Email address', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'role_id', label: 'Role', type: 'reference', table: 'roles', optional: true },
      { name: 'department_id', label: 'Department', type: 'reference', table: 'departments', optional: true },
      { name: 'job_type_id', label: 'Job type', type: 'reference', table: 'job_types', optional: true },
      { name: 'designation', label: 'Designation', type: 'text' },
      { name: 'active', label: 'Account status', type: 'select', options: [['1', 'Active'], ['0', 'Inactive']] }
    ]
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const money = value => `₹${Number(value || 0).toFixed(2)}`;
  const titleCase = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

  async function api(path, method = 'GET', body) {
    const response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && state.token) {
      signOut();
      throw new Error(data.error || 'Your session has expired. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }

  function signOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    state.token = null;
    state.user = null;
    clearInterval(state.timer);
    state.timer = null;
    renderAuth();
  }

  function renderAuth(message = '') {
    clearInterval(state.timer);
    state.timer = null;
    const signup = state.authMode === 'signup';
    app.innerHTML = `
      <main class="auth-layout">
        <section class="auth-story">
          <div class="brand brand-light"><span class="brand-mark">F</span><span>Fork &amp; Flame</span></div>
          <div class="story-copy">
            <span class="eyebrow">RESTAURANT OPERATIONS, SIMPLIFIED</span>
            <h1>A better service starts with a smoother shift.</h1>
            <p>Bring orders, the kitchen, and your team together in one calm, clear workspace.</p>
          </div>
          <div class="story-foot"><span class="story-dot"></span> Your restaurant, running in sync</div>
          <div class="auth-decoration decoration-one"></div><div class="auth-decoration decoration-two"></div>
        </section>
        <section class="auth-panel">
          <form class="auth-card" id="auth-form">
            <span class="eyebrow">${signup ? 'GET STARTED' : 'WELCOME BACK'}</span>
            <h2>${signup ? 'Create your account' : 'Sign in to your workspace'}</h2>
            <p class="muted">${signup ? 'Set up your team’s restaurant workspace.' : 'Enter your details to continue to the POS.'}</p>
            ${signup ? `<label class="field-label">Full name<input name="name" autocomplete="name" required placeholder="e.g. Aanya Mehta"></label>` : ''}
            <label class="field-label">Email address<input name="email" type="email" autocomplete="email" required placeholder="you@restaurant.com"></label>
            <label class="field-label">Password<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required placeholder="Enter your password"></label>
            ${message ? `<p class="form-message ${message.kind || 'error'}" role="status">${escapeHtml(message.text || message)}</p>` : ''}
            <button class="button button-primary button-wide" type="submit">${signup ? 'Create account' : 'Sign in'} <span>→</span></button>
            <p class="auth-switch">${signup ? 'Already have an account?' : 'New to Fork & Flame?'}
              <button class="text-button" type="button" id="auth-switch">${signup ? 'Sign in' : 'Create an account'}</button>
            </p>
            <p class="auth-note">The first account created becomes the restaurant Admin.</p>
          </form>
        </section>
      </main>`;
    $('#auth-switch').addEventListener('click', () => {
      state.authMode = signup ? 'login' : 'signup';
      renderAuth();
    });
    $('#auth-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const button = $('button[type="submit"]', event.currentTarget);
      button.disabled = true;
      button.innerHTML = 'Please wait…';
      try {
        const result = await api(`/auth/${signup ? 'signup' : 'login'}`, 'POST', {
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password')
        });
        if (signup) {
          state.authMode = 'login';
          renderAuth({ kind: 'success', text: 'Account created. Sign in with your new credentials.' });
          return;
        }
        state.token = result.token;
        state.user = result.user;
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        state.screen = 'pos';
        render();
      } catch (error) {
        renderAuth({ kind: 'error', text: error.message });
      }
    });
  }

  function render() {
    if (!state.token || !state.user) {
      renderAuth();
      return;
    }
    clearInterval(state.timer);
    state.timer = null;
    const visibleNav = navItems.filter(item => !item.managersOnly || managerRoles.includes(state.user.role));
    app.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand" href="#" aria-label="Fork & Flame home"><span class="brand-mark">F</span><span>Fork <i>&amp;</i> Flame</span></a>
          <div class="restaurant-label"><span class="live-indicator"></span> RESTAURANT WORKSPACE</div>
          <nav class="side-nav" aria-label="Main navigation">
            ${visibleNav.map(item => `<button class="nav-link ${item.id === state.screen ? 'active' : ''}" data-screen="${item.id}"><span class="nav-icon">${item.icon}</span>${item.label}${item.id === 'pos' ? '<span class="nav-arrow">›</span>' : ''}</button>`).join('')}
          </nav>
          <div class="sidebar-bottom">
            <div class="help-card"><span class="help-icon">✦</span><b>Need a hand?</b><small>Your shift tools are right here.</small></div>
            <button class="profile-button" id="profile-button"><span class="avatar">${escapeHtml((state.user.name || 'U').charAt(0).toUpperCase())}</span><span class="profile-copy"><b>${escapeHtml(state.user.name)}</b><small>${escapeHtml(state.user.role)}</small></span><span class="profile-more">···</span></button>
          </div>
        </aside>
        <main class="main-panel">
          <header class="topbar">
            <div class="breadcrumb"><span>Workspace</span><span class="crumb-divider">/</span><b>${escapeHtml(navItems.find(item => item.id === state.screen)?.label || 'Point of sale')}</b></div>
            <div class="topbar-actions"><span class="today-label" id="today-label"></span><span class="topbar-divider"></span><button class="icon-button" aria-label="Notifications">♧<i></i></button><button class="mobile-menu" id="mobile-menu" aria-label="Open navigation">☰</button></div>
          </header>
          <section class="page-content" id="screen-content"><div class="loading-state"><span class="loader"></span>Loading your workspace…</div></section>
        </main>
      </div>`;
    $('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
    document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => {
      state.screen = button.dataset.screen;
      state.menuCategory = 'all';
      if (state.screen !== 'pos') state.cart = [];
      else if (button.dataset.screen === 'pos') {
        state.selectedTableId = null;
        state.posStarted = false;
        state.posOrderType = 'pickup';
        state.posCheckout = false;
        state.posCustomer = { name: '', phone: '', address: '', customerId: null };
        state.posDiscount = 0;
        state.posRoundOff = 0;
      }
      render();
    }));
    $('#profile-button').addEventListener('click', signOut);
    $('#mobile-menu').addEventListener('click', () => $('.sidebar').classList.toggle('sidebar-open'));
    loadScreen();
  }

  async function loadScreen() {
    const requestId = ++state.requestId;
    const target = $('#screen-content');
    try {
      const renderer = screens[state.screen] || screens.pos;
      await renderer(target);
      if (requestId !== state.requestId) return;
    } catch (error) {
      if (requestId !== state.requestId) return;
      target.innerHTML = `<div class="empty-state error-state"><span class="empty-icon">!</span><h2>We couldn’t load this screen</h2><p>${escapeHtml(error.message)}</p><button class="button button-secondary" id="retry-screen">Try again</button></div>`;
      $('#retry-screen', target).addEventListener('click', loadScreen);
    }
  }

  function pageHeading(kicker, title, description, action = '') {
    return `<div class="page-heading"><div><span class="eyebrow">${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action}</div>`;
  }

  const screens = {
    async pos(target) {
      const [tables, places] = await Promise.all([
        api('/master/tables'), api('/master/table_places')
      ]);
      let selectedTable = tables.find(table => String(table.id) === String(state.selectedTableId));
      if (state.selectedTableId && !selectedTable) {
        state.selectedTableId = null;
        state.posStarted = false;
      }
      if (!state.posStarted) {
        const groups = places.map(place => ({
          ...place,
          tables: tables.filter(table => String(table.place_id) === String(place.id))
        })).filter(place => place.tables.length);
        const unassignedTables = tables.filter(table => !table.place_id);
        if (unassignedTables.length) groups.push({ id: 'unassigned', name: 'Other tables', tables: unassignedTables });
        target.innerHTML = `
          ${pageHeading('POINT OF SALE', 'Choose a table', 'Select a table by dining area to start a new order.')}
          <div class="table-picker">
            <div class="table-picker-legend"><span><i class="table-status-dot available"></i>Available</span><span><i class="table-status-dot occupied"></i>Occupied</span></div>
            ${groups.length ? groups.map(place => `
              <section class="table-area" aria-labelledby="table-area-${escapeHtml(place.id)}">
                <div class="table-area-heading"><div><h2 id="table-area-${escapeHtml(place.id)}">${escapeHtml(place.name)}</h2><p>${place.tables.length} ${place.tables.length === 1 ? 'table' : 'tables'}</p></div></div>
                <div class="table-choice-grid">${place.tables.map(table => `
                  <button class="table-choice" type="button" data-table="${escapeHtml(table.id)}" aria-label="Select ${escapeHtml(table.name)}, ${escapeHtml(titleCase(table.status))}, ${escapeHtml(table.capacity)} seats">
                    <span class="table-choice-icon">▤</span>
                    <span class="table-choice-copy"><b>${escapeHtml(table.name)}</b><small>${escapeHtml(table.capacity)} seats</small></span>
                    <span class="table-choice-status ${table.status === 'occupied' ? 'occupied' : 'available'}"><i class="table-status-dot ${table.status === 'occupied' ? 'occupied' : 'available'}"></i>${table.status === 'occupied' ? 'Occupied' : 'Available'}</span>
                  </button>`).join('')}</div>
              </section>`).join('') : '<div class="empty-state"><span class="empty-icon">▤</span><h2>No tables set up yet</h2><p>You can still start a pickup or delivery order.</p></div>'}
            <div class="table-picker-footer"><span class="muted">Taking a pickup or delivery order?</span><button class="button button-secondary" id="continue-without-table" type="button">Continue without a table <span>→</span></button></div>
          </div>`;
        target.querySelectorAll('[data-table]').forEach(button => button.addEventListener('click', () => {
          state.selectedTableId = button.dataset.table;
          state.posOrderType = 'dine_in';
          state.posStarted = true;
          state.cart = [];
          state.posCheckout = false;
          state.posCustomer = { name: '', phone: '', address: '', customerId: null };
          state.posDiscount = 0;
          state.posRoundOff = 0;
          render();
        }));
        $('#continue-without-table', target).addEventListener('click', () => {
          state.selectedTableId = null;
          state.posOrderType = 'pickup';
          state.posStarted = true;
        state.posCheckout = false;
        state.posCustomer = { name: '', phone: '', address: '', customerId: null };
        state.posDiscount = 0;
        state.posRoundOff = 0;
        render();
        });
        return;
      }
      const [menu, categories, settings, activeOrders] = await Promise.all([
        api('/menu'), api('/master/categories'), api('/settings'),
        selectedTable ? api('/orders?live=1') : Promise.resolve([])
      ]);
      const existingOrder = activeOrders.find(order => String(order.table_id) === String(selectedTable?.id));
      const taxPercent = Number(settings.tax_percent || 0);
      let orderType = selectedTable ? 'dine_in' : state.posOrderType;
      const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
      const tax = +(subtotal * taxPercent / 100).toFixed(2);
      const preDiscountTotal = subtotal + tax;
      const checkoutTotal = preDiscountTotal - Number(state.posDiscount || 0) + Number(state.posRoundOff || 0);
      target.innerHTML = state.posCheckout ? `
        ${pageHeading('POINT OF SALE', 'Checkout', 'Confirm the customer and payment details.') }
        <section class="checkout-screen">
          <div class="checkout-customer"><span class="eyebrow">CUSTOMER</span><b>${escapeHtml(state.posCustomer.name)}</b><span>${escapeHtml(state.posCustomer.phone)}</span>${selectedTable ? `<small>${escapeHtml(selectedTable.name)}</small>` : ''}</div>
          <div class="checkout-total"><span>Total amount</span><b id="checkout-total">${money(checkoutTotal)}</b></div>
          <div class="checkout-adjustments">
            <label class="field-label">Discount<input id="checkout-discount" type="number" min="0" max="${preDiscountTotal.toFixed(2)}" step="0.01" value="${escapeHtml(state.posDiscount)}"></label>
            <label class="field-label">Round off<input id="checkout-round-off" type="number" step="0.01" value="${escapeHtml(state.posRoundOff)}"></label>
          </div>
          <label class="field-label checkout-payment">Payment method<select id="checkout-payment-method"><option value="cash" ${state.posPaymentMethod === 'cash' ? 'selected' : ''}>Cash</option><option value="card" ${state.posPaymentMethod === 'card' ? 'selected' : ''}>Card</option><option value="upi" ${state.posPaymentMethod === 'upi' ? 'selected' : ''}>UPI</option></select></label>
          <p class="checkout-error" id="checkout-error" role="alert" hidden></p>
          <div class="checkout-actions"><button class="button button-secondary" id="back-to-order" type="button">Back to order</button><button class="button button-primary" id="checkout-confirm" type="button">Checkout &amp; print bill</button></div>
        </section>` : `
        ${pageHeading('ORDER DESK', 'Point of sale', 'Build an order and send it straight to the kitchen.')}
        <div class="pos-layout">
          <section class="menu-panel">
            <div class="menu-toolbar"><div><h2>Our menu</h2><p>Choose items to add to this order</p></div><label class="search-box"><span>⌕</span><input id="menu-search" placeholder="Search dishes…" aria-label="Search menu"></label></div>
            <div class="category-list" id="category-list"></div>
            <div class="product-grid" id="product-grid"></div>
          </section>
          <aside class="order-panel">
            <div class="order-panel-heading"><div><span class="eyebrow">${existingOrder ? 'ACTIVE ORDER' : 'CURRENT ORDER'}</span><h2>${existingOrder ? `Order #${escapeHtml(existingOrder.id)}` : 'New order'}</h2></div><button class="subtle-button" id="clear-cart" ${existingOrder ? 'hidden' : ''}>Clear</button></div>
            ${existingOrder ? '<p class="muted">This table has an active order. Its items are shown read-only.</p>' : ''}
            <div class="order-type-list">
              <button class="order-type ${orderType === 'dine_in' ? 'selected' : ''}" data-type="dine_in" ${existingOrder ? 'disabled' : ''}><span>♧</span>Dine in</button>
              <button class="order-type ${orderType === 'pickup' ? 'selected' : ''}" data-type="pickup" ${existingOrder ? 'disabled' : ''}><span>↗</span>Pickup</button>
              <button class="order-type ${orderType === 'delivery' ? 'selected' : ''}" data-type="delivery" ${existingOrder ? 'disabled' : ''}><span>⌖</span>Delivery</button>
            </div>
            <div class="order-details" id="order-details"></div>
            <div class="cart-heading"><b>Items</b><span id="cart-count">0 items</span></div>
            <div class="cart-list" id="cart-list"></div>
            <div class="order-summary" id="order-summary"></div>
            ${existingOrder ? '' : '<label class="field-label payment-label">Payment method<select id="payment-method"><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option></select></label>'}
            <div class="order-actions"><button class="button button-secondary" id="send-kitchen" ${existingOrder ? 'disabled' : ''}>Save &amp; KOT</button><button class="button button-primary" id="pay-order" ${existingOrder ? 'disabled' : ''}>Pay &amp; print bill <span>→</span></button></div>
          </aside>
        </div>`;
      if (state.posCheckout) {
        const updateCheckoutTotal = () => {
          const discount = Number($('#checkout-discount', target).value || 0);
          const roundOff = Number($('#checkout-round-off', target).value || 0);
          const total = preDiscountTotal - discount + roundOff;
          const invalid = !Number.isFinite(discount) || discount < 0 || discount > preDiscountTotal ||
            !Number.isFinite(roundOff) || total < 0;
          state.posDiscount = discount;
          state.posRoundOff = roundOff;
          $('#checkout-total', target).textContent = money(Math.max(0, total));
          $('#checkout-error', target).hidden = !invalid;
          $('#checkout-error', target).textContent = invalid
            ? discount > preDiscountTotal ? 'Discount cannot exceed the order total.' : 'Enter a valid adjustment; the final amount cannot be negative.'
            : '';
          $('#checkout-confirm', target).disabled = invalid;
        };
        $('#checkout-discount', target).addEventListener('input', updateCheckoutTotal);
        $('#checkout-round-off', target).addEventListener('input', updateCheckoutTotal);
        $('#checkout-payment-method', target).addEventListener('change', event => {
          state.posPaymentMethod = event.currentTarget.value;
        });
        $('#back-to-order', target).addEventListener('click', () => {
          state.posCheckout = false;
          render();
        });
        $('#checkout-confirm', target).addEventListener('click', () => placeOrder(true));
        updateCheckoutTotal();
        return;
      }

      const csvCategoryOrder = ['Starter', 'Starters', 'Meal', 'Fast Food', 'Drinks', 'Dessert'];
      const orderedCategories = [...categories].sort((a, b) => {
        const aIndex = csvCategoryOrder.indexOf(a.name);
        const bIndex = csvCategoryOrder.indexOf(b.name);
        if (aIndex < 0 && bIndex < 0) return a.name.localeCompare(b.name);
        if (aIndex < 0) return 1;
        if (bIndex < 0) return -1;
        return aIndex - bIndex;
      });
      const categoriesList = [{ id: 'all', name: 'All items' }, ...orderedCategories];
      const categoryOrder = new Map(orderedCategories.map((category, index) => [String(category.id), index]));
      const orderedMenu = [...menu].sort((a, b) =>
        (categoryOrder.get(String(a.category_id)) ?? Number.MAX_SAFE_INTEGER) -
          (categoryOrder.get(String(b.category_id)) ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name)
      );
      const drawMenu = () => {
        const search = ($('#menu-search', target).value || '').toLowerCase().trim();
        $('#category-list', target).innerHTML = categoriesList.map(category => `<button class="category-chip ${String(category.id) === String(state.menuCategory) ? 'active' : ''}" data-category="${escapeHtml(category.id)}">${escapeHtml(category.name)}</button>`).join('');
        const filtered = orderedMenu.filter(item => (state.menuCategory === 'all' || String(item.category_id) === String(state.menuCategory)) && `${item.name} ${item.description || ''}`.toLowerCase().includes(search));
        $('#product-grid', target).innerHTML = filtered.length ? filtered.map((item, index) => `
          <button class="product-card" data-item="${escapeHtml(item.id)}">
            <span class="product-art art-${index % 5}">${item.image_url && (/^https?:\/\//i.test(item.image_url) || item.image_url.startsWith('/')) ? `<img class="product-photo" data-image-fallback data-veg="${item.is_veg ? '1' : '0'}" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy">` : `<span class="product-placeholder">${item.is_veg ? '🥬' : '🍗'}</span>`}</span>
            <span class="diet-dot ${item.is_veg ? 'veg' : 'nonveg'}"></span>
            <b>${escapeHtml(item.name)}</b><small class="product-description">${escapeHtml(item.description || categories.find(category => category.id === item.category_id)?.name || 'Kitchen favorite')}</small>
            <span class="product-price">${money(item.base_price)} <i>+</i></span>
          </button>`).join('') : '<div class="empty-menu"><span>⌕</span><b>No dishes found</b><small>Try another search or category.</small></div>';
        target.querySelectorAll('[data-image-fallback]').forEach(image => image.addEventListener('error', () => {
          const placeholder = document.createElement('span');
          placeholder.className = 'product-placeholder';
          placeholder.textContent = image.dataset.veg === '1' ? '🥬' : '🍗';
          image.replaceWith(placeholder);
        }, { once: true }));
        document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
          state.menuCategory = button.dataset.category;
          drawMenu();
        }));
        document.querySelectorAll('[data-item]').forEach(button => button.addEventListener('click', () => {
          const item = menu.find(entry => String(entry.id) === button.dataset.item);
          addToCart(item);
        }));
      };
      const drawCart = () => {
        const list = $('#cart-list', target);
        const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        const tax = subtotal * taxPercent / 100;
        const items = existingOrder?.items || state.cart;
        $('#cart-count', target).textContent = `${items.reduce((sum, item) => sum + Number(item.qty), 0)} items`;
        list.innerHTML = existingOrder
          ? existingOrder.items.map(item => `
          <div class="cart-item"><span class="cart-item-art">•</span><div class="cart-item-info"><b>${escapeHtml(item.item_name)}</b><small>${money(item.price)} each${item.variation ? ` · ${escapeHtml(item.variation)}` : ''}${item.addons ? ` · + ${escapeHtml(item.addons)}` : ''}</small><div class="quantity-control"><span>${escapeHtml(item.qty)}×</span></div></div><div class="cart-item-end"><b>${money(Number(item.price) * Number(item.qty))}</b></div></div>`).join('')
          : state.cart.length ? state.cart.map((item, index) => `
          <div class="cart-item"><span class="cart-item-art">${item.veg ? '🥬' : '🍗'}</span><div class="cart-item-info"><b>${escapeHtml(item.name)}</b><small>${money(item.price)} each</small><div class="quantity-control"><button data-qty="${index}" data-change="-1" aria-label="Decrease quantity">−</button><span>${item.qty}</span><button data-qty="${index}" data-change="1" aria-label="Increase quantity">+</button></div></div><div class="cart-item-end"><b>${money(item.price * item.qty)}</b><button class="remove-item" data-remove="${index}" aria-label="Remove item">×</button></div></div>`).join('') : '<div class="cart-empty"><span>＋</span><b>Your order is empty</b><small>Add a dish from the menu to get started.</small></div>';
        $('#order-summary', target).innerHTML = existingOrder
          ? `<div><span>Subtotal</span><b>${money(existingOrder.subtotal)}</b></div><div><span>Tax</span><b>${money(existingOrder.tax)}</b></div><div class="total-row"><span>Total</span><b>${money(existingOrder.total)}</b></div>`
          : `<div><span>Subtotal</span><b>${money(subtotal)}</b></div><div><span>Tax (${taxPercent}%)</span><b>${money(tax)}</b></div><div class="total-row"><span>Total</span><b>${money(subtotal + tax)}</b></div>`;
        document.querySelectorAll('[data-qty]').forEach(button => button.addEventListener('click', () => {
          const item = state.cart[Number(button.dataset.qty)];
          item.qty = Math.max(0, item.qty + Number(button.dataset.change));
          if (!item.qty) state.cart.splice(Number(button.dataset.qty), 1);
          drawCart();
        }));
        document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
          state.cart.splice(Number(button.dataset.remove), 1);
          drawCart();
        }));
      };
      document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
        orderType = button.dataset.type;
        state.posOrderType = orderType;
        document.querySelectorAll('[data-type]').forEach(typeButton => typeButton.classList.toggle('selected', typeButton === button));
        drawOrderDetails();
      }));
      function drawOrderDetails() {
        const tableDetails = orderType === 'dine_in'
          ? selectedTable
            ? existingOrder
              ? `<div class="selected-table"><span class="table-choice-icon">▤</span><span><small>DINING TABLE</small><b>${escapeHtml(selectedTable.name)}</b></span></div>`
              : `<div class="selected-table"><span class="table-choice-icon">▤</span><span><small>DINING TABLE</small><b>${escapeHtml(selectedTable.name)}</b></span><button class="subtle-button" id="choose-table" type="button">Change</button></div>`
            : `<button class="button button-secondary choose-table-button" id="choose-table" type="button">Choose a table <span>→</span></button>`
          : '';
        $('#order-details', target).innerHTML = `${tableDetails}${existingOrder
          ? `<div class="customer-fields"><label class="field-label">Customer name<input value="${escapeHtml(existingOrder.customer_name || '')}" disabled></label><label class="field-label">Mobile number<input value="${escapeHtml(existingOrder.customer_phone || '')}" disabled></label></div>`
          : `<div class="customer-fields"><label class="field-label">Customer name<input id="customer-name" name="customer-name" placeholder="Customer name" autocomplete="name" value="${escapeHtml(state.posCustomer.name)}" required></label><label class="field-label">Mobile number<input id="customer-phone" name="customer-phone" placeholder="Mobile number" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" value="${escapeHtml(state.posCustomer.phone)}" required aria-describedby="customer-match-status"></label><small class="customer-match-status" id="customer-match-status" aria-live="polite"></small>${orderType === 'delivery' ? `<label class="field-label">Delivery address<input id="customer-address" placeholder="Street, area, city" autocomplete="street-address" value="${escapeHtml(state.posCustomer.address)}"></label>` : ''}</div>`}`;
        if (!existingOrder) {
          $('#customer-name', target).addEventListener('input', event => {
            state.posCustomer.name = event.currentTarget.value;
          });
          $('#customer-phone', target).addEventListener('input', event => {
            const phone = event.currentTarget.value;
            state.customerLookupRequest += 1;
            if (state.posCustomer.phone !== phone && state.posCustomer.customerId) {
              state.posCustomer.name = '';
              state.posCustomer.address = '';
              state.posCustomer.customerId = null;
              $('#customer-name', target).value = '';
              $('#customer-match-status', target).textContent = '';
            }
            state.posCustomer.phone = phone;
          });
          $('#customer-address', target)?.addEventListener('input', event => {
            state.posCustomer.address = event.currentTarget.value;
          });
          $('#customer-phone', target).addEventListener('blur', () => {
            lookupCustomer(false);
          });
        }
        $('#choose-table', target)?.addEventListener('click', () => {
          state.selectedTableId = null;
          state.posOrderType = 'dine_in';
          state.posStarted = false;
          state.cart = [];
          state.posCheckout = false;
          state.posCustomer = { name: '', phone: '', address: '', customerId: null };
          state.posDiscount = 0;
          state.posRoundOff = 0;
          render();
        });
      }
      drawOrderDetails();
      $('#menu-search', target).addEventListener('input', drawMenu);
      $('#clear-cart', target).addEventListener('click', () => {
        state.cart = [];
        state.posDiscount = 0;
        state.posRoundOff = 0;
        drawCart();
      });
      $('#send-kitchen', target).addEventListener('click', () => placeOrder(false));
      $('#pay-order', target).addEventListener('click', () => placeOrder(true));
      drawMenu();
      drawCart();

      function addToCart(item) {
        if (existingOrder) {
          showNotice('This table’s active order is read-only in POS.', 'error');
          return;
        }
        if (item.variations.length || item.addons.length) {
          openItemOptions(item);
          return;
        }
        commitItem(item, null, []);
      }

      function commitItem(item, variation, addons) {
        const price = Number(variation ? variation.price : item.base_price) + addons.reduce((sum, addon) => sum + Number(addon.price), 0);
        state.cart.push({
          item_id: item.id, name: `${item.name}${variation ? ` · ${variation.name}` : ''}`,
          variation_id: variation?.id, addon_ids: addons.map(addon => addon.id),
          price, qty: 1, veg: Boolean(item.is_veg)
        });
        drawCart();
      }

      function openItemOptions(item) {
        document.querySelector('#item-options-dialog')?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'item-options-dialog';
        dialog.className = 'options-dialog';
        const initialVariation = item.variations[0];
        const basePrice = Number(initialVariation ? initialVariation.price : item.base_price);
        dialog.innerHTML = `
          <form class="options-form" id="item-options-form">
            <div class="options-header">
              <span class="options-art">${item.is_veg ? '🥬' : '🍗'}</span>
              <div class="options-title"><span class="eyebrow">CUSTOMIZE YOUR ORDER</span><h2>${escapeHtml(item.name)}</h2><p>Choose your preferences before adding this dish.</p></div>
              <button class="options-close" type="button" aria-label="Close item options">×</button>
            </div>
            ${item.variations.length ? `<fieldset class="option-group"><legend>Choose a size <span>Required</span></legend><div class="option-choices">${item.variations.map((variation, index) => `<label class="option-choice"><input type="radio" name="variation" value="${escapeHtml(variation.id)}" ${index === 0 ? 'checked' : ''}><span class="choice-radio"></span><span class="choice-name">${escapeHtml(variation.name)}</span><b>${money(variation.price)}</b></label>`).join('')}</div></fieldset>` : ''}
            ${item.addons.length ? `<fieldset class="option-group addon-group"><legend>Add-ons <small>Optional</small></legend><div class="option-choices">${item.addons.map(addon => `<label class="option-choice addon-choice"><input type="checkbox" name="addon" value="${escapeHtml(addon.id)}"><span class="choice-check">✓</span><span class="choice-name">${escapeHtml(addon.name)}</span><b>+${money(addon.price)}</b></label>`).join('')}</div></fieldset>` : ''}
            <div class="options-footer"><button class="button button-secondary" type="button" id="cancel-options">Cancel</button><button class="button button-primary" type="submit">Add to order <span id="options-total">${money(basePrice)}</span></button></div>
          </form>`;
        document.body.appendChild(dialog);

        const updateTotal = () => {
          const variationId = $('input[name="variation"]:checked', dialog)?.value;
          const variation = item.variations.find(entry => String(entry.id) === variationId);
          const selectedAddonIds = new Set(Array.from(dialog.querySelectorAll('input[name="addon"]:checked'), input => input.value));
          const addons = item.addons.filter(addon => selectedAddonIds.has(String(addon.id)));
          const total = Number(variation ? variation.price : item.base_price) + addons.reduce((sum, addon) => sum + Number(addon.price), 0);
          $('#options-total', dialog).textContent = money(total);
        };
        dialog.querySelectorAll('input').forEach(input => input.addEventListener('change', updateTotal));
        const close = () => dialog.close();
        $('.options-close', dialog).addEventListener('click', close);
        $('#cancel-options', dialog).addEventListener('click', close);
        dialog.addEventListener('click', event => {
          if (event.target === dialog) close();
        });
        $('#item-options-form', dialog).addEventListener('submit', event => {
          event.preventDefault();
          const variationId = $('input[name="variation"]:checked', dialog)?.value;
          const variation = item.variations.find(entry => String(entry.id) === variationId) || null;
          const selectedAddonIds = new Set(Array.from(dialog.querySelectorAll('input[name="addon"]:checked'), input => input.value));
          const addons = item.addons.filter(addon => selectedAddonIds.has(String(addon.id)));
          dialog.close();
          dialog.remove();
          commitItem(item, variation, addons);
        });
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        dialog.showModal();
      }

      async function placeOrder(payNow) {
        if (!state.cart.length) {
          showNotice('Add at least one menu item before placing this order.', 'error');
          return;
        }
        if (orderType === 'dine_in' && !selectedTable) {
          showNotice('Choose a table before placing a dine-in order.', 'error');
          return;
        }
        if (payNow && !state.posCheckout) {
          const customer = await lookupCustomer(true);
          if (!customer) return;
          state.posCheckout = true;
          render();
          return;
        }
        const customer = state.posCheckout
          ? { ...state.posCustomer }
          : await lookupCustomer(true);
        if (!customer) return;
        if (!customer.name.trim()) {
          showNotice('Enter the customer name to continue.', 'error');
          return;
        }
        try {
          const order = await api('/orders', 'POST', {
            order_type: orderType,
            table_id: orderType === 'dine_in' ? selectedTable.id : null,
            customer,
            discount: payNow ? state.posDiscount : 0,
            round_off: payNow ? state.posRoundOff : 0,
            items: state.cart.map(({ item_id, variation_id, addon_ids, qty }) => ({ item_id, variation_id, addon_ids, qty }))
          });
          if (payNow) {
            await api(`/orders/${order.id}/pay`, 'POST', { method: state.posPaymentMethod });
            state.cart = [];
            state.posCheckout = false;
            state.posCustomer = { name: '', phone: '', address: '', customerId: null };
            state.posDiscount = 0;
            state.posRoundOff = 0;
            await printBill(order.id);
            showNotice('Payment complete. The bill is ready to print.', 'success');
          } else {
            state.cart = [];
            state.posCustomer = { name: '', phone: '', address: '', customerId: null };
            state.posDiscount = 0;
            state.posRoundOff = 0;
            render();
            showNotice('Order saved and sent to KOT.', 'success');
          }
        } catch (error) {
          showNotice(error.message, 'error');
        }
      }

      async function lookupCustomer(showValidation) {
        const phoneField = $('#customer-phone', target);
        const nameField = $('#customer-name', target);
        const phone = phoneField?.value.trim() || '';
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) {
          if (showValidation) {
            showNotice('Enter a valid mobile number with 7 to 15 digits.', 'error');
            phoneField?.focus();
          }
          return null;
        }
        state.posCustomer.phone = phone;
        const requestId = ++state.customerLookupRequest;
        try {
          const result = await api(`/customers/lookup?phone=${encodeURIComponent(phone)}`);
          if (requestId !== state.customerLookupRequest) return null;
          const customer = result.customer;
          if (customer) {
            state.posCustomer = {
              ...state.posCustomer,
              customerId: customer.id,
              phone: customer.phone,
              name: customer.name || '',
              address: customer.address || ''
            };
            if (nameField) nameField.value = state.posCustomer.name;
            if ($('#customer-address', target)) $('#customer-address', target).value = state.posCustomer.address;
            if ($('#customer-match-status', target)) $('#customer-match-status', target).textContent = 'Existing customer found.';
          } else {
            state.posCustomer.customerId = null;
            if ($('#customer-match-status', target)) $('#customer-match-status', target).textContent = 'New customer.';
          }
          if (!state.posCustomer.name.trim()) {
            if (showValidation) {
              showNotice('Enter the customer name to continue.', 'error');
              nameField?.focus();
            }
            return null;
          }
          return { ...state.posCustomer };
        } catch (error) {
          showNotice(error.message, 'error');
          return null;
        }
      }
    },

    async kot(target) {
      target.innerHTML = `<div class="page-heading"><div><span class="eyebrow">KITCHEN DISPLAY</span><h1>Kitchen orders</h1><p>Track each order from preparation to service.</p></div><span class="refresh-label"><span class="live-indicator"></span> Updates every 5 seconds</span></div><div id="orders-content"><div class="loading-state"><span class="loader"></span>Loading orders…</div></div>`;
      const load = async () => {
        if (!$('#orders-content', target)) return;
        const orders = await api('/orders?live=1');
        if (!$('#orders-content', target)) return;
        const ordersById = new Map();
        orders.forEach(order => {
          const existing = ordersById.get(String(order.id));
          if (!existing) {
            ordersById.set(String(order.id), { ...order, items: [...order.items] });
            return;
          }
          const itemIds = new Set(existing.items.map(item => String(item.id)));
          existing.items.push(...order.items.filter(item => !itemIds.has(String(item.id))));
        });
        const groupedOrders = [...ordersById.values()];
        $('#orders-content', target).innerHTML = groupedOrders.length ? `<div class="orders-grid">${groupedOrders.map(order => `
          <article class="ticket-card">
            <div class="ticket-top"><div><span class="ticket-id">ORDER #${escapeHtml(order.id)}</span><h2>${escapeHtml(order.table_name || titleCase(order.order_type))}</h2></div><span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(titleCase(order.status))}</span></div>
            <div class="ticket-meta"><span>${escapeHtml(titleCase(order.order_type))}</span><span>${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${order.customer_name ? `<span>${escapeHtml(order.customer_name)}</span>` : ''}</div>
            <div class="ticket-items">${order.items.map(item => `<div><span><b>${escapeHtml(item.qty)}×</b> ${escapeHtml(item.item_name)} ${item.variation ? `<small>(${escapeHtml(item.variation)})</small>` : ''}${item.addons ? `<small class="ticket-addon">+ ${escapeHtml(item.addons)}</small>` : ''}</span></div>`).join('')}</div>
            <div class="ticket-bottom"><b>${money(order.total)}</b>${order.status === 'placed' ? `<button class="button button-secondary" data-status="${order.id}" data-next="preparing">Start preparing</button>` : ''}${order.status === 'preparing' ? `<button class="button button-primary" data-status="${order.id}" data-next="ready">Mark ready</button>` : ''}${order.status === 'ready' ? `<button class="button button-primary" data-status="${order.id}" data-next="${order.order_type === 'delivery' ? 'delivered' : 'served'}">${order.order_type === 'delivery' ? 'Mark delivered' : 'Mark served'}</button>` : ''}</div>
          </article>`).join('')}</div>` : '<div class="empty-state"><span class="empty-icon">✓</span><h2>All caught up</h2><p>New kitchen orders will appear here as they come in.</p></div>';
        document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await api(`/orders/${button.dataset.status}/status`, 'PATCH', { status: button.dataset.next });
            await load();
          } catch (error) {
            showNotice(error.message, 'error');
            button.disabled = false;
          }
        }));
      };
      await load();
      state.timer = setInterval(() => load().catch(error => showNotice(error.message, 'error')), 5000);
    },

    async history(target) {
      const orders = await api('/orders');
      target.innerHTML = `${pageHeading('YOUR SERVICE, AT A GLANCE', 'Order history', 'Review recent orders and reprint a customer bill.')}<div class="table-card"><div class="table-card-heading"><div><h2>Recent orders</h2><p>Showing up to 200 orders</p></div><span class="record-count">${orders.length} orders</span></div>${orders.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>ORDER</th><th>TYPE</th><th>DATE &amp; TIME</th><th>STATUS</th><th>PAYMENT</th><th>TOTAL</th><th></th></tr></thead><tbody>${orders.map(order => `<tr><td><b>#${escapeHtml(order.id)}</b></td><td>${escapeHtml(titleCase(order.order_type))}${order.table_name ? `<small class="table-subtext">${escapeHtml(order.table_name)}</small>` : ''}</td><td>${new Date(order.created_at).toLocaleString()}</td><td><span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(titleCase(order.status))}</span></td><td><span class="payment-state ${order.payment_status === 'paid' ? 'paid' : ''}">${escapeHtml(titleCase(order.payment_status))}</span></td><td><b>${money(order.total)}</b></td><td><button class="button button-small button-secondary" data-bill="${escapeHtml(order.id)}">View bill</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><span class="empty-icon">◷</span><h2>No orders yet</h2><p>Completed orders will show up here.</p></div>'}</div>`;
      document.querySelectorAll('[data-bill]').forEach(button => button.addEventListener('click', () => printBill(button.dataset.bill)));
    },

    menu(target) { return masterScreen(target, 'Menu management', 'Manage menu items, categories, sizes, and add-ons.', ['categories', 'items', 'item_variations', 'item_addons']); },
    tables(target) { return masterScreen(target, 'Tables', 'Manage seating areas and dining tables.', ['table_places', 'tables']); },
    staff(target) { return masterScreen(target, 'Team', 'Manage your restaurant roles and employee records.', ['departments', 'job_types', 'roles', 'employees']); },

    async settings(target) {
      const settings = await api('/settings');
      const fields = [
        { key: 'restaurant_name', label: 'Restaurant name', placeholder: 'Your restaurant' },
        { key: 'address', label: 'Address', placeholder: 'Street, city' },
        { key: 'tax_percent', label: 'Tax rate (%)', placeholder: '5', type: 'number' },
        { key: 'bill_footer', label: 'Bill footer message', placeholder: 'Thank you, visit again!' }
      ];
      target.innerHTML = `${pageHeading('WORKSPACE PREFERENCES', 'Settings', 'Keep your restaurant details and bill information up to date.')}<form class="settings-card" id="settings-form"><div class="settings-card-heading"><span class="settings-icon">⚙</span><div><h2>Bill configuration</h2><p>These details appear on printed customer bills.</p></div></div><div class="settings-fields">${fields.map(field => `<label class="field-label">${escapeHtml(field.label)}<input name="${field.key}" type="${field.type || 'text'}" ${field.type === 'number' ? 'min="0" step="0.01"' : ''} value="${escapeHtml(settings[field.key] || '')}" placeholder="${escapeHtml(field.placeholder)}"></label>`).join('')}</div><div class="settings-actions"><span class="muted">Changes are saved for the whole restaurant.</span><button class="button button-primary" type="submit">Save changes <span>→</span></button></div></form>`;
      $('#settings-form', target).addEventListener('submit', async event => {
        event.preventDefault();
        const button = $('button[type="submit"]', event.currentTarget);
        button.disabled = true;
        try {
          const body = Object.fromEntries(new FormData(event.currentTarget).entries());
          await api('/settings', 'PUT', body);
          showNotice('Restaurant settings saved.', 'success');
        } catch (error) {
          showNotice(error.message, 'error');
        } finally {
          button.disabled = false;
        }
      });
    }
  };

  async function masterScreen(target, heading, description, tables) {
    target.innerHTML = `${pageHeading('RESTAURANT SETUP', heading, description)}<div class="master-list" id="master-list"></div>`;
    const container = $('#master-list', target);
    for (const table of tables) {
      const rows = await api(`/master/${table}`);
      if (!$('#master-list', target)) return;
      const fields = masterFields[table] || [];
      const references = {};
      for (const field of fields.filter(item => item.type === 'reference')) {
        references[field.table] = references[field.table] || await api(`/master/${field.table}`);
      }
      const columns = rows[0] ? Object.keys(rows[0]).filter(column => !['id', 'created_at', 'image_prompt'].includes(column)) : [];
      const useManagementDrawer = (
        heading === 'Tables' && ['table_places', 'tables'].includes(table)
      ) || (
        heading === 'Menu management' && ['categories', 'items', 'item_variations', 'item_addons'].includes(table)
      );
      const recordLabel = {
        table_places: 'dining area',
        tables: 'table',
        categories: 'category',
        items: 'menu item',
        item_variations: 'variation',
        item_addons: 'add-on'
      }[table] || titleCase(table).toLowerCase();
      const makeFields = (record = {}) => `<div class="master-fields">${fields.map(field => {
        const required = field.required ? 'required' : '';
        const value = record[field.name] ?? field.value ?? '';
        if (field.type === 'reference') {
          const options = references[field.table] || [];
          return `<label class="field-label">${escapeHtml(field.label)}<select name="${field.name}" ${required}>${field.optional ? '<option value="">None</option>' : '<option value="">Choose…</option>'}${options.map(option => `<option value="${escapeHtml(option.id)}" ${String(value) === String(option.id) ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}</select></label>`;
        }
        if (field.type === 'select') {
          return `<label class="field-label">${escapeHtml(field.label)}<select name="${field.name}" ${required}>${field.options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`;
        }
        if (field.type === 'textarea') {
          return `<label class="field-label">${escapeHtml(field.label)}<textarea name="${field.name}" ${required}>${escapeHtml(value)}</textarea></label>`;
        }
        return `<label class="field-label">${escapeHtml(field.label)}<input name="${field.name}" type="${field.type}" value="${escapeHtml(value)}" ${required}${field.min !== undefined ? ` min="${field.min}"` : ''}${field.step ? ` step="${field.step}"` : ''} placeholder="${escapeHtml(field.placeholder || (field.type === 'number' ? '0.00' : ''))}"></label>`;
      }).join('')}</div>`;
      const card = document.createElement('section');
      card.className = 'table-card master-card';
      card.innerHTML = `<div class="table-card-heading"><div><h2>${escapeHtml(titleCase(table))}</h2><p>${rows.length} ${rows.length === 1 ? 'record' : 'records'}</p></div><div class="master-card-actions"><span class="record-count">${escapeHtml(table)}</span>${useManagementDrawer ? `<button class="button button-secondary" data-create>＋ Add ${escapeHtml(recordLabel)}</button>` : ''}</div></div>
        ${rows.length ? `<div class="table-scroll"><table class="data-table"><thead><tr>${columns.map(column => `<th>${escapeHtml(titleCase(column))}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(row[column] ?? '—')}</td>`).join('')}<td class="master-row-actions">${useManagementDrawer ? `<button class="button button-small button-secondary" data-edit="${escapeHtml(row.id)}">Edit</button>` : ''}<button class="button button-small button-danger" data-delete="${escapeHtml(row.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="master-empty">No records here yet. Add the first one below.</p>'}
        ${table === 'employees'
          ? '<p class="master-empty">Employee accounts are created through the sign-up screen.</p>'
          : useManagementDrawer ? '' : `<form class="master-add" data-table="${escapeHtml(table)}">${makeFields()}<button class="button button-secondary" type="submit">＋ Add record</button></form>`}`;
      container.appendChild(card);
      const openEditor = record => {
        const isEditing = Boolean(record);
        const drawer = document.createElement('dialog');
        drawer.className = 'master-drawer';
        drawer.innerHTML = `<section class="master-drawer-panel" aria-labelledby="master-drawer-title">
          <header class="master-drawer-heading"><div><span class="eyebrow">${heading === 'Menu management' ? 'MENU MANAGEMENT' : 'TABLE SETUP'}</span><h2 id="master-drawer-title">${isEditing ? `Edit ${escapeHtml(recordLabel)}` : `Add ${escapeHtml(recordLabel)}`}</h2><p>${isEditing ? 'Update this record’s details.' : `Add a ${escapeHtml(recordLabel)} to your restaurant.`}</p></div><button class="master-drawer-close" type="button" aria-label="Close form">×</button></header>
          <form class="master-drawer-form">${makeFields(record)}<footer class="master-drawer-actions"><button class="button button-secondary" type="button" data-cancel>Cancel</button><button class="button button-primary" type="submit">${isEditing ? 'Save changes' : `Add ${escapeHtml(recordLabel)}`}</button></footer></form>
        </section>`;
        document.body.appendChild(drawer);
        drawer.showModal();
        const close = () => {
          drawer.close();
          drawer.remove();
        };
        drawer.addEventListener('click', event => {
          if (event.target === drawer) close();
        });
        drawer.addEventListener('close', () => drawer.remove(), { once: true });
        drawer.querySelector('.master-drawer-close').addEventListener('click', close);
        drawer.querySelector('[data-cancel]').addEventListener('click', close);
        drawer.querySelector('form').addEventListener('submit', async event => {
          event.preventDefault();
          const button = event.currentTarget.querySelector('[type="submit"]');
          button.disabled = true;
          const formData = new FormData(event.currentTarget);
          const recordData = {};
          for (const field of fields) {
            const value = formData.get(field.name);
            if (field.type === 'number') recordData[field.name] = value === '' ? null : Number(value);
            else if (field.type === 'select' && ['is_veg', 'available', 'active'].includes(field.name)) recordData[field.name] = Number(value);
            else recordData[field.name] = value === '' ? null : value;
          }
          try {
            await api(isEditing ? `/master/${table}/${record.id}` : `/master/${table}`, isEditing ? 'PUT' : 'POST', recordData);
            close();
            await masterScreen(target, heading, description, tables);
            showNotice(isEditing ? `${titleCase(recordLabel)} updated.` : `${titleCase(recordLabel)} added.`, 'success');
          } catch (error) {
            showNotice(error.message, 'error');
            button.disabled = false;
          }
        });
      };
      if (useManagementDrawer) {
        card.querySelector('[data-create]').addEventListener('click', () => openEditor());
        card.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
          const record = rows.find(row => String(row.id) === button.dataset.edit);
          if (record) openEditor(record);
        }));
      }
      card.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
        if (!confirm(`Delete this ${titleCase(table).toLowerCase()} record?`)) return;
        button.disabled = true;
        try {
          await api(`/master/${table}/${button.dataset.delete}`, 'DELETE');
          await masterScreen(target, heading, description, tables);
        } catch (error) {
          showNotice(error.message, 'error');
          button.disabled = false;
        }
      }));
      const addForm = card.querySelector('form');
      if (addForm) addForm.addEventListener('submit', async event => {
        event.preventDefault();
        const record = {};
        const formData = new FormData(event.currentTarget);
        for (const field of fields) {
          const value = formData.get(field.name);
          if (field.type === 'number') record[field.name] = value === '' ? null : Number(value);
          else if (field.type === 'select' && ['is_veg', 'available', 'active'].includes(field.name)) record[field.name] = Number(value);
          else record[field.name] = value === '' ? null : value;
        }
        try {
          await api(`/master/${table}`, 'POST', record);
          await masterScreen(target, heading, description, tables);
          showNotice('Record added.', 'success');
        } catch (error) {
          showNotice(error.message, 'error');
        }
      });
    }
  }

  async function printBill(id) {
    try {
      const { order, items, settings } = await api(`/orders/${id}/bill`);
      const windowRef = window.open('', '', 'width=420,height=650');
      if (!windowRef) {
        showNotice('Allow pop-ups to print the bill.', 'error');
        return;
      }
      windowRef.document.write(`<!doctype html><html><head><title>Bill #${escapeHtml(order.id)}</title><style>body{font:14px/1.5 Arial,sans-serif;padding:24px;color:#222}h1{font-size:21px;margin:0}p{margin:4px 0 18px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dashed #ccc}.right{text-align:right}.total{font-size:18px;font-weight:bold}footer{text-align:center;margin-top:26px}@media print{body{padding:0}}</style></head><body><h1>${escapeHtml(settings.restaurant_name || '')}</h1><p>${escapeHtml(settings.address || '')}<br>Bill #${escapeHtml(order.id)} · ${new Date(order.created_at).toLocaleString()}<br>Customer: ${escapeHtml(order.customer_name || 'Walk-in')} · Mobile: ${escapeHtml(order.customer_phone || '—')}</p><table>${items.map(item => `<tr><td>${escapeHtml(item.qty)} × ${escapeHtml(item.item_name)}</td><td class="right">${money(item.price * item.qty)}</td></tr>`).join('')}<tr><td>Subtotal</td><td class="right">${money(order.subtotal)}</td></tr><tr><td>Tax</td><td class="right">${money(order.tax)}</td></tr>${Number(order.discount) ? `<tr><td>Discount</td><td class="right">−${money(order.discount)}</td></tr>` : ''}${Number(order.round_off) ? `<tr><td>Round off</td><td class="right">${Number(order.round_off) > 0 ? '+' : '−'}${money(Math.abs(Number(order.round_off)))}</td></tr>` : ''}<tr class="total"><td>Total</td><td class="right">${money(order.total)}</td></tr></table><footer>${escapeHtml(settings.bill_footer || '')}</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
      windowRef.document.close();
    } catch (error) {
      showNotice(error.message, 'error');
    }
  }

  function showNotice(message, kind = 'success') {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  if (state.token && state.user) render();
  else renderAuth();
})();
