/**
 * 最適化されたItemAssignmentManager
 * パフォーマンス改善とメモリ効率化を実装
 */
class ItemAssignmentManager {
  constructor() {
    // 状態管理
    this.groupData = {};
    this.members = [];
    this.items = [];
    this.assignments = [];
    this.newItems = new Set();
    
    // パフォーマンス最適化用
    this.pendingSaves = new Map();
    this.isInitialized = false;
    this.renderScheduled = false;
    
    // DOM要素のキャッシュ
    this.dom = {};
    
    // 初期化を非同期で実行
    this.initializeAsync();
  }

  /**
   * 非同期初期化（エラーハンドリング強化）
   */
  async initializeAsync() {
    try {
      this.bindElements();
      await this.loadOrCreateGroup();
      await this.fetchItemsFromServer();
      this.attachEventListeners();
      this.scheduleRender();
      this.isInitialized = true;
    } catch (error) {
      console.error("初期化エラー:", error);
      this.showErrorMessage("初期化に失敗しました。ページを更新してください。");
    }
  }

  /**
   * DOM要素の効率的な取得とキャッシュ
   */
  bindElements() {
    const elements = {
      input: "itemInput",
      addBtn: "addButton",
      listWrap: "itemsList",
      noMsg: "noItemsMessage"
    };
    
    Object.entries(elements).forEach(([key, id]) => {
      this.dom[key] = document.getElementById(id);
      if (!this.dom[key]) {
        console.warn(`要素が見つかりません: ${id}`);
      }
    });
  }

  /**
   * グループ情報の効率的な読み込み
   */
  async loadOrCreateGroup() {
    console.log("=== loadOrCreateGroup 開始 ===");

    // パスからgroupIdを抽出（最優先）
    const path = window.location.pathname;
    const groupIdMatch = path.match(/\/group\/([^\/\?#]+)/);
    
    // URLパラメータから取得
    const params = new URLSearchParams(window.location.search);
    const urlGroupId = params.get("groupId");
    const urlGroupName = params.get("groupName");
    const urlMembers = params.get("members");

    // sessionStorageから復元
    try {
      const saved = sessionStorage.getItem("groupData");
      if (saved) {
        this.groupData = JSON.parse(saved);
      }
    } catch (error) {
      console.warn("sessionStorage読み込みエラー:", error);
      this.groupData = {};
    }

    // groupIDの優先順位設定
    if (groupIdMatch?.[1]) {
      this.groupData.groupId = groupIdMatch[1];
    } else if (urlGroupId) {
      this.groupData.groupId = urlGroupId;
    }

    // その他のパラメータ処理
    if (urlGroupName) {
      this.groupData.groupName = decodeURIComponent(urlGroupName);
    }
    
    if (urlMembers) {
      try {
        const memberArray = JSON.parse(urlMembers);
        this.groupData.members = Array.isArray(memberArray) 
          ? memberArray.map(m => typeof m === 'string' ? m : m.name)
          : [];
      } catch (error) {
        console.warn("メンバー情報の解析に失敗:", error);
        this.groupData.members = this.groupData.members || [];
      }
    }

    this.members = this.groupData.members || [];

    // groupIdが無い場合は新規作成
    if (!this.groupData.groupId) {
      await this.createNewGroup();
    } else if (this.shouldFetchGroupInfo()) {
      await this.fetchGroupInfo();
    }

    // データを保存
    this.saveGroupDataToSession();
    console.log("=== loadOrCreateGroup 完了 ===", this.groupData);
  }

  /**
   * グループ情報取得の必要性チェック
   */
  shouldFetchGroupInfo() {
    return !this.groupData.groupName || !this.members.length;
  }

  /**
   * 新規グループの作成
   */
  async createNewGroup() {
    const response = await this.fetchWithRetry("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupName: this.groupData.groupName || "新グループ",
        members: this.members,
      }),
    });

    if (!response.ok) throw new Error("グループ作成失敗");

    const { groupId } = await response.json();
    this.groupData.groupId = groupId;

    // URLを更新（リロードなし）
    const params = new URLSearchParams(window.location.search);
    params.set("groupId", groupId);
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }

  /**
   * 既存グループ情報の取得
   */
  async fetchGroupInfo() {
    try {
      const response = await this.fetchWithRetry(`/api/groups/${this.groupData.groupId}`);
      
      if (response.ok) {
        const groupInfo = await response.json();
        
        if (!this.groupData.groupName) {
          this.groupData.groupName = groupInfo.groupName;
        }
        if (!this.members.length) {
          this.groupData.members = groupInfo.members;
          this.members = groupInfo.members || [];
        }
      }
    } catch (error) {
      console.warn("グループ情報取得失敗:", error);
    }
  }

  /**
   * リトライ機能付きfetch
   */
  async fetchWithRetry(url, options = {}, maxRetries = 2) {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        if (i === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  /**
   * APIベースURL（最適化）
   */
  getBaseUrl(path = "") {
    if (path === "/items") {
      return `/.netlify/functions/items?groupId=${this.groupData.groupId}`;
    }
    return `/api/groups/${this.groupData.groupId}${path}`;
  }

  /**
   * 既存アイテムの効率的な取得
   */
  async fetchItemsFromServer() {
    if (!this.groupData.groupId) return;

    try {
      const response = await this.fetchWithRetry(this.getBaseUrl("/items"));
      
      if (response.status === 404) return; // アイテム無し
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const items = await response.json();
      
      // データ正規化とバッチ処理
      this.assignments = items.map(item => ({
        name: item.name || "",
        assignee: item.assignee || "",
        quantity: item.quantity === null || item.quantity === undefined ? "" : item.quantity
      }));
      
      this.items = items.map(item => item.name);
      
    } catch (error) {
      console.warn("アイテム取得をスキップ:", error.message);
    }
  }

  /**
   * アイテム保存（デバウンス機能付き）
   */
  async saveItemToServer(payload) {
    const key = payload.name;
    
    // 既存の保存処理をキャンセル
    if (this.pendingSaves.has(key)) {
      clearTimeout(this.pendingSaves.get(key));
    }
    
    // デバウンス処理（500ms遅延）
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        try {
          const processedPayload = {
            name: payload.name || "",
            assignee: payload.assignee || "",
            quantity: payload.quantity === "" || payload.quantity === null || payload.quantity === undefined 
                     ? null 
                     : parseInt(payload.quantity, 10)
          };
          
          const response = await this.fetchWithRetry(this.getBaseUrl("/items"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(processedPayload),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`保存失敗: ${response.status} - ${errorText}`);
          }
          
          this.pendingSaves.delete(key);
          resolve(await response.json());
          
        } catch (error) {
          this.pendingSaves.delete(key);
          console.error('保存エラー:', error);
          reject(error);
        }
      }, 500);
      
      this.pendingSaves.set(key, timeoutId);
    });
  }

  /**
   * アイテム削除（最適化済み）
   */
  async deleteItemFromServer(name) {
    const response = await this.fetchWithRetry(this.getBaseUrl("/items"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`削除失敗: ${response.status} - ${errorText}`);
    }
    
    return response.json();
  }

  /**
   * イベントリスナーの効率的な設定
   */
  attachEventListeners() {
    if (!this.dom.addBtn || !this.dom.input) return;

    // イベントデリゲーションを使用
    this.dom.addBtn.addEventListener("click", this.handleAdd.bind(this), { passive: true });
    
    this.dom.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleAdd();
      }
    });

    // リストコンテナでイベントデリゲーション
    if (this.dom.listWrap) {
      this.dom.listWrap.addEventListener("change", this.handleSelectChange.bind(this));
      this.dom.listWrap.addEventListener("click", this.handleListClick.bind(this));
    }
  }

  /**
   * リストクリックのハンドリング（イベントデリゲーション）
   */
  handleListClick(e) {
    if (e.target.classList.contains('delete-btn')) {
      const row = e.target.closest('.item-row');
      if (row) {
        const itemName = row.dataset.name;
        this.handleDelete(itemName);
      }
    }
  }

  /**
   * アイテム追加処理（最適化済み）
   */
  async handleAdd() {
    if (!this.dom.input) return;

    const name = this.dom.input.value.trim();
    if (!name) return;

    // 重複チェック
    if (this.items.includes(name)) {
      this.showErrorMessage("既に存在するアイテムです");
      return;
    }

    // UI先行更新
    this.items.push(name);
    this.assignments.push({ name, assignee: "", quantity: "" });
    this.newItems.add(name);
    this.dom.input.value = "";
    
    // レンダリングをスケジュール
    this.scheduleRender();

    // サーバー保存（非同期）
    try {
      await this.saveItemToServer({ name });
    } catch (error) {
      this.showErrorMessage("保存に失敗しました");
      // エラー時はUIを元に戻す
      this.items = this.items.filter(item => item !== name);
      this.assignments = this.assignments.filter(a => a.name !== name);
      this.newItems.delete(name);
      this.scheduleRender();
    }
  }

  /**
   * セレクト変更処理（デバウンス付き）
   */
  handleSelectChange(e) {
    if (!e.target.classList.contains('item-select')) return;

    const index = parseInt(e.target.dataset.index, 10);
    const type = e.target.dataset.type;
    
    if (!this.assignments[index]) return;

    this.assignments[index][type] = e.target.value;
    const { name, quantity, assignee } = this.assignments[index];
    
    // 自動保存（デバウンス付き）
    this.saveItemToServer({ name, quantity, assignee }).catch(error => {
      console.error("自動保存エラー:", error);
    });
  }

  /**
   * 効率的なレンダリング（RequestAnimationFrame使用）
   */
  scheduleRender() {
    if (this.renderScheduled) return;
    
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderItems();
      this.renderScheduled = false;
    });
  }

  /**
   * アイテムリスト描画（最適化済み）
   */
  renderItems() {
    if (!this.dom.listWrap || !this.dom.noMsg) return;

    if (this.items.length === 0) {
      this.dom.noMsg.style.display = "block";
      this.hideHeaders();
      return;
    }

    this.dom.noMsg.style.display = "none";
    this.showHeaders();

    // DocumentFragmentで効率的なDOM操作
    const fragment = document.createDocumentFragment();
    
    this.assignments.forEach((assignment, index) => {
      let row = this.dom.listWrap.querySelector(`[data-name="${assignment.name}"]`);
      
      if (!row) {
        row = this.createRow(assignment, index);
        fragment.appendChild(row);
      } else {
        this.updateRow(row, assignment);
      }

      // 新規アイテムアニメーション
      if (this.newItems.has(assignment.name)) {
        this.animateRow(row);
        this.newItems.delete(assignment.name);
      }
    });

    if (fragment.hasChildNodes()) {
      this.dom.listWrap.appendChild(fragment);
    }
  }

  /**
   * ヘッダー表示/非表示の最適化
   */
  showHeaders() {
    let header = this.dom.listWrap.querySelector(".column-headers");
    if (!header) {
      header = this.createHeader();
      this.dom.listWrap.prepend(header);
    }
    header.style.display = "flex";
  }

  hideHeaders() {
    const header = this.dom.listWrap.querySelector(".column-headers");
    if (header) {
      header.style.display = "none";
    }
  }

  /**
   * ヘッダー作成（最適化済み）
   */
  createHeader() {
    const headerContainer = document.createElement("div");
    headerContainer.className = "column-headers";
    
    const headerContent = document.createElement("div");
    headerContent.className = "column-headers-content";
    
    const headers = ["何を？", "誰が？", "どれくらい？"];
    headers.forEach(text => {
      const headerDiv = document.createElement("div");
      headerDiv.className = "column-header";
      headerDiv.textContent = text;
      headerContent.appendChild(headerDiv);
    });
    
    const spacer = document.createElement("div");
    spacer.className = "header-spacer";
    
    headerContainer.appendChild(headerContent);
    headerContainer.appendChild(spacer);
    
    return headerContainer;
  }

  /**
   * 行作成（最適化済み）
   */
  createRow(assignment, index) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.name = assignment.name;

    const content = document.createElement("div");
    content.className = "item-content";

    // アイテム名
    const nameDiv = document.createElement("div");
    nameDiv.className = "item-name";
    nameDiv.textContent = assignment.name;

    // セレクトボックス
    const assigneeSelect = this.createSelect(index, "assignee", [
      "", "全員", ...this.members
    ]);
    const quantitySelect = this.createSelect(index, "quantity", [
      "", ...Array.from({ length: 10 }, (_, i) => i + 1)
    ]);

    content.append(nameDiv, assigneeSelect, quantitySelect);

    // 削除ボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute('aria-label', `${assignment.name}を削除`);

    row.appendChild(content);
    row.appendChild(deleteBtn);

    return row;
  }

  /**
   * 行の更新（既存行の値同期）
   */
  updateRow(row, assignment) {
    const assigneeSelect = row.querySelector('select[data-type="assignee"]');
    const quantitySelect = row.querySelector('select[data-type="quantity"]');
    
    if (assigneeSelect) assigneeSelect.value = assignment.assignee;
    if (quantitySelect) quantitySelect.value = assignment.quantity;
  }

  /**
   * セレクトボックス作成（最適化済み）
   */
  createSelect(index, type, options) {
    const select = document.createElement("select");
    select.className = "item-select";
    select.dataset.index = index;
    select.dataset.type = type;
    
    options.forEach(value => {
      const option = document.createElement("option");
      option.value = value === "" ? "" : String(value);
      option.textContent = value === "" ? "選択してください" : String(value);
      
      if (value === "全員") {
        option.style.fontWeight = "bold";
        option.style.color = "#00E1A9";
      }
      
      select.appendChild(option);
    });
    
    // デフォルト値を設定（重要: 初期状態で空文字列）
    select.value = "";
    
    console.log(`セレクト作成: type=${type}, index=${index}, options=`, options);
    
    return select;
  }

  /**
   * 行のアニメーション（GPU最適化）
   */
  animateRow(row) {
    row.style.opacity = "0";
    row.style.transform = "translateY(20px)";
    
    // 次のフレームでアニメーション開始
    requestAnimationFrame(() => {
      row.style.transition = "opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      row.style.opacity = "1";
      row.style.transform = "translateY(0)";
    });
  }

  /**
   * 削除処理（UI最適化済み）
   */
  async handleDelete(name) {
    if (!confirm(`「${name}」を削除しますか？`)) return;

    const row = this.dom.listWrap.querySelector(`[data-name="${name}"]`);
    const deleteBtn = row?.querySelector('.delete-btn');
    
    // ボタン無効化
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "...";
    }

    try {
      // サーバーから削除
      await this.deleteItemFromServer(name);

      // ローカル状態更新
      this.assignments = this.assignments.filter(a => a.name !== name);
      this.items = this.items.filter(item => item !== name);

      // アニメーション付きで削除
      if (row) {
        row.style.transition = "all 0.3s ease-out";
        row.style.opacity = "0";
        row.style.transform = "translateX(-20px)";
        
        setTimeout(() => {
          row.remove();
          this.checkEmptyState();
        }, 300);
      }

    } catch (error) {
      console.error("削除エラー:", error);
      this.showErrorMessage("削除に失敗しました");
      
      // エラー時はボタンを元に戻す
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "×";
      }
    }
  }

  /**
   * 空の状態チェック
   */
  checkEmptyState() {
    if (this.items.length === 0) {
      this.dom.noMsg.style.display = "block";
      this.hideHeaders();
    }
  }

  /**
   * エラーメッセージ表示
   */
  showErrorMessage(message) {
    // 簡単なトースト風メッセージ
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // フェードイン
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
    });
    
    // 3秒後に削除
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  /**
   * グループデータをセッションに保存
   */
  saveGroupDataToSession() {
    try {
      sessionStorage.setItem("groupData", JSON.stringify(this.groupData));
    } catch (error) {
      console.warn("sessionStorage保存エラー:", error);
    }
  }
}

/**
 * ヘッダークリック処理（最適化済み）
 */
function initializeHeaderClick() {
  const header = document.querySelector("header");
  if (!header) return;

  header.addEventListener('click', () => {
    window.location.href = "/index.html";
  }, { passive: true });
  
  header.style.cursor = "pointer";
}

/**
 * 編集ボタン処理（最適化済み）
 */
async function initializeEditButton() {
  const editBtn = document.querySelector(".edit-btn[data-type='members']");
  if (!editBtn) return;

  editBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    
    try {
      sessionStorage.setItem("editMode", "members");

      const currentGroupData = {
        groupId: window.itemManager?.groupData?.groupId,
        groupName: window.itemManager?.groupData?.groupName,
        members: window.itemManager?.members || []
      };

      // サーバーから最新情報を取得
      if (currentGroupData.groupId) {
        try {
          const response = await fetch(`/api/groups/${currentGroupData.groupId}`);
          if (response.ok) {
            const serverData = await response.json();
            currentGroupData.groupName = serverData.groupName || currentGroupData.groupName;
            currentGroupData.members = serverData.members || currentGroupData.members;
          }
        } catch (err) {
          console.warn("サーバー情報取得失敗:", err);
        }
      }

      sessionStorage.setItem("groupData", JSON.stringify(currentGroupData));
      window.location.href = "page2.html";
      
    } catch (error) {
      console.error("編集ボタンエラー:", error);
      alert("編集画面への移動に失敗しました。");
    }
  }, { passive: false });
}

/**
 * DOMContentLoaded時の初期化
 */
document.addEventListener("DOMContentLoaded", () => {
  // メインクラスのインスタンス化
  window.itemManager = new ItemAssignmentManager();
  
  // その他の初期化
  initializeHeaderClick();
  initializeEditButton();
}, { passive: true });
