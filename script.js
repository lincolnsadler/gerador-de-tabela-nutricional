const $ = (id) => document.getElementById(id);

// ===== util =====
function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
        }[c];
    });
}

function numVal(v, fallback) {
    const n = parseInt(String(v || "").trim(), 10);
    return Number.isFinite(n) ? n : fallback;
}

// quebra aproximada por caracteres
function wrapLinesByChar(text, maxChars) {
    const words = String(text || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (test.length > maxChars && cur) {
            lines.push(cur);
            cur = w;
        } else {
            cur = test;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

function parseCSV(text) {
    const lines = String(text ?? "")
        .replace(/\r\n/g, "\n")
        .split(/\n|\\n/g)
        .map((l) => l.trim())
        .filter(Boolean);

    return lines.map((line) => {
        const parts = line.split(",").map((x) => x.trim());
        return {
            name: parts[0] || "",
            qty: parts[1] || "",
            unit: parts[2] || "",
            dv_us: parts[3] || "",
            vd_br: parts[4] || "",
        };
    });
}

function downloadText(filename, text) {
    const blob = new Blob([text], {
        type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ===== PNG ALTA QUALIDADE (super-sampling) =====
async function downloadPNGFromSVG(svgString, outW, outH, filename, scale = 3) {
    const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = svgUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(outW * scale);
        canvas.height = Math.round(outH * scale);

        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // fundo branco (para transparente basta remover estas 2 linhas)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(img, 0, 0, outW, outH);

        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png"),
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

// ===== state =====
let mode = "us";
let rows = [];

// ===== builders =====
function buildUS(data, width, height, useAutoHeight) {
    const pad = 18;
    const innerW = width - pad * 2;
    let y = pad;

    const rowFont = 14;
    const footerFont = 12;

    const servings = esc($("usServings").value);
    const servingSize = esc($("usServingSize").value);

    const footerTextUS =
        "* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. " +
        "2,000 calories a day is used for general nutrition advice.";

    const maxCharsFooter = Math.max(38, Math.floor((innerW - 20) / 6.6));
    const footerLines = wrapLinesByChar(footerTextUS, maxCharsFooter);
    const footerLineH = 16;
    const footerBlockH = 10 + footerLines.length * footerLineH + 8;

    const rowStepUS = 20;
    const ruleOffsetUS = 8;

    const lineH = 22;
    const baseH = pad * 2 + 160 + data.length * lineH + footerBlockH + 60;
    const h = useAutoHeight ? baseH : Math.max(260, height);

    const bottomY = h - pad;
    const footerYTop = bottomY - footerBlockH;

    const svg = [];
    svg.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">`,
    );
    svg.push(`<rect x="0" y="0" width="${width}" height="${h}" fill="#fff"/>`);
    svg.push(
        `<rect x="${pad}" y="${pad}" width="${innerW}" height="${
            h - pad * 2
        }" fill="#fff" stroke="#000" stroke-width="4"/>`,
    );

    svg.push(`<defs>`);
    svg.push(`<clipPath id="clipRowsUS">`);
    svg.push(
        `<rect id="clipRectUS" x="${pad + 6}" y="0" width="${
            innerW - 12
        }" height="0" />`,
    );
    svg.push(`</clipPath>`);
    svg.push(`</defs>`);

    y += 34;
    svg.push(
        `<text x="${
            pad + 10
        }" y="${y}" font-family="Arial" font-size="34" font-weight="900">Supplement Facts</text>`,
    );
    y += 18;
    svg.push(
        `<line x1="${pad}" y1="${y}" x2="${
            pad + innerW
        }" y2="${y}" stroke="#000" stroke-width="10" />`,
    );

    y += 26;
    svg.push(
        `<text x="${
            pad + 10
        }" y="${y}" font-family="Arial" font-size="16">Servings Per Container ${servings}</text>`,
    );
    y += 20;
    svg.push(
        `<text x="${
            pad + 10
        }" y="${y}" font-family="Arial" font-size="16">Serving Size ${servingSize}</text>`,
    );
    y += 16;
    svg.push(
        `<line x1="${pad}" y1="${y}" x2="${
            pad + innerW
        }" y2="${y}" stroke="#000" stroke-width="6" />`,
    );

    y += 26;
    const col1 = pad + 10;
    const col2 = pad + innerW * 0.7;
    const col3 = pad + innerW - 10;
    svg.push(
        `<text x="${col2}" y="${y}" font-family="Arial" font-size="14" font-weight="700" text-anchor="end">Amount Per Serving</text>`,
    );
    svg.push(
        `<text x="${col3}" y="${y}" font-family="Arial" font-size="14" font-weight="700" text-anchor="end">% Daily Value</text>`,
    );
    y += 10;
    svg.push(
        `<line x1="${pad}" y1="${y}" x2="${
            pad + innerW
        }" y2="${y}" stroke="#000" stroke-width="2" />`,
    );

    y += 18;
    const rowsClipY = y - 16;

    svg.push(`<g clip-path="url(#clipRowsUS)">`);

    data.forEach((r) => {
        const name = esc(r.name);
        const amt = esc(r.qty ? `${r.qty} ${r.unit}`.trim() : "");
        const dv = esc(r.dv_us);

        svg.push(
            `<text x="${col1}" y="${y}" font-family="Arial" font-size="${rowFont}">${name}</text>`,
        );
        svg.push(
            `<text x="${col2}" y="${y}" font-family="Arial" font-size="${rowFont}" text-anchor="end">${amt}</text>`,
        );
        svg.push(
            `<text x="${col3}" y="${y}" font-family="Arial" font-size="${rowFont}" text-anchor="end">${dv}</text>`,
        );

        const ruleY = y + ruleOffsetUS;
        svg.push(
            `<line x1="${pad + 8}" y1="${ruleY}" x2="${
                pad + innerW - 8
            }" y2="${ruleY}" stroke="#000" stroke-width="1" opacity="0.35"/>`,
        );

        y += rowStepUS;
    });

    svg.push(`</g>`);

    const thickY = footerYTop - 10;
    svg.push(
        `<line x1="${pad}" y1="${thickY}" x2="${
            pad + innerW
        }" y2="${thickY}" stroke="#000" stroke-width="6" />`,
    );

    let fy = footerYTop + 18;
    footerLines.forEach((line) => {
        svg.push(
            `<text x="${
                pad + 10
            }" y="${fy}" font-family="Arial" font-size="${footerFont}">${esc(
                line,
            )}</text>`,
        );
        fy += footerLineH;
    });

    svg.push(`</svg>`);

    const clipH = Math.max(10, thickY - 10 - rowsClipY);
    return svg
        .join("")
        .replace(
            `y="0" width="${innerW - 12}" height="0"`,
            `y="${rowsClipY}" width="${innerW - 12}" height="${clipH}"`,
        );
}

// ===== NOVO BR: só Porção + %VD*, sem coluna vazia, grid completo =====
function buildBR(data, width, height, useAutoHeight) {
    const pad = 18;
    const innerW = width - pad * 2;
    let y = pad;

    const rowFont = 14;
    const footerFont = 14; // tamanho fixo do rodapé

    // valor bruto do input de porção (sem escapar ainda)
    const brPorcaoVal = String($("brPorcao").value || "");
    const porcoes = esc($("brPorcoes").value);
    const porcao = esc(brPorcaoVal);
    const medida = esc($("brMedida").value);

    // Texto para o CABEÇALHO: só a parte antes do "(" (ex.: "1 g (2 cápsulas)" -> "1 g")
    const porcaoHeaderRaw = brPorcaoVal.split("(")[0].trim() || "Porção";
    const porcaoHeader = esc(porcaoHeaderRaw);

    const footerA =
        "Não contém quantidades significativas de valor energético, carboidratos, açúcares totais, açúcares adicionados, gorduras totais, " +
        "gorduras saturadas, gorduras trans, fibras alimentares e sódio.";
    const footerB = "*Percentual de valores diários fornecidos pela porção.";

    // ===== QUEBRA DE LINHA DEPENDENDO DA LARGURA =====
    // Aproximação: cada caractere ~7 px em Arial 14px.
    // Usamos quase a largura total, com uma margem pequena.
    const charW = 7.0;
    const maxCharsFooter = Math.max(
        35,
        Math.floor((innerW - 26) / charW), // 26px de margem total (~13 cada lado)
    );

    const linesA = wrapLinesByChar(footerA, maxCharsFooter);
    const linesB = wrapLinesByChar(footerB, maxCharsFooter);

    const footerLineH = footerFont + 4;
    const footerBlockH =
        8 +
        linesA.length * footerLineH +
        10 +
        1 +
        18 +
        linesB.length * footerLineH +
        8;

    const lineH = 22;
    const baseH = pad * 2 + 160 + data.length * lineH + footerBlockH + 60;
    const h = useAutoHeight ? baseH : Math.max(260, height);

    const bottomY = h - pad;
    const footerYTop = bottomY - footerBlockH;
    const beforeFooterY = footerYTop - 10;

    const svg = [];
    svg.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">`,
    );
    svg.push(`<rect x="0" y="0" width="${width}" height="${h}" fill="#fff"/>`);
    svg.push(
        `<rect x="${pad}" y="${pad}" width="${innerW}" height="${
            h - pad * 2
        }" fill="#fff" stroke="#000" stroke-width="4"/>`,
    );

    // clip para a área de linhas
    svg.push(`<defs>`);
    svg.push(`<clipPath id="clipRowsBR">`);
    svg.push(
        `<rect id="clipRectBR" x="${pad}" y="0" width="${innerW}" height="0" />`,
    );
    svg.push(`</clipPath>`);
    svg.push(`</defs>`);

    // =========================
    // TÍTULO CENTRALIZADO
    // =========================
    y += 34;
    const titleX = pad + innerW / 2;
    svg.push(
        `<text x="${titleX}" y="${y}" font-family="Arial" font-size="26" font-weight="900" text-anchor="middle">INFORMAÇÃO NUTRICIONAL</text>`,
    );

    // linha fina logo abaixo do título
    y += 10;
    svg.push(
        `<line x1="${pad}" y1="${y}" x2="${
            pad + innerW
        }" y2="${y}" stroke="#000" stroke-width="1" />`,
    );

    // =========================
    // PORÇÕES
    // =========================
    y += 26;
    svg.push(
        `<text x="${
            pad + 10
        }" y="${y}" font-family="Arial" font-size="14">Porções por embalagem: ${porcoes}</text>`,
    );
    y += 20;
    const porcLine = medida
        ? `Porção: ${porcao} (${medida})`
        : `Porção: ${porcao}`;
    svg.push(
        `<text x="${
            pad + 10
        }" y="${y}" font-family="Arial" font-size="14">${esc(porcLine)}</text>`,
    );

    // linha grossa após as porções (topo da grade)
    y += 14;
    const gridTopY = y;
    svg.push(
        `<line x1="${pad}" y1="${gridTopY}" x2="${
            pad + innerW
        }" y2="${gridTopY}" stroke="#000" stroke-width="4" />`,
    );

    // =========================
    // CABEÇALHO: [valor da porção] | %VD*
    // =========================
    y += 22;
    const headerTextY = y;

    const xLeft = pad;
    const xRight = pad + innerW;

    // coluna vertical entre NOME e COLUNA DE PORÇÃO
    const xColPor = pad + innerW * 0.72;
    // coluna vertical entre COLUNA DE PORÇÃO e %VD*
    const xColVD = pad + innerW * 0.88;

    const xPorHeader = (xColPor + xColVD) / 2; // centro da coluna Porção
    const xVDHeader = (xColVD + xRight) / 2; // centro da coluna %VD*

    // título com o VALOR da porção (ex: "1 g")
    svg.push(
        `<text x="${xPorHeader}" y="${headerTextY}" font-family="Arial" font-size="13" font-weight="700" text-anchor="middle">${porcaoHeader}</text>`,
    );
    // título "%VD*" CENTRALIZADO
    svg.push(
        `<text x="${xVDHeader}" y="${headerTextY}" font-family="Arial" font-size="13" font-weight="700" text-anchor="middle">%VD*</text>`,
    );

    // linha fina logo abaixo do cabeçalho
    y += 8;
    const headerBottomY = y;
    svg.push(
        `<line x1="${xLeft}" y1="${headerBottomY}" x2="${xRight}" y2="${headerBottomY}" stroke="#000" stroke-width="1" />`,
    );

    // =========================
    // LINHAS DE NUTRIENTES
    // =========================
    y += 18;
    const rowsClipY = y - 16;

    svg.push(`<g clip-path="url(#clipRowsBR)">`);

    const rowStepBR = 22;

    data.forEach((r) => {
        const name = esc(r.name);
        const amt = esc(r.qty ? `${r.qty} ${r.unit}`.trim() : "");
        const vd = esc(r.vd_br);

        const textY = y;

        // Nome
        svg.push(
            `<text x="${pad + 8}" y="${textY}" font-family="Arial" font-size="${rowFont}">${name}</text>`,
        );

        // COLUNA DA PORÇÃO (centralizada)
        svg.push(
            `<text x="${(xColPor + xColVD) / 2}" y="${textY}" font-family="Arial" font-size="${rowFont}" text-anchor="middle">${amt}</text>`,
        );

        // %VD* (centralizado)
        svg.push(
            `<text x="${xVDHeader}" y="${textY}" font-family="Arial" font-size="${rowFont}" text-anchor="middle">${vd}</text>`,
        );

        // linha horizontal
        const rowBottom = textY + 8;
        svg.push(
            `<line x1="${xLeft}" y1="${rowBottom}" x2="${xRight}" y2="${rowBottom}" stroke="#000" stroke-width="1" />`,
        );

        y += rowStepBR;
    });

    svg.push(`</g>`);

    // =========================
    // LINHAS VERTICAIS DA GRADE
    // =========================
    svg.push(
        `<line x1="${xColPor}" y1="${gridTopY}" x2="${xColPor}" y2="${beforeFooterY}" stroke="#000" stroke-width="1" />`,
    );
    svg.push(
        `<line x1="${xColVD}" y1="${gridTopY}" x2="${xColVD}" y2="${beforeFooterY}" stroke="#000" stroke-width="1" />`,
    );

    // linha grossa separando a tabela do rodapé
    svg.push(
        `<line x1="${pad}" y1="${beforeFooterY}" x2="${
            pad + innerW
        }" y2="${beforeFooterY}" stroke="#000" stroke-width="4" />`,
    );

    // =========================
    // RODAPÉ A – "Não contém quantidades..."
    // =========================
    let fy = footerYTop + footerLineH + 4;
    linesA.forEach((line) => {
        svg.push(
            `<text x="${
                pad + 6
            }" y="${fy}" font-family="Arial" font-size="${footerFont}">${esc(
                line,
            )}</text>`,
        );
        fy += footerLineH;
    });

    // linha de separação entre os rodapés
    fy += 4;
    svg.push(
        `<line x1="${pad}" y1="${fy}" x2="${
            pad + innerW
        }" y2="${fy}" stroke="#000" stroke-width="1" opacity="0.9"/>`,
    );
    fy += footerLineH;

    // =========================
    // RODAPÉ B – "*Percentual de valores..."
    // =========================
    linesB.forEach((line) => {
        svg.push(
            `<text x="${
                pad + 6
            }" y="${fy}" font-family="Arial" font-size="${footerFont}">${esc(
                line,
            )}</text>`,
        );
        fy += footerLineH;
    });

    svg.push(`</svg>`);

    // clip das linhas (termina antes do rodapé)
    const clipH = Math.max(10, beforeFooterY - rowsClipY);
    return svg
        .join("")
        .replace(
            `y="0" width="${innerW}" height="0"`,
            `y="${rowsClipY}" width="${innerW}" height="${clipH}"`,
        );
}

// ===== UI list =====
function renderList() {
    const list = $("list");
    list.innerHTML = "";

    rows.forEach((r, idx) => {
        const item = document.createElement("div");
        item.className = "nutrientItem";
        item.innerHTML = `
      <div class="nutrientItemTop">
        <span class="pill">Item ${idx + 1}</span>
        <button class="btnSmall btnDanger" data-del="${idx}">Remover</button>
      </div>
      <label>Nome</label>
      <input data-k="name" data-i="${idx}" value="${esc(r.name)}" />
      <div class="row3">
        <div>
          <label>Quantidade</label>
          <input data-k="qty" data-i="${idx}" value="${esc(r.qty)}" />
        </div>
        <div>
          <label>Unidade</label>
          <input data-k="unit" data-i="${idx}" value="${esc(r.unit)}" />
        </div>
        <div>
          <label>${mode === "us" ? "%DV (US)" : "%VD (BR)"}</label>
          <input data-k="${
              mode === "us" ? "dv_us" : "vd_br"
          }" data-i="${idx}" value="${esc(
              mode === "us" ? r.dv_us : r.vd_br,
          )}" />
        </div>
      </div>
    `;
        list.appendChild(item);
    });

    list.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("input", (e) => {
            const i = parseInt(e.target.getAttribute("data-i"), 10);
            const k = e.target.getAttribute("data-k");
            rows[i][k] = e.target.value;
            render();
        });
    });

    list.querySelectorAll("button[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const i = parseInt(btn.getAttribute("data-del"), 10);
            rows.splice(i, 1);
            renderList();
            render();
        });
    });
}

function addRow(init = {}) {
    rows.push({
        name: init.name || "",
        qty: init.qty || "",
        unit: init.unit || "",
        dv_us: init.dv_us || "",
        vd_br: init.vd_br || "",
    });
    renderList();
    render();
}

function formToCSV() {
    const lines = rows.map((r) =>
        [
            r.name || "",
            r.qty || "",
            r.unit || "",
            r.dv_us || "",
            r.vd_br || "",
        ].join(","),
    );
    $("csv").value = lines.join("\n");
}

function csvToForm() {
    const parsed = parseCSV($("csv").value);
    rows = parsed;
    renderList();
    render();
}

function setMode(m) {
    mode = m;
    $("tabUS").classList.toggle("active", m === "us");
    $("tabBR").classList.toggle("active", m === "br");
    $("basicUS").style.display = m === "us" ? "" : "none";
    $("basicBR").style.display = m === "br" ? "" : "none";
    renderList();
    render();
}

function render() {
    const w = Math.max(320, numVal($("w").value, 900));
    const h = Math.max(260, numVal($("h").value, 900));
    const autoH = $("autoH").checked;

    const data = rows.map((r) => ({ ...r }));

    const svg =
        mode === "us" ? buildUS(data, w, h, autoH) : buildBR(data, w, h, autoH);

    $("preview").innerHTML = svg;
    window._lastSVG = svg;
}

function addDefault() {
    rows = [
        {
            name: "Valor energético",
            qty: "0",
            unit: "kcal",
            dv_us: "",
            vd_br: "0",
        },
        { name: "Carboidratos", qty: "0", unit: "g", dv_us: "", vd_br: "0" },
        { name: "Açúcares totais", qty: "0", unit: "g", dv_us: "", vd_br: "" },
        {
            name: "Açúcares adicionados",
            qty: "0",
            unit: "g",
            dv_us: "",
            vd_br: "0",
        },
        { name: "Proteínas", qty: "0", unit: "g", dv_us: "", vd_br: "0" },
        { name: "Gorduras totais", qty: "0", unit: "g", dv_us: "", vd_br: "0" },
        {
            name: "Gorduras saturadas",
            qty: "0",
            unit: "g",
            dv_us: "",
            vd_br: "0",
        },
        { name: "Gorduras trans", qty: "0", unit: "g", dv_us: "", vd_br: "" },
        { name: "Fibra alimentar", qty: "0", unit: "g", dv_us: "", vd_br: "0" },
        { name: "Sódio", qty: "0", unit: "mg", dv_us: "", vd_br: "0" },
    ];
    renderList();
    render();
}

// ===== events =====
$("tabUS").addEventListener("click", () => setMode("us"));
$("tabBR").addEventListener("click", () => setMode("br"));

[
    "w",
    "h",
    "autoH",
    "usServingSize",
    "usServings",
    "brPorcao",
    "brPorcoes",
    "brMedida",
].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", render);
});

$("addRowBtn").addEventListener("click", () => addRow({ name: "" }));
$("clearBtn").addEventListener("click", () => {
    rows = [];
    renderList();
    render();
});

$("csvToForm").addEventListener("click", csvToForm);
$("formToCSV").addEventListener("click", formToCSV);

$("dlSVG").addEventListener("click", () => {
    if (!window._lastSVG) render();
    downloadText(
        mode === "us" ? "supplement-facts.svg" : "tabela-nutricional-br.svg",
        window._lastSVG,
    );
});

$("dlPNG").addEventListener("click", async () => {
    if (!window._lastSVG) render();

    const tmp = document.createElement("div");
    tmp.innerHTML = window._lastSVG;
    const svgEl = tmp.querySelector("svg");
    const outW = parseInt(svgEl.getAttribute("width"), 10);
    const outH = parseInt(svgEl.getAttribute("height"), 10);

    const scale = parseInt($("pngScale")?.value || "3", 10);

    await downloadPNGFromSVG(
        window._lastSVG,
        outW,
        outH,
        mode === "us" ? "supplement-facts.png" : "tabela-nutricional-br.png",
        scale,
    );
});

$("helpBtn").addEventListener("click", () => {
    alert(
        "Como usar:\n\n" +
            "1) Escolha o formato (EUA/Brasil).\n" +
            "2) Defina largura/altura (ou ative Altura automática).\n" +
            "3) Adicione nutrientes (ou importe via CSV).\n" +
            "4) Baixe em SVG/PNG.\n\n" +
            "Dica de qualidade: use PNG 3x ou 4x para ficar bem legível.",
    );
});

$("addDefaultBtn").addEventListener("click", addDefault);

// init
addDefault();
setMode("us");
