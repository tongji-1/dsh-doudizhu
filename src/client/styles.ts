/** All plugin CSS, injected once into `document.head` by the client half. */

export const STYLES = String.raw`
[data-ddz-nav-entry] {
  position: relative; min-height: 28px; padding: 3px 9px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  color: var(--dsw-alias-label-secondary); background: transparent; cursor: pointer;
  font: 500 12px/18px var(--dsw-font-family);
  transition: background var(--ds-transition-duration-fast), border-color var(--ds-transition-duration-fast), color var(--ds-transition-duration-fast);
}
[data-ddz-nav-entry]:hover {
  border-color: var(--dsw-alias-border-l1); background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary);
}
.ddz-entry-icon { width: 18px; height: 18px; position: relative; flex: 0 0 auto; }
.ddz-entry-card {
  position: absolute; width: 10px; height: 14px; border: 1.5px solid currentColor; border-radius: 2.5px;
  background: var(--dsw-alias-bg-layer-1);
}
.ddz-entry-card:first-child { transform: rotate(-12deg); left: 1px; top: 2px; }
.ddz-entry-card:last-child { transform: rotate(10deg); right: 1px; top: 1px; }
.ddz-entry-pip {
  position: absolute; z-index: 1; left: 5px; top: 3px; font-size: 8px; font-weight: 700;
  color: var(--dsw-alias-state-error-secondary);
}
.ddz-entry-copy { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ddz-entry-dot {
  flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%;
  background: var(--dsw-alias-state-error-secondary); animation: ddz-pulse 1.5s infinite;
}
@keyframes ddz-pulse { 50% { opacity: .35; } }

.ddz-window, .ddz-pill {
  position: fixed; z-index: 40; pointer-events: auto;
  color: var(--dsw-alias-label-primary); font-family: var(--dsw-font-family);
  --ddz-solid-surface: var(--dsw-alias-bg-overlay, #fff);
}
.ddz-window {
  display: flex; flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; overflow: hidden;
  background: var(--ddz-solid-surface); box-shadow: 0 18px 48px rgba(20, 30, 55, .28);
}
.ddz-window > * { flex: 0 0 auto; }
body[data-ds-dark-theme] .ddz-window { box-shadow: 0 18px 48px rgba(0, 0, 0, .55); }

.ddz-titlebar {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; height: 40px;
  padding: 0 8px 0 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); cursor: grab; touch-action: none; user-select: none;
}
.ddz-titlebar:active { cursor: grabbing; }
.ddz-title { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 12px; }
.ddz-title span { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; }
.ddz-title-actions { display: flex; align-items: center; gap: 3px; }
.ddz-agent {
  display: flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 11px;
  color: var(--dsw-alias-label-tertiary); font-size: 10px; white-space: nowrap;
}
.ddz-agent i { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-caption); }
.ddz-agent[data-running="true"] {
  color: var(--dsw-alias-label-primary-bluish); background: var(--dsw-alias-state-business-tertiary);
}
.ddz-agent[data-running="true"] i { background: var(--dsw-alias-state-business-primary); animation: ddz-pulse 1.4s infinite; }
.ddz-ghost {
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: 7px; cursor: pointer;
  color: var(--dsw-alias-label-secondary); background: transparent; font: 500 14px/1 var(--dsw-font-family);
}
.ddz-ghost:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.ddz-ghost[data-active="true"] {
  color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-state-business-tertiary);
}

.ddz-settings {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.ddz-switch { display: flex; align-items: center; gap: 9px; cursor: pointer; }
.ddz-switch input { width: 15px; height: 15px; accent-color: var(--dsw-alias-state-business-primary); }
.ddz-switch span { display: grid; gap: 2px; }
.ddz-switch strong { font-size: 12px; font-weight: 500; }
.ddz-switch em { color: var(--dsw-alias-label-tertiary); font-size: 10.5px; font-style: normal; }

.ddz-work-reminder {
  min-height: 34px; display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 7px;
  padding: 4px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-state-business-tertiary); font-size: 10.5px;
}
.ddz-work-reminder > strong { color: var(--dsw-alias-label-primary); font-size: 11px; white-space: nowrap; }
.ddz-work-indicator { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-business-primary); }
.ddz-work-reminder[data-kind="running"] .ddz-work-indicator { animation: ddz-pulse 1.4s infinite; }
.ddz-work-reminder:is([data-kind="approval"], [data-kind="plan-review"], [data-kind="question"]) {
  color: var(--dsw-alias-label-primary); background: color-mix(in srgb, #e8b34c 18%, var(--ddz-solid-surface));
}
.ddz-work-reminder:is([data-kind="approval"], [data-kind="plan-review"], [data-kind="question"]) .ddz-work-indicator {
  background: #c48719; animation: ddz-pulse 1s infinite;
}
.ddz-work-reminder[data-kind="completed"] { background: color-mix(in srgb, #4a9c72 16%, var(--ddz-solid-surface)); }
.ddz-work-reminder[data-kind="completed"] .ddz-work-indicator { background: #3e8b65; }
.ddz-work-message { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ddz-work-reminder > button {
  height: 24px; padding: 0 9px; border: 1px solid currentColor; border-radius: 7px; cursor: pointer;
  color: var(--dsw-alias-label-primary-bluish); background: var(--dsw-alias-bg-base); font: 500 10.5px/1 var(--dsw-font-family);
}
.ddz-work-reminder > button:hover { background: var(--dsw-alias-interactive-bg-hover); }

.ddz-bots { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px 14px 4px; }
.ddz-bot {
  position: relative; display: grid; gap: 7px; padding: 9px 10px; border-radius: 11px;
  border: 1px solid transparent; background: var(--dsw-alias-bg-layer-1);
  transition: border-color var(--ds-transition-duration-fast);
}
.ddz-bot[data-acting="true"] { border-color: var(--dsw-alias-state-business-primary); }
.ddz-bot[data-side="right"] { justify-items: end; text-align: right; }
.ddz-bot-head { display: flex; align-items: center; gap: 8px; width: 100%; }
.ddz-bot[data-side="right"] .ddz-bot-head { flex-direction: row-reverse; }
.ddz-avatar {
  width: 26px; height: 26px; flex: 0 0 auto; border-radius: 50%; display: grid; place-items: center;
  color: var(--dsw-alias-label-primary-foreground); background: var(--dsw-alias-label-caption);
  font: 600 11px/1 var(--dsw-font-family);
}
.ddz-avatar[data-landlord="true"] { background: var(--dsw-alias-state-error-secondary); }
.ddz-bot-meta { display: grid; gap: 1px; min-width: 0; flex: 1 1 auto; }
.ddz-bot-meta strong { font-size: 12px; font-weight: 500; }
.ddz-bot-meta span { color: var(--dsw-alias-label-tertiary); font-size: 10.5px; }
.ddz-bot-tokens { color: var(--dsw-alias-label-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ddz-bot-play { min-height: 46px; display: flex; align-items: center; }
.ddz-bot[data-side="right"] .ddz-bot-play { justify-content: flex-end; }
.ddz-bot-character {
  position: absolute; z-index: 0; top: 3px; width: auto; height: 180px; max-width: 34%;
  object-fit: contain; object-position: center top; pointer-events: none; user-select: none;
  filter: drop-shadow(0 7px 8px rgba(23, 40, 83, .16));
}
.ddz-bot[data-side="left"] .ddz-bot-character { left: 12px; }
.ddz-bot[data-side="right"] .ddz-bot-character { right: 12px; }
.ddz-bot[data-character="true"] { min-height: 126px; overflow: hidden; }
.ddz-bot[data-character="true"] > :not(.ddz-bot-character, .ddz-talk) { position: relative; z-index: 1; }
.ddz-bot[data-character="true"] > .ddz-talk { position: absolute; z-index: 2; top: 48px; max-width: calc(100% - 130px); }
.ddz-bot[data-character="true"][data-side="left"] > .ddz-talk { left: auto; right: 12px; }
.ddz-bot[data-character="true"][data-side="right"] > .ddz-talk { left: 12px; right: auto; }
.ddz-bot[data-character="true"] :is(.ddz-bot-head, .ddz-bot-play, .ddz-thinking) { box-sizing: border-box; }
.ddz-bot[data-character="true"][data-side="left"] :is(.ddz-bot-head, .ddz-bot-play, .ddz-thinking) {
  padding-left: 102px;
}
.ddz-bot[data-character="true"][data-side="right"] :is(.ddz-bot-head, .ddz-bot-play, .ddz-thinking) {
  padding-right: 102px;
}
.ddz-bot[data-character="true"][data-side="left"] .ddz-bot-play { justify-content: flex-end; }
.ddz-bot[data-character="true"][data-side="right"] .ddz-bot-play { justify-content: flex-start; }
.ddz-play-row { display: flex; }
.ddz-play-row .ddz-card { margin-right: -14px; }
.ddz-play-row .ddz-card:last-child { margin-right: 0; }
.ddz-play-empty { display: block; height: 44px; }
.ddz-pass-chip {
  padding: 3px 9px; border-radius: 9px; color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-interactive-bg-hover); font-size: 11px;
}
.ddz-thinking { display: flex; align-items: center; gap: 5px; color: var(--dsw-alias-label-tertiary); font-size: 10.5px; }
.ddz-thinking i {
  width: 4px; height: 4px; border-radius: 50%; background: var(--dsw-alias-state-business-primary);
  animation: ddz-bounce 1s infinite;
}
.ddz-thinking i:nth-child(2) { animation-delay: .15s; }
.ddz-thinking i:nth-child(3) { animation-delay: .3s; }
@keyframes ddz-bounce { 50% { opacity: .25; transform: translateY(-2px); } }
.ddz-talk {
  position: absolute; z-index: 2; top: -8px; right: 10px; width: max-content; max-width: 70%; padding: 4px 9px; border-radius: 10px;
  color: var(--dsw-alias-label-primary-foreground); background: var(--dsw-alias-button-primary-fill);
  font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.ddz-center {
  flex: 1 1 auto; min-height: 0; display: grid; gap: 8px; align-content: center; justify-items: center;
  padding: 6px 14px;
}
.ddz-center[data-result="true"] { align-content: stretch; padding: 18px 24px; overflow: auto; }
.ddz-bottom-cards { display: flex; align-items: center; gap: 4px; }
.ddz-label { margin-right: 4px; color: var(--dsw-alias-label-tertiary); font-size: 10.5px; }
.ddz-meta { display: flex; align-items: center; gap: 14px; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.ddz-meta strong { color: var(--dsw-alias-label-primary); font-weight: 600; }
.ddz-source { padding: 2px 8px; border-radius: 9px; background: var(--dsw-alias-interactive-bg-hover); }
.ddz-source[data-source="model"] {
  color: var(--dsw-alias-label-primary-bluish); background: var(--dsw-alias-state-business-tertiary);
}
.ddz-log {
  margin: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-secondary); font-size: 11.5px;
}
.ddz-settlement {
  box-sizing: border-box; align-self: center; width: min(560px, 100%); max-height: 100%; margin: auto;
  display: grid; gap: 9px; padding: 16px 18px; overflow: auto; border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); font-size: 12px;
  box-shadow: 0 8px 24px rgba(20, 30, 55, .08);
}
.ddz-settlement > strong { font-size: 16px; line-height: 22px; text-align: center; }
.ddz-settlement > span { color: var(--dsw-alias-label-secondary); }
.ddz-settlement-result { line-height: 18px; text-align: center; }
.ddz-settlement-payment {
  justify-self: center; display: inline-flex; align-items: center; gap: 9px; padding: 6px 12px;
  border-radius: 10px; background: var(--dsw-alias-interactive-bg-hover); font-variant-numeric: tabular-nums;
}
.ddz-settlement-payment i { color: var(--dsw-alias-label-caption); font-style: normal; }
.ddz-settlement-bankrupt { text-align: center; color: var(--dsw-alias-state-error-secondary) !important; }
.ddz-settlement[data-match-over="true"] { border-color: var(--dsw-alias-state-error-secondary); }
.ddz-settlement ol {
  list-style: none; display: grid; gap: 5px; margin: 2px 0 0; padding: 9px 0 0;
  border-top: 1px solid var(--dsw-alias-border-l2);
}
.ddz-settlement li {
  min-height: 32px; display: grid; grid-template-columns: 24px 1fr auto; gap: 9px; align-items: center;
  padding: 0 9px; border-radius: 8px; background: var(--dsw-alias-bg-base);
}
.ddz-settlement li b {
  display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  color: var(--dsw-alias-label-caption); background: var(--dsw-alias-interactive-bg-hover); font-size: 10px;
}
.ddz-settlement li:first-child b { color: var(--dsw-alias-label-primary); }
.ddz-settlement li em { color: var(--dsw-alias-label-secondary); font-style: normal; font-variant-numeric: tabular-nums; }
.ddz-settlement li[data-bankrupt="true"] { opacity: .58; }

.ddz-hero { display: grid; gap: 6px; padding: 4px 14px 0; }
.ddz-hero-head { position: relative; display: flex; align-items: center; gap: 8px; font-size: 12px; }
.ddz-hero-head strong { font-weight: 500; }
.ddz-hero-copy { display: grid; gap: 1px; }
.ddz-hero-copy > span { color: var(--dsw-alias-label-tertiary); font-size: 10.5px; }
.ddz-hero-tokens { margin-left: auto; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.ddz-combo {
  padding: 2px 8px; border-radius: 9px; font-size: 11px;
  color: var(--dsw-alias-label-primary-bluish); background: var(--dsw-alias-state-business-tertiary);
}
.ddz-talk-trigger {
  width: 28px; height: 26px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-base); cursor: pointer;
}
.ddz-talk-menu {
  position: absolute; z-index: 50; right: 0; bottom: 32px; width: 210px; padding: 7px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 5px; border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; background: var(--ddz-solid-surface); box-shadow: 0 10px 28px rgba(20, 30, 55, .22);
}
.ddz-talk-menu button {
  min-height: 28px; padding: 4px 7px; border: 0; border-radius: 7px; cursor: pointer;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); font: 500 11px/1.2 var(--dsw-font-family);
}
.ddz-talk-menu button:hover { color: var(--dsw-alias-label-primary-bluish); }
.ddz-hero-talk {
  position: absolute; z-index: 4; left: 36px; bottom: 31px; max-width: 55%; padding: 5px 9px; border-radius: 10px 10px 10px 2px;
  color: var(--dsw-alias-label-primary-foreground); background: var(--dsw-alias-button-primary-fill); box-shadow: 0 4px 12px rgba(20, 30, 55, .18);
}
.ddz-selection-status { min-height: 15px; color: var(--dsw-alias-state-error-secondary); font-size: 10.5px; text-align: center; }
.ddz-selection-status[data-valid="true"] { color: var(--dsw-alias-label-primary-bluish); }
.ddz-hand {
  display: flex; align-items: flex-end; justify-content: center; min-height: 78px;
  padding-top: 12px; overflow-x: auto; overflow-y: hidden; touch-action: none; user-select: none;
}
.ddz-hand .ddz-card { margin-right: -20px; }
.ddz-hand .ddz-card:last-child { margin-right: 0; }
.ddz-hand[data-count="17"] .ddz-card, .ddz-hand[data-count="20"] .ddz-card { margin-right: -24px; }

.ddz-card {
  position: relative; flex: 0 0 auto; width: 42px; height: 58px; padding: 3px 0 0 4px;
  display: grid; align-content: start; justify-items: start; gap: 0;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family); text-align: left; cursor: default;
  transition: transform var(--ds-transition-duration-fast), border-color var(--ds-transition-duration-fast);
}
button.ddz-card { cursor: pointer; }
button.ddz-card:hover { z-index: 10; transform: translateY(-5px); }
.ddz-card[data-red="true"] { color: var(--dsw-alias-state-error-secondary); }
.ddz-card[data-selected="true"] {
  z-index: 20; transform: translateY(-14px); border-color: var(--dsw-alias-state-business-primary);
  box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary);
}
.ddz-card-rank { font-size: 15px; font-weight: 600; line-height: 1.05; }
.ddz-card-suit { font-size: 12px; line-height: 1; }
.ddz-card-back {
  display: grid; place-items: center; padding: 0;
  color: var(--dsw-alias-label-caption); background: var(--dsw-alias-interactive-bg-hover);
}
.ddz-bot-play .ddz-card, .ddz-bottom-cards .ddz-card { width: 32px; height: 44px; }
.ddz-bot-play .ddz-card-rank, .ddz-bottom-cards .ddz-card-rank { font-size: 12px; }
.ddz-bot-play .ddz-card-suit, .ddz-bottom-cards .ddz-card-suit { font-size: 9px; }

.ddz-controls {
  min-height: 52px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px;
  padding: 0 14px; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
}
.ddz-action {
  height: 30px; min-width: 68px; padding: 0 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary); font: 500 12px/1 var(--dsw-font-family);
}
.ddz-action:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.ddz-action:disabled { opacity: .42; cursor: not-allowed; }
.ddz-action[data-primary="true"] {
  border-color: transparent; color: var(--dsw-alias-label-primary-foreground);
  background: var(--dsw-alias-button-primary-fill);
}
.ddz-waiting { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.ddz-hints { display: flex; align-items: center; gap: 3px; }
.ddz-hints .ddz-action { min-width: 72px; padding-inline: 9px; }
.ddz-hints .ddz-hint-arrow { min-width: 30px; width: 30px; padding: 0; font-size: 18px; }
.ddz-robbar { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.ddz-robbar strong { font-weight: 500; }
.ddz-rob-options { display: flex; gap: 6px; }
.ddz-rob-options .ddz-action { min-width: 72px; padding: 0 12px; }

.ddz-resize {
  position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
  touch-action: none;
  background: linear-gradient(135deg, transparent 50%, var(--dsw-alias-border-l1) 50%);
}

.ddz-pill {
  right: 24px; bottom: 24px; display: flex; align-items: center; gap: 2px; padding: 4px 4px 4px 6px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 22px;
  background: var(--dsw-alias-bg-layer-1); box-shadow: 0 8px 24px rgba(20, 30, 55, .22);
}
.ddz-pill[data-waiting="true"] { border-color: var(--dsw-alias-state-error-secondary); }
.ddz-pill-main {
  display: flex; align-items: center; gap: 7px; height: 30px; padding: 0 8px; border: 0; border-radius: 18px;
  background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer;
  font: 500 12px/1 var(--dsw-font-family);
}
.ddz-pill-main em { color: var(--dsw-alias-label-tertiary); font-style: normal; font-size: 11px; }
.ddz-pill-main:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ddz-pill-close {
  width: 26px; height: 26px; border: 0; border-radius: 50%; cursor: pointer;
  color: var(--dsw-alias-label-secondary); background: transparent; font: 500 14px/1 var(--dsw-font-family);
}
.ddz-pill-close:hover { background: var(--dsw-alias-interactive-bg-hover); }

/* Abyssal Maid Atelier integration. The skin intentionally makes bg-base
   transparent so its palace can show through the application. A game table is
   a foreground surface, however: give it its own opaque porcelain/navy palette
   and echo the skin's gold, ribbon and lace language without owning its art. */
body[data-dsh-maid-atelier] [data-ddz-nav-entry] {
  min-height: 28px; padding: 3px 10px;
  border: 1px solid rgba(226, 199, 139, .58); border-radius: 8px;
  color: #f8f3e8;
  background:
    linear-gradient(90deg, rgba(111, 135, 196, .22), rgba(41, 63, 126, .34) 48%, rgba(15, 34, 79, .34)),
    rgba(16, 32, 77, .68);
  box-shadow:
    inset 0 0 0 1px rgba(255, 251, 236, .06), 0 2px 8px rgba(2, 8, 29, .16);
  font-family: "Noto Serif SC", "Songti SC", STSong, serif;
}
body[data-dsh-maid-atelier] [data-ddz-nav-entry]:hover {
  color: #fffaf0;
  border-color: rgba(235, 204, 143, .86);
  background:
    linear-gradient(90deg, rgba(139, 162, 219, .34), rgba(62, 84, 150, .5) 48%, rgba(21, 43, 94, .5)),
    rgba(22, 43, 98, .82);
}
body[data-dsh-maid-atelier] [data-ddz-nav-entry] .ddz-entry-card {
  border-color: #ead29c; background: #f8f3e8;
}
body[data-dsh-maid-atelier] [data-ddz-nav-entry] .ddz-entry-pip { color: #30477f; }
body[data-dsh-maid-atelier] [data-ddz-nav-entry] .ddz-entry-dot {
  background: #e5c277; box-shadow: 0 0 0 2px rgba(229, 194, 119, .18);
}

body[data-dsh-maid-atelier] .ddz-window,
body[data-dsh-maid-atelier] .ddz-pill {
  --ddz-navy: #0b173b;
  --ddz-navy-soft: #1b326c;
  --ddz-indigo: #526aa8;
  --ddz-periwinkle: #8ea5da;
  --ddz-gold: #c5a468;
  --ddz-gold-bright: #e4c888;
  --ddz-gold-line: rgba(197, 164, 104, .74);
  --ddz-porcelain: #f8f6f0;
  --ddz-lace: #fffdf7;
  --ddz-surface: #f1f3f8;
  --ddz-panel: #fbfaf6;
  --ddz-panel-soft: #e9edf6;
  --ddz-card-surface: #fffdf8;
  --ddz-text: #172347;
  --ddz-muted: #687796;
  color: var(--ddz-text);
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-window,
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-pill {
  --ddz-navy: #07102b;
  --ddz-navy-soft: #14295c;
  --ddz-gold-line: rgba(220, 188, 124, .78);
  --ddz-surface: #101d43;
  --ddz-panel: #172957;
  --ddz-panel-soft: #203665;
  --ddz-text: #edf1fb;
  --ddz-muted: #a9b6d2;
}

body[data-dsh-maid-atelier] .ddz-window {
  isolation: isolate;
  border: 2px solid var(--ddz-gold); border-radius: 18px;
  background:
    radial-gradient(circle at 50% 0, rgba(142, 165, 218, .22), transparent 42%),
    linear-gradient(180deg, var(--ddz-panel) 0, var(--ddz-surface) 100%);
  box-shadow:
    0 24px 64px rgba(8, 20, 55, .34),
    0 3px 12px rgba(8, 20, 55, .2),
    inset 0 0 0 1px rgba(255, 252, 238, .88),
    inset 0 0 0 4px rgba(197, 164, 104, .22);
}
body[data-dsh-maid-atelier] .ddz-window::before {
  content: ''; position: absolute; z-index: 20; inset: 5px; pointer-events: none;
  border: 1px solid var(--ddz-gold-line); border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .42);
}

body[data-dsh-maid-atelier] .ddz-titlebar {
  position: relative; z-index: 2; height: 46px; padding: 0 11px 0 17px;
  border-bottom: 2px solid var(--ddz-gold);
  color: #f8f3e8;
  background:
    radial-gradient(ellipse at 50% -20%, rgba(104, 132, 199, .52), transparent 48%),
    linear-gradient(180deg, #172b61, var(--ddz-navy));
  box-shadow:
    inset 0 1px rgba(255, 255, 255, .13),
    inset 0 -1px rgba(5, 11, 35, .7),
    0 4px 14px rgba(16, 32, 77, .16);
}
body[data-dsh-maid-atelier] .ddz-titlebar::before {
  content: ''; position: absolute; left: 50%; top: -1px; width: 76px; height: 36px;
  transform: translateX(-50%); pointer-events: none;
  background: var(--maid-bow-art, none) center / contain no-repeat;
  filter: drop-shadow(0 3px 6px rgba(4, 11, 35, .3));
}
body[data-dsh-maid-atelier] .ddz-titlebar::after {
  content: ''; position: absolute; left: 16px; right: 16px; bottom: -8px; height: 7px;
  pointer-events: none; opacity: .82;
  background:
    radial-gradient(circle at 50% -1px, var(--ddz-lace) 0 3px, transparent 3.5px) 0 0 / 14px 7px repeat-x;
  filter: drop-shadow(0 1px 0 rgba(197, 164, 104, .68));
}
body[data-dsh-maid-atelier] .ddz-title {
  font-family: "Noto Serif SC", "Songti SC", STSong, serif;
  letter-spacing: .04em;
}
body[data-dsh-maid-atelier] .ddz-title strong { font-size: 13px; font-weight: 600; }
body[data-dsh-maid-atelier] .ddz-title span,
body[data-dsh-maid-atelier] .ddz-agent { color: #b9c5e1; }
body[data-dsh-maid-atelier] .ddz-agent[data-running="true"] {
  color: #fff4d8; background: rgba(197, 164, 104, .2);
  box-shadow: inset 0 0 0 1px rgba(229, 197, 132, .24);
}
body[data-dsh-maid-atelier] .ddz-agent i { background: #8292b6; }
body[data-dsh-maid-atelier] .ddz-agent[data-running="true"] i { background: #e5c277; }
body[data-dsh-maid-atelier] .ddz-ghost { color: #c7d1e7; }
body[data-dsh-maid-atelier] .ddz-ghost:hover,
body[data-dsh-maid-atelier] .ddz-ghost[data-active="true"] {
  color: #fff8e8; background: rgba(255, 250, 236, .12);
}

body[data-dsh-maid-atelier] .ddz-settings {
  padding-top: 14px; border-bottom-color: var(--ddz-gold-line);
  background: var(--ddz-panel);
  box-shadow: inset 0 -8px 18px rgba(67, 88, 140, .06);
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-settings {
  background: var(--ddz-panel);
}
body[data-dsh-maid-atelier] .ddz-switch input { accent-color: var(--ddz-indigo); }
body[data-dsh-maid-atelier] .ddz-work-reminder {
  margin: 8px 16px 0; min-height: 32px; border: 1px solid rgba(197, 164, 104, .5); border-radius: 10px;
  color: var(--ddz-muted); background: linear-gradient(90deg, rgba(226, 232, 247, .9), rgba(249, 247, 240, .94));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .58), 0 3px 10px rgba(24, 45, 91, .07);
}
body[data-dsh-maid-atelier] .ddz-work-reminder > strong { color: var(--ddz-text); }
body[data-dsh-maid-atelier] .ddz-work-reminder > button {
  color: var(--ddz-navy-soft); border-color: var(--ddz-gold-line); background: rgba(255, 252, 242, .86);
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-work-reminder {
  color: var(--ddz-muted); background: linear-gradient(90deg, rgba(39, 59, 111, .96), rgba(20, 35, 76, .96));
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-work-reminder > button { color: #f2ddb0; background: rgba(17, 31, 69, .86); }

body[data-dsh-maid-atelier] .ddz-bots { gap: 12px; padding: 18px 16px 6px; }
body[data-dsh-maid-atelier] .ddz-bot {
  padding: 10px 12px; border: 1px solid var(--ddz-gold-line); border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, .62), rgba(225, 231, 246, .36)),
    var(--ddz-panel);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, .54),
    0 5px 13px rgba(24, 45, 91, .08);
}
body[data-dsh-maid-atelier]:has(.ddz-window .ddz-bot-character) [data-skin-chrome="character-stage"] {
  opacity: .16; transition: opacity 240ms ease;
}
body[data-dsh-maid-atelier] .ddz-bot-character {
  filter:
    saturate(1.02)
    brightness(1.03)
    drop-shadow(0 7px 9px rgba(17, 35, 79, .2));
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-bot-character {
  filter:
    brightness(.86)
    saturate(.94)
    drop-shadow(0 8px 11px rgba(0, 0, 0, .32));
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-bot {
  background: linear-gradient(135deg, rgba(50, 72, 126, .48), rgba(17, 31, 69, .72)), var(--ddz-panel);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .05), 0 5px 13px rgba(0, 0, 0, .16);
}
body[data-dsh-maid-atelier] .ddz-bot[data-acting="true"] {
  border-color: var(--ddz-gold-bright);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, .58),
    0 0 0 2px rgba(197, 164, 104, .18),
    0 6px 16px rgba(24, 45, 91, .12);
}
body[data-dsh-maid-atelier] .ddz-avatar {
  color: #fff8e8; border: 1px solid var(--ddz-gold-bright);
  background: linear-gradient(145deg, var(--ddz-indigo), var(--ddz-navy-soft));
  box-shadow: 0 2px 6px rgba(14, 29, 69, .22);
}
body[data-dsh-maid-atelier] .ddz-avatar[data-landlord="true"] {
  color: #2a2140; background: linear-gradient(145deg, #f0d397, var(--ddz-gold));
}
body[data-dsh-maid-atelier] .ddz-bot-meta span,
body[data-dsh-maid-atelier] .ddz-bot-tokens,
body[data-dsh-maid-atelier] .ddz-thinking { color: var(--ddz-muted); }
body[data-dsh-maid-atelier] .ddz-thinking i { background: var(--ddz-gold); }
body[data-dsh-maid-atelier] .ddz-pass-chip {
  color: var(--ddz-muted); background: rgba(82, 106, 168, .1);
  box-shadow: inset 0 0 0 1px rgba(82, 106, 168, .12);
}
body[data-dsh-maid-atelier] .ddz-talk {
  color: #fff8e8; border: 1px solid var(--ddz-gold-bright);
  background: linear-gradient(135deg, var(--ddz-indigo), var(--ddz-navy-soft));
  box-shadow: 0 4px 12px rgba(12, 27, 66, .2);
}

body[data-dsh-maid-atelier] .ddz-center {
  margin: 6px 16px 0; padding: 12px 16px; border: 1px solid rgba(197, 164, 104, .46);
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 20%, rgba(255, 255, 255, .76), transparent 42%),
    linear-gradient(180deg, rgba(224, 231, 246, .78), rgba(248, 246, 240, .9));
  box-shadow:
    inset 0 0 22px rgba(82, 106, 168, .08),
    inset 0 0 0 1px rgba(255, 255, 255, .62);
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-center {
  background:
    radial-gradient(circle at 50% 20%, rgba(93, 119, 181, .22), transparent 45%),
    linear-gradient(180deg, rgba(31, 51, 103, .94), rgba(17, 31, 69, .96));
}
body[data-dsh-maid-atelier] .ddz-label,
body[data-dsh-maid-atelier] .ddz-meta,
body[data-dsh-maid-atelier] .ddz-log { color: var(--ddz-muted); }
body[data-dsh-maid-atelier] .ddz-meta strong { color: var(--ddz-text); }
body[data-dsh-maid-atelier] .ddz-settlement {
  border-color: rgba(197, 164, 104, .5); color: var(--ddz-text); background: var(--ddz-panel);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .5);
}
body[data-dsh-maid-atelier] .ddz-settlement[data-match-over="true"] { border-color: var(--ddz-gold-bright); }
body[data-dsh-maid-atelier] .ddz-settlement > span,
body[data-dsh-maid-atelier] .ddz-settlement li em { color: var(--ddz-muted); }
body[data-dsh-maid-atelier] .ddz-source {
  color: var(--ddz-muted); background: rgba(82, 106, 168, .1);
}
body[data-dsh-maid-atelier] .ddz-source[data-source="model"],
body[data-dsh-maid-atelier] .ddz-combo {
  color: var(--ddz-navy-soft); background: rgba(197, 164, 104, .2);
  box-shadow: inset 0 0 0 1px rgba(197, 164, 104, .22);
}
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-source[data-source="model"],
body[data-dsh-maid-atelier][data-ds-dark-theme] .ddz-combo { color: #f2ddb0; }

body[data-dsh-maid-atelier] .ddz-hero {
  margin: 8px 16px 0; padding: 9px 12px 2px; border: 1px solid rgba(197, 164, 104, .38);
  border-bottom: 0; border-radius: 13px 13px 0 0;
  background: var(--ddz-panel);
  box-shadow: inset 0 6px 18px rgba(82, 106, 168, .05);
}
body[data-dsh-maid-atelier] .ddz-hero-head strong {
  font-family: "Noto Serif SC", "Songti SC", STSong, serif;
}
body[data-dsh-maid-atelier] .ddz-hero-copy > span { color: var(--ddz-muted); }
body[data-dsh-maid-atelier] .ddz-hero-tokens { color: var(--ddz-muted); }
body[data-dsh-maid-atelier] .ddz-talk-trigger,
body[data-dsh-maid-atelier] .ddz-talk-menu {
  border-color: rgba(197, 164, 104, .52); color: var(--ddz-text); background: var(--ddz-panel);
}
body[data-dsh-maid-atelier] .ddz-talk-menu button { color: var(--ddz-text); background: rgba(82, 106, 168, .1); }
body[data-dsh-maid-atelier] .ddz-hero-talk {
  color: #fff8e8; border: 1px solid var(--ddz-gold-bright); background: linear-gradient(135deg, var(--ddz-indigo), var(--ddz-navy-soft));
}
body[data-dsh-maid-atelier] .ddz-selection-status[data-valid="true"] { color: var(--ddz-navy-soft); }

body[data-dsh-maid-atelier] .ddz-card {
  border-color: rgba(94, 112, 157, .42);
  color: #172347; background: var(--ddz-card-surface);
  box-shadow:
    0 2px 5px rgba(17, 35, 79, .12),
    inset 0 0 0 1px rgba(255, 255, 255, .72);
}
body[data-dsh-maid-atelier] button.ddz-card:hover {
  border-color: var(--ddz-gold); box-shadow: 0 5px 10px rgba(17, 35, 79, .16);
}
body[data-dsh-maid-atelier] .ddz-card[data-red="true"] { color: #b54d55; }
body[data-dsh-maid-atelier] .ddz-card[data-selected="true"] {
  border-color: var(--ddz-gold);
  box-shadow:
    0 0 0 2px var(--ddz-navy-soft),
    0 0 0 4px rgba(197, 164, 104, .56),
    0 8px 14px rgba(17, 35, 79, .2);
}
body[data-dsh-maid-atelier] .ddz-card-back {
  color: #e5cf9c;
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, .07) 0 2px, transparent 2px 6px),
    linear-gradient(145deg, var(--ddz-indigo), var(--ddz-navy));
}

body[data-dsh-maid-atelier] .ddz-controls {
  min-height: 58px; border-top: 2px solid var(--ddz-gold-line);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .32), transparent),
    var(--ddz-panel);
  box-shadow: inset 0 1px rgba(255, 255, 255, .7);
}
body[data-dsh-maid-atelier] .ddz-action {
  border-color: rgba(82, 106, 168, .34); color: var(--ddz-text); background: var(--ddz-panel);
  box-shadow: 0 2px 5px rgba(15, 32, 75, .08), inset 0 0 0 1px rgba(255, 255, 255, .34);
}
body[data-dsh-maid-atelier] .ddz-action:hover:not(:disabled) {
  border-color: var(--ddz-gold); background: var(--ddz-panel-soft);
}
body[data-dsh-maid-atelier] .ddz-action[data-primary="true"] {
  border-color: var(--ddz-gold-bright); color: #fff9eb;
  background: linear-gradient(145deg, #637bb5, #354d88);
  box-shadow:
    0 3px 8px rgba(17, 35, 79, .2),
    inset 0 1px rgba(255, 255, 255, .22);
}
body[data-dsh-maid-atelier] .ddz-action[data-primary="true"]:hover:not(:disabled) {
  background: linear-gradient(145deg, #7188bd, #405a99);
}
body[data-dsh-maid-atelier] .ddz-waiting { color: var(--ddz-muted); }
body[data-dsh-maid-atelier] :is(.ddz-action, .ddz-ghost, .ddz-card, [data-ddz-nav-entry]):focus-visible {
  outline: 2px solid var(--ddz-gold-bright); outline-offset: 2px;
}

body[data-dsh-maid-atelier] .ddz-resize {
  width: 18px; height: 18px;
  background: linear-gradient(135deg, transparent 49%, var(--ddz-gold) 50% 58%, transparent 59% 68%, var(--ddz-gold) 69%);
}
body[data-dsh-maid-atelier] .ddz-pill {
  border: 1px solid var(--ddz-gold-bright);
  background: linear-gradient(145deg, var(--ddz-navy-soft), var(--ddz-navy));
  color: #f8f3e8;
  box-shadow:
    0 10px 28px rgba(7, 16, 43, .3),
    inset 0 0 0 1px rgba(255, 255, 255, .08);
}
body[data-dsh-maid-atelier] .ddz-pill[data-waiting="true"] {
  border-color: #e5c277; box-shadow: 0 0 0 3px rgba(229, 194, 119, .17), 0 10px 28px rgba(7, 16, 43, .3);
}
body[data-dsh-maid-atelier] .ddz-pill-main,
body[data-dsh-maid-atelier] .ddz-pill-close { color: #f8f3e8; }
body[data-dsh-maid-atelier] .ddz-pill-main em { color: #b9c5e1; }
body[data-dsh-maid-atelier] :is(.ddz-pill-main, .ddz-pill-close):hover {
  background: rgba(255, 250, 236, .1);
}
`
