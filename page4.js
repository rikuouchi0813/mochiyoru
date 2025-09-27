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
      if (res.status === 404) return; // まだ何も無い
      if (!res.ok) throw new Error();

      const items = await res.json(); // [{name,quantity,assignee}]

      // データを正規化（空文字に統一）
      this.assignments = items.map((it) => ({
        name: it.name || "",
        assignee: it.assignee || "",
        quantity: it.quantity || "",
      }));

      this.items = items.map((it) => it.name);
    } catch (err) {
      console.warn("アイテム取得スキップ（404 or ネットワーク）");
    }
  }

  /* ---------- アイテム保存 ---------- */
  async saveItemToServer(payload) {
    console.log("=== アイテム保存開始 ===");
    console.log("送信データ（変換前）:", payload);

    const processedPayload = {
      name: payload.name || "",
      assignee: payload.assignee || "",
      quantity:
        payload.quantity === "" ||
        payload.quantity === null ||
        payload.quantity === undefined
          ? null
          : parseInt(payload.quantity, 10),
    };

    console.log("送信データ（変換後）:", processedPayload);
    console.log("URL:", this.baseUrl("/items"));

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
    console.log("URL:", this.baseUrl("/items"));

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
      // ヘッダーも非表示にする
      const existingHeader = this.listWrap.querySelector(".column-headers");
      if (existingHeader) {
        existingHeader.style.display = "none";
      }
      return;
    }
    this.noMsg.style.display = "none";

    // ヘッダーが無ければ作る（一度だけ）
    let header = this.listWrap.querySelector(".column-headers");
    if (!header) {
      header = this.createHeader();
      this.listWrap.prepend(header);
    }
    // ヘッダーを表示状態にする
    header.style.display = "flex";

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

    // デフォルトで「選択してください」を選択状態にする
    s.value = "";

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

  /* ---------- 削除処理（実装済み） ---------- */
  async handleDelete(name) {
    // 確認ダイアログを表示
    if (!confirm(`「${name}」を削除しますか？`)) {
      return;
    }

    // 削除ボタンを一時的に無効化（連続クリック防止）
    const deleteBtn = this.listWrap.querySelector(
      `[data-name="${name}"] .delete-btn`
    );
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "...";
    }

    try {
      // サーバーから削除
      await this.deleteItemFromServer(name);

      // UIから削除
      this.assignments = this.assignments.filter((a) => a.name !== name);
      this.items = this.items.filter((n) => n !== name);
      const el = this.listWrap.querySelector(`[data-name="${name}"]`);
      if (el) {
        // フェードアウトアニメーション
        el.style.transition = "all 0.3s ease-out";
        el.style.opacity = "0";
        el.style.transform = "translateX(-20px)";

        setTimeout(() => {
          el.remove();

          // アイテムが0個になった場合の処理
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

      // エラー時はボタンを元に戻す
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "×";
      }
    }
  }
}

// ===== スマホ対応強化：編集ボタンのイベント処理関数 =====
function setupEditButtonEvents() {
  const editBtn = document.getElementById("editMembersBtn");
  if (!editBtn) {
    console.warn("編集ボタンが見つかりません");
    return;
  }

  console.log("編集ボタンにイベントを設定中...");

  // イベントハンドラー関数
  const handleEditClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log("編集ボタンがクリックされました");

    try {
      // ボタンを一時的に無効化（連続クリック防止）
      editBtn.style.pointerEvents = "none";
      editBtn.style.opacity = "0.6";

      // メンバー編集のためのフラグを sessionStorage に設定
      sessionStorage.setItem("editMode", "members");

      // 現在のグループデータを確実に sessionStorage に保存
      const currentGroupData = {
        groupId: window.itemManager?.groupData?.groupId,
        groupName: window.itemManager?.groupData?.groupName,
        members: window.itemManager?.members || [],
      };

      // グループIDが存在する場合は、最新情報をサーバーから取得
      if (currentGroupData.groupId) {
        console.log("編集ボタン：サーバーから最新のグループ情報を取得中...");

        try {
          const response = await fetch(
            `/api/groups/${currentGroupData.groupId}`
          );
          if (response.ok) {
            const serverGroupData = await response.json();
            console.log("サーバーから取得した最新データ:", serverGroupData);

            // サーバーの最新データで更新
            currentGroupData.groupName =
              serverGroupData.groupName || currentGroupData.groupName;
            currentGroupData.members =
              serverGroupData.members || currentGroupData.members;
          }
        } catch (err) {
          console.warn(
            "サーバーからの情報取得に失敗、ローカルデータを使用:",
            err
          );
        }
      }

      // sessionStorageに保存
      sessionStorage.setItem("groupData", JSON.stringify(currentGroupData));
      console.log("編集用にsessionStorageに保存:", currentGroupData);

      // page2.htmlに遷移
      console.log("page2.htmlに遷移します");
      window.location.href = "page2.html";

    } catch (err) {
      console.error("編集ボタンエラー:", err);
      alert("編集画面への移動に失敗しました。もう一度お試しください。");
      
      // エラー時はボタンを元に戻す
      editBtn.style.pointerEvents = "auto";
      editBtn.style.opacity = "1";
    }
  };

  // 既存のイベントリスナーを削除（重複防止）
  editBtn.removeEventListener("click", handleEditClick);
  editBtn.removeEventListener("touchstart", handleEditClick);
  editBtn.removeEventListener("touchend", handleEditClick);

  // PC用：clickイベント
  editBtn.addEventListener("click", handleEditClick, { passive: false });

  // スマホ用：touchstartイベント（より確実）
  editBtn.addEventListener("touchstart", (event) => {
    console.log("touchstart detected");
    event.preventDefault();
    // タッチ開始時の視覚的フィードバック
    editBtn.style.transform = "scale(0.95)";
    editBtn.style.background = "#404040";
  }, { passive: false });

  // スマホ用：touchendイベントで実際の処理を実行
  editBtn.addEventListener("touchend", (event) => {
    console.log("touchend detected");
    event.preventDefault();
    // 視覚的フィードバックをリセット
    editBtn.style.transform = "scale(1.05)";
    editBtn.style.background = "#242424";
    
    // 少し遅延してから処理を実行（タッチフィードバックを見せるため）
    setTimeout(() => {
      handleEditClick(event);
    }, 100);
  }, { passive: false });

  console.log("編集ボタンのイベント設定完了");
}

// ===== ヘッダークリック処理（従来通り） =====
function setupHeaderClick() {
  const header = document.querySelector("header");
  if (header) {
    // 既存のonclickを上書きしてindex.htmlに戻る
    header.onclick = () => {
      window.location.href = "/index.html";
    };

    // カーソルスタイルを確実にpointerに設定
    header.style.cursor = "pointer";

    console.log("ヘッダークリックイベントを設定しました");
  }
}

// ===== 初期化処理 =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded - 初期化開始");
  
  // ヘッダークリック設定
  setupHeaderClick();
  
  // ItemAssignmentManagerインスタンスをグローバルに保存
  window.itemManager = new ItemAssignmentManager();
  
  // 編集ボタンのイベント設定（ItemAssignmentManagerの初期化後に実行）
  setTimeout(() => {
    setupEditButtonEvents();
  }, 100);
  
  console.log("初期化完了");
});
