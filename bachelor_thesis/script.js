(() => {
  const data = window.THESIS_DATA;
  const root = data.root;
  const PLOTLY_CDN = "plotly.min.js";

  const state = {
    activeNode: root,
    activePlot: null,
    query: "",
    view: localStorage.getItem("thesis-view") || "grid",
    expanded: new Set([root.id]),
    compared: [],
    mode: "static",
    axesUnified: false,
    plotlyLoaded: false,
    plotlyFigures: new Map(),
    ignoreHistory: false
  };

  const refs = Object.fromEntries([
    "siteTitle", "siteSubtitle", "tree", "breadcrumbs", "sectionEyebrow", "sectionTitle",
    "sectionSummary", "folderSection", "folderHeading", "folderGrid", "fileSection",
    "fileHeading", "plotGrid", "emptyState", "searchInput", "galleryView", "workspaceView",
    "workspaceFolder", "workspaceTitle", "workspaceSummary", "backToFolder", "interactiveToggle",
    "addComparison", "unifyAxes", "axisSettings", "comparisonCount", "compatibilityText",
    "clearComparisons", "comparisonGrid", "comparisonDialog", "comparisonSearch", "comparisonList",
    "closeComparisonDialog", "settingsDialog", "closeSettingsDialog", "axisForm", "axisTarget",
    "xMin", "xMax", "yMin", "yMax", "resetAxes", "sidebar",
    "sidebarToggle", "backdrop", "toast"
  ].map(id => [id, document.getElementById(id)]));

  refs.siteTitle.textContent = data.siteTitle;
  refs.siteSubtitle.textContent = data.siteSubtitle;

  function imagePath(file) {
    return file.image || file.file || "";
  }

  function allNodes(node = root, parent = null, list = []) {
    list.push({ node, parent });
    (node.children || []).forEach(child => allNodes(child, node, list));
    return list;
  }

  const nodeEntries = allNodes();
  const nodeIndex = new Map(nodeEntries.map(item => [item.node.id, item.node]));
  const parentIndex = new Map(nodeEntries.filter(item => item.parent).map(item => [item.node.id, item.parent]));

  function flattenFiles(node = root, list = []) {
    (node.files || []).forEach(file => list.push({ file, node }));
    (node.children || []).forEach(child => flattenFiles(child, list));
    return list;
  }

  const fileIndex = flattenFiles();
  const fileById = new Map(fileIndex.map(item => [item.file.id, item]));

  function nodePath(target) {
    const path = [];
    let current = target;
    while (current) {
      path.unshift(current);
      current = parentIndex.get(current.id) || null;
    }
    return path;
  }

  function expandPath(node) {
    nodePath(node).forEach(item => state.expanded.add(item.id));
  }

  function countFiles(node) {
    return flattenFiles(node, []).length;
  }

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("sk")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function plural(number, one, few, many) {
    if (number === 1) return one;
    if (number >= 2 && number <= 4) return few;
    return many;
  }

  function updateUrl(push = true) {
    const params = new URLSearchParams();
    params.set("folder", state.activeNode.id);
    if (state.activePlot) params.set("plot", state.activePlot.file.id);
    const url = `#${params.toString()}`;
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
  }

  function buildTreeNode(node) {
    const li = document.createElement("li");
    li.className = "tree-item";

    const row = document.createElement("button");
    row.className = "tree-row";
    if (node.id === state.activeNode.id && !state.activePlot) row.classList.add("active");

    const hasChildren = (node.children || []).length > 0;
    const isOpen = state.expanded.has(node.id);
    row.innerHTML = `
      <span class="tree-chevron ${isOpen ? "open" : ""}">${hasChildren ? "▶" : ""}</span>
      <span class="tree-folder">📁</span>
      <span class="tree-name">${escapeHtml(node.name)}</span>
    `;

    row.addEventListener("click", event => {
      const clickedChevron = event.target.classList.contains("tree-chevron");
      if (clickedChevron && hasChildren) {
        if (state.expanded.has(node.id)) state.expanded.delete(node.id);
        else state.expanded.add(node.id);
        renderTree();
        return;
      }
      navigateToFolder(node);
    });
    li.appendChild(row);

    if (hasChildren && isOpen) {
      const ul = document.createElement("ul");
      ul.className = "tree-list";
      node.children.forEach(child => ul.appendChild(buildTreeNode(child)));
      li.appendChild(ul);
    }

    if ((node.files || []).length && node.id === state.activeNode.id) {
      const files = document.createElement("div");
      files.className = "tree-files";
      node.files.forEach(file => {
        const button = document.createElement("button");
        button.className = "tree-plot-row";
        if (state.activePlot?.file.id === file.id) button.classList.add("active");
        button.innerHTML = `
          <span class="tree-plot-icon">▥</span>
          <span class="tree-plot-name">${escapeHtml(file.name)}</span>
        `;
        button.addEventListener("click", () => openPlot(file, node));
        files.appendChild(button);
      });
      li.appendChild(files);
    }

    return li;
  }

  function renderTree() {
    refs.tree.replaceChildren();
    const ul = document.createElement("ul");
    ul.className = "tree-list";
    ul.appendChild(buildTreeNode(root));
    refs.tree.appendChild(ul);
  }

  function renderBreadcrumbs(node, file = null) {
    refs.breadcrumbs.replaceChildren();

    if (
      node === root
      && !file
    ) {
      refs.breadcrumbs.classList.add(
        "hidden"
      );

      return;
    }

    refs.breadcrumbs.classList.remove(
      "hidden"
    );

    const path = nodePath(node);
    path.forEach((item, index) => {
      const button = document.createElement("button");
      button.textContent = item.name;
      const isLastFolder = index === path.length - 1 && !file;
      if (isLastFolder) {
        button.className = "current";
        button.setAttribute("aria-current", "page");
      } else {
        button.addEventListener("click", () => navigateToFolder(item));
      }
      refs.breadcrumbs.appendChild(button);
      const needsSeparator = index < path.length - 1 || file;
      if (needsSeparator) {
        const separator = document.createElement("span");
        separator.className = "separator";
        separator.textContent = "›";
        refs.breadcrumbs.appendChild(separator);
      }
    });

    if (file) {
      const current = document.createElement("span");
      current.className = "current";
      current.textContent = file.name;
      refs.breadcrumbs.appendChild(current);
    }
  }

  function navigateToFolder(node, push = true) {
    state.activeNode = node;
    state.activePlot = null;
    state.compared = [];
    state.mode = "static";
    state.axesUnified = false;
    state.query = "";
    refs.searchInput.value = "";
    expandPath(node);
    render();
    closeSidebar();
    updateUrl(push);
  }

  function openPlot(file, node, push = true) {
    state.activeNode = node;
    state.activePlot = { file, node };
    state.compared = [{ file, node }];
    state.mode = "static";
    state.axesUnified = false;
    state.query = "";
    refs.searchInput.value = "";
    expandPath(node);
    render();
    closeSidebar();
    updateUrl(push);
  }

  function renderFolders(folders) {
    refs.folderGrid.replaceChildren();
    folders.forEach(folder => {
      const card = document.createElement("button");
      card.className = "folder-card";
      const total = countFiles(folder);
      card.innerHTML = `
        <span class="folder-icon-large">📁</span>
        <span>
          <h4>${escapeHtml(folder.name)}</h4>
          <p>${total} ${plural(total, "graf", "grafy", "grafov")}</p>
        </span>
      `;
      card.addEventListener("click", () => navigateToFolder(folder));
      refs.folderGrid.appendChild(card);
    });
    refs.folderSection.classList.toggle("hidden", folders.length === 0);
    refs.folderHeading.textContent = state.query ? "Nájdené priečinky" : "Priečinky";
  }

  function renderFiles(items) {
    refs.plotGrid.replaceChildren();
    refs.plotGrid.classList.toggle("list-view", state.view === "list");

    items.forEach(({ file, node }) => {
      const card = document.createElement("button");
      card.className = "plot-card";
      card.innerHTML = `
        <span class="plot-thumb"><img src="${escapeHtml(imagePath(file))}" alt="" loading="lazy"></span>
        <span class="plot-info">
          <p class="plot-meta">${escapeHtml(node.name)}</p>
          <h4>${escapeHtml(file.name)}</h4>
          <p>${escapeHtml(file.caption || "")}</p>
        </span>
      `;
      card.addEventListener("click", () => openPlot(file, node));
      refs.plotGrid.appendChild(card);
    });

    refs.fileSection.classList.toggle("hidden", items.length === 0);
    refs.fileHeading.textContent = state.query ? "Nájdené grafy" : "Grafy";
  }

  function renderSearch() {
    const q = normalize(state.query);
    const matchingNodes = nodeEntries
      .map(item => item.node)
      .filter(node => node !== root && normalize(node.name).includes(q));
    const matchingFiles = fileIndex.filter(({ file, node }) =>
      normalize(`${file.name} ${file.caption || ""} ${node.name}`).includes(q)
    );

    refs.galleryView.classList.remove("hidden");
    refs.workspaceView.classList.add("hidden");
    refs.sectionEyebrow.textContent = "Vyhľadávanie";
    refs.sectionTitle.textContent = `Výsledky pre „${state.query}“`;
    refs.sectionSummary.textContent = `${matchingNodes.length} priečinkov a ${matchingFiles.length} grafov`;
    refs.breadcrumbs.replaceChildren();
    refs.breadcrumbs.classList.add(
      "hidden"
    );
    renderFolders(matchingNodes);
    renderFiles(matchingFiles);
    refs.emptyState.classList.toggle("hidden", matchingNodes.length + matchingFiles.length !== 0);
  }

  function renderGallery() {
    const node = state.activeNode;
    const files = (node.files || []).map(file => ({ file, node }));
    const folders = node.children || [];

    refs.galleryView.classList.remove("hidden");
    refs.workspaceView.classList.add("hidden");
    renderBreadcrumbs(node);
    refs.sectionEyebrow.textContent = node === root ? "Bakalárska práca" : "Kapitola";
    refs.sectionTitle.textContent = node.name;
    if (node === root) {
      refs.sectionSummary.textContent =
        "Grafy sú zoradené podľa rovnakej štruktúry ako výsledková časť práce.";
    }

    else if (folders.length === 0) {
      refs.sectionSummary.textContent =
        `${files.length} ${plural(
          files.length,
          "graf",
          "grafy",
          "grafov"
        )}`;
    }

    else {
      refs.sectionSummary.textContent =
        `${folders.length} ${plural(
          folders.length,
          "podpriečinok",
          "podpriečinky",
          "podpriečinkov"
        )} · ${files.length} ${plural(
          files.length,
          "graf",
          "grafy",
          "grafov"
        )}`;
    }
    renderFolders(folders);
    renderFiles(files);
    refs.emptyState.classList.toggle("hidden", folders.length + files.length !== 0);
  }

  function selectedInteractiveAvailable() {
    return state.compared.length > 0 && state.compared.every(item => Boolean(item.file.interactive));
  }

  function selectedCompatible() {
    if (state.compared.length < 2) return false;
    const groups = new Set(state.compared.map(item => item.file.axisGroup).filter(Boolean));
    return groups.size === 1 && state.compared.every(item => Boolean(item.file.axisGroup));
  }

  function compatibilityLabel() {
    if (state.mode === "static") {
      if (
        state.compared.length > 1
        && selectedCompatible()
      ) {
        return (
          "Statické zobrazenie · osi možno zjednotiť "
          + "v interaktívnom režime"
        );
      }

      if (state.compared.length > 1) {
        return "Statické zobrazenie";
      }

      return "Statické zobrazenie";
    }

    if (selectedCompatible()) {
      return state.axesUnified
        ? "Interaktívne zobrazenie · spoločný rozsah osí"
        : "Interaktívne zobrazenie · samostatné rozsahy osí";
    }

    return "Interaktívne zobrazenie";
  }

  function renderWorkspace() {
    const primary = state.activePlot;
    if (!primary) return renderGallery();

    if (
      state.mode === "interactive"
      && !selectedInteractiveAvailable()
    ) {
      state.mode = "static";
      state.axesUnified = false;
    }

    refs.galleryView.classList.add("hidden");
    refs.workspaceView.classList.remove("hidden");
    renderBreadcrumbs(primary.node, primary.file);
    refs.workspaceFolder.textContent = primary.node.name;
    refs.workspaceTitle.textContent = primary.file.name;
    refs.workspaceSummary.textContent =
      state.compared.length === 1
        ? "Statické a interaktívne zobrazenie grafu."
        : `${state.compared.length} ${plural(
            state.compared.length,
            "graf",
            "grafy",
            "grafov"
          )} v porovnaní.`;

    const interactiveAvailable = selectedInteractiveAvailable();
    refs.interactiveToggle.disabled = !interactiveAvailable;
    refs.interactiveToggle.innerHTML = state.mode === "interactive"
      ? '<span aria-hidden="true">▧</span> Prepnúť na statické'
      : '<span aria-hidden="true">⌁</span> Prepnúť na interaktívne';
    refs.interactiveToggle.title = interactiveAvailable
      ? "Prepnúť spôsob zobrazenia"
      : "Interaktívna verzia tohto grafu nie je dostupná.";

    refs.addComparison.disabled = state.compared.length >= 4;
    refs.addComparison.title = state.compared.length >= 4 ? "Naraz možno porovnať najviac štyri grafy" : "Pridať ďalší graf";

    const canEditAxes = state.mode === "interactive" && interactiveAvailable;
    refs.axisSettings.disabled = !canEditAxes;
    refs.unifyAxes.disabled = !(canEditAxes && selectedCompatible());
    refs.unifyAxes.innerHTML = state.axesUnified
      ? '<span aria-hidden="true">✓</span> Osi zjednotené'
      : '<span aria-hidden="true">↔</span> Zjednotiť osi';

    refs.comparisonCount.textContent = `${state.compared.length} zo 4 ${plural(state.compared.length, "grafu", "grafov", "grafov")}`;
    refs.compatibilityText.textContent = compatibilityLabel();
    refs.clearComparisons.classList.toggle("hidden", state.compared.length <= 1);

    renderComparisonGrid();
  }

  function renderComparisonGrid() {
    refs.comparisonGrid.replaceChildren();
    refs.comparisonGrid.className = `comparison-grid count-${state.compared.length}`;

    state.compared.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "comparison-card";
      card.dataset.plotId = item.file.id;

      const header = document.createElement("header");
      header.className = "comparison-card-header";
      header.innerHTML = `
        <div>
          <p>${escapeHtml(item.node.name)}</p>
          <h3>${escapeHtml(item.file.name)}</h3>
        </div>
      `;

      if (
        state.compared.length === 1
        && index === 0
      ) {
        const close = document.createElement("button");
        close.className = "remove-plot";
        close.type = "button";
        close.title = "Zavrieť graf a vrátiť sa na stránku Výsledky";
        close.setAttribute(
          "aria-label",
          "Zavrieť graf a vrátiť sa na stránku Výsledky"
        );
        close.textContent = "×";

        close.addEventListener(
          "click",
          () => {
            navigateToFolder(
              root
            );
          }
        );

        header.appendChild(
          close
        );
      }

      else if (index > 0) {
        const remove = document.createElement("button");
        remove.className = "remove-plot";
        remove.type = "button";
        remove.title = "Odstrániť z porovnania";
        remove.setAttribute("aria-label", "Odstrániť graf");
        remove.textContent = "×";

        remove.addEventListener(
          "click",
          () => {
            state.compared.splice(
              index,
              1
            );

            state.axesUnified = false;

            renderWorkspace();
          }
        );

        header.appendChild(
          remove
        );
      }

      const stage = document.createElement("div");
      stage.className = "comparison-stage";
      if (state.mode === "static") {
        const img = document.createElement("img");
        const requestedPath = imagePath(item.file);
        img.src = requestedPath;
        img.alt = `${item.file.name} – ${item.node.name}`;

        img.addEventListener("error", () => {
          stage.replaceChildren();

          const error = document.createElement("div");
          error.className = "missing-image";
          error.innerHTML = `
            <strong>Obrázok sa nepodarilo načítať.</strong>
            <span>Obnovte stránku alebo skúste graf otvoriť neskôr.</span>
          `;

          stage.appendChild(error);
        });

        stage.appendChild(img);
      } else {
        stage.classList.add("interactive-stage");

        const host = document.createElement("div");
        host.className = "plotly-host";
        host.id = `plotly-${item.file.id}`;
        stage.appendChild(host);
      }

      card.append(header, stage);
      refs.comparisonGrid.appendChild(card);
    });

    if (state.mode === "interactive") renderInteractiveFigures();
  }

  function render() {
    renderTree();
    document.querySelectorAll(".view-button").forEach(button => {
      button.classList.toggle("active", button.dataset.view === state.view);
    });

    if (state.query.trim()) renderSearch();
    else if (state.activePlot) renderWorkspace();
    else renderGallery();
  }

  function openComparisonPicker() {
    if (state.compared.length >= 4) return;
    refs.comparisonSearch.value = "";
    renderComparisonOptions("");
    refs.comparisonDialog.showModal();
    setTimeout(() => refs.comparisonSearch.focus(), 50);
  }

  function renderComparisonOptions(query) {
    const q = normalize(query);
    const selectedIds = new Set(state.compared.map(item => item.file.id));
    const candidates = fileIndex.filter(({ file, node }) => {
      if (selectedIds.has(file.id)) return false;
      return !q || normalize(`${file.name} ${node.name}`).includes(q);
    });

    const groups = new Map();
    candidates.forEach(item => {
      if (!groups.has(item.node.id)) groups.set(item.node.id, { node: item.node, items: [] });
      groups.get(item.node.id).items.push(item);
    });

    refs.comparisonList.replaceChildren();
    if (!candidates.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<h3>Nenašiel sa žiadny ďalší graf</h3><p>Skúste iný výraz alebo odstráňte niektorý z už načítaných grafov.</p>";
      refs.comparisonList.appendChild(empty);
      return;
    }

    groups.forEach(({ node, items }) => {
      const section = document.createElement("section");
      section.className = "comparison-group";
      const title = document.createElement("h3");
      title.className = "comparison-group-title";
      title.textContent = node.name;
      section.appendChild(title);

      items.forEach(item => {
        const compatible = item.file.axisGroup && item.file.axisGroup === state.activePlot.file.axisGroup;
        const button = document.createElement("button");
        button.className = "comparison-option";
        button.innerHTML = `
          <span>
            <strong>${escapeHtml(item.file.name)}</strong>
            <small>${escapeHtml(item.file.plotType || "graf")}</small>
          </span>
          <span class="compatibility-badge ${compatible ? "" : "other"}">${compatible ? "kompatibilný" : "iný typ"}</span>
        `;
        button.addEventListener("click", () => {
          if (state.compared.length < 4) state.compared.push(item);
          state.axesUnified = false;
          refs.comparisonDialog.close();
          renderWorkspace();
        });
        section.appendChild(button);
      });
      refs.comparisonList.appendChild(section);
    });
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => refs.toast.classList.add("hidden"), 3300);
  }

  async function ensurePlotly() {
    if (window.Plotly) return;
    if (state.plotlyLoaded) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PLOTLY_CDN;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Nepodarilo sa načítať Plotly."));
      document.head.appendChild(script);
    });
    state.plotlyLoaded = true;
  }

  function wait(milliseconds) {
    return new Promise(
      resolve => setTimeout(
        resolve,
        milliseconds
      )
    );
  }


  async function fetchPlotlyJson(
    relativePath,
  ) {
    const url = new URL(
      relativePath,
      document.baseURI
    );

    let lastError = null;

    for (
      let attempt = 1;
      attempt <= 2;
      attempt += 1
    ) {
      try {
        const requestUrl = new URL(
          url.href
        );

        requestUrl.searchParams.set(
          "_plotly",
          String(Date.now())
        );

        const response = await fetch(
          requestUrl.href,
          {
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status} ${response.statusText}`
          );
        }

        const text = await response.text();

        try {
          return JSON.parse(
            text
          );
        }

        catch (parseError) {
          throw new Error(
            "Súbor bol nájdený, ale neobsahuje platný JSON."
          );
        }
      }

      catch (error) {
        lastError = error;

        if (attempt < 2) {
          await wait(
            250
          );
        }
      }
    }

    console.error(
      "Plotly JSON load failed:",
      relativePath,
      lastError
    );

    throw new Error(
      "Interaktívna verzia grafu sa nepodarila načítať."
    );
  }


  async function loadFigure(item) {
    if (
      state.plotlyFigures.has(
        item.file.id
      )
    ) {
      return state.plotlyFigures.get(
        item.file.id
      );
    }

    if (
      location.protocol === "file:"
    ) {
      throw new Error(
        "Interaktívne grafy fungujú iba cez webový server, "
        + "nie pri priamom otvorení súboru."
      );
    }

    const figure = await fetchPlotlyJson(
      item.file.interactive
    );

    state.plotlyFigures.set(
      item.file.id,
      figure
    );

    return figure;
  }

  function isDayAxisItem(item) {
    return [
      "average-current-density",
      "point-a",
      "point-b",
      "point-c"
    ].includes(
      item?.file?.plotType
    );
  }


  function dayAxisRangeFromFigure(figure) {
    const configuredRange =
      figure?.layout?.xaxis?.range;

    if (
      Array.isArray(configuredRange)
      && configuredRange.length >= 2
      && Number.isFinite(
        Number(configuredRange[1])
      )
    ) {
      return [
        0,
        Math.max(
          Number(configuredRange[1]),
          1
        )
      ];
    }

    return [
      0,
      8
    ];
  }


  async function renderInteractiveFigures() {
    try {
      await ensurePlotly();
    }

    catch (error) {
      state.mode = "static";
      renderWorkspace();

      showToast(
        error.message
        || "Plotly sa nepodarilo načítať."
      );

      return;
    }


    const results = await Promise.allSettled(
      state.compared.map(
        async item => {
          const host = document.getElementById(
            `plotly-${item.file.id}`
          );

          if (!host) {
            return;
          }

          try {
            const figure = await loadFigure(
              item
            );

            const layout = {
              ...(figure.layout || {}),

              autosize: true,

              margin: {
                l: 70,
                r: 25,
                t: 35,
                b: 65,
                ...(figure.layout?.margin || {})
              }
            };

            const config = {
              responsive: true,
              displaylogo: false,
              ...(figure.config || {})
            };

            await Plotly.newPlot(
              host,
              figure.data || [],
              layout,
              config
            );

            if (isDayAxisItem(item)) {
              await Plotly.relayout(
                host,
                {
                  "xaxis.range":
                    dayAxisRangeFromFigure(
                      figure
                    ),

                  "xaxis.autorange": false,
                  "xaxis.tickmode": "linear",
                  "xaxis.tick0": 0,
                  "xaxis.dtick": 1
                }
              );
            }
          }

          catch (error) {
            host.replaceChildren();

            const message = document.createElement(
              "div"
            );

            message.className =
              "interactive-load-error";

            message.innerHTML = `
              <strong>Interaktívny graf sa nepodarilo načítať.</strong>
              <span>Obnovte stránku alebo skúste načítanie zopakovať.</span>
              <button type="button">Skúsiť znova</button>
            `;

            message
              .querySelector("button")
              .addEventListener(
                "click",
                () => {
                  state.plotlyFigures.delete(
                    item.file.id
                  );

                  renderWorkspace();
                }
              );

            host.appendChild(
              message
            );

            throw error;
          }
        }
      )
    );


    const failed = results.filter(
      result => result.status === "rejected"
    );


    if (
      state.axesUnified
      && failed.length === 0
    ) {
      await applyUnifiedAxes();
    }


    if (failed.length > 0) {
      const firstError =
        failed[0].reason;

      showToast(
        firstError?.message
        || "Niektorý interaktívny graf sa nepodarilo načítať."
      );
    }
  }

  function decodePlotlyArray(value) {
    if (Array.isArray(value)) {
      return value.flat(Infinity);
    }

    if (ArrayBuffer.isView(value)) {
      return Array.from(value);
    }

    if (
      !value
      || typeof value !== "object"
      || typeof value.bdata !== "string"
    ) {
      return [];
    }

    const binary = atob(value.bdata);
    const bytes = new Uint8Array(binary.length);

    for (
      let index = 0;
      index < binary.length;
      index += 1
    ) {
      bytes[index] = binary.charCodeAt(index);
    }

    const dtype = String(
      value.dtype || ""
    )
      .replace(/[<>=|]/g, "")
      .toLowerCase();

    const buffer = bytes.buffer;

    const constructors = {
      f8: Float64Array,
      f4: Float32Array,
      i1: Int8Array,
      u1: Uint8Array,
      i2: Int16Array,
      u2: Uint16Array,
      i4: Int32Array,
      u4: Uint32Array,
    };

    const Constructor = constructors[dtype];

    if (Constructor) {
      return Array.from(
        new Constructor(buffer)
      );
    }

    if (
      dtype === "i8"
      || dtype === "u8"
    ) {
      const view = new DataView(buffer);
      const values = [];

      for (
        let offset = 0;
        offset + 8 <= view.byteLength;
        offset += 8
      ) {
        const number = dtype === "i8"
          ? view.getBigInt64(offset, true)
          : view.getBigUint64(offset, true);

        values.push(
          Number(number)
        );
      }

      return values;
    }

    return [];
  }


  function numericExtent(values) {
    const numbers = values
      .flat(Infinity)
      .map(Number)
      .filter(Number.isFinite);

    if (!numbers.length) {
      return null;
    }

    return [
      Math.min(...numbers),
      Math.max(...numbers),
    ];
  }


  function axisExtentFromFigure(
    figure,
    axisName,
    traceKey,
  ) {
    const axis = figure.layout?.[
      axisName
    ] || {};

    if (
      Array.isArray(axis.range)
      && axis.range.length >= 2
      && axis.range.every(
        value => Number.isFinite(
          Number(value)
        )
      )
    ) {
      return [
        Number(axis.range[0]),
        Number(axis.range[1]),
      ];
    }

    const values = [];

    (figure.data || []).forEach(
      trace => {
        const decoded = decodePlotlyArray(
          trace[traceKey]
        );

        if (decoded.length) {
          values.push(decoded);
        }
      }
    );

    const extent = numericExtent(values);

    if (
      extent
      && axis.rangemode === "tozero"
    ) {
      extent[0] = Math.min(
        extent[0],
        0
      );

      extent[1] = Math.max(
        extent[1],
        0
      );
    }

    return extent;
  }


  async function collectExtents() {
    const xExtents = [];
    const yExtents = [];

    for (
      const item of state.compared
    ) {
      const figure = await loadFigure(
        item
      );

      const xExtent = axisExtentFromFigure(
        figure,
        "xaxis",
        "x",
      );

      const yExtent = axisExtentFromFigure(
        figure,
        "yaxis",
        "y",
      );

      if (xExtent) {
        xExtents.push(xExtent);
      }

      if (yExtent) {
        yExtents.push(yExtent);
      }
    }

    return {
      x: numericExtent(xExtents),
      y: numericExtent(yExtents),
    };
  }

  async function applyUnifiedAxes() {
    if (!selectedCompatible()) return;

    const extents = await collectExtents();
    const update = {};

    if (extents.x) {
      const allUseDayAxis =
        state.compared.every(
          isDayAxisItem
        );

      update["xaxis.range"] =
        allUseDayAxis
          ? [
              0,
              Math.max(
                Number(extents.x[1]),
                1
              )
            ]
          : extents.x;
    }

    if (extents.y) {
      update["yaxis.range"] =
        extents.y;
    }

    await Promise.all(
      state.compared.map(
        item => {
          const host =
            document.getElementById(
              `plotly-${item.file.id}`
            );

          return host
            ? Plotly.relayout(
                host,
                update
              )
            : Promise.resolve();
        }
      )
    );
  }

  async function resetAutomaticAxes(
    items = state.compared
  ) {
    await Promise.all(
      items.map(
        async item => {
          const host =
            document.getElementById(
              `plotly-${item.file.id}`
            );

          if (!host) {
            return;
          }

          if (isDayAxisItem(item)) {
            const figure =
              await loadFigure(item);

            return Plotly.relayout(
              host,
              {
                "xaxis.range":
                  dayAxisRangeFromFigure(
                    figure
                  ),

                "xaxis.autorange": false,
                "xaxis.tickmode": "linear",
                "xaxis.tick0": 0,
                "xaxis.dtick": 1,

                "yaxis.autorange": true,
                "xaxis.type": "linear",
                "yaxis.type": "linear"
              }
            );
          }

          return Plotly.relayout(
            host,
            {
              "xaxis.autorange": true,
              "yaxis.autorange": true,
              "xaxis.type": "linear",
              "yaxis.type": "linear"
            }
          );
        }
      )
    );
  }

  function openAxisSettings() {
    refs.axisTarget.replaceChildren();
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "Všetky zobrazené grafy";
    refs.axisTarget.appendChild(all);
    state.compared.forEach(item => {
      const option = document.createElement("option");
      option.value = item.file.id;
      option.textContent = `${item.node.name} — ${item.file.name}`;
      refs.axisTarget.appendChild(option);
    });
    [refs.xMin, refs.xMax, refs.yMin, refs.yMax].forEach(input => input.value = "");
    refs.settingsDialog.showModal();
  }

  function targetItems() {
    return refs.axisTarget.value === "all"
      ? state.compared
      : state.compared.filter(item => item.file.id === refs.axisTarget.value);
  }

  function numberOrNull(input) {
    if (input.value.trim() === "") return null;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : null;
  }

  refs.searchInput.addEventListener("input", event => {
    state.query = event.target.value;
    if (state.query.trim()) state.activePlot = null;
    render();
  });

  document.querySelectorAll(".view-button").forEach(button => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      localStorage.setItem("thesis-view", state.view);
      render();
    });
  });

  refs.backToFolder.addEventListener("click", () => navigateToFolder(state.activeNode));
  refs.addComparison.addEventListener("click", openComparisonPicker);
  refs.closeComparisonDialog.addEventListener("click", () => refs.comparisonDialog.close());
  refs.comparisonSearch.addEventListener("input", event => renderComparisonOptions(event.target.value));
  refs.closeSettingsDialog.addEventListener("click", () => refs.settingsDialog.close());

  refs.clearComparisons.addEventListener("click", () => {
    state.compared = state.compared.slice(0, 1);
    state.axesUnified = false;
    renderWorkspace();
  });

  refs.interactiveToggle.addEventListener("click", async () => {
    if (!selectedInteractiveAvailable()) {
      showToast("Interaktívna verzia tohto grafu nie je dostupná.");
      return;
    }
    state.mode = state.mode === "static" ? "interactive" : "static";
    state.axesUnified = false;
    renderWorkspace();
  });

  refs.unifyAxes.addEventListener("click", async () => {
    if (state.mode !== "interactive" || !selectedCompatible()) return;
    state.axesUnified = !state.axesUnified;
    if (state.axesUnified) await applyUnifiedAxes();
    else await resetAutomaticAxes();
    renderWorkspace();
  });

  refs.axisSettings.addEventListener("click", openAxisSettings);

  refs.axisForm.addEventListener("submit", async event => {
    event.preventDefault();
    const items = targetItems();
    const xMin = numberOrNull(refs.xMin);
    const xMax = numberOrNull(refs.xMax);
    const yMin = numberOrNull(refs.yMin);
    const yMax = numberOrNull(refs.yMax);
    const update = {
      "xaxis.type": "linear",
      "yaxis.type": "linear"
    };

    if (
      xMin !== null
      && xMax !== null
    ) {
      update["xaxis.range"] = [
        xMin,
        xMax
      ];
    }

    if (
      yMin !== null
      && yMax !== null
    ) {
      update["yaxis.range"] = [
        yMin,
        yMax
      ];
    }

    await Promise.all(items.map(item => {
      const host = document.getElementById(`plotly-${item.file.id}`);
      return host ? Plotly.relayout(host, update) : Promise.resolve();
    }));
    state.axesUnified = false;
    refs.settingsDialog.close();
    refs.unifyAxes.innerHTML = '<span aria-hidden="true">↔</span> Zjednotiť osi';
    refs.compatibilityText.textContent = compatibilityLabel();
  });

  refs.resetAxes.addEventListener("click", async () => {
    await resetAutomaticAxes(targetItems());
    state.axesUnified = false;
    refs.settingsDialog.close();
    refs.unifyAxes.innerHTML = '<span aria-hidden="true">↔</span> Zjednotiť osi';
    refs.compatibilityText.textContent = compatibilityLabel();
  });

  function openSidebar() {
    refs.sidebar.classList.add("open");
    refs.backdrop.classList.remove("hidden");
    refs.sidebarToggle.setAttribute("aria-expanded", "true");
  }
  function closeSidebar() {
    refs.sidebar.classList.remove("open");
    refs.backdrop.classList.add("hidden");
    refs.sidebarToggle.setAttribute("aria-expanded", "false");
  }
  refs.sidebarToggle.addEventListener("click", openSidebar);
  refs.backdrop.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && refs.sidebar.classList.contains("open")) {
      closeSidebar();
    }
  });

  function loadFromUrl() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const node = nodeIndex.get(params.get("folder")) || root;
    const plotEntry = fileById.get(params.get("plot"));
    state.activeNode = node;
    expandPath(node);
    state.query = "";
    refs.searchInput.value = "";

    if (plotEntry) {
      state.activeNode = plotEntry.node;
      state.activePlot = plotEntry;
      state.compared = [plotEntry];
    } else {
      state.activePlot = null;
      state.compared = [];
    }
    state.mode = "static";
    state.axesUnified = false;
    render();
  }

  window.addEventListener("popstate", loadFromUrl);
  loadFromUrl();
  if (!location.hash) updateUrl(false);
})();
