/* The Common Athlete — interactions */
(function () {
  "use strict";

  /* ---------- sticky nav shadow ---------- */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  const toggle = document.getElementById("navToggle");
  const mobile = document.getElementById("navMobile");
  toggle.addEventListener("click", () => {
    const open = mobile.classList.toggle("is-open");
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  mobile.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      mobile.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );

  /* ---------- scroll reveal ---------- */
  const revealables = document.querySelectorAll(".reveal, .reveal-late, .honest__bars");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- product colourway swap ---------- */
  const tones = {
    black:    { label: "Black",    bg: "linear-gradient(160deg, #F3EDE1, #E9DFCE)" },
    sand:     { label: "Sand",     bg: "linear-gradient(160deg, #F6F0E5, #EFE3CF)" },
    espresso: { label: "Espresso", bg: "linear-gradient(160deg, #F1EAE0, #E4D8C8)" },
  };

  document.querySelectorAll("[data-product]").forEach((card) => {
    const media = card.querySelector("[data-media]");
    const shot = card.querySelector("[data-shot]");
    const style = card.dataset.style;
    const swatches = card.querySelectorAll("[data-swatches] .swatch");
    if (!shot || !style) return;

    // warm the other colourways so swapping doesn't flash
    Object.keys(tones).forEach((t) => {
      const pre = new Image();
      pre.src = `assets/garments/${style}-${t}.png`;
    });

    swatches.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tone = tones[btn.dataset.tone];
        if (!tone) return;
        swatches.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        shot.src = `assets/garments/${style}-${btn.dataset.tone}.png`;
        shot.alt = shot.alt.replace(/ in .*$/, ` in ${tone.label}`);
        media.style.background = tone.bg;
      });
    });
  });

  /* ---------- waitlist form ---------- */
  const form = document.getElementById("waitlistForm");
  const success = document.getElementById("waitlistSuccess");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      form.email.focus();
      form.email.style.borderColor = "#c96f5a";
      return;
    }
    form.hidden = true;
    success.hidden = false;
  });
  form.email.addEventListener("input", () => {
    form.email.style.borderColor = "";
  });
})();
