// app.js
import {
  db,
  auth,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp
} from "./firebase-config.js";

let currentUser = null;

// State semasa
let currentBahasa = null;   // { id, nama }
let currentHuruf = null;    // "A", "B", ...
let currentPerkataan = null; // { id, perkataan }

// Simpan dari mana kita datang sebelum masuk page log
let lastPageBeforeLog = null;

// DOM helpers
const pages = {
  login: document.getElementById("page-login"),
  bahasa: document.getElementById("page-bahasa"),
  huruf: document.getElementById("page-huruf"),
  perkataan: document.getElementById("page-perkataan"),
  perkataanDone: document.getElementById("page-perkataan-done"),
  elemen: document.getElementById("page-elemen"),
  ayatBiasa: document.getElementById("page-ayat-biasa"),
  dialog: document.getElementById("page-dialog"),
  dialogBubble: document.getElementById("page-dialog-bubble"),
  log: document.getElementById("page-log")
};

const statusBar = document.getElementById("status-bar");

export function showPage(pageId) {
  Object.values(pages).forEach(p => p.classList.add("hidden"));
  const el = pages[pageId.replace("page-", "")] || document.getElementById(pageId);
  if (el) el.classList.remove("hidden");
}

export function showStatus(msg, type = "info", timeout = 3000, progress = null) {
  if (!statusBar) return;
  let textEl = document.getElementById("status-text");
  let progressWrap = document.getElementById("status-progress");
  let progressBar = document.getElementById("status-progress-bar");

  if (textEl) textEl.textContent = msg;
  else statusBar.textContent = msg;

  statusBar.className = "";
  statusBar.classList.add(type, "visible");
  statusBar.classList.remove("hidden");

  if (progress !== null && progressWrap && progressBar) {
    progressWrap.classList.remove("hidden");
    progressBar.style.width = progress + "%";
  } else if (progressWrap) {
    progressWrap.classList.add("hidden");
  }

  if (timeout) {
    setTimeout(() => {
      statusBar.classList.add("hidden");
    }, timeout);
  }
}

export function initAppAfterAuth(user) {
  currentUser = user;
  loadBahasa();
}

export function clearAppStateOnLogout() {
  currentUser = null;
  currentBahasa = null;
  currentHuruf = null;
  currentPerkataan = null;
  lastPageBeforeLog = null;
}

const inputSearchBahasa = document.getElementById("search-bahasa");
const btnTambahBahasa = document.getElementById("btn-tambah-bahasa");
const senaraiBahasaEl = document.getElementById("senarai-bahasa");
const btnBahasaLog = document.getElementById("btn-bahasa-log");

btnBahasaLog?.addEventListener("click", () => {
  lastPageBeforeLog = "page-bahasa";
  openLogPage();
});

btnTambahBahasa?.addEventListener("click", async () => {
  const nama = prompt("Masukkan nama bahasa:");
  if (!nama || !nama.trim()) return;
  try {
    await addDoc(collection(db, "languages"), {
      userId: currentUser.uid,
      name: nama.trim(),
      createdAt: serverTimestamp()
    });
    showStatus("Bahasa berjaya ditambah.", "success");
    loadBahasa();
  } catch (err) {
    console.error(err);
    showStatus("Gagal tambah bahasa.", "error");
  }
});

inputSearchBahasa?.addEventListener("input", () => {
  renderBahasaList(cacheBahasa, inputSearchBahasa.value);
});

let cacheBahasa = [];

async function loadBahasa() {
  if (!currentUser) return;
  const q = query(
    collection(db, "languages"),
    where("userId", "==", currentUser.uid),
    orderBy("name", "asc")
  );
  const snap = await getDocs(q);
  cacheBahasa = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  renderBahasaList(cacheBahasa, inputSearchBahasa.value);
}

function renderBahasaList(list, filterText = "") {
  if (!senaraiBahasaEl) return;
  senaraiBahasaEl.innerHTML = "";
  const ft = (filterText || "").toLowerCase();

  list.filter(b => !ft || (b.name || "").toLowerCase().includes(ft)).forEach(b => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "item-main";
    main.textContent = b.name;
    main.addEventListener("click", () => {
      currentBahasa = { id: b.id, name: b.name };
      openHurufPage();
    });

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn small secondary";
    btnEdit.textContent = "Sunting";
    btnEdit.addEventListener("click", async (e) => {
      e.stopPropagation();
      const baru = prompt("Sunting nama bahasa:", b.name);
      if (!baru || !baru.trim()) return;
      try {
        await setDoc(doc(db, "languages", b.id), { ...b, name: baru.trim() });
        showStatus("Bahasa dikemaskini.", "success");
        loadBahasa();
      } catch (err) {
        console.error(err);
        showStatus("Gagal sunting bahasa.", "error");
      }
    });

    const btnPadam = document.createElement("button");
    btnPadam.className = "btn small danger";
    btnPadam.textContent = "Padam";
    btnPadam.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Padam bahasa ini beserta semua data di bawahnya?")) return;
      try {
        await deleteDoc(doc(db, "languages", b.id));
        showStatus("Bahasa dipadam.", "success");
        loadBahasa();
      } catch (err) {
        console.error(err);
        showStatus("Gagal padam bahasa.", "error");
      }
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnPadam);
    li.appendChild(main);
    li.appendChild(actions);
    senaraiBahasaEl.appendChild(li);
  });
}

const btnKembaliKeBahasa = document.getElementById("btn-kembali-ke-bahasa");
const tajukHurufBahasa = document.getElementById("tajuk-huruf-bahasa");
const labelBahasaTerpilih = document.getElementById("label-bahasa-terpilih");
const senaraiHurufEl = document.getElementById("senarai-huruf");
const searchPerkataanDariHuruf = document.getElementById("search-perkataan-dari-huruf");

btnKembaliKeBahasa?.addEventListener("click", () => {
  showPage("page-bahasa");
});

function openHurufPage() {
  if (!currentBahasa) return;
  tajukHurufBahasa.textContent = "Huruf";
  labelBahasaTerpilih.textContent = "Bahasa: " + currentBahasa.name;
  renderHurufGrid();
  showPage("page-huruf");
}

function renderHurufGrid() {
  if (!senaraiHurufEl) return;
  senaraiHurufEl.innerHTML = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  alphabet.forEach(h => {
    const btn = document.createElement("button");
    btn.className = "btn secondary";
    btn.textContent = h;
    btn.addEventListener("click", () => {
      currentHuruf = h;
      openPerkataanPage();
    });
    senaraiHurufEl.appendChild(btn);
  });
}

searchPerkataanDariHuruf?.addEventListener("input", () => {
  // optional global search
});

const btnKembaliKeHuruf = document.getElementById("btn-kembali-ke-huruf");
const btnPerkataanLog = document.getElementById("btn-perkataan-log");
const tajukPerkataanHuruf = document.getElementById("tajuk-perkataan-huruf");
const labelPerkataanBahasaHuruf = document.getElementById("label-perkataan-bahasa-huruf");
const inputSearchPerkataan = document.getElementById("search-perkataan");
const btnTambahPerkataan = document.getElementById("btn-tambah-perkataan");
const senaraiPerkataanEl = document.getElementById("senarai-perkataan");
const btnPadamPilih = document.getElementById("btn-padampilih");

// Tambahan untuk page Done
const btnHurufDone = document.getElementById("btn-huruf-done");
const btnKembaliKeHurufDone = document.getElementById("btn-kembali-ke-huruf-done");
const tajukPerkataanDone = document.getElementById("tajuk-perkataan-done");
const labelPerkataanDone = document.getElementById("label-perkataan-done");
const senaraiPerkataanDone = document.getElementById("senarai-perkataan-done");

let cachePerkataan = [];

btnKembaliKeHuruf?.addEventListener("click", () => showPage("page-huruf"));
btnPerkataanLog?.addEventListener("click", () => { 
  lastPageBeforeLog = "page-perkataan"; 
  openLogPage(); 
});

function openPerkataanPage() {
  if (!currentBahasa || !currentHuruf) return;
  tajukPerkataanHuruf.textContent = "Perkataan huruf " + currentHuruf;
  labelPerkataanBahasaHuruf.textContent = "Bahasa: " + currentBahasa.name + " | Huruf: " + currentHuruf;
  loadPerkataan();
  showPage("page-perkataan");
}

// Page Done
btnHurufDone?.addEventListener("click", () => openPerkataanDonePage());
btnKembaliKeHurufDone?.addEventListener("click", () => showPage("page-huruf"));

function openPerkataanDonePage() {
  if (!currentBahasa || !currentHuruf) return;
  tajukPerkataanDone.textContent = "Perkataan selesai huruf " + currentHuruf;
  labelPerkataanDone.textContent = "Bahasa: " + currentBahasa.name + " | Huruf: " + currentHuruf;
  loadPerkataanDone();
  showPage("page-perkataan-done");
}

btnTambahPerkataan?.addEventListener("click", async () => {
  const perk = prompt("Masukkan perkataan:");
  if (!perk || !perk.trim()) return;
  try {
    await addDoc(collection(db, "words"), {
      userId: currentUser.uid,
      bahasaId: currentBahasa.id,
      bahasaName: currentBahasa.name,
      huruf: currentHuruf,
      word: perk.trim(),
      done: false,
      createdAt: serverTimestamp()
    });
    showStatus("Perkataan ditambah.", "success");
    loadPerkataan();
  } catch (err) {
    console.error(err);
    showStatus("Gagal tambah perkataan.", "error");
  }
});

inputSearchPerkataan?.addEventListener("input", () => renderPerkataanList(cachePerkataan, inputSearchPerkataan.value));

async function loadPerkataan() {
  if (!currentUser || !currentBahasa || !currentHuruf) return;
  const q = query(
    collection(db, "words"),
    where("userId", "==", currentUser.uid),
    where("bahasaId", "==", currentBahasa.id),
    where("huruf", "==", currentHuruf),
    orderBy("word", "asc")
  );
  const snap = await getDocs(q);
  cachePerkataan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderPerkataanList(cachePerkataan, inputSearchPerkataan.value);
}

function renderPerkataanList(list, filterText = "") {
  if (!senaraiPerkataanEl) return;
  senaraiPerkataanEl.innerHTML = "";
  const ft = (filterText || "").toLowerCase();

  list.filter(p => !ft || (p.word || "").toLowerCase().includes(ft)).forEach(p => {
    const li = document.createElement("li");

    const tick = document.createElement("input");
    tick.type = "checkbox";
    tick.className = "progress-tick";
    tick.dataset.id = p.id;
    tick.checked = !!p.done;
    tick.addEventListener("change", async () => {
      try {
        await setDoc(doc(db, "words", p.id), { ...p, done: tick.checked });
        showStatus("Status bacaan dikemaskini.", "success");
      } catch (err) {
        console.error(err);
        showStatus("Gagal kemaskini status bacaan.", "error");
        tick.checked = !tick.checked;
      }
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "select-word";
    checkbox.dataset.id = p.id;

    const main = document.createElement("div");
    main.className = "item-main";
    main.textContent = p.word;
    main.addEventListener("click", () => {
      currentPerkataan = { id: p.id, word: p.word, data: p };
      openElemenPage();
    });

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const btnLog = document.createElement("button");
    btnLog.className = "btn small secondary";
    btnLog.textContent = "Simpan ke log";
    btnLog.addEventListener("click", async (e) => { e.stopPropagation(); await simpanKeLog(p); });

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn small secondary";
    btnEdit.textContent = "Sunting";
    btnEdit.addEventListener("click", async (e) => {
      e.stopPropagation();
      const baru = prompt("Sunting perkataan:", p.word);
      if (!baru || !baru.trim()) return;
      try {
        await setDoc(doc(db, "words", p.id), { ...p, word: baru.trim() });
        showStatus("Perkataan dikemaskini.", "success");
        loadPerkataan();
      } catch (err) {
        console.error(err);
        showStatus("Gagal sunting perkataan.", "error");
      }
    });

    const btnPadam = document.createElement("button");
    btnPadam.className = "btn small danger";
    btnPadam.textContent = "Padam";
    btnPadam.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Padam perkataan ini?")) return;
      try {
        await deleteDoc(doc(db, "words", p.id));
        showStatus("Perkataan dipadam.", "success");
        loadPerkataan();
      } catch (err) {
        console.error(err);
        showStatus("Gagal padam perkataan.", "error");
      }
    });

    actions.appendChild(btnLog);
    actions.appendChild(btnEdit);
    actions.appendChild(btnPadam);

    li.appendChild(tick);
    li.appendChild(checkbox);
    li.appendChild(main);
    li.appendChild(actions);
    senaraiPerkataanEl.appendChild(li);
  });
}

// Fungsi untuk load perkataan Done
async function loadPerkataanDone() {
  if (!currentUser || !currentBahasa || !currentHuruf) return;
  const q = query(
    collection(db, "words"),
    where("userId", "==", currentUser.uid),
    where("bahasaId", "==", currentBahasa.id),
    where("huruf", "==", currentHuruf),
    where("done", "==", true),
    orderBy("word", "asc")
  );
  const snap = await getDocs(q);
  const listDone = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderPerkataanDoneList(listDone);
}

function renderPerkataanDoneList(list) {
  if (!senaraiPerkataanDone) return;
  senaraiPerkataanDone.innerHTML = "";
  list.forEach(p => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "item-main";
    main.textContent = p.word;
    main.addEventListener("click", () => {
      currentPerkataan = { id: p.id, word: p.word, data: p };
      openElemenPage();
    });
    li.appendChild(main);
    senaraiPerkataanDone.appendChild(li);
  });
}

const btnKembaliKePerkataan = document.getElementById("btn-kembali-ke-perkataan");
const tajukElemenPerkataan = document.getElementById("tajuk-elemen-perkataan");
const labelElemenBahasaHurufPerkataan = document.getElementById("label-elemen-bahasa-huruf-perkataan");
const btnElemenAyatBiasa = document.getElementById("btn-elemen-ayat-biasa");
const btnElemenDialog = document.getElementById("btn-elemen-dialog");

btnKembaliKePerkataan?.addEventListener("click", () => showPage("page-perkataan"));

function openElemenPage() {
  if (!currentBahasa || !currentHuruf || !currentPerkataan) return;
  tajukElemenPerkataan.textContent = "Elemen: " + currentPerkataan.word;
  labelElemenBahasaHurufPerkataan.textContent =
    "Bahasa: " + currentBahasa.name +
    " | Huruf: " + currentHuruf +
    " | Perkataan: " + currentPerkataan.word;
  showPage("page-elemen");
}

btnElemenAyatBiasa?.addEventListener("click", () => openAyatBiasaPage());
btnElemenDialog?.addEventListener("click", () => openDialogPage());

const btnKembaliKeElemenDariAyatBiasa = document.getElementById("btn-kembali-ke-elemen-dari-ayat-biasa");
const tajukAyatBiasa = document.getElementById("tajuk-ayat-biasa");
const labelAyatBiasa = document.getElementById("label-ayat-biasa");
const btnTambahAyatBiasa = document.getElementById("btn-tambah-ayat-biasa");
const senaraiAyatBiasaEl = document.getElementById("senarai-ayat-biasa");

btnKembaliKeElemenDariAyatBiasa?.addEventListener("click", () => showPage("page-elemen"));

let cacheAyatBiasa = [];

function openAyatBiasaPage() {
  if (!currentPerkataan) return;
  tajukAyatBiasa.textContent = "Ayat biasa & karangan: " + currentPerkataan.word;
  labelAyatBiasa.textContent = "Bahasa: " + currentBahasa.name + " | Huruf: " + currentHuruf;
  loadAyatBiasa();
  showPage("page-ayat-biasa");
}

btnTambahAyatBiasa?.addEventListener("click", async () => {
  try {
    await addDoc(collection(db, "sentences"), {
      userId: currentUser.uid,
      wordId: currentPerkataan.id,
      text: "",
      createdAt: serverTimestamp()
    });
    loadAyatBiasa();
  } catch (err) {
    console.error(err);
    showStatus("Gagal tambah ayat.", "error");
  }
});

async function loadAyatBiasa() {
  if (!currentPerkataan) return;
  const q = query(
    collection(db, "sentences"),
    where("userId", "==", currentUser.uid),
    where("wordId", "==", currentPerkataan.id),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  cacheAyatBiasa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAyatBiasa();
}

function renderAyatBiasa() {
  if (!senaraiAyatBiasaEl) return;
  senaraiAyatBiasaEl.innerHTML = "";
  cacheAyatBiasa.forEach(a => {
    const wrap = document.createElement("div");
    wrap.className = "ayat-item";

    const textarea = document.createElement("textarea");
    textarea.value = a.text || "";
    textarea.placeholder = "Tulis ayat di sini...";
    textarea.addEventListener("change", async () => {
      try {
        await setDoc(doc(db, "sentences", a.id), { ...a, text: textarea.value });
      } catch (err) {
        console.error(err);
        showStatus("Gagal simpan ayat.", "error");
      }
    });

    const actions = document.createElement("div");
    actions.style.textAlign = "right";

    const btnPadam = document.createElement("button");
    btnPadam.className = "btn small danger";
    btnPadam.textContent = "Padam";
    btnPadam.addEventListener("click", async () => {
      if (!confirm("Padam ayat ini?")) return;
      try {
        await deleteDoc(doc(db, "sentences", a.id));
        loadAyatBiasa();
      } catch (err) {
        console.error(err);
        showStatus("Gagal padam ayat.", "error");
      }
    });

    actions.appendChild(btnPadam);
    wrap.appendChild(textarea);
    wrap.appendChild(actions);
    senaraiAyatBiasaEl.appendChild(wrap);
  });
}

// Dialog (senarai tajuk)
const btnKembaliKeElemenDariDialog = document.getElementById("btn-kembali-ke-elemen-dari-dialog");
const tajukDialog = document.getElementById("tajuk-dialog");
const labelDialog = document.getElementById("label-dialog");
const btnTambahDialog = document.getElementById("btn-tambah-dialog");
const senaraiDialogEl = document.getElementById("senarai-dialog");

let cacheDialog = [];
let currentDialog = null;

btnKembaliKeElemenDariDialog?.addEventListener("click", () => showPage("page-elemen"));

function openDialogPage() {
  if (!currentPerkataan) return;
  tajukDialog.textContent = "Ayat dialog: " + currentPerkataan.word;
  labelDialog.textContent = "Bahasa: " + currentBahasa.name + " | Huruf: " + currentHuruf;
  loadDialogList();
  showPage("page-dialog");
}

btnTambahDialog?.addEventListener("click", async () => {
  const tajuk = prompt("Masukkan tajuk dialog:");
  if (!tajuk || !tajuk.trim()) return;
  try {
    await addDoc(collection(db, "dialogs"), {
      userId: currentUser.uid,
      wordId: currentPerkataan.id,
      title: tajuk.trim(),
      createdAt: serverTimestamp()
    });
    showStatus("Dialog ditambah.", "success");
    loadDialogList();
  } catch (err) {
    console.error(err);
    showStatus("Gagal tambah dialog.", "error");
  }
});

async function loadDialogList() {
  if (!currentPerkataan) return;
  const q = query(
    collection(db, "dialogs"),
    where("userId", "==", currentUser.uid),
    where("wordId", "==", currentPerkataan.id),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  cacheDialog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderDialogList();
}

function renderDialogList() {
  if (!senaraiDialogEl) return;
  senaraiDialogEl.innerHTML = "";
  cacheDialog.forEach(dg => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "item-main";
    main.textContent = dg.title;
    main.addEventListener("click", () => {
      currentDialog = { id: dg.id, title: dg.title, data: dg };
      openDialogBubblePage();
    });
    li.appendChild(main);
    senaraiDialogEl.appendChild(li);
  });
}

// Dialog Bubble (perbualan dalam dialog)
const btnKembaliKeDialog = document.getElementById("btn-kembali-ke-dialog");
const tajukDialogBubble = document.getElementById("tajuk-dialog-bubble");
const labelDialogBubble = document.getElementById("label-dialog-bubble");
const btnTambahDialogBubble = document.getElementById("btn-tambah-dialog-bubble");
const senaraiDialogBubbleEl = document.getElementById("senarai-dialog-bubble");

let cacheDialogBubble = [];

btnKembaliKeDialog?.addEventListener("click", () => showPage("page-dialog"));

function openDialogBubblePage() {
  if (!currentDialog) return;
  tajukDialogBubble.textContent = "Dialog: " + currentDialog.title;
  labelDialogBubble.textContent =
    "Bahasa: " + currentBahasa.name +
    " | Huruf: " + currentHuruf +
    " | Perkataan: " + currentPerkataan.word;
  loadDialogBubble();
  showPage("page-dialog-bubble");
}

btnTambahDialogBubble?.addEventListener("click", async () => {
  try {
    await addDoc(collection(db, "dialogBubbles"), {
      userId: currentUser.uid,
      dialogId: currentDialog.id,
      text: "",
      createdAt: serverTimestamp()
    });
    loadDialogBubble();
  } catch (err) {
    console.error(err);
    showStatus("Gagal tambah bubble.", "error");
  }
});

async function loadDialogBubble() {
  if (!currentDialog) return;
  const q = query(
    collection(db, "dialogBubbles"),
    where("userId", "==", currentUser.uid),
    where("dialogId", "==", currentDialog.id),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  cacheDialogBubble = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderDialogBubble();
}

function renderDialogBubble() {
  if (!senaraiDialogBubbleEl) return;
  senaraiDialogBubbleEl.innerHTML = "";
  cacheDialogBubble.forEach(b => {
    const wrap = document.createElement("div");
    wrap.className = "bubble-item";

    const textarea = document.createElement("textarea");
    textarea.value = b.text || "";
    textarea.placeholder = "Tulis dialog di sini...";
    textarea.addEventListener("change", async () => {
      try {
        await setDoc(doc(db, "dialogBubbles", b.id), { ...b, text: textarea.value });
      } catch (err) {
        console.error(err);
        showStatus("Gagal simpan dialog.", "error");
      }
    });

    const actions = document.createElement("div");
    actions.style.textAlign = "right";

    const btnPadam = document.createElement("button");
    btnPadam.className = "btn small danger";
    btnPadam.textContent = "Padam";
    btnPadam.addEventListener("click", async () => {
      if (!confirm("Padam bubble ini?")) return;
      try {
        await deleteDoc(doc(db, "dialogBubbles", b.id));
        loadDialogBubble();
      } catch (err) {
        console.error(err);
        showStatus("Gagal padam bubble.", "error");
      }
    });

    actions.appendChild(btnPadam);
    wrap.appendChild(textarea);
    wrap.appendChild(actions);
    senaraiDialogBubbleEl.appendChild(wrap);
  });
}

// Log Page
const pageLog = document.getElementById("page-log");
const btnKembaliDariLog = document.getElementById("btn-kembali-dari-log");
const inputSearchLog = document.getElementById("search-log");
const senaraiLogEl = document.getElementById("senarai-log");
const btnPadamSemuaLog = document.getElementById("btn-padamlah-semua-log");

let cacheLog = [];

btnKembaliDariLog?.addEventListener("click", () => {
  if (lastPageBeforeLog) showPage(lastPageBeforeLog);
  else showPage("page-bahasa");
});

btnPadamSemuaLog?.addEventListener("click", async () => {
  if (!confirm("Padam semua log?")) return;
  try {
    const q = query(collection(db, "logs"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    const batchDeletes = snap.docs.map(d => deleteDoc(doc(db, "logs", d.id)));
    await Promise.all(batchDeletes);
    showStatus("Semua log dipadam.", "success");
    loadLog();
  } catch (err) {
    console.error(err);
    showStatus("Gagal padam semua log.", "error");
  }
});

inputSearchLog?.addEventListener("input", () => {
  renderLogList(cacheLog, inputSearchLog.value);
});

async function simpanKeLog(perkataanObj) {
  try {
    await addDoc(collection(db, "logs"), {
      userId: currentUser.uid,
      bahasaId: currentBahasa.id,
      huruf: currentHuruf,
      word: perkataanObj.word,
      createdAt: serverTimestamp()
    });
    showStatus("Perkataan disimpan ke log.", "success");
  } catch (err) {
    console.error(err);
    showStatus("Gagal simpan ke log.", "error");
  }
}

async function openLogPage() {
  loadLog();
  showPage("page-log");
}

async function loadLog() {
  if (!currentUser) return;
  const q = query(
    collection(db, "logs"),
    where("userId", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  cacheLog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderLogList(cacheLog, inputSearchLog.value);
}

function renderLogList(list, filterText = "") {
  if (!senaraiLogEl) return;
  senaraiLogEl.innerHTML = "";
  const ft = (filterText || "").toLowerCase();

  list.filter(l => !ft || (l.word || "").toLowerCase().includes(ft)).forEach(l => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "item-main";
    main.textContent = l.word;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const btnPadam = document.createElement("button");
    btnPadam.className = "btn small danger";
    btnPadam.textContent = "Padam";
    btnPadam.addEventListener("click", async () => {
      if (!confirm("Padam log ini?")) return;
      try {
        await deleteDoc(doc(db, "logs", l.id));
        showStatus("Log dipadam.", "success");
        loadLog();
      } catch (err) {
        console.error(err);
        showStatus("Gagal padam log.", "error");
      }
    });

    actions.appendChild(btnPadam);
    li.appendChild(main);
    li.appendChild(actions);
    senaraiLogEl.appendChild(li);
  });
}












