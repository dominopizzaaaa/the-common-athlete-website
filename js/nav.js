/* The Common Athlete — shared navigation behaviour */
(function () {
  "use strict";

  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const toggle = document.getElementById("navToggle");
  const mobile = document.getElementById("navMobile");
  if (!toggle || !mobile) return;

  const close = () => {
    mobile.classList.remove("is-open");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const open = mobile.classList.toggle("is-open");
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  mobile.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
})();
