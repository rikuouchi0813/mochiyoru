class GroupManager {
  constructor() {
    /* --- セッション読み出し --- */
    const rawEdit = sessionStorage.getItem("editMode");
    const rawGroup = sessionStorage.getItem("groupData");
    this.groupData = rawGroup ? JSON.parse(rawGroup) : {};

    /* editMode 判定を厳密に */
    this.isEditMode =
      rawEdit === "members" && this.groupData && this.groupData.groupId;

    /* 編集モードでないのに editMode フラグだけ残っていたら掃除 */
    if (!this.isEditMode) sessionStorage.removeItem("editMode");

    this.members = [];
    this.isSubmitting = false; // 二重送信防止

    this.init();
  }

  /* ---------- 初期化 ---------- */
  init() {
    /* 新規モードなら残データをリセット */
    if (!this.isEditMode) {
      sessionStorage.removeItem("groupData");
      sessionStorage.removeItem("currentGroupId");
      this.groupData = {};
    }

    this.bindDOM();
    this.bindEvents();
    this.restoreIfAny();

    /* UI 切り替え */
    if (this.isEditMode) {
      this.$groupName.readOnly = true;
      this.$createBtn.textContent = "メンバーを更新";
    } else {
      this.$createBtn.textContent = "グループを作成";
    }
  }

  /* ---------- DOM 取得 ---------- */
  bindDOM() {
    this.$memberInput = document.getElementById("memberName");
    this.$addBtn = document.getElementById("addMember");
    this.$memberList = document.getElementById("memberList");
    this.$groupName = document.getElementById("groupName");
    this.$createBtn = document.getElementById("createGroupBtn");
  }

  /* ---------- イベント ---------- */
  bindEvents() {
    this.$addBtn.addEventListener("click", () => this.addMember());
    this.$memberInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.addMember();
      }
    });
    this.$createBtn.addEventListener("click", (e) => this.handleSubmit(e));
    this.$groupName.addEventListener("input", () => this.persistTemp());
  }

  /* ---------- 復元 ---------- */
  restoreIfAny() {
    if (this.groupData.groupName)
      this.$groupName.value = this.groupData.groupName;

    if (Array.isArray(this.groupData.members)) {
      this.members = [...this.groupData.members];
      this.renderMembers();
    }
  }

  /* ---------- 一時保存 ---------- */
  persistTemp() {
    const tmp = {
      groupName: this.$groupName.value.trim(),
      members: [...this.members],
      groupId: this.groupData.groupId || null,
    };
    sessionStorage.setItem("groupData", JSON.stringify(tmp));
  }

  /* ---------- メンバー操作 ---------- */
  addMember() {
    const name = this.$memberInput.value.trim();
    if (!name) {
      this.showAlert("メンバー名を入力してください");
      this.$memberInput.focus();
      return;
    }
    if (name.length > 20) {
      this.showAlert("20 文字以内で入力してください");
      this.$memberInput.focus();
      return;
    }
    if (this.members.includes(name)) {
      this.showAlert("同じ名前があります");
      this.$memberInput.focus();
      return;
    }

    this.members.push(name);
    this.$memberInput.value = "";
    this.renderMembers();
    this.persistTemp();
    this.$memberInput.focus(); // 連続入力のため
  }

  removeMember(name) {
    this.members = this.members.filter((m) => m !== name);
    this.renderMembers();
    this.persistTemp();
  }

  renderMembers() {
    this.$memberList.innerHTML = "";
    this.members.forEach((m) => {
      const li = document.createElement("li");
      li.className = "member-tag";
      li.innerHTML =
        `<span class="member-name">${this.escapeHtml(m)}</span>` +
        `<button class="remove-btn" type="button" aria-label="${this.escapeHtml(m)}を削除">×</button>`;
      li.querySelector(".remove-btn").onclick = () => this.removeMember(m);
      this.$memberList.appendChild(li);
    });
  }

  /* ---------- 作成 / 更新 ---------- */
  async handleSubmit(e) {
    e.preventDefault();
    
    // 二重送信防止
    if (this.isSubmitting) return;
    if (!this.validate()) return;

    this.isSubmitting = true;
    this.setButtonState(true, "処理中...");

    const payload = {
      groupName: this.$groupName.value.trim(),
      members: [...this.members],
    };

    console.log("=== グループ作成/更新開始 ===");
    console.log("Payload:", payload);
    console.log("Edit mode:", this.isEditMode);

    try {
      /* === 編集モード === */
      if (this.isEditMode) {
        await this.handleEditMode(payload);
        return;
      }

      /* === 新規モード === */
      await this.handleCreateMode(payload);
      
    } catch (error) {
      console.error("処理エラー:", error);
      this.showAlert("エラーが発生しました。もう一度お試しください。");
    } finally {
      this.isSubmitting = false;
      this.setButtonState(false);
    }
  }

  async handleEditMode(payload) {
    console.log("編集モードで更新中...");
    
    try {
      const updateRes = await this.fetchWithTimeout(`/api/groups/${this.groupData.groupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, groupId: this.groupData.groupId }),
      });
      
      if (!updateRes.ok) {
        throw new Error(`更新失敗: ${updateRes.status}`);
      }
      
      console.log("更新成功:", updateRes.status);
    } catch (err) {
      console.error("更新エラー:", err);
      this.showAlert("更新に失敗しました。オフラインで続行します。");
    }

    /* 保存してフラグ解除 */
    this.groupData = { ...this.groupData, ...payload };
    sessionStorage.setItem("groupData", JSON.stringify(this.groupData));
    sessionStorage.removeItem("editMode");

    /* page3→page4 に戻す */
    const qp = new URLSearchParams({
      groupId: this.groupData.groupId,
      groupName: this.groupData.groupName,
      members: JSON.stringify(this.members),
    });
    
    this.navigateToPage(`page3.html?${qp.toString()}`);
  }

  async handleCreateMode(payload) {
    console.log("新規グループ作成中...");
    let groupId;
    let apiSuccess = false;
    
    try {
      console.log("API呼び出し開始:", "/api/groups");
      const res = await this.fetchWithTimeout("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      console.log("API レスポンス status:", res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("API エラー詳細:", errorText);
        throw new Error(`API Error: ${res.status} - ${errorText}`);
      }
      
      const responseData = await res.json();
      console.log("API レスポンスデータ:", responseData);
      
      groupId = responseData.groupId;
      apiSuccess = true;
      console.log("API成功！ groupId:", groupId);
      
    } catch (err) {
      console.error("API呼び出し失敗:", err);
      console.log("オフラインモードに切り替え");
      groupId = this.generateId();
      apiSuccess = false;
    }

    console.log("最終的な groupId:", groupId);
    console.log("API成功:", apiSuccess);

    const full = { ...payload, groupId, apiSuccess };
    sessionStorage.setItem("groupData", JSON.stringify(full));
    sessionStorage.setItem("currentGroupId", groupId);

    console.log("保存したデータ:", full);

    const qp = new URLSearchParams({
      groupId,
      groupName: payload.groupName,
      members: JSON.stringify(this.members),
    });
    
    console.log("page3へのURL:", `page3.html?${qp.toString()}`);
    this.navigateToPage(`page3.html?${qp.toString()}`);
  }

  /* ---------- バリデーション ---------- */
  validate() {
    if (!this.$groupName.value.trim()) {
      this.showAlert("グループ名を入力してください");
      this.$groupName.focus();
      return false;
    }
    if (this.members.length === 0) {
      this.showAlert("メンバーを 1 人以上追加してください");
      this.$memberInput.focus();
      return false;
    }
    if (this.members.length > 10) {
      this.showAlert("メンバーは 10 名までです");
      return false;
    }
    return true;
  }

  /* ---------- ユーティリティ関数 ---------- */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showAlert(message) {
    alert(message);
  }

  setButtonState(isLoading, loadingText = "処理中...") {
    if (isLoading) {
      this.$createBtn.style.opacity = "0.6";
      this.$createBtn.style.pointerEvents = "none";
      const originalText = this.$createBtn.childNodes[0].textContent;
      this.$createBtn.setAttribute('data-original-text', originalText);
      this.$createBtn.childNodes[0].textContent = loadingText;
    } else {
      this.$createBtn.style.opacity = "";
      this.$createBtn.style.pointerEvents = "";
      const originalText = this.$createBtn.getAttribute('data-original-text');
      if (originalText) {
        this.$createBtn.childNodes[0].textContent = originalText;
        this.$createBtn.removeAttribute('data-original-text');
      }
    }
  }

  // タイムアウト付きfetch
  async fetchWithTimeout(url, options, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('リクエストがタイムアウトしました');
      }
      throw error;
    }
  }

  // 安全な画面遷移
  navigateToPage(url) {
    // 少し遅延を入れて確実にセッションストレージが保存されるようにする
    setTimeout(() => {
      location.href = url;
    }, 100);
  }
}

/* ---------- 起動 ---------- */
document.addEventListener("DOMContentLoaded", () => new GroupManager());
