// src/liff/app.js
// LIFF app — five-step flow: services → staff → date → time → confirm.

(function () {
  const API = window.__API_URL__;
  const LIFF_ID = window.__LIFF_ID__;

  const state = {
    step: 'services',
    idToken: null,
    profile: null,
    selected: { service: null, staff: null, date: null, time: null }
  };

  const $app = document.getElementById('app');
  const $back = document.getElementById('back-btn');
  const $title = document.getElementById('header-title');

  function setTitle(t) { $title.textContent = t; }

  function fetchJson(action, params) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    return fetch(API + '?' + qs).then(r => r.json());
  }

  function postJson(action, body) {
    return fetch(API + '?action=' + action, {
      method: 'POST',
      body: JSON.stringify(body)
    }).then(r => r.json());
  }

  async function init() {
    try {
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      state.idToken = liff.getIDToken();
      state.profile = await liff.getProfile();
      renderServices();
    } catch (e) {
      $app.innerHTML = `<div class="error">無法初始化 LIFF：${e.message}</div>`;
    }
  }

  function renderLoading() {
    $app.innerHTML = '<div class="loading">載入中…</div>';
  }

  async function renderServices() {
    state.step = 'services';
    setTitle('選擇服務');
    $back.hidden = true;
    renderLoading();
    const data = await fetchJson('services', {});
    $app.innerHTML = data.services.map(s => `
      <button class="card" data-id="${s.service_id}">
        <div class="card-title">${s.name}</div>
        <div class="card-meta">${s.duration_min} 分鐘 · NT$ ${s.price}</div>
        <div class="card-desc">${s.description || ''}</div>
      </button>
    `).join('') || '<div class="empty">尚無服務</div>';
    $app.querySelectorAll('button.card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.service = data.services.find(s => s.service_id === btn.dataset.id);
        renderStaff();
      });
    });
  }

  async function renderStaff() {
    state.step = 'staff';
    setTitle('選擇人員');
    $back.hidden = false; $back.onclick = renderServices;
    renderLoading();
    const data = await fetchJson('staff', { service_id: state.selected.service.service_id });
    $app.innerHTML = data.staff.map(s => `
      <button class="card" data-id="${s.staff_id}">
        ${s.photo_url ? `<img class="avatar" src="${s.photo_url}">` : ''}
        <div class="card-title">${s.name}</div>
      </button>
    `).join('');
    $app.querySelectorAll('button.card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.staff = data.staff.find(s => s.staff_id === btn.dataset.id);
        renderDate();
      });
    });
  }

  function renderDate() {
    state.step = 'date';
    setTitle('選擇日期');
    $back.onclick = renderStaff;

    const today = new Date();
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, label: `${d.getMonth()+1}/${d.getDate()}`, dow: ['日','一','二','三','四','五','六'][d.getDay()] });
    }
    $app.innerHTML = `<div class="grid-dates">${
      days.map(d => `<button class="date-cell" data-iso="${d.iso}"><span>${d.label}</span><small>${d.dow}</small></button>`).join('')
    }</div>`;
    $app.querySelectorAll('.date-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.date = btn.dataset.iso;
        renderTime();
      });
    });
  }

  async function renderTime() {
    state.step = 'time';
    setTitle(`${state.selected.date} 可預約時段`);
    $back.onclick = renderDate;
    renderLoading();
    const data = await fetchJson('availability', {
      service_id: state.selected.service.service_id,
      staff_id: state.selected.staff.staff_id,
      date: state.selected.date
    });
    if (!data.slots || data.slots.length === 0) {
      $app.innerHTML = '<div class="empty">這天沒有可預約時段</div>';
      return;
    }
    $app.innerHTML = `<div class="grid-times">${
      data.slots.map(t => `<button class="time-cell">${t}</button>`).join('')
    }</div>`;
    $app.querySelectorAll('.time-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.time = btn.textContent;
        renderConfirm();
      });
    });
  }

  function renderConfirm() {
    state.step = 'confirm';
    setTitle('確認預約');
    $back.onclick = renderTime;
    const s = state.selected;
    $app.innerHTML = `
      <div class="summary">
        <div><b>服務：</b>${s.service.name}</div>
        <div><b>人員：</b>${s.staff.name}</div>
        <div><b>日期：</b>${s.date}</div>
        <div><b>時段：</b>${s.time}</div>
        <div><b>金額：</b>NT$ ${s.service.price}</div>
      </div>
      <button id="submit" class="primary">確認下訂並付款</button>
    `;
    document.getElementById('submit').addEventListener('click', submitBooking);
  }

  async function submitBooking() {
    const btn = document.getElementById('submit');
    btn.disabled = true; btn.textContent = '處理中…';
    const s = state.selected;
    const [y, mo, d] = s.date.split('-').map(Number);
    const [h, mi] = s.time.split(':').map(Number);
    const utcMillis = Date.UTC(y, mo - 1, d, h, mi) - 8 * 3600 * 1000;
    const startAtIso = new Date(utcMillis).toISOString();
    const result = await postJson('booking', {
      idToken: state.idToken,
      service_id: s.service.service_id,
      staff_id: s.staff.staff_id,
      start_at: startAtIso
    });
    if (result.success) {
      $app.innerHTML = `
        <div class="success">
          <div class="big-check">✓</div>
          <div>預約成功！</div>
          <div class="small">訂單編號：${result.order_id}</div>
          <button class="primary" onclick="liff.closeWindow()">回到 LINE</button>
        </div>
      `;
      $back.hidden = true;
    } else {
      btn.disabled = false; btn.textContent = '確認下訂並付款';
      alert('預約失敗：' + (result.error || '未知錯誤'));
    }
  }

  init();
})();
