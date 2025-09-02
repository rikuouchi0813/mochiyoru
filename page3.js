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

    // URLパラメータがない場合はセッションストレージから取得
    if (!groupName && !membersParam) {
      try {
        const sessionData = sessionStorage.getItem("groupData");
        if (sessionData) {
          const data = JSON.parse(sessionData);
          groupName = data.groupName || "おはなグループ";
          membersParam = JSON.stringify(
            data.members.map((name) => ({ name: name }))
          );
          groupId = data.groupId;
        }
      } catch (error) {
        // エラーは無視
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
        members = [];
      }
    }

    // groupIdの処理
    if (!groupId) {
      groupId = this.generateGroupId();
    }

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
    return `${timestamp}${randomStr}`;
  }

  // グループURLを生成
  generateGroupUrl() {
    return `${this.baseUrl}${this.groupData.groupId}`;
  }

  // 初期化処理
  init() {
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
    }
  }

  // イベントリスナーの設定
  setupEventListeners() {
    // コピーボタンのクリックイベント
    const copyBtn = document.getElementById("copyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.copyUrl());
    }

    // URL入力欄の設定
    this.setupUrlInput();
  }

  // URL入力欄の設定
  setupUrlInput() {
    const urlInput = document.getElementById("groupUrl");
    if (!urlInput) {
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

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
        this.showCopySuccess();
      } else {
        this.fallbackCopyUrl(fullUrl);
      }
    } catch (err) {
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
      this.showCopyError();
    }

    document.body.removeChild(textArea);
  }

  // コピー成功メッセージを表示
  showCopySuccess() {
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

      // groupDataも更新（page4とpage2での整合性確保）
      sessionStorage.setItem("groupData", JSON.stringify({
        groupId: this.groupData.groupId,
        groupName: this.groupData.groupName,
        members: this.groupData.members.map(member => 
          typeof member === 'string' ? member : member.name
        )
      }));

    } catch (err) {
      // エラーは無視
    }
  }

  // 他のページからグループデータを取得するための静的メソッド
  static getGroupData(groupId) {
    try {
      const data = sessionStorage.getItem(`group_${groupId}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      return null;
    }
  }

  // 現在のグループIDを取得
  static getCurrentGroupId() {
    try {
      return sessionStorage.getItem("currentGroupId");
    } catch (err) {
      return null;
    }
  }
}

// ページ読み込み時の処理
document.addEventListener("DOMContentLoaded", () => {
  try {
    new GroupManager();
  } catch (error) {
    // エラーが発生してもページは正常に表示される
  }
});
