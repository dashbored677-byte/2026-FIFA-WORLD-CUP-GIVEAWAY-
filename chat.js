(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const config = window.LIA_CHAT_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || '') &&
    !!config.supabaseAnonKey && !String(config.supabaseAnonKey).includes('YOUR_');
  const DEMO_KEY = 'lia_chat_demo_messages_v1';
  const NAME_KEY = 'lia_chat_display_name_v1';
  const MAX_MESSAGES = 60;
  let supabase = null;
  let userId = null;
  let realtimeChannel = null;
  let chatOpen = false;
  let messages = [];
  let unread = 0;
  let currentName = readName();
  let sending = false;
  let lastSentAt = 0;

  const widget = $('#communityChat');
  const launcher = $('#chatLauncher');
  const panel = $('#chatPanel');
  const list = $('#chatMessages');
  const input = $('#chatMessageInput');
  const form = $('#chatForm');
  const sendButton = $('#chatSendButton');
  const nameInput = $('#chatDisplayName');
  const statusText = $('#chatStatusText');
  const modeNote = $('#chatModeNote');
  const transportNote = $('#chatTransportNote');

  function readName() {
    try {
      const explicit = localStorage.getItem(NAME_KEY);
      if (explicit && explicit.trim()) return explicit.trim().slice(0, 22);
      const savedGame = JSON.parse(localStorage.getItem('lifeInAkwaIbom_v1') || '{}');
      return String(savedGame.name || 'New Resident').trim().slice(0, 22);
    } catch { return 'New Resident'; }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function safeTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'now';
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }
  function setStatus(text, online = false) {
    statusText.textContent = text;
    $('#chatLauncherStatus').textContent = online ? 'Residents can connect' : 'Community chat';
    $('#chatStatusDot').classList.toggle('is-online', online);
  }
  function setModeNote(text, warning = false) {
    modeNote.textContent = text;
    modeNote.classList.toggle('is-warning', warning);
  }
  function openChat() {
    chatOpen = true; panel.classList.remove('hidden'); launcher.setAttribute('aria-expanded','true');
    $('#chatChevron').textContent = '⌄'; unread = 0; updateUnread(); renderMessages();
    setTimeout(() => input.focus(), 80);
  }
  function closeChat() {
    chatOpen = false; panel.classList.add('hidden'); launcher.setAttribute('aria-expanded','false');
    $('#chatChevron').textContent = '⌃';
  }
  function updateUnread() {
    const badge = $('#chatUnread');
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('hidden', unread < 1);
  }
  function addMessage(message, {notify = true} = {}) {
    if (!message || !message.id || messages.some(m => String(m.id) === String(message.id))) return;
    messages.push(message);
    messages = messages.slice(-MAX_MESSAGES);
    if (notify && !chatOpen && message.user_id !== userId) { unread++; updateUnread(); }
    renderMessages();
  }
  function renderMessages() {
    if (!messages.length) {
      list.innerHTML = `<div class="chat-welcome"><span>👋</span><b>Welcome to Town Square</b><p>Say hello, share your progress, and meet other players.</p></div>`;
      return;
    }
    list.innerHTML = messages.slice(-MAX_MESSAGES).map(m => {
      const mine = !!userId && m.user_id === userId;
      const name = String(m.display_name || 'Resident').slice(0,22);
      return `<article class="chat-message ${mine ? 'mine' : ''}"><div class="chat-message-meta"><b>${esc(name)}${mine ? ' · you' : ''}</b><time>${esc(safeTime(m.created_at))}</time></div><p>${esc(m.message || '')}</p></article>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  }
  function loadDemoMessages() {
    try { messages = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]').slice(-MAX_MESSAGES); }
    catch { messages = []; }
    renderMessages();
  }
  function saveDemoMessages() {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES))); } catch {}
  }
  function showDemoMode() {
    userId = 'demo-local-user';
    loadDemoMessages();
    setStatus('Demo mode', false);
    setModeNote('Preview mode: messages are saved only in this browser. Connect Supabase to enable live chat between different players and devices.', true);
    transportNote.textContent = 'Local preview only';
  }
  async function startLiveChat() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;
    let session = authData.session;
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    userId = session.user.id;
    await ensureProfile();
    const { data: rows, error } = await supabase.from('chat_messages')
      .select('id,user_id,display_name,message,created_at').order('created_at', {ascending:true}).limit(MAX_MESSAGES);
    if (error) throw error;
    messages = rows || []; renderMessages();
    setStatus('Live community chat', true);
    setModeNote('You are in the global Town Square. Messages are shared with players using this game’s live chat.', false);
    transportNote.textContent = 'Live · all locations';
    realtimeChannel = supabase.channel('lia-global-town-square')
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'chat_messages'}, payload => addMessage(payload.new))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setStatus('Live community chat', true);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setStatus('Reconnecting…', false);
      });
  }
  async function ensureProfile() {
    const desired = currentName || 'Resident';
    const { error } = await supabase.from('chat_profiles').upsert({id:userId, display_name:desired}, {onConflict:'id'});
    if (error) throw error;
  }
  async function saveDisplayName() {
    const next = nameInput.value.trim().replace(/\s+/g,' ').slice(0,22);
    if (!next) { nameInput.focus(); setModeNote('Please choose a chat name before sending a message.', true); return; }
    currentName = next; nameInput.value = next;
    try { localStorage.setItem(NAME_KEY, currentName); } catch {}
    if (configured && supabase && userId) {
      const { error } = await supabase.from('chat_profiles').upsert({id:userId, display_name:currentName}, {onConflict:'id'});
      if (error) { setModeNote('Could not update your live profile. Check the Supabase chat setup.', true); return; }
    }
    setModeNote(configured ? 'Your chat name is saved. Keep it respectful and protect your privacy.' : 'Name saved for this browser. Demo messages are not shared with other devices.', !configured);
  }
  async function sendMessage(event) {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || sending) return;
    if (!currentName || currentName === 'New Resident') {
      setModeNote('Set a chat name first so other residents know what to call you.', true); nameInput.focus(); return;
    }
    if (message.length > 500) return;
    const now = Date.now();
    if (now - lastSentAt < 900) { setModeNote('Please wait a moment before sending another message.', true); return; }
    sending = true; sendButton.disabled = true;
    try {
      if (configured && supabase && userId) {
        const { error } = await supabase.from('chat_messages').insert({user_id:userId, display_name:currentName, message});
        if (error) throw error;
      } else {
        const item = {id: (crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random()}`), user_id:'demo-local-user', display_name:currentName, message, created_at:new Date().toISOString()};
        addMessage(item, {notify:false}); saveDemoMessages();
      }
      input.value = ''; $('#chatCharCount').textContent = '0/500'; lastSentAt = Date.now();
    } catch (error) {
      console.error('Chat send failed:', error);
      setModeNote('Message not sent. Check your internet connection and Supabase chat setup.', true);
    } finally { sending = false; sendButton.disabled = false; input.focus(); }
  }
  function setupEvents() {
    launcher.addEventListener('click', () => chatOpen ? closeChat() : openChat());
    $('#chatClose').addEventListener('click', closeChat);
    $('#chatNavButton')?.addEventListener('click', () => { $('#sidebar').classList.remove('open'); openChat(); });
    $('#chatNameSave').addEventListener('click', saveDisplayName);
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveDisplayName(); } });
    form.addEventListener('submit', sendMessage);
    input.addEventListener('input', () => { $('#chatCharCount').textContent = `${input.value.length}/500`; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    window.addEventListener('storage', e => {
      if (!configured && e.key === DEMO_KEY) loadDemoMessages();
      if (e.key === NAME_KEY) { currentName = readName(); nameInput.value = currentName; }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && chatOpen) closeChat(); });
  }
  async function init() {
    nameInput.value = currentName;
    setupEvents();
    if (!configured) { showDemoMode(); return; }
    setStatus('Connecting…', false); setModeNote('Connecting securely to the community chat…', false); transportNote.textContent = 'Connecting';
    try { await startLiveChat(); }
    catch (error) {
      console.error('Live chat setup failed:', error);
      showDemoMode();
      setModeNote('Live chat is configured but could not connect. Verify Supabase auth, SQL setup, and internet access. Preview messages remain local.', true);
    }
  }
  init();
})();
