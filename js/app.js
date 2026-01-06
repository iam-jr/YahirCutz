console.log("[DEBUG] YahirCutz App Loaded");
/**
 * YahirCutz — Sistema de reservas
 * Adaptado de Zayas4k con diseño premium oro/negro
 */

/* ===================== Configuración ===================== */
const TIMEZONE = "America/Puerto_Rico";
const OPEN_DAYS = [2, 3, 4, 5, 6]; // Mar-Sáb
const OPEN_HOUR = 8;
const CLOSE_HOUR = 19;
const SLOT_MINUTES = 15;
const STORAGE_KEY = "yahircutz_bookings_v1";

/* ===================== Estado ===================== */
let viewYear, viewMonth;
let selectedDate = null;
let selectedTime = null;
let selectedService = null;

/* ===================== Utils ===================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isToday = (d) => startOfDay(d).getTime() === startOfDay(new Date()).getTime();
const clamp = (num, min, max) => Math.max(min, Math.min(num, max));
const fmtMonth = (y, m) =>
  new Date(y, m, 1).toLocaleString("es-PR", { month: "long", year: "numeric", timeZone: TIMEZONE });

function safeJSONParse(str, fallback = {}) { try { return JSON.parse(str) || fallback; } catch { return fallback; } }
const loadBookings = () => safeJSONParse(localStorage.getItem(STORAGE_KEY), {});
const saveBookings = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

function to12h(hhmm) {
  const [H, M] = hhmm.split(":").map(Number);
  const suffix = H >= 12 ? "pm" : "am";
  const h12 = ((H + 11) % 12) + 1;
  return `${h12}:${String(M).padStart(2, "0")} ${suffix}`;
}

function formatDateSpanish(date) {
  return date.toLocaleDateString("es-ES", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/* ===================== Calendario ===================== */
function renderCalendar(y, m) {
  viewYear = y;
  viewMonth = m;
  const cal = $("#calendar");
  if (!cal) {
    console.error("[ERROR] No se encontró el elemento #calendar");
    return;
  }

  console.log("[DEBUG] Renderizando calendario para:", y, m);

  const prevH = cal.offsetHeight;
  if (prevH > 0) cal.style.minHeight = prevH + "px";

  cal.innerHTML = "";

  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  console.log("[DEBUG] Días en el mes:", daysInMonth, "Offset:", startOffset);

  for (let i = 0; i < startOffset; i++) {
    const slot = document.createElement("div");
    slot.setAttribute("aria-hidden", "true");
    slot.style.visibility = "hidden";
    cal.appendChild(slot);
  }

  const bookings = loadBookings();
  const todaySoD = startOfDay(new Date());

  let daysRendered = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day);
    const open = OPEN_DAYS.includes(d.getDay());
    const past = startOfDay(d) < todaySoD;

    const tile = document.createElement("button");
    tile.className = "day";
    tile.type = "button";
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("tabindex", past || !open ? "-1" : "0");
    tile.setAttribute("aria-disabled", (!open || past) ? "true" : "false");
    tile.dataset.date = d.toISOString();

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = day;

    tile.appendChild(num);

    if (past || !open) {
      tile.classList.add("disabled");
    } else {
      tile.classList.add("available");
      tile.addEventListener("click", () => onSelectDay(tile, cal));
      tile.addEventListener("keydown", (ev) => handleDayKeyDown(ev, tile, cal));
    }

    if (isToday(d)) {
      tile.dataset.today = "true";
      tile.style.borderColor = "var(--accent)";
    }
    
    if (selectedDate && startOfDay(d).getTime() === startOfDay(selectedDate).getTime()) {
      tile.classList.add("selected");
    }

    cal.appendChild(tile);
    daysRendered++;
  }

  console.log("[DEBUG] Días renderizados:", daysRendered);

  const label = $("#month-label");
  if (label) {
    const monthName = fmtMonth(y, m);
    label.textContent = monthName;
    console.log("[DEBUG] Etiqueta del mes actualizada:", monthName);
  }

  requestAnimationFrame(() => {
    cal.style.minHeight = "";
    console.log("[DEBUG] Calendario renderizado completamente");
  });
}

function onSelectDay(tile, calRoot) {
  $$(".calendar-day.selected", calRoot).forEach((n) => {
    n.classList.remove("selected");
    n.setAttribute("aria-selected", "false");
  });

  tile.classList.add("selected");
  tile.setAttribute("aria-selected", "true");

  selectedDate = new Date(tile.dataset.date);
  selectedTime = null;
  
  renderHours();
  updateSummary();
  
  // Auto-scroll suave a las horas
  setTimeout(() => {
    $("#hora-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 300);
}

function handleDayKeyDown(ev, tile, calRoot) {
  const code = ev.key;
  const days = $$(".day:not([aria-disabled='true'])", calRoot);
  const idx = days.indexOf(tile);
  if (idx < 0) return;

  const cols = 7;
  let nextIndex = null;

  if (code === "ArrowRight") nextIndex = clamp(idx + 1, 0, days.length - 1);
  else if (code === "ArrowLeft") nextIndex = clamp(idx - 1, 0, days.length - 1);
  else if (code === "ArrowDown") nextIndex = clamp(idx + cols, 0, days.length - 1);
  else if (code === "ArrowUp") nextIndex = clamp(idx - cols, 0, days.length - 1);
  else if (code === "Home") nextIndex = 0;
  else if (code === "End") nextIndex = days.length - 1;
  else if (code === "Enter" || code === " ") {
    ev.preventDefault();
    tile.click();
    return;
  }

  if (nextIndex !== null) {
    ev.preventDefault();
    days[nextIndex].focus({ preventScroll: true });
  }
}

/* ===================== Horas ===================== */
function generateDaySlots(dateObj, serviceMinutes = 45) {
  const slots = [];
  const start = new Date(dateObj);
  start.setHours(OPEN_HOUR, 0, 0, 0);

  const end = new Date(dateObj);
  end.setHours(CLOSE_HOUR, 0, 0, 0);

  for (let t = new Date(start); t.getTime() <= end.getTime();) {
    const hh = pad(t.getHours());
    const mm = pad(t.getMinutes());
    slots.push(`${hh}:${mm}`);
    t.setMinutes(t.getMinutes() + SLOT_MINUTES, 0, 0);
  }
  return slots;
}

async function renderHours() {
  const grid = $("#hours");
  if (!grid) return;

  const prevH = grid.offsetHeight;
  if (prevH > 0) grid.style.minHeight = prevH + "px";

  grid.innerHTML = "";

  if (!selectedDate) {
    grid.innerHTML = `<p style="text-align:center; color: var(--gray-light);">Selecciona una fecha primero</p>`;
    requestAnimationFrame(() => {
      grid.style.minHeight = "";
    });
    return;
  }

  const serviceMinutes = selectedService?.duration || 45;
  const allStarts = generateDaySlots(selectedDate, serviceMinutes);

  const now = new Date();
  const validStarts = allStarts.filter((h) => {
    if (!isToday(selectedDate)) return true;
    const [hh, mm] = h.split(":").map((n) => parseInt(n, 10));
    const cand = new Date(selectedDate);
    cand.setHours(hh, mm, 0, 0);
    return cand.getTime() > now.getTime() + 5 * 60 * 1000;
  });

  const dateStr = dateKey(selectedDate);
  let busy = new Set();
  
  // FRONTEND ONLY - Simulando horas ocupadas desde localStorage
  try {
    const bookings = loadBookings();
    if (bookings[dateStr] && Array.isArray(bookings[dateStr])) {
      bookings[dateStr].forEach((booking) => {
        const [h, m] = booking.time.split(":").map(Number);
        for (let i = 0; i < 4; i++) {
          const d = new Date(2000, 0, 1, h, m + i * 15);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          busy.add(`${hh}:${mm}`);
        }
      });
    }
  } catch (err) {
    console.log('Usando sistema sin backend:', err);
  }

  const frag = document.createDocumentFragment();
  validStarts.forEach((h, idx) => {
    const b = document.createElement("button");
    b.className = "hour-btn";
    b.type = "button";
    b.textContent = to12h(h);
    b.dataset.time24 = h;

    if (busy.has(h)) {
      b.classList.add("disabled");
      b.disabled = true;
      b.title = "Ocupado";
    } else {
      b.setAttribute("tabindex", "0");
      b.addEventListener("click", () => onSelectHour(b, grid, h));
      b.addEventListener("keydown", (ev) => handleHourKeyDown(ev, b, grid));
      if (idx === 0 && $(".calendar-day.selected")) b.dataset.autofocus = "true";
    }

    if (selectedTime === h) {
      b.classList.add("selected");
    }

    frag.appendChild(b);
  });
  grid.appendChild(frag);

  requestAnimationFrame(() => {
    const auto = $(".hour-btn[data-autofocus='true']", grid);
    if (auto) {
      auto.focus({ preventScroll: true });
      auto.removeAttribute("data-autofocus");
    }
    grid.style.minHeight = "";
  });
}

function onSelectHour(btn, grid, time) {
  $$(".hour-btn.selected", grid).forEach((n) => n.classList.remove("selected"));
  btn.classList.add("selected");
  selectedTime = time;
  updateSummary();
  
  // Auto-scroll suave a la confirmación
  setTimeout(() => {
    $("#confirmacion-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 300);
}

function handleHourKeyDown(ev, btn, gridRoot) {
  const code = ev.key;
  const hours = $$(".hour-btn", gridRoot);
  const idx = hours.indexOf(btn);
  if (idx < 0) return;

  const cols = getComputedStyle(gridRoot).gridTemplateColumns.split(" ").length || 3;
  let nextIndex = null;

  if (code === "ArrowRight") nextIndex = clamp(idx + 1, 0, hours.length - 1);
  else if (code === "ArrowLeft") nextIndex = clamp(idx - 1, 0, hours.length - 1);
  else if (code === "ArrowDown") nextIndex = clamp(idx + cols, 0, hours.length - 1);
  else if (code === "ArrowUp") nextIndex = clamp(idx - cols, 0, hours.length - 1);
  else if (code === "Home") nextIndex = 0;
  else if (code === "End") nextIndex = hours.length - 1;
  else if (code === "Enter" || code === " ") {
    ev.preventDefault();
    btn.click();
    return;
  }

  if (nextIndex !== null) {
    ev.preventDefault();
    hours[nextIndex].focus({ preventScroll: true });
  }
}

/* ===================== Navegación de Pasos ===================== */
// Ya no se usa - todo visible en una página
function goToStep(step) {
  // Deshabilitado - sistema de página única
  console.log("[DEBUG] goToStep deshabilitado - página única");
}

/* ===================== Resumen ===================== */
function updateSummary() {
  const summaryService = $("#summary-service");
  const summaryDate = $("#summary-date");
  const summaryTime = $("#summary-time");
  const summaryPrice = $("#summary-price");

  if (summaryService) summaryService.textContent = selectedService?.name || "-";
  if (summaryDate && selectedDate) summaryDate.textContent = formatDateSpanish(selectedDate);
  if (summaryTime) summaryTime.textContent = selectedTime ? to12h(selectedTime) : "-";
  if (summaryPrice) summaryPrice.textContent = selectedService?.price ? `$${selectedService.price}` : "-";
}

/* ===================== Servicios ===================== */
function onSelectService(serviceName, price, duration) {
  selectedService = {
    name: serviceName,
    price: parseFloat(price),
    duration: parseInt(duration, 10)
  };

  $$(".servicio-card").forEach((card) => card.classList.remove("selected"));
  
  $$(".servicio-card").forEach((card) => {
    const btn = card.querySelector(".btn-servicio");
    if (btn && btn.dataset.service === serviceName) {
      card.classList.add("selected");
    }
  });

  updateSummary();
  
  // Auto-scroll suave al calendario
  setTimeout(() => {
    $("#fecha-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 300);
}

/* ===================== Formulario ===================== */
async function handleBookingSubmit(e) {
  e.preventDefault();

  const name = $("#clientName")?.value?.trim();
  const email = $("#clientEmail")?.value?.trim();
  const phone = $("#clientPhone")?.value?.trim();
  const instagram = $("#clientInstagram")?.value?.trim();

  if (!name || !email) {
    showMessage("Por favor ingresa nombre y email", "error");
    return;
  }

  if (!selectedService || !selectedDate || !selectedTime) {
    showMessage("Por favor completa todos los pasos", "error");
    return;
  }

  const dateStr = dateKey(selectedDate);

  const payload = {
    clientName: name,
    clientEmail: email,
    clientPhone: phone || "",
    clientInstagram: instagram || "",
    service: selectedService.name,
    date: dateStr,
    time: selectedTime
  };

  // FRONTEND ONLY - Guardando en localStorage
  try {
    const bookings = loadBookings();
    if (!bookings[dateStr]) {
      bookings[dateStr] = [];
    }
    
    // Verificar si ya existe una reserva a esa hora
    const exists = bookings[dateStr].some(b => b.time === selectedTime);
    if (exists) {
      showMessage("Esta hora ya está ocupada. Por favor elige otra.", "error");
      return;
    }
    
    bookings[dateStr].push(payload);
    saveBookings(bookings);
    
    showMessage("✓ ¡Cita confirmada! Redirigiendo...", "success");
    
    const params = new URLSearchParams({
      name,
      service: selectedService.name,
      date: dateStr,
      time: selectedTime,
      email,
      phone: phone || "",
      instagram: instagram || ""
    });
    
    setTimeout(() => {
      window.location.href = `confirmacion/index.html?${params.toString()}`;
    }, 1500);
    
  } catch (err) {
    console.error("Error:", err);
    showMessage("Error al guardar la cita. Intenta nuevamente", "error");
  }
}

function showMessage(text, type) {
  const msg = $("#booking-message");
  if (msg) {
    msg.className = `booking-message ${type}`;
    msg.textContent = text;
    msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/* ===================== Inicialización ===================== */
document.addEventListener("DOMContentLoaded", function() {
  console.log("[DEBUG] Inicializando YahirCutz");

  // Servicios
  const servicios = [
    { name: "Corte Clásico", price: "40", duration: "45", icon: "✂️" },
    { name: "Corte + Barba", price: "40", duration: "60", icon: "🧔" },
    { name: "Combo Completo", price: "40", duration: "75", icon: "💈" },
    { name: "Diseño Custom", price: "40", duration: "60", icon: "🎨" },
    { name: "House Call", price: "100", duration: "90", icon: "🏠" }
  ];

  const servicioList = $("#servicioList");
  if (servicioList) {
    servicios.forEach((service) => {
      const card = document.createElement("div");
      card.className = "servicio-card";
      card.innerHTML = `
        <div class="servicio-icon">${service.icon}</div>
        <h3>${service.name}</h3>
        <p class="precio">$${service.price}</p>
        <button class="btn-servicio" data-service="${service.name}" data-price="${service.price}" data-duration="${service.duration}" type="button">Seleccionar</button>
      `;

      card.querySelector(".btn-servicio").addEventListener("click", function() {
        onSelectService(service.name, service.price, service.duration);
      });

      servicioList.appendChild(card);
    });
  }

  // Inicializar calendario con fecha actual
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  
  console.log("[DEBUG] Renderizando calendario inicial:", viewYear, viewMonth);
  renderCalendar(viewYear, viewMonth);

  // Navegación de calendario
  const prevBtn = $("#prev-month");
  const nextBtn = $("#next-month");
  
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      console.log("[DEBUG] Navegando a mes anterior:", viewYear, viewMonth);
      renderCalendar(viewYear, viewMonth);
      renderHours();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      console.log("[DEBUG] Navegando a mes siguiente:", viewYear, viewMonth);
      renderCalendar(viewYear, viewMonth);
      renderHours();
    });
  }

  // Formulario
  const form = $("#booking-form");
  if (form) {
    form.addEventListener("submit", handleBookingSubmit);
  }

  console.log("[DEBUG] YahirCutz inicializado correctamente - Modo página única");
  console.log("[DEBUG] Todas las secciones visibles, esperando interacción del usuario");
});

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
