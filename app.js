(() => {
  "use strict";

  const STORAGE_KEY = "mobieduca-carregadores-v1";
  const SETTINGS_VERSION = 2;
  const SAFE_MARGIN_MM = 5;
  const A4 = { width: 210, height: 297 };
  const defaults = {
    width: 50,
    height: 30,
    margin: SAFE_MARGIN_MM,
    gapX: 0,
    gapY: 1,
    cutLines: true,
  };

  const state = {
    items: [],
    editingId: null,
    settings: { ...defaults },
  };

  const $ = (id) => document.getElementById(id);
  const elements = {
    form: $("labelForm"),
    school: $("school"),
    note: $("note"),
    input: $("inputValue"),
    output: $("outputValue"),
    quantity: $("quantity"),
    width: $("labelWidth"),
    height: $("labelHeight"),
    margin: $("pageMargin"),
    gapX: $("gapX"),
    gapY: $("gapY"),
    cutLines: $("cutLines"),
    message: $("formMessage"),
    submit: $("submitBtn"),
    cancelEdit: $("cancelEditBtn"),
    resetForm: $("resetFormBtn"),
    clearQueue: $("clearQueueBtn"),
    print: $("printBtn"),
    queueBody: $("queueBody"),
    queueContent: $("queueContent"),
    emptyState: $("emptyState"),
    printArea: $("printArea"),
    previewLabel: $("previewLabel"),
    previewSchool: $("previewSchool"),
    previewNote: $("previewNote"),
    previewInput: $("previewInput"),
    previewOutput: $("previewOutput"),
    previewSize: $("previewSize"),
    capacityStat: $("capacityStat"),
    totalStat: $("totalStat"),
    pagesStat: $("pagesStat"),
    printSummary: $("printSummary"),
    pageSummary: $("pageSummary"),
    toast: $("toast"),
  };

  const toNumber = (value, fallback) => {
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const makeId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const formatMm = (value) =>
    Number.isInteger(value)
      ? String(value)
      : String(Number(value.toFixed(2))).replace(".", ",");

  function readSettings() {
    return {
      width: toNumber(elements.width.value, defaults.width),
      height: toNumber(elements.height.value, defaults.height),
      margin: toNumber(elements.margin.value, defaults.margin),
      gapX: toNumber(elements.gapX.value, defaults.gapX),
      gapY: toNumber(elements.gapY.value, defaults.gapY),
      cutLines: elements.cutLines.checked,
    };
  }

  function capacity(settings = readSettings()) {
    const usableWidth = A4.width - settings.margin * 2;
    const usableHeight = A4.height - settings.margin * 2;
    const columns = Math.floor(
      (usableWidth + settings.gapX) / (settings.width + settings.gapX),
    );
    const rows = Math.floor(
      (usableHeight + settings.gapY) / (settings.height + settings.gapY),
    );
    return {
      columns: Math.max(0, columns),
      rows: Math.max(0, rows),
      total: Math.max(0, columns * rows),
    };
  }

  function totalLabels() {
    return state.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  function saveState() {
    state.settings = readSettings();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SETTINGS_VERSION,
        items: state.items,
        settings: state.settings,
      }),
    );
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || !Array.isArray(saved.items)) return;
      state.items = saved.items.filter(
        (item) =>
          item &&
          typeof item.school === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      );
      const savedSettings = saved.settings || {};
      const usedOldDefaultLayout =
        toNumber(savedSettings.width, defaults.width) === 50 &&
        toNumber(savedSettings.height, defaults.height) === 30 &&
        toNumber(savedSettings.margin, 3) === 3 &&
        toNumber(savedSettings.gapX, 1) === 1;

      state.settings = { ...defaults, ...savedSettings };
      state.settings.margin = Math.max(
        SAFE_MARGIN_MM,
        toNumber(state.settings.margin, defaults.margin),
      );
      if ((saved.version || 1) < SETTINGS_VERSION && usedOldDefaultLayout) {
        state.settings.gapX = 0;
      }

      elements.width.value = state.settings.width;
      elements.height.value = state.settings.height;
      elements.margin.value = state.settings.margin;
      elements.gapX.value = state.settings.gapX;
      elements.gapY.value = state.settings.gapY;
      elements.cutLines.checked = state.settings.cutLines;
      saveState();
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(
      () => elements.toast.classList.remove("is-visible"),
      2500,
    );
  }

  function showMessage(message = "") {
    elements.message.textContent = message;
  }

  function getDraft() {
    return {
      school: elements.school.value.trim(),
      note: elements.note.value.trim(),
      input: elements.input.value.trim(),
      output: elements.output.value.trim(),
      quantity: Number(elements.quantity.value),
    };
  }

  function validateForm(draft) {
    if (!draft.school) return "Informe o nome da escola.";
    if (!draft.input) return "Informe o INPUT do carregador.";
    if (!draft.output) return "Informe o OUTPUT do carregador.";
    if (!Number.isInteger(draft.quantity) || draft.quantity < 1) {
      return "Informe uma quantidade válida, maior que zero.";
    }
    if (draft.quantity > 999) return "A quantidade máxima por item é 999.";
    return "";
  }

  function validateSettings(settings) {
    if (settings.width <= 0 || settings.height <= 0) {
      return "Largura e altura precisam ser maiores que zero.";
    }
    if (settings.margin < SAFE_MARGIN_MM) {
      return "Use pelo menos 5 mm de margem para evitar cortes na impressão.";
    }
    if (settings.gapX < 0 || settings.gapY < 0) {
      return "Os espaçamentos não podem ser negativos.";
    }
    if (capacity(settings).total === 0) {
      return "Com essas medidas, nenhuma etiqueta cabe em uma folha A4.";
    }
    return "";
  }

  function resetForm({ keepSettings = true } = {}) {
    state.editingId = null;
    elements.school.value = "";
    elements.note.value = "";
    elements.input.value = "100-240V~ 50/60Hz";
    elements.output.value = "5V 3A";
    elements.quantity.value = "1";
    elements.submit.innerHTML = '<span aria-hidden="true">＋</span> Adicionar à fila';
    elements.cancelEdit.hidden = true;
    showMessage();
    if (!keepSettings) {
      elements.width.value = defaults.width;
      elements.height.value = defaults.height;
      elements.margin.value = defaults.margin;
      elements.gapX.value = defaults.gapX;
      elements.gapY.value = defaults.gapY;
      elements.cutLines.checked = defaults.cutLines;
    }
    updatePreview();
  }

  function updatePreview() {
    const draft = getDraft();
    const settings = readSettings();
    elements.previewSchool.textContent =
      draft.school.toUpperCase() || "NOME DA ESCOLA";
    elements.previewNote.textContent = draft.note.toUpperCase();
    elements.previewNote.hidden = !draft.note;
    elements.previewInput.textContent = `INPUT: ${draft.input || "100-240V~ 50/60Hz"}`;
    elements.previewOutput.textContent = `OUTPUT: ${draft.output || "5V 3A"}`;
    elements.previewSize.textContent = `${formatMm(settings.width)} × ${formatMm(settings.height)} mm`;

    const ratio = settings.width > 0 && settings.height > 0
      ? settings.width / settings.height
      : defaults.width / defaults.height;
    elements.previewLabel.style.aspectRatio = String(ratio);
    const maxWidth = ratio < 1 ? Math.max(180, 280 * ratio) : 400;
    elements.previewLabel.style.width = `min(100%, ${maxWidth}px)`;
    fitText(elements.previewSchool, 15, 8);
    fitText(elements.previewNote, 13, 7);
    fitText(elements.previewInput, 12, 7);
    fitText(elements.previewOutput, 12, 7);
    updateSummary();
  }

  function fitText(element, start, minimum) {
    if (!element || element.hidden) return;
    element.style.fontSize = `${start}px`;
    let size = start;
    while (
      size > minimum &&
      (element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight)
    ) {
      size -= 0.5;
      element.style.fontSize = `${size}px`;
    }
  }

  function updateSummary() {
    const settings = readSettings();
    const pageCapacity = capacity(settings);
    const total = totalLabels();
    const pages = pageCapacity.total ? Math.ceil(total / pageCapacity.total) : 0;
    elements.capacityStat.textContent = String(pageCapacity.total);
    elements.totalStat.textContent = String(total);
    elements.pagesStat.textContent = String(pages);
    elements.printSummary.textContent = total
      ? `${total} ${total === 1 ? "etiqueta" : "etiquetas"} pronta${total === 1 ? "" : "s"}`
      : "Nenhuma etiqueta adicionada";
    elements.pageSummary.textContent = total
      ? `${pageCapacity.columns} colunas × ${pageCapacity.rows} linhas — ${pages} ${pages === 1 ? "página A4" : "páginas A4"}`
      : "Adicione itens para preparar a folha A4.";
  }

  function renderQueue() {
    const hasItems = state.items.length > 0;
    elements.emptyState.hidden = hasItems;
    elements.queueContent.hidden = !hasItems;
    elements.clearQueue.disabled = !hasItems;
    elements.print.disabled = !hasItems;
    elements.queueBody.innerHTML = state.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.school).replaceAll("\n", "<br>")}</td>
            <td>${escapeHtml(item.note || "—")}</td>
            <td>${escapeHtml(item.input)}</td>
            <td>${escapeHtml(item.output)}</td>
            <td class="number-cell"><strong>${item.quantity}</strong></td>
            <td>
              <div class="row-actions">
                <button class="icon-button" type="button" data-action="edit" data-id="${item.id}">Editar</button>
                <button class="icon-button" type="button" data-action="remove-one" data-id="${item.id}" title="Diminuir uma unidade">−1</button>
                <button class="icon-button icon-button--danger" type="button" data-action="delete" data-id="${item.id}">Excluir</button>
              </div>
            </td>
          </tr>`,
      )
      .join("");
    updateSummary();
  }

  function startEdit(id) {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return;
    state.editingId = id;
    elements.school.value = item.school;
    elements.note.value = item.note;
    elements.input.value = item.input;
    elements.output.value = item.output;
    elements.quantity.value = item.quantity;
    elements.submit.textContent = "Salvar edição";
    elements.cancelEdit.hidden = false;
    showMessage();
    updatePreview();
    elements.school.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeOne(id) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index < 0) return;
    if (state.items[index].quantity > 1) {
      state.items[index].quantity -= 1;
    } else {
      state.items.splice(index, 1);
    }
    if (state.editingId === id) resetForm();
    saveState();
    renderQueue();
    showToast("Uma etiqueta foi removida.");
  }

  function deleteItem(id) {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return;
    if (!window.confirm(`Excluir “${item.school.replaceAll("\n", " / ")}” da fila?`)) return;
    state.items = state.items.filter((candidate) => candidate.id !== id);
    if (state.editingId === id) resetForm();
    saveState();
    renderQueue();
    showToast("Item excluído da fila.");
  }

  function labelMarkup(item, cutLines) {
    const marks = cutLines
      ? `
        <i class="cut-mark cut-mark--tl"></i>
        <i class="cut-mark cut-mark--tr"></i>
        <i class="cut-mark cut-mark--bl"></i>
        <i class="cut-mark cut-mark--br"></i>`
      : "";
    return `
      <div class="label-slot">
        ${marks}
        <div class="charger-label">
          <img class="charger-label__logo" src="./logo.png" alt="" />
          <div class="charger-label__school print-fit" data-start="5.3" data-min="2.4">${escapeHtml(item.school.toUpperCase()).replaceAll("\n", "<br>")}</div>
          ${
            item.note
              ? `<div class="charger-label__note print-fit" data-start="8.2" data-min="2.6">${escapeHtml(item.note.toUpperCase())}</div>`
              : ""
          }
          <div class="charger-label__spec print-fit" data-start="5.4" data-min="2.6">INPUT: ${escapeHtml(item.input)}</div>
          <div class="charger-label__spec print-fit" data-start="4.4" data-min="2.6">OUTPUT: ${escapeHtml(item.output)}</div>
          <div class="charger-label__icons">
            <span>⌂</span>
            <span>▣</span>
            <span class="bin-symbol">♲</span>
            <span>− ◉ ＋</span>
          </div>
        </div>
      </div>`;
  }

  function buildPrintPages() {
    const settings = readSettings();
    const settingsError = validateSettings(settings);
    if (settingsError) {
      showMessage(settingsError);
      return false;
    }

    const pageCapacity = capacity(settings);
    const expanded = state.items.flatMap((item) =>
      Array.from({ length: item.quantity }, () => item),
    );
    const pages = [];
    for (let index = 0; index < expanded.length; index += pageCapacity.total) {
      pages.push(expanded.slice(index, index + pageCapacity.total));
    }

    elements.printArea.innerHTML = pages
      .map(
        (pageItems) => `
          <section
            class="print-page"
            style="
              padding: ${settings.margin}mm;
              grid-template-columns: repeat(${pageCapacity.columns}, ${settings.width}mm);
              grid-auto-rows: ${settings.height}mm;
              column-gap: ${settings.gapX}mm;
              row-gap: ${settings.gapY}mm;
              --label-width: ${settings.width}mm;
              --label-height: ${settings.height}mm;
            "
          >
            ${pageItems.map((item) => labelMarkup(item, settings.cutLines)).join("")}
          </section>`,
      )
      .join("");
    return true;
  }

  function fitPrintText(root = elements.printArea) {
    root.querySelectorAll(".print-fit").forEach((element) => {
      let size = Number(element.dataset.start);
      const minimum = Number(element.dataset.min);
      element.style.fontSize = `${size}pt`;
      while (
        size > minimum &&
        (element.scrollWidth > element.clientWidth ||
          element.scrollHeight > element.clientHeight)
      ) {
        size -= 0.2;
        element.style.fontSize = `${size}pt`;
      }
    });
  }

  function waitForFrame(frame) {
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      frame.addEventListener("load", finish, { once: true });
      window.setTimeout(finish, 1800);
    });
  }

  async function printInSafeFrame() {
    document.getElementById("printFrame")?.remove();

    const frame = document.createElement("iframe");
    frame.id = "printFrame";
    frame.title = "Documento seguro de impressão";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);

    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      throw new Error("Não foi possível preparar o documento de impressão.");
    }

    const loaded = waitForFrame(frame);
    frameDocument.open();
    frameDocument.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="color-scheme" content="only light">
          <base href="${escapeHtml(document.baseURI)}">
          <link rel="stylesheet" href="./styles.css">
          <style>
            :root, html, body {
              color-scheme: only light !important;
              background: #fff !important;
              background-color: #fff !important;
              background-image: none !important;
              color: #000 !important;
              filter: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          </style>
          <title>Etiquetas para carregadores</title>
        </head>
        <body>
          <div id="printArea">${elements.printArea.innerHTML}</div>
        </body>
      </html>`);
    frameDocument.close();
    await loaded;

    const framePrintArea = frameDocument.getElementById("printArea");
    if (!framePrintArea) {
      frame.remove();
      throw new Error("A folha de impressão não foi preparada.");
    }

    const images = [...frameDocument.images];
    await Promise.all(
      images.map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
      ),
    );

    fitPrintText(framePrintArea);
    elements.printArea.innerHTML = "";

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      frame.remove();
    };
    frameWindow.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 60000);
    frameWindow.focus();
    frameWindow.print();
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const draft = getDraft();
    const error = validateForm(draft);
    if (error) {
      showMessage(error);
      return;
    }

    const item = {
      id: state.editingId || makeId(),
      school: draft.school,
      note: draft.note,
      input: draft.input,
      output: draft.output,
      quantity: draft.quantity,
    };

    if (state.editingId) {
      const index = state.items.findIndex(
        (candidate) => candidate.id === state.editingId,
      );
      if (index >= 0) state.items[index] = item;
      showToast("Etiqueta atualizada.");
    } else {
      state.items.push(item);
      showToast("Etiqueta adicionada à fila.");
    }

    saveState();
    renderQueue();
    resetForm();
  });

  elements.queueBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "edit") startEdit(id);
    if (action === "remove-one") removeOne(id);
    if (action === "delete") deleteItem(id);
  });

  elements.resetForm.addEventListener("click", () => resetForm());
  elements.cancelEdit.addEventListener("click", () => resetForm());
  elements.clearQueue.addEventListener("click", () => {
    if (!state.items.length) return;
    if (!window.confirm("Deseja limpar toda a fila de impressão?")) return;
    state.items = [];
    resetForm();
    saveState();
    renderQueue();
    showToast("A fila foi limpa.");
  });

  [
    elements.school,
    elements.note,
    elements.input,
    elements.output,
    elements.width,
    elements.height,
    elements.margin,
    elements.gapX,
    elements.gapY,
    elements.cutLines,
  ].forEach((element) => {
    element.addEventListener("input", () => {
      showMessage();
      saveState();
      updatePreview();
    });
    element.addEventListener("change", () => {
      saveState();
      updatePreview();
    });
  });

  elements.print.addEventListener("click", async () => {
    showMessage();
    if (!buildPrintPages()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    elements.print.disabled = true;
    try {
      await printInSafeFrame();
    } catch {
      fitPrintText();
      document.documentElement.style.colorScheme = "only light";
      document.body.style.background = "#fff";
      window.print();
    } finally {
      elements.print.disabled = false;
    }
  });

  window.addEventListener("afterprint", () => {
    elements.printArea.innerHTML = "";
    document.documentElement.style.removeProperty("color-scheme");
    document.body.style.removeProperty("background");
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(updatePreview.resizeTimer);
    updatePreview.resizeTimer = window.setTimeout(updatePreview, 100);
  });

  loadState();
  renderQueue();
  updatePreview();
})();
