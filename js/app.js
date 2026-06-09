/* app.js — 主控制器（UI 互動邏輯，Demo 模式）
   合租管家 · 敗家組
*/

'use strict';

// ─── State ───────────────────────────────────────────────
const state = {
  currentTab: 'finance',
  balance: 1550,
};

// ─── DOM Helpers ─────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

// ─── Toast ───────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ─── Tab Navigation ──────────────────────────────────────
function switchTab(tabName) {
  if (state.currentTab === tabName) return;
  state.currentTab = tabName;

  // Update tabs
  $$('.tab-item').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  // Update pages
  $$('.page').forEach(p => {
    p.classList.toggle('active', p.dataset.page === tabName);
  });
}

$$('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ─── Wallet Balance Animation ────────────────────────────
function animateBalance(from, to, duration = 500) {
  const el = $('#balance-amount');
  const start = performance.now();
  const diff = to - from;

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + diff * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── Modal System ─────────────────────────────────────────
function openModal(id) {
  const overlay = $(`#modal-${id}`);
  overlay.classList.add('active');
  // Trap focus / prevent body scroll
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = $(`#modal-${id}`);
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Close on overlay click
$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      const id = overlay.id.replace('modal-', '');
      closeModal(id);
    }
  });
});

// ─── Wallet: Deposit Button ───────────────────────────────
$('#btn-deposit').addEventListener('click', () => openModal('deposit'));
$('#close-modal-deposit').addEventListener('click', () => closeModal('deposit'));
$('#cancel-deposit').addEventListener('click', () => closeModal('deposit'));

// Quick amount buttons
$$('.quick-amount-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $('#deposit-amount').value = btn.dataset.amount;
    // Highlight selected
    $$('.quick-amount-btn').forEach(b => b.style.borderColor = '');
    btn.style.borderColor = '#11998e';
  });
});

// Submit deposit
$('#submit-deposit').addEventListener('click', () => {
  const amount = parseFloat($('#deposit-amount').value);
  const who = $('input[name="deposit-who"]:checked')?.value;

  if (!amount || amount <= 0) {
    showToast('❌ 請輸入有效金額');
    return;
  }
  if (!who) {
    showToast('❌ 請選擇儲值成員');
    return;
  }

  const prev = state.balance;
  state.balance += amount;
  animateBalance(prev, state.balance);
  closeModal('deposit');
  $('#deposit-amount').value = '';
  $$('.quick-amount-btn').forEach(b => b.style.borderColor = '');
  showToast(`✅ 隊員 ${who} 儲值 $${amount.toLocaleString()} 成功！`);
});

// ─── Expense Modal ────────────────────────────────────────
$('#btn-add-expense').addEventListener('click', () => openModal('expense'));
$('#btn-add-reimburse').addEventListener('click', () => {
  openModal('expense');
  // Pre-select reimburse option
  const reimburseRadio = $('input[name="pay-type"][value="reimburse"]');
  if (reimburseRadio) reimburseRadio.checked = true;
});

$('#close-modal-expense').addEventListener('click', () => closeModal('expense'));
$('#cancel-expense').addEventListener('click', () => closeModal('expense'));

$('#submit-expense').addEventListener('click', () => {
  const title = $('#expense-title').value.trim();
  const amount = parseFloat($('#expense-amount').value);
  const payType = $('input[name="pay-type"]:checked')?.value;
  const buyer = $('input[name="buyer"]:checked')?.value;

  if (!title) { showToast('❌ 請填寫品項名稱'); return; }
  if (!amount || amount <= 0) { showToast('❌ 請輸入有效金額'); return; }
  if (!buyer) { showToast('❌ 請選擇採購人'); return; }

  if (payType === 'fund') {
    if (amount > state.balance) {
      showToast('❌ 公積金餘額不足！');
      return;
    }
    const prev = state.balance;
    state.balance -= amount;
    animateBalance(prev, state.balance);
    showToast(`✅ 已從公積金扣除 $${amount.toLocaleString()} (${title})`);
  } else {
    showToast(`📝 已記錄墊付：隊員 ${buyer} 墊付 $${amount.toLocaleString()} (${title})`);
  }

  // Reset form
  $('#expense-title').value = '';
  $('#expense-amount').value = '';
  closeModal('expense');
});

// ─── Rent: Pay / Confirm Buttons ─────────────────────────
$('#btn-pay-c')?.addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const item = btn.closest('.rent-item');
  item.classList.remove('unpaid');
  item.classList.add('pending');

  // Update dot
  const dot = item.querySelector('.rent-status-dot');
  dot.classList.remove('unpaid');
  dot.classList.add('pending');

  // Replace button with status + confirm
  btn.replaceWith((() => {
    const wrap = document.createElement('div');
    wrap.className = 'rent-status-actions';
    wrap.innerHTML = `
      <div class="rent-status-tag pending">待確認 ⏳</div>
      <button class="rent-confirm-btn" id="btn-confirm-c">確認入帳</button>
    `;
    wrap.querySelector('#btn-confirm-c').addEventListener('click', () => confirmRent(item, wrap));
    return wrap;
  })());

  showToast('✅ 已標記為「我已繳交」，請等待確認！');
});

$('#btn-confirm-b')?.addEventListener('click', function() {
  confirmRent(this.closest('.rent-item'), this.closest('.rent-status-actions'));
});

function confirmRent(item, actionsEl) {
  item.classList.remove('pending');
  item.classList.add('confirmed');

  const dot = item.querySelector('.rent-status-dot');
  dot.classList.remove('pending');
  dot.classList.add('confirmed');

  if (actionsEl) {
    actionsEl.innerHTML = '<div class="rent-status-tag confirmed">已繳清 ✅</div>';
  }
  showToast('🎉 確認入帳成功！房租已繳清。');
}

// ─── Chore Checkboxes ─────────────────────────────────────
$$('.chore-checkbox').forEach(checkbox => {
  checkbox.addEventListener('change', function() {
    const item = this.closest('.chore-item');
    if (this.checked) {
      item.classList.add('done');
      showToast('✅ 打掃任務已打卡！辛苦了 🎉');
    } else {
      item.classList.remove('done');
    }
    updateChoreProgress();
  });
});

function updateChoreProgress() {
  const all = $$('.chore-checkbox');
  const done = [...all].filter(c => c.checked).length;
  const total = all.length;
  const pct = Math.round((done / total) * 100);

  const chip = $('.progress-chip');
  if (chip) {
    chip.querySelector('span').textContent = `${done} / ${total}`;
    chip.querySelector('.mini-progress').style.setProperty('--pct', `${pct}%`);
  }
}

// ─── Maintenance Done Buttons ─────────────────────────────
$$('.maintenance-done-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.maintenance-item');
    const title = item.querySelector('.maintenance-title')?.textContent;
    item.classList.remove('overdue');
    const meta = item.querySelector('.maintenance-meta');
    if (meta) {
      meta.innerHTML = meta.innerHTML.replace(/・<span.*<\/span>/, '') + '・<span style="color:var(--color-confirmed);font-weight:700;">剛剛完成 ✓</span>';
    }
    showToast(`✅ 「${title}」已標記完成！`);
  });
});

// ─── Init ─────────────────────────────────────────────────
(function init() {
  // Ensure finance page is active on load
  switchTab('finance');

  // Trigger initial balance display (no animation on load)
  $('#balance-amount').textContent = state.balance.toLocaleString();

  // Initialize chore progress
  updateChoreProgress();

  console.log('🏠 合租管家 App 啟動 — Demo 模式');
})();
