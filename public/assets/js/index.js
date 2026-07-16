document.getElementById('year').textContent = new Date().getFullYear();

// Subtle scroll-reveal. Reduced-motion users get the CSS override (always visible).
if ('IntersectionObserver' in window) {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
} else {
  document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
}
