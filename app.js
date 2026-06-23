const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxnXTaaZclOvdmzkcM2GGxYIcoUhckYU3qchDxHGqVyvOxGO2vFx_FpdxPHYD-POOtV/exec";
// ================================

const COLUMNS = {
  CAME_MAQUILA: ["Remisión", "Fecha", "Pedido", "Cliente", "Descripción", "Lote", "Ancho", "Peso"],
  CAME_INTERNO: ["Remisión", "Fecha", "Descripción", "Número rollo", "Ancho", "Cantidad KG"],
  SMURFIT_MAQUILA: ["Número documento", "Fecha", "Descripción", "Lote", "Ancho", "Peso"],
  SMURFIT_INTERNO: ["Número", "Fecha", "Descripción", "Ancho", "Número de lote", "Kilos"]
};

const TIPO_LABEL = {
  CAME_MAQUILA: "CAME Maquila",
  CAME_INTERNO: "CAME Interno",
  SMURFIT_MAQUILA: "Smurfit Maquila",
  SMURFIT_INTERNO: "Smurfit Interno"
};

let state = {
  step: 1,
  tipo: null,
  filas: []
};

const steps = [1, 2, 3, 4, 5];

function showStep(n) {
  state.step = n;
  steps.forEach((s) => {
    document.getElementById("step" + s).hidden = s !== n;
  });
  document.getElementById("backBtn").style.visibility = n > 1 ? "visible" : "hidden";
}

document.getElementById("backBtn").addEventListener("click", () => {
  if (state.step > 1) showStep(state.step - 1);
});

document.querySelectorAll(".doctype").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.tipo = btn.dataset.tipo;
    document.getElementById("tipoBadge").textContent = TIPO_LABEL[state.tipo];
    document.getElementById("errorMsg").hidden = true;
    showStep(2);
  });
});

document.getElementById("btnFoto").addEventListener("click", () => {
  document.getElementById("inputFoto").click();
});

document.getElementById("btnPdf").addEventListener("click", () => {
  document.getElementById("inputPdf").click();
});

document.getElementById("inputFoto").addEventListener("change", (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0], true);
});

document.getElementById("inputPdf").addEventListener("change", (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0], false);
});

function showError(msg) {
  const el = document.getElementById("errorMsg");
  el.textContent = msg;
  el.hidden = false;
}

async function handleFile(file, isPhoto) {
  document.getElementById("errorMsg").hidden = true;
  try {
    let base64, mimeType;
    if (isPhoto) {
      base64 = await compressImage(file, 1600, 0.75);
      mimeType = "image/jpeg";
    } else {
      if (file.size > 7 * 1024 * 1024) {
        showError("El archivo es muy grande (máximo ~7MB). Intenta con un PDF más liviano o solo una página.");
        return;
      }
      base64 = await fileToBase64(file);
      mimeType = file.type || "application/pdf";
    }
    showStep(3);
    await extraer(base64, mimeType);
  } catch (err) {
    showError("No se pudo leer el archivo: " + err.message);
  }
}

function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("error de lectura"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("imagen inválida"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("error de lectura"));
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  });
}

async function extraer(base64, mimeType) {
  try {
    const resp = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: state.tipo, mimeType, base64 })
    });
    const data = await resp.json();
    if (!data.ok) {
      showStep(2);
      showError(data.error || "No se pudo extraer la información, intenta de nuevo.");
      return;
    }
    state.filas = (data.filas || []).map((f) => normalizeFila(f));
    if (state.filas.length === 0) {
      showStep(2);
      showError("No se detectaron filas en el documento. Intenta con una foto más clara.");
      return;
    }
    renderTabla();
    showStep(4);
  } catch (err) {
    showStep(2);
    showError("Error de conexión: " + err.message);
  }
}

function normalizeFila(fila) {
  const cols = COLUMNS[state.tipo];
  const out = {};
  cols.forEach((c) => {
    out[c] = fila[c] !== undefined && fila[c] !== null ? String(fila[c]) : "";
  });
  return out;
}

function renderTabla() {
  const cols = COLUMNS[state.tipo];
  const wrap = document.getElementById("tableWrap");
  let html = "<table><thead><tr>";
  cols.forEach((c) => (html += `<th>${c}</th>`));
  html += "<th></th></tr></thead><tbody>";
  state.filas.forEach((fila, i) => {
    html += "<tr>";
    cols.forEach((c) => {
      html += `<td><input data-row="${i}" data-col="${c}" value="${escapeHtml(fila[c])}" /></td>`;
    });
    html += `<td><button class="delRow" data-row="${i}" aria-label="Eliminar fila">&times;</button></td>`;
    html += "</tr>";
  });
  html += "</tbody></table>";
  wrap.innerHTML = html;

  wrap.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const r = parseInt(e.target.dataset.row);
      const c = e.target.dataset.col;
      state.filas[r][c] = e.target.value;
    });
  });

  wrap.querySelectorAll(".delRow").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const r = parseInt(e.target.dataset.row);
      state.filas.splice(r, 1);
      renderTabla();
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document.getElementById("addRowBtn").addEventListener("click", () => {
  const cols = COLUMNS[state.tipo];
  const empty = {};
  cols.forEach((c) => (empty[c] = ""));
  state.filas.push(empty);
  renderTabla();
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("saveError");
  errEl.hidden = true;

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("PEGA_AQUI") !== -1) {
    errEl.textContent = "Falta configurar la URL de Apps Script en app.js";
    errEl.hidden = false;
    return;
  }
  if (state.filas.length === 0) {
    errEl.textContent = "No hay filas para guardar.";
    errEl.hidden = false;
    return;
  }

  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ tipo: state.tipo, filas: state.filas })
    });
    const data = await resp.json();
    btn.disabled = false;
    btn.textContent = "Guardar en Sheets";
    if (!data.ok) {
      errEl.textContent = data.error || "No se pudo guardar.";
      errEl.hidden = false;
      return;
    }
    document.getElementById("successMsg").textContent =
      data.filasGuardadas + " filas guardadas en " + TIPO_LABEL[state.tipo];
    showStep(5);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Guardar en Sheets";
    errEl.textContent = "Error de conexión: " + err.message;
    errEl.hidden = false;
  }
});

document.getElementById("newDocBtn").addEventListener("click", () => {
  state = { step: 1, tipo: null, filas: [] };
  document.getElementById("inputFoto").value = "";
  document.getElementById("inputPdf").value = "";
  showStep(1);
});

showStep(1);
