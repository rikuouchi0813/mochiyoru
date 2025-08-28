// グループ情報の管理とURL生成
class GroupManager {
  constructor() {
    this.groupData = this.loadGroupData();
    this.baseUrl = this.getBaseUrl();
    this.init();
  }

  // 現在のドメインからベースURLを取得
  getBaseUrl() {
    const currentDomain = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${currentDomain}/group/`;
  }

  // グループデータをURLパラメータから読み込み、フォールバックでセッションストレージも利用
  loadGroupData() {
    const urlParams = new URLSearchParams(window.location.search);
    let groupName = urlParams.get("groupName");
    let membersParam = urlParams.get("members");
    let groupId = urlParams.get("groupId");

    console.log("URL parameters:", { groupName, membersParam, groupId });

    // URLパラメータがない場合はセッションストレージから取得
    if (!groupName && !membersParam) {
      console.log(
        "URLパラメータが見つからないため、セッションストレージから読み込みます"
      );
      try {
        const sessionData = sessionStorage.getItem("groupData");
        if (sessionData) {
          const data = JSON.parse(sessionData);
          groupName = data.groupName || "おはなグループ";
          membersParam = JSON.stringify(
            data.members.map((name) => ({ name: name }))
          );
          groupId = data.groupId; // 既存のIDを保持
          console.log("セッションストレージからデータを復元:", data);
        }
      } catch (error) {
        console.error("セッションストレージからの読み込みエラー:", error);
      }
    }

    // デフォルト値を設定
    groupName = groupName || "おはなグループ";

    let members = [];
    if (membersParam) {
      try {
        const parsedMembers = JSON.parse(decodeURIComponent(membersParam));
        // メンバーデータの形式をチェック
        if (Array.isArray(parsedMembers)) {
          if (
            parsedMembers.length > 0 &&
            typeof parsedMembers[0] === "object" &&
            parsedMembers[0].name
          ) {
            // オブジェクト形式の場合
            members = parsedMembers;
          } else if (typeof parsedMembers[0] === "string") {
            // 文字列配列の場合はオブジェクト形式に変換
            members = parsedMembers.map((name) => ({ name: name }));
          }
        }
      } catch (error) {
        console.error("メンバーデータの解析に失敗しました:", error);
        members = [];
      }
    }

    // ★重要な修正★ groupIdの処理
    // URLパラメータまたはsessionStorageから既存のIDを取得できない場合のみ新規生成
    if (!groupId) {
      console.log("既存のgroupIdが見つからないため、新規生成します");
      groupId = this.generateGroupId();
    } else {
      console.log("既存のgroupIdを使用します:", groupId);
    }

    console.log("読み込まれたグループデータ:", { groupName, members, groupId });

    return {
      groupName: groupName,
      members: members,
      groupId: groupId,
    };
  }

  // ユニークなグループIDを生成
  generateGroupId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    const newId = `${timestamp}${randomStr}`;
    console.log("新しいgroupIdを生成しました:", newId);
    return newId;
  }

  // グループURLを生成
  generateGroupUrl() {
    return `${this.baseUrl}${this.groupData.groupId}`;
  }

  // 初期化処理
  init() {
    // デバッグ情報をコンソールに出力
    console.log("GroupManager initialized with data:", this.groupData);
    console.log("Base URL:", this.baseUrl);

    this.updateUI();
    this.setupEventListeners();
    this.saveGroupDataToSessionStorage();
  }

  // UIを更新
  updateUI() {
    const groupUrl = this.generateGroupUrl();
    const urlElement = document.getElementById("groupUrl");
    if (urlElement) {
      urlElement.value = groupUrl;
      console.log("URL updated:", groupUrl);
    } else {
      console.error("URL input element not found");
    }

    // 次のステップボタンにもグループ情報を含める
    const nextStepBtn = document.getElementById("nextStepBtn");
    if (nextStepBtn) {
      const params = new URLSearchParams({
        groupId: this.groupData.groupId,
        groupName: this.groupData.groupName,
        members: JSON.stringify(this.groupData.members),
      });
      nextStepBtn.href = `page4.html?${params.toString()}`;
      console.log("Next step button updated:", nextStepBtn.href);
    } else {
      console.error("Next step button not found");
    }

    // グループ情報を表示（デバッグ用）
    this.displayGroupInfo();
  }

  // グループ情報を表示（デバッグ用）
  displayGroupInfo() {
    console.log("=== グループ情報 ===");
    console.log("グループ名:", this.groupData.groupName);
    console.log("メンバー数:", this.groupData.members.length);
    console.log("メンバー:", this.groupData.members);
    console.log("グループID:", this.groupData.groupId);
    console.log("グループURL:", this.generateGroupUrl());
  }

  // イベントリスナーの設定
  setupEventListeners() {
    // コピーボタンのクリックイベント
    const copyBtn = document.getElementById("copyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.copyUrl());
      console.log("Copy button event listener added");
    } else {
      console.error("Copy button not found");
    }

    // URL入力欄の設定
    this.setupUrlInput();
  }

  // URL入力欄の設定
  setupUrlInput() {
    const urlInput = document.getElementById("groupUrl");
    if (!urlInput) {
      console.error("URL input not found");
      return;
    }

    // 初期状態では読み取り専用
    urlInput.readOnly = true;

    // クリックで編集可能にする
    urlInput.addEventListener("click", () => {
      if (urlInput.readOnly) {
        urlInput.readOnly = false;
        urlInput.focus();
        setTimeout(() => urlInput.select(), 0);
      }
    });

    // フォーカスを失った時に読み取り専用に戻す
    urlInput.addEventListener("blur", () => {
      urlInput.readOnly = true;
    });

    // キーボードショートカット
    urlInput.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        urlInput.select();
      }

      if (e.key === "Enter") {
        urlInput.blur();
      }

      if (e.key === "Escape") {
        urlInput.value = this.generateGroupUrl();
        urlInput.blur();
      }
    });

    // ダブルクリックで全選択
    urlInput.addEventListener("dblclick", (e) => {
      e.preventDefault();
      urlInput.select();
    });

    // タッチデバイス用
    urlInput.addEventListener("touchstart", (e) => {
      if (urlInput.readOnly) {
        e.preventDefault();
        urlInput.readOnly = false;
        urlInput.focus();
        setTimeout(() => urlInput.select(), 100);
      }
    });
  }

  // URLをクリップボードにコピー
  async copyUrl() {
    const urlInput = document.getElementById("groupUrl");
    const urlToCopy = urlInput ? urlInput.value : this.generateGroupUrl();
    const fullUrl = urlToCopy.startsWith("http")
      ? urlToCopy
      : `https://${urlToCopy}`;

    console.log("Copying URL:", fullUrl);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
        this.showCopySuccess();
      } else {
        this.fallbackCopyUrl(fullUrl);
      }
    } catch (err) {
      console.error("コピーに失敗しました:", err);
      this.fallbackCopyUrl(fullUrl);
    }
  }

  // フォールバック用のコピー機能
  fallbackCopyUrl(url) {
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        this.showCopySuccess();
      } else {
        this.showCopyError();
      }
    } catch (err) {
      console.error("フォールバックコピーに失敗しました:", err);
      this.showCopyError();
    }

    document.body.removeChild(textArea);
  }

  // コピー成功メッセージを表示
  showCopySuccess() {
    console.log("Copy successful");
    const successMessage = document.getElementById("copySuccessMessage");
    if (successMessage) {
      successMessage.textContent = "コピーしました！";
      successMessage.classList.add("show");

      setTimeout(() => {
        successMessage.classList.remove("show");
      }, 2000);
    }
  }

  // コピーエラーメッセージを表示
  showCopyError() {
    console.log("Copy failed");
    const successMessage = document.getElementById("copySuccessMessage");
    if (successMessage) {
      successMessage.textContent = "コピーに失敗しました";
      successMessage.classList.add("show");

      setTimeout(() => {
        successMessage.classList.remove("show");
      }, 2000);
    }
  }

  // グループデータをSessionStorageに保存
  saveGroupDataToSessionStorage() {
    try {
      const dataToSave = {
        ...this.groupData,
        createdAt: new Date().toISOString(),
        groupUrl: this.generateGroupUrl(),
      };

      // SessionStorageを使用（ページ間でデータを共有）
      sessionStorage.setItem(
        `group_${this.groupData.groupId}`,
        JSON.stringify(dataToSave)
      );
      sessionStorage.setItem("currentGroupId", this.groupData.groupId);

      // ★重要★ groupDataも更新（page4とpage2での整合性確保）
      sessionStorage.setItem("groupData", JSON.stringify({
        groupId: this.groupData.groupId,
        groupName: this.groupData.groupName,
        members: this.groupData.members.map(member => 
          typeof member === 'string' ? member : member.name
        )
      }));

      console.log("Group data saved to SessionStorage:", dataToSave);
    } catch (err) {
      console.error("グループデータの保存に失敗しました:", err);
    }
  }

  // 他のページからグループデータを取得するための静的メソッド
  static getGroupData(groupId) {
    try {
      const data = sessionStorage.getItem(`group_${groupId}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error("グループデータの読み込みに失敗しました:", err);
      return null;
    }
  }

  // 現在のグループIDを取得
  static getCurrentGroupId() {
    try {
      return sessionStorage.getItem("currentGroupId");
    } catch (err) {
      console.error("現在のグループIDの取得に失敗しました:", err);
      return null;
    }
  }
}

// エラーハンドリング関数
function handleError(error, context) {
  console.error(`Error in ${context}:`, error);

  // ユーザーに分かりやすいエラーメッセージを表示
  const errorMessage = document.createElement("div");
  errorMessage.style.cssText = `
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
  `;
  errorMessage.textContent = `エラーが発生しました: ${context}`;
  document.body.appendChild(errorMessage);

  setTimeout(() => {
    if (errorMessage.parentNode) {
      errorMessage.parentNode.removeChild(errorMessage);
    }
  }, 5000);
}

// ページ読み込み時の処理
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("Page loaded, initializing GroupManager...");
    console.log("Current URL:", window.location.href);
    console.log("URL Parameters:", window.location.search);

    const groupManager = new GroupManager();

    // グローバルからアクセス可能にする（デバッグ用）
    window.groupManager = groupManager;
  } catch (error) {
    handleError(error, "GroupManager initialization");
  }
});

// デバッグ用関数
window.debugGroupData = () => {
  console.log("=== デバッグ情報 ===");
  console.log("Current URL:", window.location.href);
  console.log(
    "URL Parameters:",
    Object.fromEntries(new URLSearchParams(window.location.search))
  );
  console.log("SessionStorage data:");

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith("group_") || key === "groupData" || key === "currentGroupId")) {
      console.log(`  ${key}:`, JSON.parse(sessionStorage.getItem(key) || 'null'));
    }
  }

  console.log("Current Group ID:", GroupManager.getCurrentGroupId());

  if (window.groupManager) {
    console.log("GroupManager instance:", window.groupManager.groupData);
  }
};

// URLパラメータの検証関数
function validateUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const groupName = urlParams.get("groupName");
  const members = urlParams.get("members");
  const groupId = urlParams.get("groupId");

  console.log("=== URL Parameter Validation ===");
  console.log("Group Name:", groupName);
  console.log("Group ID:", groupId);
  console.log("Members param:", members);

  if (!groupName) {
    console.warn("Warning: groupName parameter is missing");
  }

  if (!groupId) {
    console.warn("Warning: groupId parameter is missing");
  }

  if (!members) {
    console.warn("Warning: members parameter is missing");
  } else {
    try {
      const parsedMembers = JSON.parse(decodeURIComponent(members));
      console.log("Parsed members:", parsedMembers);
    } catch (error) {
      console.error("Error parsing members parameter:", error);
    }
  }
}

// ページ読み込み後にパラメータを検証
window.addEventListener("load", validateUrlParameters);
