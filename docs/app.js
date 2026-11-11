/**
 * AI Agent Arcade - Interactive Enhancements
 * - Accessible Tabs with hidden="until-found" & beforematch synchronization
 * - One-click Copy for AI Agent prompts, CLI commands, and share.txt
 * - Native <dialog closedby="any"> Lightbox for 1080x1350 Result Cards
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initTabs();
  initCopyButtons();
  initCardLightbox();
});

function initNavbar() {
  const toggleBtns = document.querySelectorAll('.menu-toggle-btn');

  toggleBtns.forEach((btn) => {
    const menuId = btn.getAttribute('aria-controls');
    const menu = menuId ? document.getElementById(menuId) : null;
    if (!menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      menu.classList.toggle('is-open', !isExpanded);
    });

    // メニュー内のリンクをクリックしたら自動で閉じる
    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        btn.setAttribute('aria-expanded', 'false');
        menu.classList.remove('is-open');
      });
    });
  });

  // メニュー外をクリックしたら閉じる（Light Dismiss）
  document.addEventListener('click', (e) => {
    toggleBtns.forEach((btn) => {
      const menuId = btn.getAttribute('aria-controls');
      const menu = menuId ? document.getElementById(menuId) : null;
      if (menu && menu.classList.contains('is-open')) {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
          btn.setAttribute('aria-expanded', 'false');
          menu.classList.remove('is-open');
        }
      }
    });
  });

  // Escキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleBtns.forEach((btn) => {
        const menuId = btn.getAttribute('aria-controls');
        const menu = menuId ? document.getElementById(menuId) : null;
        if (menu && menu.classList.contains('is-open')) {
          btn.setAttribute('aria-expanded', 'false');
          menu.classList.remove('is-open');
          btn.focus();
        }
      });
    }
  });
}

function initTabs() {
  const tabGroups = document.querySelectorAll('[data-tabs]');

  tabGroups.forEach((group) => {
    const tablist = group.querySelector('[role="tablist"]');
    const tabs = Array.from(group.querySelectorAll('[role="tab"]'));
    const panels = Array.from(group.querySelectorAll('[role="tabpanel"]'));

    if (!tablist || tabs.length === 0 || panels.length === 0) return;

    function selectTab(targetTab, moveFocus = false) {
      tabs.forEach((tab, index) => {
        const isSelected = tab === targetTab;
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        tab.setAttribute('tabindex', isSelected ? '0' : '-1');
        tab.toggleAttribute('focusgroupstart', isSelected);

        const panel = panels[index];
        if (panel) {
          if (isSelected) {
            panel.removeAttribute('hidden');
            panel.setAttribute('tabindex', '0');
          } else {
            panel.setAttribute('hidden', 'until-found');
            panel.removeAttribute('tabindex');
          }
        }
      });

      if (moveFocus) {
        targetTab.focus();
      }
      if (typeof targetTab.scrollIntoView === 'function') {
        targetTab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        selectTab(tab, false);
      });
    });

    // Keyboard navigation fallback (Left/Right/Home/End) with selection follows focus
    tablist.addEventListener('keydown', (e) => {
      const currentIndex = tabs.indexOf(document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = -1;
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== -1) {
        e.preventDefault();
        selectTab(tabs[nextIndex], true);
      }
    });

    // Sync tab state when browser Find-in-Page reveals a hidden="until-found" panel
    panels.forEach((panel, index) => {
      panel.addEventListener('beforematch', () => {
        if (tabs[index]) {
          selectTab(tabs[index], false);
        }
      });
    });
  });
}

function initCopyButtons() {
  const buttons = document.querySelectorAll('[data-copy-target]');
  const resetTimers = new WeakMap();

  function showFeedback(btn, labelText) {
    const labelEl = btn.querySelector('[data-copy-label]');
    if (labelEl) {
      if (!btn.dataset.originalLabel) {
        btn.dataset.originalLabel = labelEl.textContent || '';
      }
      labelEl.textContent = labelText;
    }
    btn.classList.add('copied');

    const prevTimer = resetTimers.get(btn);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    const timer = setTimeout(() => {
      if (labelEl && btn.dataset.originalLabel) {
        labelEl.textContent = btn.dataset.originalLabel;
      }
      btn.classList.remove('copied');
      resetTimers.delete(btn);
    }, 2000);

    resetTimers.set(btn, timer);
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-target');
      const targetEl = targetId ? document.getElementById(targetId) : null;
      if (!targetEl) return;

      const text = targetEl.textContent ? targetEl.textContent.trim() : '';
      try {
        await navigator.clipboard.writeText(text);
        showFeedback(btn, 'コピーしました！');
      } catch {
        // Fallback selection
        const range = document.createRange();
        range.selectNodeContents(targetEl);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        showFeedback(btn, '選択しました (Ctrl+C)');
      }
    });
  });
}

function initCardLightbox() {
  const dialog = document.getElementById('card-lightbox');
  if (!(dialog instanceof HTMLDialogElement)) return;

  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const triggers = document.querySelectorAll('[data-lightbox-src]');

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const src = trigger.getAttribute('data-lightbox-src');
      const alt = trigger.getAttribute('alt') || 'リザルトカード拡大表示';
      const name = trigger.getAttribute('data-lightbox-name');
      const outcome = trigger.getAttribute('data-lightbox-outcome');
      const omamori = trigger.getAttribute('data-lightbox-omamori');

      if (lightboxImg instanceof HTMLImageElement && src) {
        lightboxImg.src = src;
        lightboxImg.alt = alt;
      }
      if (lightboxTitle) {
        if (name && outcome && omamori) {
          lightboxTitle.replaceChildren();
          const nameSpan = document.createElement('span');
          nameSpan.className = 'title-phrase';
          nameSpan.textContent = `${name}　`;

          const detailSpan = document.createElement('span');
          detailSpan.className = 'title-phrase';
          detailSpan.style.fontWeight = '500';
          detailSpan.style.color = 'var(--text-secondary)';
          detailSpan.textContent = `（${outcome} ／ `;

          const omamoriSpan = document.createElement('span');
          omamoriSpan.className = 'title-phrase';
          omamoriSpan.textContent = `${omamori}）`;
          detailSpan.appendChild(omamoriSpan);

          lightboxTitle.append(nameSpan, detailSpan);
        } else {
          lightboxTitle.textContent = alt;
        }
      }
      dialog.showModal();
    });
  });

  // Fallback light-dismiss for browsers where closedby="any" is not yet active
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.close();
    }
  });

  if (window.location.search.includes('lightbox=1') && triggers[0]) {
    triggers[0].dispatchEvent(new Event('click'));
  }
}
