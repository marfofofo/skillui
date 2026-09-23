// Foglio di conferma con "scorri per eseguire".

import { $ } from "./util.js";

const TITLES = {
  run_shell: "Eseguire un comando nel Terminale?",
  run_applescript: "Eseguire uno script AppleScript?",
};

export function createApprovalSheet({ onAnswer }) {
  const sheet = $("approval");
  const scrim = $("sheetScrim");
  const slider = $("slider");
  const knob = slider.querySelector(".knob");
  const label = slider.querySelector(".slider-text");
  let pendingId = null;
  let drag = null;

  const maxX = () => slider.clientWidth - knob.offsetWidth - 10;

  function setKnob(x) {
    knob.style.transform = `translateX(${x}px)`;
    const p = Math.round((x / maxX()) * 100);
    slider.setAttribute("aria-valuenow", String(p));
    label.style.opacity = String(Math.max(0, 1 - p / 60));
  }

  function resetSlider(animated) {
    slider.classList.toggle("back", animated);
    setKnob(0);
  }

  function answer(ok) {
    const id = pendingId;
    close();
    if (id) onAnswer(id, ok);
  }

  function close() {
    pendingId = null;
    sheet.hidden = true;
    scrim.hidden = true;
  }

  const clampX = (e) => Math.max(0, Math.min(maxX(), e.clientX - drag.startX));

  knob.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    knob.setPointerCapture(e.pointerId);
    slider.classList.remove("back");
    drag = { startX: e.clientX };
  });
  knob.addEventListener("pointermove", (e) => drag && setKnob(clampX(e)));
  const endDrag = (e) => {
    if (!drag) return;
    const x = clampX(e);
    drag = null;
    if (x >= maxX() * 0.92) {
      setKnob(maxX());
      setTimeout(() => answer(true), 120);
    } else resetSlider(true);
  };
  knob.addEventListener("pointerup", endDrag);
  knob.addEventListener("pointercancel", endDrag);
  slider.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && answer(true));
  $("deny").onclick = () => answer(false);

  return {
    get pendingId() {
      return pendingId;
    },
    open({ id, name, detail }) {
      pendingId = id;
      $("approvalTitle").textContent = TITLES[name] || `Consentire «${name}»?`;
      $("approvalDetail").textContent = detail || "";
      resetSlider(false);
      sheet.hidden = false;
      scrim.hidden = false;
    },
    close,
  };
}
