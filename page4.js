class ItemAssignmentManager {
  // ===== コンストラクタ =====
  constructor() {
    // 状態
    this.groupData = {}; // { groupId, groupName, members[] }
    this.members = []; // ["太郎", "花子" ...]
    this.items = []; // ["カメラ", ...]
    this.assignments = []; // [{name, assignee, quantity}]
    this.newItems = new Set(); // 画面上で演出する用
    
    // リアルタイム同期用
    this.supabaseClient = null;
    this.realtimeChannel = null;
    this.isProcessingRemoteChange = false; // 無限ループ防止フラグ

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
    this.connectionStatus = document.getElementById("connectionStatus");
  }

  /* ---------- ここがメイン初期化 ---------- */
  async initialize() {
    await this.loadOrCreateGroup(); // groupId を必ず確保
    await this.initializeSupabaseRealtime(); // Supabaseリアルタイム接続
    await this.fetchItemsFromServer(); // 既存アイテム取得（無ければ空）
    this.attachEventListeners(); // イベント設定
    this.renderItems(); // 画面描画
  }

  /* ---------- Supabaseリアルタイム機能の初期化 ---------- */
  async initializeSupabaseRealtime() {
    try {
      console.log("=== Supabaseリアルタイム接続開始 ===");
      
      // Supabase環境変数を取得（本番環境では環境変数から読み込む）
      // 開発時は直接指定も可能ですが、本番では必ず環境変数を使用してください
      const supabaseUrl = 'https://vvpopjnyxbtqyetgmpgp.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cG9wam55eGJ0cXlldGdtcGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwOTYwMjgsImV4cCI6MjA2NjY3MjAyOH0.EqyBZTAzv2a-I69P1AKNh2d8o4I4CXCem_ahnYo4KQU';
      
      // Supabaseクライアント作成
      this.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      
      // リアルタイムチャンネル作成（グループごとに専用チャンネル）
      const channelName = `group:${this.groupData.groupId}`;
      console.log("チャンネル名:", channelName);
      
      this.realtimeChannel = this.supabaseClient.channel(channelName);
      
      // データベースの変更を監視
      this.realtimeChannel
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETEすべて監視
            schema: 'public',
            table: 'items',
            filter: `group_id=eq.${this.groupData.groupId}` // このグループのアイテムのみ
          },
          (payload) => {
            console.log("🔔 Realtimeイベント受信:", payload);
            this.handleRealtimeChange(payload);
          }
        )
        .subscribe((status) => {
          console.log('リアルタイム接続状態:', status);
          this.updateConnectionStatus(status);
          
          if (status === 'SUBSCRIBED') {
            console.log("✅ リアルタイム接続が確立されました");
            console.log("グループID:", this.groupData.groupId);
          }
        });
      
      console.log("=== Supabaseリアルタイム接続完了 ===");
    } catch (err) {
      console.error("リアルタイム接続エラー:", err);
      this.updateConnectionStatus('error');
    }
  }

  /* ---------- リアルタイム変更のハンドラー ---------- */
  handleRealtimeChange(payload) {
    console.log("=== リアルタイム変更を受信 ===", payload);
    console.log("イベントタイプ:", payload.eventType);
    console.log("新しいレコード:", payload.new);
    console.log("古いレコード:", payload.old);
    
    // 自分の変更による更新の場合はスキップ（無限ループ防止）
    if (this.isProcessingRemoteChange) {
      console.log("自分の変更なのでスキップ");
      return;
    }
    
    this.isProcessingRemoteChange = true;
    
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      switch (eventType) {
        case 'INSERT':
          this.handleRemoteInsert(newRecord);
          break;
        case 'UPDATE':
          this.handleRemoteUpdate(newRecord);
          break;
        case 'DELETE':
          console.log("DELETE イベント処理開始");
          this.handleRemoteDelete(oldRecord);  // ✅ DELETEの場合はoldRecordを使用
          break;
      }
    } finally {
      // 少し遅延させてから解除（連続変更の場合を考慮）
      setTimeout(() => {
        this.isProcessingRemoteChange = false;
      }, 100);
    }
  }

  /* ---------- リモートからのINSERT処理 ---------- */
  handleRemoteInsert(record) {
    console.log("リモート追加:", record);
    
    // item_nameをnameに変換
    const itemName = record.item_name || record.name || "";
    
    // 既に存在する場合はスキップ
    if (this.items.includes(itemName)) {
      return;
    }
    
    // ローカルデータに追加
    this.items.push(itemName);
    this.assignments.push({
      name: itemName,
      assignee: record.assignee || "",
      quantity: record.quantity || ""
    });
    
    // 画面を更新
    this.renderItems();
    
    // 追加されたことを視覚的に表示
    this.showNotification(`「${itemName}」が追加されました`);
  }

  /* ---------- リモートからのUPDATE処理 ---------- */
  handleRemoteUpdate(record) {
    console.log("リモート更新:", record);
    
    // item_nameをnameに変換
    const itemName = record.item_name || record.name || "";
    
    const idx = this.assignments.findIndex(a => a.name === itemName);
    if (idx === -1) {
      console.warn("更新対象が見つかりません:", itemName);
      return;
    }
    
    // ローカルデータを更新
    this.assignments[idx] = {
      name: itemName,
      assignee: record.assignee || "",
      quantity: record.quantity || ""
    };
    
    // 画面を更新（アニメーションなしで静かに更新）
    this.renderItems();
  }

  /* ---------- リモートからのDELETE処理 ---------- */
  handleRemoteDelete(record) {
    console.log("=== リモート削除処理開始 ===");
    console.log("削除レコード:", record);
    
    if (!record) {
      console.error("削除レコードがnullまたはundefined");
      return;
    }
    
    // item_nameをnameに変換
    const itemName = record.item_name || record.name || "";
    console.log("削除対象のアイテム名:", itemName);
    
    if (!itemName) {
      console.error("アイテム名が取得できません");
      return;
    }
    
    console.log("削除前のitems:", this.items);
    console.log("削除前のassignments:", this.assignments);
    
    // ローカルデータから削除
    this.items = this.items.filter(n => {
      const shouldKeep = n !== itemName;
      console.log(`アイテム "${n}": ${shouldKeep ? "保持" : "削除"}`);
      return shouldKeep;
    });
    
    this.assignments = this.assignments.filter(a => {
      const shouldKeep = a.name !== itemName;
      console.log(`割り当て "${a.name}": ${shouldKeep ? "保持" : "削除"}`);
      return shouldKeep;
    });
    
    console.log("削除後のitems:", this.items);
    console.log("削除後のassignments:", this.assignments);
    
    // 画面を更新
    this.renderItems();
    
    // 削除されたことを視覚的に表示
    this.showNotification(`「${itemName}」が削除されました`);
    
    console.log("=== リモート削除処理完了 ===");
  }

  /* ---------- 接続状態の表示更新 ---------- */
  updateConnectionStatus(status) {
    if (!this.connectionStatus) return;
    
    const indicator = this.connectionStatus.querySelector('.status-indicator');
    const text = this.connectionStatus.querySelector('.status-text');
    
    console.log('接続状態更新:', status);
    
    switch (status) {
      case 'SUBSCRIBED':
        // 接続成功 - 表示を隠す
        this.connectionStatus.style.display = 'none';
        console.log('✅ リアルタイム接続成功 - 状態表示を非表示');
        break;
      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
        // 一時的なエラーは無視（リトライ中）
        console.log('一時的な接続エラー - リトライ中...');
        break;
      case 'error':
        // エラー時のみ表示 - 赤色
        this.connectionStatus.style.display = 'flex';
        indicator.className = 'status-indicator error';
        text.textContent = '接続エラー';
        this.connectionStatus.classList.remove('connected', 'connecting');
        this.connectionStatus.classList.add('error');
        break;
      case 'CLOSED':
        // 接続が閉じられた - 再接続試行中を表示
        this.connectionStatus.style.display = 'flex';
        indicator.className = 'status-indicator connecting';
        text.textContent = '再接続中...';
        this.connectionStatus.classList.remove('connected', 'error');
        this.connectionStatus.classList.add('connecting');
        break;
      default:
        // 初回接続中は非表示（すぐに接続完了するため）
        this.connectionStatus.style.display = 'none';
    }
  }

  /* ---------- 通知表示 ---------- */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'realtime-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // アニメーション
    setTimeout(() => notification.classList.add('show'), 10);
    
    // 3秒後に削除
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
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
    // Netlify Functions形式でリクエスト
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

      // データを正規化（データベースのカラム名に対応）
      this.assignments = items.map((it) => ({
        name: it.item_name || it.name || "",  // item_nameとnameの両方に対応
        assignee: it.assignee !== null && it.assignee !== undefined ? it.assignee : "",
        quantity: it.quantity !== null && it.quantity !== undefined ? it.quantity : "",
      }));

      this.items = items.map((it) => it.item_name || it.name || "");  // item_nameとnameの両方に対応
      console.log("正規化後のassignments:", this.assignments);
    } catch (err) {
      console.warn("アイテム取得エラー:", err);
    }
  }

  /* ---------- アイテム保存 ---------- */
  async saveItemToServer(payload) {
    console.log("=== アイテム保存開始 ===");
    console.log("送信データ:", payload);

    // データベースのカラム名に合わせて送信（group_idも含める）
    const processedPayload = {
      group_id: this.groupData.groupId,  // group_idを追加
      item_name: payload.name || payload.item_name || "",  // nameをitem_nameに変換
      assignee: payload.assignee || "",
      quantity: payload.quantity || "",
    };

    console.log("送信データ（処理後）:", processedPayload);
    console.log("送信先URL:", this.baseUrl("/items"));
    console.log("送信JSON:", JSON.stringify(processedPayload));

    const res = await fetch(this.baseUrl("/items"), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(processedPayload),
    });

    console.log("レスポンス status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("サーバーエラー詳細:", errorText);
      
      // エラーレスポンスをパース
      try {
        const errorJson = JSON.parse(errorText);
        console.error("エラーJSON:", errorJson);
      } catch (e) {
        console.error("エラーテキスト:", errorText);
      }
      
      throw new Error(`保存失敗: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    console.log("保存成功:", result);
  }

  /* ---------- アイテム削除 ---------- */
  async deleteItemFromServer(name) {
    console.log("=== アイテム削除開始 ===");
    console.log("削除対象:", name);

    // データベースのカラム名に合わせて送信（group_idも含める）
    const deletePayload = {
      group_id: this.groupData.groupId,
      item_name: name
    };
    
    console.log("削除リクエストボディ:", deletePayload);

    const res = await fetch(this.baseUrl("/items"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deletePayload),
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

    // サーバー保存（Supabaseが自動的に他のユーザーに通知）
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
  async handleSelectChange(e) {
    const el = e.target;
    const idx = +el.dataset.index;
    const type = el.dataset.type;
    this.assignments[idx][type] = el.value;

    const { name, quantity, assignee } = this.assignments[idx];
    
    try {
      await this.saveItemToServer({ name, quantity, assignee });
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました。ネットワーク接続を確認してください。");
    }
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

    // 行を新規作成
    this.assignments.forEach((a, idx) => {
      const row = this.createRow(a, idx);
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
      console.log("=== ローカル削除開始 ===");
      console.log("削除対象:", name);
      
      // リアルタイム処理フラグを立てる（自分の削除を無視するため）
      this.isProcessingRemoteChange = true;
      
      // サーバーから削除
      await this.deleteItemFromServer(name);

      // ローカルデータから削除
      this.assignments = this.assignments.filter((a) => a.name !== name);
      this.items = this.items.filter((n) => n !== name);
      
      // DOM要素を削除
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
      
      // フラグを少し遅延させて解除（Realtimeイベントが来る前に）
      setTimeout(() => {
        this.isProcessingRemoteChange = false;
        console.log("削除のフラグを解除しました");
      }, 1000);  // 1秒後に解除
      
    } catch (err) {
      console.error("削除エラー:", err);
      alert("削除に失敗しました。ネットワーク接続を確認してください。");

      // エラー時はすぐにフラグを解除
      this.isProcessingRemoteChange = false;

      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "×";
      }
    }
  }
  
  /* ---------- クリーンアップ ---------- */
  destroy() {
    // リアルタイムチャンネルを切断
    if (this.realtimeChannel) {
      this.supabaseClient.removeChannel(this.realtimeChannel);
      console.log("リアルタイムチャンネルを切断しました");
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

// ページを閉じる時にクリーンアップ
window.addEventListener('beforeunload', () => {
  if (window.itemManager) {
    window.itemManager.destroy();
  }
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

