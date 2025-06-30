/**
 * page4.js – フロントエンド版
 *   ・グループ情報を URL / sessionStorage から取得
 *   ・/api/groups/:id/items に対し fetch で CRUD
 *   ・UI まわりは元のまま
 *   ※ import / export は一切入れない（ブラウザ実行用）
 */

class ItemAssignmentManager {
  // ===== コンストラクタ =====
  constructor() {
    // 状態
    this.groupData = {}; // { groupId, groupName, members[] }
    this.members = []; // ["太郎", "花子" ...]
    this.items = []; // ["カメラ", ...]
    this.assignments = []; // [{name, assignee, quantity}]
    this.newItems = new Set(); // 画面上で演出する用

    // DOM
    this.bindElements();

    // 非同期初期化
    this.initialize().catch((err) => {
      console.error(err);
      alert("初期化に失敗しました。もう一度やり直してください。");
    });
  }

  /* ---------- DOM 取得 ---------- */
  bindElements() {
    this.input = document.getElementById("itemInput");
    this.addBtn = document.getElementById("addButton");
    this.listWrap = document.getElementById("itemsList");
    this.noMsg = document.getElementById("noItemsMessage");
  }

  /* ---------- ここがメイン初期化 ---------- */
  async initialize() {
    await this.loadOrCreateGroup(); // groupId を必ず確保
    await this.fetchItemsFromServer(); // 既存アイテム取得（無ければ空）
    this.attachEventListeners(); // イベント設定
    this.renderItems(); // 画面描画
  }

  /* ---------- グループ情報を取得 or 新規作成 ---------- */
  async loadOrCreateGroup() {
    // 1. URLパスからgroupIdを取得（/group/xxxxx形式）
    const path = window.location.pathname;
    const groupIdFromPath = path.match(/\/group\/(.+)/);

    // 2. URL パラメータからも取得（従来の方式も維持）
    const params = new URLSearchParams(window.location.search);
    const urlGroupId = params.get("groupId");
    const urlGroupName = params.get("groupName");
    const urlMembers = params.get("members"); // JSON 文字列

    // 3. sessionStorage
    const saved = sessionStorage.getItem("groupData");
    if (saved) {
      this.groupData = JSON.parse(saved);
    }

    // 4. groupIdの優先順位：パス > URLパラメータ > sessionStorage
    if (groupIdFromPath) {
      this.groupData.groupId = groupIdFromPath[1];
    } else if (urlGroupId) {
      this.groupData.groupId = urlGroupId;
    }

    // 5. その他のパラメータ処理（従来通り）
    if (urlGroupName) {
      this.groupData.groupName = decodeURIComponent(urlGroupName);
    }
    if (urlMembers) {
      try {
        const arr = JSON.parse(urlMembers);
        // ["名前"] or [{name:"名前"}] のどちらでも OK にする
        this.groupData.members = arr.map((m) => (m.name ? m.name : m));
      } catch {
        /* ignore */
      }
    }

    this.members = this.groupData.members || [];

    // 6. groupId が無ければサーバーで新規作成（従来通り）
    if (!this.groupData.groupId) {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: this.groupData.groupName || "新グループ",
          members: this.members,
        }),
      });

      if (!res.ok) throw new Error("グループ作成 API 失敗");

      const { groupId } = await res.json();
      this.groupData.groupId = groupId;

      // 取得した id を URL に反映（リロード無し）
      params.set("groupId", groupId);
      history.replaceState(
        null,
        "",
        `${location.pathname}?${params.toString()}`
      );
    }

    // 7. 最終データを保存
    sessionStorage.setItem("groupData", JSON.stringify(this.groupData));
  }

  /* ---------- API ベース URL ---------- */
  baseUrl(path = "") {
    //return `https://mochiyoru.vercel.app/api/groups/${this.groupData.groupId}${path}`;
    return `/api/groups/${this.groupData.groupId}${path}`;
  }

  /* ---------- 既存アイテム取得 ---------- */
  async fetchItemsFromServer() {
    try {
      const res = await fetch(this.baseUrl("/items"));
      if (res.status === 404) return; // まだ何も無い
      if (!res.ok) throw new Error();

      const items = await res.json(); // [{name,quantity,assignee}]
      this.assignments = items.map((it) => ({ ...it }));
      this.items = items.map((it) => it.name);
    } catch (err) {
      console.warn("アイテム取得スキップ（404 or ネットワーク）");
    }
  }

  /* ---------- アイテム保存 ---------- */
  async saveItemToServer(payload) {
    const res = await fetch(this.baseUrl("/items"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("保存失敗");
  }

  /* ---------- イベント ---------- */
  attachEventListeners() {
    this.addBtn.addEventListener("click", () => this.handleAdd());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleAdd();
    });
  }

  /*  アイテム追加  */
  async handleAdd() {
    const name = this.input.value.trim();
    if (!name) return;

    // UI 先行反映
    this.items.push(name);
    this.assignments.push({ name, assignee: "", quantity: "" });
    this.newItems.add(name);
    this.input.value = "";
    this.renderItems();

    // サーバー保存
    try {
      await this.saveItemToServer({ name });
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました（オフライン？）");
    }
  }

  /*  セレクト変更  */
  handleSelectChange(e) {
    const el = e.target;
    const idx = +el.dataset.index;
    const type = el.dataset.type; // "assignee" or "quantity"
    this.assignments[idx][type] = el.value;

    const { name, quantity, assignee } = this.assignments[idx];
    this.saveItemToServer({ name, quantity, assignee }).catch(console.error);
  }

  /* ---------- UI 描画 ---------- */
  renderItems() {
    if (this.items.length === 0) {
      this.noMsg.style.display = "block";
      return;
    }
    this.noMsg.style.display = "none";

    // ヘッダーが無ければ作る
    if (!this.listWrap.querySelector(".speech-bubbles-header")) {
      this.listWrap.prepend(this.createHeader());
    }

    // 既存行を再利用 or 追加
    this.assignments.forEach((a, idx) => {
      let row = this.listWrap.querySelector(`[data-name="${a.name}"]`);
      if (!row) {
        row = this.createRow(a, idx);
        this.listWrap.appendChild(row);
      }

      // 値同期
      row.querySelector('select[data-type="assignee"]').value = a.assignee;
      row.querySelector('select[data-type="quantity"]').value = a.quantity;

      // 追加アニメーション
      if (this.newItems.has(a.name)) {
        this.animateRow(row);
        this.newItems.delete(a.name);
      }
    });
  }

  createHeader() {
    const h = document.createElement("div");
    h.className = "speech-bubbles-header";
    ["何を？", "誰が？", "どのくらい？"].forEach((t) => {
      const d = document.createElement("div");
      d.className = "speech-bubble";
      d.textContent = t;
      h.appendChild(d);
    });
    return h;
  }

  createRow(a, idx) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.name = a.name;

    const wrap = document.createElement("div");
    wrap.className = "item-content";

    const nameBox = document.createElement("div");
    nameBox.className = "item-name";
    nameBox.textContent = a.name;

    const selWho = this.createSelect(idx, "assignee", [
      "",
      "全員",
      ...this.members,
    ]);
    const selQty = this.createSelect(idx, "quantity", [
      "",
      ...Array.from({ length: 10 }, (_, i) => i + 1),
    ]);

    wrap.append(nameBox, selWho, selQty);
    row.appendChild(wrap);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "×";
    del.onclick = () => this.handleDelete(a.name);
    row.appendChild(del);

    return row;
  }

  createSelect(idx, type, opts) {
    const s = document.createElement("select");
    s.className = "item-select";
    s.dataset.index = idx;
    s.dataset.type = type;
    opts.forEach((v) => {
      const o = document.createElement("option");
      o.value = v === "" ? "" : String(v);
      o.textContent = v === "" ? "選択してください" : String(v);
      if (v === "全員") {
        o.style.fontWeight = "bold";
        o.style.color = "#1dd1a1";
      }
      s.appendChild(o);
    });
    s.onchange = (e) => this.handleSelectChange(e);
    return s;
  }

  animateRow(row) {
    row.style.opacity = "0";
    row.style.transform = "translateY(20px)";
    requestAnimationFrame(() => {
      row.style.transition = "all .5s ease-out";
      row.style.opacity = "1";
      row.style.transform = "translateY(0)";
    });
  }

  /* ----- 未実装：削除 ----- */
  handleDelete(name) {
    alert("削除 API はまだ実装していません（UI だけ削除します）");
    this.assignments = this.assignments.filter((a) => a.name !== name);
    this.items = this.items.filter((n) => n !== name);
    const el = this.listWrap.querySelector(`[data-name="${name}"]`);
    if (el) el.remove();
    if (this.items.length === 0) this.noMsg.style.display = "block";
  }
}

/* ===== 起動 ===== */
document.addEventListener(
  "DOMContentLoaded",
  () => new ItemAssignmentManager()
);

// 編集ボタンが押されたら page2.html に戻る処理
document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.querySelector(".edit-btn[data-type='members']");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    // メンバー編集のためのフラグを sessionStorage に設定
    sessionStorage.setItem("editMode", "members");

    // 現在の groupId などは sessionStorage に残したまま
    window.location.href = "page2.html";
  });
});
