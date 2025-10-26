class ItemAssignmentManager {
  // ===== コンストラクタ =====
  constructor() {
    // 状態
    this.groupData = {}; // { groupId, groupName, members[] }
    this.members = []; // ["太郎", "花子" ...]
    this.items = []; // ["カメラ", ...]
    this.assignments = []; // [{name, assignee, quantity}]
    this.newItems = new Set(); // 画面上で演出する用
    this.sortByAssignee = false; // ソート状態フラグ

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
    console.log("=== loadOrCreateGroup 開始 ===");

    // 1. URLパスからgroupIdを取得（/group/xxxxx形式）
    const path = window.location.pathname;
    console.log("現在のパス:", path);

    // より厳密な正規表現を使用
    const groupIdFromPath = path.match(/\/group\/([^\/\?#]+)/);
    console.log("パスからの抽出結果:", groupIdFromPath);
    console.log(
      "抽出されたgroupId:",
      groupIdFromPath ? groupIdFromPath[1] : "なし"
    );

    // 2. URL パラメータからも取得（従来の方式も維持）
    const params = new URLSearchParams(window.location.search);
    const urlGroupId = params.get("groupId");
    const urlGroupName = params.get("groupName");
    const urlMembers = params.get("members"); // JSON 文字列

    console.log("URLパラメータ:", { urlGroupId, urlGroupName, urlMembers });

    // 3. sessionStorage
    const saved = sessionStorage.getItem("groupData");
    if (saved) {
      this.groupData = JSON.parse(saved);
      console.log("sessionStorageから復元:", this.groupData);
    }

    // 4. groupIdの優先順位：パス > URLパラメータ > sessionStorage
    if (groupIdFromPath && groupIdFromPath[1]) {
      this.groupData.groupId = groupIdFromPath[1];
      console.log("パスからgroupIdを設定:", groupIdFromPath[1]);
    } else if (urlGroupId) {
      this.groupData.groupId = urlGroupId;
      console.log("URLパラメータからgroupIdを設定:", urlGroupId);
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
    console.log("現在のメンバー:", this.members);
    console.log("最終的なgroupId:", this.groupData.groupId);

    // 6. groupId が無ければサーバーで新規作成（従来通り）
    if (!this.groupData.groupId) {
      console.log("groupIdが無いため、新規作成します");
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

    // 6-2. groupIdがあるがメンバー情報がない場合、Supabaseから取得
    if (
      this.groupData.groupId &&
      (!this.groupData.groupName ||
        !this.groupData.members ||
        this.members.length === 0)
    ) {
      console.log("メンバー情報が不足しているため、Supabaseから取得します");
      console.log("リクエストURL:", `/api/groups/${this.groupData.groupId}`);

      try {
        const res = await fetch(`/api/groups/${this.groupData.groupId}`);
        console.log("API Response status:", res.status);

        if (res.ok) {
          const groupInfo = await res.json();
          console.log("Supabaseから取得したグループ情報:", groupInfo);

          // Supabaseから取得した情報で補完
          if (!this.groupData.groupName) {
            this.groupData.groupName = groupInfo.groupName;
          }
          if (!this.groupData.members || this.members.length === 0) {
            this.groupData.members = groupInfo.members;
            this.members = groupInfo.members || [];
            console.log("メンバー情報を更新:", this.members);
          }
        } else {
          console.error("API レスポンスエラー:", res.status, await res.text());
        }
      } catch (err) {
        console.error("グループ情報の取得に失敗:", err);
      }
    }

    // 7. 最終データを保存
    sessionStorage.setItem("groupData", JSON.stringify(this.groupData));
    console.log("最終的なgroupData:", this.groupData);
    console.log("最終的なmembers:", this.members);
    console.log("=== loadOrCreateGroup 完了 ===");
  }

  /* ---------- グループデータを取得する静的メソッド ---------- */
  static getCurrentGroupData() {
    // 1. URLパスからgroupIdを取得
    const path = window.location.pathname;
    const groupIdFromPath = path.match(/\/group\/([^\/\?#]+)/);
    
    // 2. URLパラメータからも取得
    const params = new URLSearchParams(window.location.search);
    const urlGroupId = params.get("groupId");
    const urlGroupName = params.get("groupName");
    const urlMembers = params.get("members");
    
    // 3. sessionStorageから取得
    let groupData = {};
    try {
      const saved = sessionStorage.getItem("groupData");
      if (saved) {
        groupData = JSON.parse(saved);
      }
    } catch (err) {
      console.warn("sessionStorageの読み込みに失敗:", err);
    }
    
    // 4. groupIdの優先順位：パス > URLパラメータ > sessionStorage
    if (groupIdFromPath && groupIdFromPath[1]) {
      groupData.groupId = groupIdFromPath[1];
    } else if (urlGroupId) {
      groupData.groupId = urlGroupId;
    }
    
    // 5. その他の情報も取得
    if (urlGroupName) {
      groupData.groupName = decodeURIComponent(urlGroupName);
    }
    if (urlMembers) {
      try {
        const arr = JSON.parse(urlMembers);
        groupData.members = arr.map((m) => (m.name ? m.name : m));
      } catch (err) {
        console.warn("メンバー情報の解析に失敗:", err);
      }
    }
    
    return groupData;
  }

  /* ---------- API ベース URL ---------- */
  baseUrl(path = "") {
    if (path === "/items") {
      return `/.netlify/functions/items?groupId=${this.groupData.groupId}`;
    }
    return `/api/groups/${this.groupData.groupId}${path}`;
  }

  /* ---------- 既存アイテム取得 ---------- */
  async fetchItemsFromServer() {
    try {
      const res = await fetch(this.baseUrl("/items"));
      if (res.status === 404) {
        console.log("アイテムがまだ存在しません (404)");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const items = await res.json();
      console.log("サーバーから取得したアイテム:", items);

      // データを正規化（重要：空文字列を保持）
      this.assignments = items.map((it) => ({
        name: it.name || "",
        assignee: it.assignee !== null && it.assignee !== undefined ? it.assignee : "",
        quantity: it.quantity !== null && it.quantity !== undefined ? it.quantity : "",
      }));

      this.items = items.map((it) => it.name);
      console.log("正規化後のassignments:", this.assignments);
    } catch (err) {
      console.warn("アイテム取得エラー:", err);
    }
  }

  /* ---------- アイテム保存 ---------- */
  async saveItemToServer(payload) {
    console.log("=== アイテム保存開始 ===");
    console.log("送信データ:", payload);

    const processedPayload = {
      name: payload.name || "",
      assignee: payload.assignee || "",
      quantity: payload.quantity || "",
    };

    console.log("送信データ（処理後）:", processedPayload);

    const res = await fetch(this.baseUrl("/items"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(processedPayload),
    });

    console.log("レスポンス status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("サーバーエラー詳細:", errorText);
      throw new Error(`保存失敗: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    console.log("保存成功:", result);
  }

  /* ---------- アイテム削除 ---------- */
  async deleteItemFromServer(name) {
    console.log("=== アイテム削除開始 ===");
    console.log("削除対象:", name);

    const res = await fetch(this.baseUrl("/items"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    console.log("削除レスポンス status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("削除エラー詳細:", errorText);
      throw new Error(`削除失敗: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    console.log("削除成功:", result);
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

    // 重複チェック
    if (this.items.includes(name)) {
      alert("この持ち物は既に追加されています。");
      return;
    }

    // UI 先行反映
    this.items.push(name);
    this.assignments.push({ name, assignee: "", quantity: "" });
    this.newItems.add(name);
    this.input.value = "";
    this.renderItems();

    // サーバー保存
    try {
      await this.saveItemToServer({ name, assignee: "", quantity: "" });
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました。ネットワーク接続を確認してください。");
      // 失敗時はUIから削除
      this.items = this.items.filter(n => n !== name);
      this.assignments = this.assignments.filter(a => a.name !== name);
      this.newItems.delete(name);
      this.renderItems();
    }
  }

  /*  セレクト変更（担当者用）  */
  handleSelectChange(e) {
    const el = e.target;
    const idx = +el.dataset.index;
    const type = el.dataset.type;
    this.assignments[idx][type] = el.value;

    const { name, quantity, assignee } = this.assignments[idx];
    this.saveItemToServer({ name, quantity, assignee }).catch((err) => {
      console.error(err);
      alert("保存に失敗しました。ネットワーク接続を確認してください。");
    });
  }

  /*  数量入力変更（新規）  */
  handleQuantityInput(e) {
    const el = e.target;
    const idx = +el.dataset.index;
    this.assignments[idx].quantity = el.value;
  }

  /*  数量バリデーション（blur時）  */
  async handleQuantityBlur(e) {
    const el = e.target;
    const idx = +el.dataset.index;
    const value = el.value.trim();

    // 空欄はOK
    if (!value) {
      el.classList.remove('quantity-error');
      el.placeholder = '例: 5本, 各1個';
      this.assignments[idx].quantity = '';
      
      const { name, assignee } = this.assignments[idx];
      await this.saveItemToServer({ name, quantity: "", assignee }).catch((err) => {
        console.error(err);
        alert("保存に失敗しました。ネットワーク接続を確認してください。");
      });
      return;
    }

    // 半角・全角数字チェック
    if (!/[0-9０-９]/.test(value)) {
      el.classList.add('quantity-error');
      el.value = '';
      el.placeholder = '数字を含めてください';
      this.assignments[idx].quantity = '';
      return;
    }

    // バリデーションOK
    el.classList.remove('quantity-error');
    el.placeholder = '例: 5本, 各1個';
    this.assignments[idx].quantity = value;

    const { name, assignee } = this.assignments[idx];
    await this.saveItemToServer({ name, quantity: value, assignee }).catch((err) => {
      console.error(err);
      alert("保存に失敗しました。ネットワーク接続を確認してください。");
    });
  }

  /*  数量入力フォーカス時（エラー状態解除）  */
  handleQuantityFocus(e) {
    const el = e.target;
    el.classList.remove('quantity-error');
    el.placeholder = '例: 5本, 各1個';
  }

  /* ---------- UI 描画（修正版） ---------- */
  renderItems() {
    if (this.items.length === 0) {
      this.noMsg.style.display = "block";
      const existingHeader = this.listWrap.querySelector(".column-headers");
      if (existingHeader) {
        existingHeader.style.display = "none";
      }
      return;
    }
    this.noMsg.style.display = "none";

    // ヘッダーが無ければ作る
    let header = this.listWrap.querySelector(".column-headers");
    if (!header) {
      header = this.createHeader();
      this.listWrap.prepend(header);
    }
    header.style.display = "flex";

    // 既存の行をすべて削除（重要：古いデータが残らないように）
    const existingRows = this.listWrap.querySelectorAll('.item-row');
    existingRows.forEach(row => row.remove());

    // ソート処理を適用
    const sortedAssignments = this.sortAssignments(this.assignments);

    // 行を新規作成
    sortedAssignments.forEach((a, idx) => {
      // 元のインデックスを取得（データ更新時に必要）
      const originalIdx = this.assignments.findIndex(item => item.name === a.name);
      const row = this.createRow(a, originalIdx);
      this.listWrap.appendChild(row);

      // 追加アニメーション
      if (this.newItems.has(a.name)) {
        this.animateRow(row);
        this.newItems.delete(a.name);
      }
    });
  }

  createHeader() {
    const headerContainer = document.createElement("div");
    headerContainer.className = "column-headers";

    const headerContent = document.createElement("div");
    headerContent.className = "column-headers-content";

    ["何を？", "誰が？", "どれくらい？"].forEach((t) => {
      const d = document.createElement("div");
      d.className = "column-header";
      d.textContent = t;
      headerContent.appendChild(d);
    });

    const spacer = document.createElement("div");
    spacer.className = "header-spacer";

    headerContainer.appendChild(headerContent);
    headerContainer.appendChild(spacer);

    return headerContainer;
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

    // セレクトボックスを作成（初期値付き）
    const selWho = this.createSelect(idx, "assignee", [
      "",
      "全員",
      ...this.members,
    ], a.assignee);
    
    // 数量入力フィールドを作成（初期値付き）
    const qtyInput = this.createQuantityInput(idx, a.quantity);

    wrap.append(nameBox, selWho, qtyInput);
    row.appendChild(wrap);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "×";
    del.onclick = () => this.handleDelete(a.name);
    row.appendChild(del);

    return row;
  }

  createSelect(idx, type, opts, initialValue = "") {
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

    // 初期値を設定（重要：空文字列でも明示的に設定）
    s.value = initialValue || "";
    console.log(`セレクト初期値設定: ${type} = "${initialValue}"`);

    s.onchange = (e) => this.handleSelectChange(e);
    return s;
  }

  createQuantityInput(idx, value = "") {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'item-select quantity-input';
    input.dataset.index = idx;
    input.dataset.type = 'quantity';
    input.placeholder = '例: 5本, 各1個';
    input.maxLength = 30;
    input.value = value || "";  // 初期値を確実に設定
    
    // イベント設定
    input.addEventListener('input', (e) => this.handleQuantityInput(e));
    input.addEventListener('blur', (e) => this.handleQuantityBlur(e));
    input.addEventListener('focus', (e) => this.handleQuantityFocus(e));
    
    return input;
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

  /* ---------- ソート処理 ---------- */
  sortAssignments(assignments) {
    if (!this.sortByAssignee) {
      // ソートしない場合は元の配列をそのまま返す
      return assignments;
    }

    // ソートする場合
    return [...assignments].sort((a, b) => {
      const assigneeA = a.assignee || "";
      const assigneeB = b.assignee || "";

      // 「全員」を最優先
      if (assigneeA === "全員" && assigneeB !== "全員") return -1;
      if (assigneeA !== "全員" && assigneeB === "全員") return 1;

      // 未選択（空文字列）を最後
      if (assigneeA === "" && assigneeB !== "") return 1;
      if (assigneeA !== "" && assigneeB === "") return -1;

      // 両方とも「全員」または両方とも空の場合は順序を保持
      if (assigneeA === assigneeB) return 0;

      // それ以外は50音順
      return assigneeA.localeCompare(assigneeB, 'ja');
    });
  }

  /* ---------- ソートトグル処理 ---------- */
  toggleSort() {
    this.sortByAssignee = !this.sortByAssignee;

    // ボタンのラベルを更新
    const sortLabel = document.getElementById("sortLabel");
    if (sortLabel) {
      sortLabel.textContent = this.sortByAssignee ? "元の順序に戻す" : "50音順で並べ替え";
    }

    // ボタンのスタイルを更新（アクティブ状態を示す）
    const sortBtn = document.getElementById("sortToggleBtn");
    if (sortBtn) {
      if (this.sortByAssignee) {
        sortBtn.classList.add("active");
      } else {
        sortBtn.classList.remove("active");
      }
    }

    // 再描画
    this.renderItems();
  }

  /* ---------- 削除処理 ---------- */
  async handleDelete(name) {
    if (!confirm(`「${name}」を削除しますか？`)) {
      return;
    }

    const deleteBtn = this.listWrap.querySelector(
      `[data-name="${name}"] .delete-btn`
    );
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "...";
    }

    try {
      await this.deleteItemFromServer(name);

      this.assignments = this.assignments.filter((a) => a.name !== name);
      this.items = this.items.filter((n) => n !== name);
      const el = this.listWrap.querySelector(`[data-name="${name}"]`);
      if (el) {
        el.style.transition = "all 0.3s ease-out";
        el.style.opacity = "0";
        el.style.transform = "translateX(-20px)";

        setTimeout(() => {
          el.remove();
          if (this.items.length === 0) {
            this.noMsg.style.display = "block";
            const header = this.listWrap.querySelector(".column-headers");
            if (header) {
              header.style.display = "none";
            }
          }
        }, 300);
      }

      console.log(`アイテム「${name}」を削除しました`);
    } catch (err) {
      console.error("削除エラー:", err);
      alert("削除に失敗しました。ネットワーク接続を確認してください。");

      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "×";
      }
    }
  }
}

// ヘッダークリックでindex.htmlに戻る処理
document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector("header");
  if (header) {
    header.onclick = () => {
      window.location.href = "/index.html";
    };
    header.style.cursor = "pointer";
    console.log("ヘッダークリックイベントを設定しました");
  }
});

// 編集ボタンが押されたら page2.html に戻る処理
document.addEventListener("DOMContentLoaded", () => {
  const editBtnWrappers = document.querySelectorAll(".edit-button-wrapper");
  const editBtnWrapper = editBtnWrappers[0];
  const editBtn = document.getElementById("editMembersBtn") || document.querySelector(".edit-btn[data-type='members']");
  
  if (!editBtnWrapper && !editBtn) {
    console.warn("編集ボタンが見つかりません");
    return;
  }

  console.log("編集ボタンのイベントリスナーを設定しました");

  const handleEditClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      console.log("編集ボタンがクリックされました");
      
      sessionStorage.setItem("editMode", "members");

      let currentGroupData = ItemAssignmentManager.getCurrentGroupData();
      
      console.log("取得したグループデータ:", currentGroupData);

      if (currentGroupData.groupId) {
        console.log("編集ボタン：サーバーから最新のグループ情報を取得中...");

        try {
          const response = await fetch(`/api/groups/${currentGroupData.groupId}`);
          if (response.ok) {
            const serverGroupData = await response.json();
            console.log("サーバーから取得した最新データ:", serverGroupData);

            currentGroupData.groupName = serverGroupData.groupName || currentGroupData.groupName;
            currentGroupData.members = serverGroupData.members || currentGroupData.members;
          } else {
            console.warn("サーバーからの情報取得に失敗（ステータス:", response.status, "）");
          }
        } catch (err) {
          console.warn("サーバーからの情報取得に失敗、ローカルデータを使用:", err);
        }
      }

      if (!currentGroupData.groupId) {
        console.warn("グループIDが見つかりません。デフォルト値を使用します。");
        currentGroupData = {
          groupId: "temp-id",
          groupName: "新グループ", 
          members: []
        };
      }

      sessionStorage.setItem("groupData", JSON.stringify(currentGroupData));
      console.log("編集用にsessionStorageに保存:", currentGroupData);

      window.location.href = "/page2.html";
    } catch (err) {
      console.error("編集ボタンエラー:", err);
      alert("編集画面への移動に失敗しました。もう一度お試しください。");
    }
  };

  if (editBtnWrapper) {
    editBtnWrapper.style.cursor = "pointer";
    editBtnWrapper.addEventListener("click", handleEditClick);
  }
  
  if (editBtn) {
    editBtn.addEventListener("click", handleEditClick);
  }
});

// ItemAssignmentManagerインスタンスをグローバルに保存
document.addEventListener("DOMContentLoaded", () => {
  window.itemManager = new ItemAssignmentManager();
});

// URLコピー機能
document.addEventListener("DOMContentLoaded", () => {
  const copyUrlBtnWrapper = document.querySelectorAll(".edit-button-wrapper")[1];
  const copyUrlBtn = document.getElementById("copyUrlBtn");

  const handleCopyClick = async () => {
    try {
      const protocol = window.location.protocol;
      const currentDomain = window.location.hostname;
      const baseUrl = `${protocol}//${currentDomain}/group/`;

      const groupData = ItemAssignmentManager.getCurrentGroupData();
      const groupId = groupData.groupId;

      if (!groupId) {
        alert("グループIDが見つかりません");
        return;
      }

      const groupUrl = `${baseUrl}${groupId}`;

      await navigator.clipboard.writeText(groupUrl);

      const successMessage = document.getElementById("copySuccessMessage");
      if (successMessage) {
        successMessage.textContent = "コピーしました！";
        successMessage.classList.add("show");

        setTimeout(() => {
          successMessage.classList.remove("show");
        }, 2000);
      }

      console.log("URLをコピーしました:", groupUrl);
    } catch (err) {
      console.error("URLのコピーに失敗しました:", err);
      alert("URLのコピーに失敗しました。手動でコピーしてください。");
    }
  };

  if (copyUrlBtnWrapper) {
    copyUrlBtnWrapper.style.cursor = "pointer";
    copyUrlBtnWrapper.addEventListener("click", handleCopyClick);
  }

  if (copyUrlBtn) {
    copyUrlBtn.addEventListener("click", handleCopyClick);
  }
});

// ソート機能
document.addEventListener("DOMContentLoaded", () => {
  const sortBtnWrapper = document.querySelectorAll(".edit-button-wrapper")[2];
  const sortBtn = document.getElementById("sortToggleBtn");

  const handleSortClick = () => {
    if (window.itemManager) {
      window.itemManager.toggleSort();
    }
  };

  if (sortBtnWrapper) {
    sortBtnWrapper.style.cursor = "pointer";
    sortBtnWrapper.addEventListener("click", handleSortClick);
  }

  if (sortBtn) {
    sortBtn.addEventListener("click", handleSortClick);
  }
});
