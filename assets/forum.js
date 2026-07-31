/* ==========================================================================
   MetricMech Forum — shared client
   Static site + Supabase. No build step, no framework.
   Exposes window.MMForum.
   ========================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://wzxowvrvuecybdxymjvi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_NYFIl1lGQHd0SwWb0dJCUw_VtdIV8Kj';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  var state = { user: null, profile: null, tags: null, myVotes: {} };

  /* ---------------------------------------------------------------- utils */

  // Rendering lives in assets/forum-md.js so the nightly pre-render job emits
  // byte-identical markup to what the browser draws.
  var esc = window.MMForumMD.esc;
  var renderBody = window.MMForumMD.renderBody;

  function timeAgo(iso) {
    var s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    var units = [[31536000, 'yr'], [2592000, 'mo'], [604800, 'wk'], [86400, 'd'], [3600, 'h'], [60, 'm']];
    for (var i = 0; i < units.length; i++) {
      if (s >= units[i][0]) return Math.floor(s / units[i][0]) + ' ' + units[i][1] + ' ago';
    }
    return 'just now';
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  function avatar(profileish, size) {
    var px = size || 28;
    var url = profileish.author_avatar || profileish.avatar_url;
    var name = profileish.author_name || profileish.display_name || 'Member';
    if (url) {
      return '<img class="fm-avatar" src="' + esc(url) + '" alt="" width="' + px + '" height="' + px +
             '" style="width:' + px + 'px;height:' + px + 'px" loading="lazy" referrerpolicy="no-referrer">';
    }
    return '<span class="fm-avatar fm-avatar-fb" style="width:' + px + 'px;height:' + px + 'px;font-size:' +
           Math.round(px * 0.38) + 'px">' + esc(initials(name)) + '</span>';
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'fm-toast' + (kind === 'error' ? ' fm-toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 3600);
    setTimeout(function () { el.remove(); }, 4200);
  }

  // Postgres errors are developer-facing; map the ones a member can actually
  // trigger onto plain language, and never leak the rest verbatim.
  function friendlyError(err) {
    var m = (err && (err.message || err.error_description)) || '';
    if (/Rate limit/i.test(m)) return m;
    if (/cannot vote on your own/i.test(m)) return 'You cannot vote on your own post.';
    if (/Only the person who asked/i.test(m)) return 'Only the person who asked can accept an answer.';
    if (/Sign in required/i.test(m)) return 'Please sign in first.';
    if (/cannot post right now|cannot vote right now/i.test(m)) return 'Your account is not allowed to do that.';
    if (/forum_questions_title_check/i.test(m)) return 'Your title must be between 15 and 160 characters.';
    if (/forum_questions_body_check/i.test(m)) return 'Please write at least 30 characters of detail.';
    if (/forum_answers_body_check/i.test(m)) return 'An answer needs at least 20 characters.';
    if (/duplicate key|already exists/i.test(m)) return 'That has already been posted.';
    if (/row-level security|permission denied/i.test(m)) return 'You do not have permission to do that.';
    console.error('[forum]', err);
    return 'Something went wrong. Please try again.';
  }

  /* ----------------------------------------------------------------- auth */

  function currentUser() { return state.user; }
  function currentProfile() { return state.profile; }

  async function loadSession() {
    var res = await sb.auth.getSession();
    state.user = (res.data && res.data.session && res.data.session.user) || null;
    if (state.user && !state.profile) await ensureProfile();
    return state.user;
  }

  async function ensureProfile() {
    if (!state.user) return null;
    var meta = state.user.user_metadata || {};
    var name = meta.full_name || meta.name || null;
    var pic = meta.avatar_url || meta.picture || null;
    var r = await sb.rpc('forum_ensure_profile', { p_display_name: name, p_avatar_url: pic });
    if (r.error) { console.error('[forum] profile', r.error); return null; }
    state.profile = r.data;
    return state.profile;
  }

  function returnUrl() {
    return location.pathname + location.search + location.hash;
  }

  async function signInWithGoogle() {
    sessionStorage.setItem('mm_forum_return', returnUrl());
    var r = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/forum/auth' }
    });
    if (r.error) toast(friendlyError(r.error), 'error');
  }

  async function signInWithEmail(email) {
    sessionStorage.setItem('mm_forum_return', returnUrl());
    var r = await sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.origin + '/forum/auth' }
    });
    if (r.error) { toast(friendlyError(r.error), 'error'); return false; }
    return true;
  }

  async function signOut() {
    await sb.auth.signOut();
    state.user = null; state.profile = null; state.myVotes = {};
    location.reload();
  }

  /* --------------------------------------------------------- sign-in modal */

  function openSignIn(reason) {
    if (document.getElementById('fm-auth')) return;
    var wrap = document.createElement('div');
    wrap.id = 'fm-auth';
    wrap.className = 'fm-modal-back';
    wrap.innerHTML =
      '<div class="fm-modal" role="dialog" aria-modal="true" aria-labelledby="fm-auth-t">' +
        '<button class="fm-modal-x" type="button" aria-label="Close">&times;</button>' +
        '<div class="fm-eyebrow">JOIN THE FORUM</div>' +
        '<h2 id="fm-auth-t">' + esc(reason || 'Sign in to post') + '</h2>' +
        '<p class="fm-modal-sub">Free, and takes about ten seconds. You need an account so answers can be attributed and credited.</p>' +
        '<button class="fm-btn fm-btn-google" type="button" id="fm-google">' +
          '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">' +
            '<path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.5z"/>' +
            '<path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.8C7.9 41 15.4 46 24 46z"/>' +
            '<path fill="#FBBC05" d="M11.6 28c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.8H4.3C2.8 17 2 20.4 2 23.9s.8 6.9 2.3 9.9l7.3-5.8z"/>' +
            '<path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 7 4.3 14.1l7.3 5.8c1.7-5.2 6.6-9.2 12.4-9.2z"/>' +
          '</svg>Continue with Google</button>' +
        '<div class="fm-or"><span>or</span></div>' +
        '<form id="fm-magic" novalidate>' +
          '<label class="fm-label" for="fm-email">Work email</label>' +
          '<input class="fm-input" id="fm-email" type="email" required autocomplete="email" placeholder="you@company.com">' +
          '<button class="fm-btn fm-btn-primary" type="submit" style="width:100%;margin-top:10px">Email me a sign-in link</button>' +
        '</form>' +
        '<p class="fm-fineprint">No password. We email you a one-time link. Your email is never shown publicly or sold.</p>' +
      '</div>';
    document.body.appendChild(wrap);

    function close() { wrap.remove(); }
    wrap.querySelector('.fm-modal-x').onclick = close;
    wrap.onclick = function (e) { if (e.target === wrap) close(); };
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });

    wrap.querySelector('#fm-google').onclick = signInWithGoogle;
    wrap.querySelector('#fm-magic').onsubmit = async function (e) {
      e.preventDefault();
      var input = wrap.querySelector('#fm-email');
      var btn = e.target.querySelector('button[type=submit]');
      if (!input.value || !/.+@.+\..+/.test(input.value)) { input.focus(); return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      var ok = await signInWithEmail(input.value.trim());
      if (ok) {
        wrap.querySelector('.fm-modal').innerHTML =
          '<div class="fm-eyebrow">CHECK YOUR INBOX</div>' +
          '<h2>Link sent</h2>' +
          '<p class="fm-modal-sub">We emailed a sign-in link to <strong>' + esc(input.value.trim()) +
          '</strong>. Open it on this device and you will land back here, signed in.</p>' +
          '<button class="fm-btn fm-btn-primary" type="button" style="width:100%" onclick="this.closest(\'.fm-modal-back\').remove()">Done</button>';
      } else {
        btn.disabled = false; btn.textContent = 'Email me a sign-in link';
      }
    };
    setTimeout(function () { var i = wrap.querySelector('#fm-email'); if (i) i.focus(); }, 60);
  }

  async function requireAuth(reason) {
    await loadSession();
    if (state.user) return true;
    openSignIn(reason);
    return false;
  }

  /* ------------------------------------------------------------ user chip */

  function renderUserChip(el) {
    if (!el) return;
    if (state.profile) {
      el.innerHTML =
        '<span class="fm-userchip">' + avatar(state.profile, 26) +
          '<span class="fm-userchip-name">' + esc(state.profile.display_name) + '</span>' +
          '<span class="fm-rep" title="Reputation">' + state.profile.reputation + '</span>' +
          '<button class="fm-linkbtn" type="button" id="fm-signout">Sign out</button>' +
        '</span>';
      el.querySelector('#fm-signout').onclick = signOut;
    } else {
      el.innerHTML = '<button class="fm-btn fm-btn-ghost" type="button" id="fm-signin">Sign in</button>';
      el.querySelector('#fm-signin').onclick = function () { openSignIn('Sign in to MetricMech Forum'); };
    }
  }

  /* ----------------------------------------------------------------- data */

  async function getTags(force) {
    if (state.tags && !force) return state.tags;
    var r = await sb.from('forum_tags').select('slug,name,description,question_count,sort_order')
                    .order('sort_order', { ascending: true });
    state.tags = r.error ? [] : r.data;
    return state.tags;
  }

  var FEED_COLS = 'id,slug,title,excerpt,view_count,answer_count,vote_score,has_accepted,is_closed,created_at,last_activity_at,author_handle,author_name,author_avatar,author_reputation,tags,tag_slugs';

  async function listQuestions(opts) {
    opts = opts || {};
    var q = sb.from('forum_question_list').select(FEED_COLS, { count: 'exact' });

    if (opts.tag) q = q.contains('tag_slugs', [opts.tag]);
    if (opts.q) q = q.textSearch('search', opts.q, { type: 'websearch', config: 'english' });
    if (opts.filter === 'unanswered') q = q.eq('answer_count', 0);
    if (opts.filter === 'solved') q = q.eq('has_accepted', true);

    if (opts.sort === 'top') q = q.order('vote_score', { ascending: false }).order('answer_count', { ascending: false });
    else if (opts.sort === 'active') q = q.order('last_activity_at', { ascending: false });
    else q = q.order('created_at', { ascending: false });

    var page = opts.page || 0, size = opts.size || 20;
    q = q.range(page * size, page * size + size - 1);

    var r = await q;
    if (r.error) { console.error('[forum] list', r.error); return { rows: [], count: 0 }; }
    return { rows: r.data || [], count: r.count || 0 };
  }

  async function getQuestion(slug) {
    var r = await sb.from('forum_question_list').select(FEED_COLS).eq('slug', slug).maybeSingle();
    if (r.error || !r.data) return null;
    var full = await sb.from('forum_questions').select('body,accepted_answer_id,author_id,updated_at').eq('id', r.data.id).maybeSingle();
    if (full.data) Object.assign(r.data, full.data);
    return r.data;
  }

  async function getAnswers(questionId) {
    var r = await sb.from('forum_answers')
      .select('id,body,vote_score,is_accepted,created_at,updated_at,author_id,forum_profiles(handle,display_name,avatar_url,reputation)')
      .eq('question_id', questionId).is('deleted_at', null)
      .order('is_accepted', { ascending: false })
      .order('vote_score', { ascending: false })
      .order('created_at', { ascending: true });
    if (r.error) { console.error('[forum] answers', r.error); return []; }
    return (r.data || []).map(function (a) {
      var p = a.forum_profiles || {};
      a.author_name = p.display_name; a.author_handle = p.handle;
      a.author_avatar = p.avatar_url; a.author_reputation = p.reputation;
      return a;
    });
  }

  async function loadMyVotes(questionId, answerIds) {
    state.myVotes = {};
    if (!state.user) return state.myVotes;
    var r = await sb.from('forum_votes').select('question_id,answer_id,value');
    if (r.error) return state.myVotes;
    (r.data || []).forEach(function (v) {
      state.myVotes[v.question_id ? 'q:' + v.question_id : 'a:' + v.answer_id] = v.value;
    });
    return state.myVotes;
  }

  function myVote(kind, id) { return state.myVotes[kind + ':' + id] || 0; }

  async function vote(kind, id, value) {
    if (!(await requireAuth('Sign in to vote'))) return null;
    var key = kind + ':' + id;
    var next = state.myVotes[key] === value ? 0 : value;
    var args = kind === 'q'
      ? { p_question: id, p_answer: null, p_value: next }
      : { p_question: null, p_answer: id, p_value: next };
    var r = await sb.rpc('forum_vote', args);
    if (r.error) { toast(friendlyError(r.error), 'error'); return null; }
    state.myVotes[key] = next;
    return { score: r.data, mine: next };
  }

  async function ask(title, body, tags) {
    var r = await sb.rpc('forum_ask', { p_title: title, p_body: body, p_tags: tags || [] });
    if (r.error) { toast(friendlyError(r.error), 'error'); return null; }
    return r.data;
  }

  async function answer(questionId, body) {
    if (!state.profile) await ensureProfile();
    var r = await sb.from('forum_answers')
      .insert({ question_id: questionId, body: body, author_id: state.user.id })
      .select('id').single();
    if (r.error) { toast(friendlyError(r.error), 'error'); return null; }
    return r.data;
  }

  async function acceptAnswer(answerId) {
    var r = await sb.rpc('forum_accept_answer', { p_answer: answerId });
    if (r.error) { toast(friendlyError(r.error), 'error'); return null; }
    return r.data;
  }

  async function flag(target, id, reason, note) {
    if (!(await requireAuth('Sign in to report a post'))) return false;
    var row = { reporter_id: state.user.id, reason: reason, note: note || null };
    row[target === 'q' ? 'question_id' : 'answer_id'] = id;
    var r = await sb.from('forum_flags').insert(row);
    if (r.error) { toast(friendlyError(r.error), 'error'); return false; }
    toast('Reported. A moderator will review it.');
    return true;
  }

  function bumpView(slug) {
    var key = 'mm_seen_' + slug;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (e) { /* private mode — count it anyway */ }
    sb.rpc('forum_view', { p_slug: slug });
  }

  /* -------------------------------------------------------------- exports */

  window.MMForum = {
    sb: sb,
    esc: esc, renderBody: renderBody, timeAgo: timeAgo, avatar: avatar, qs: qs,
    toast: toast, friendlyError: friendlyError,
    loadSession: loadSession, currentUser: currentUser, currentProfile: currentProfile,
    ensureProfile: ensureProfile, requireAuth: requireAuth, openSignIn: openSignIn,
    signOut: signOut, renderUserChip: renderUserChip,
    getTags: getTags, listQuestions: listQuestions, getQuestion: getQuestion,
    getAnswers: getAnswers, loadMyVotes: loadMyVotes, myVote: myVote,
    vote: vote, ask: ask, answer: answer, acceptAnswer: acceptAnswer, flag: flag,
    bumpView: bumpView
  };
})();
