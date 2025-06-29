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
      if (e.key === "Enter") this.addMember();
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
    if (!name) return alert("メンバー名を入力してください");
    if (name.length > 20) return alert("20 文字以内で入力してください");
    if (this.members.includes(name)) return alert("同じ名前があります");

    this.members.push(name);
    this.$memberInput.value = "";
    this.renderMembers();
    this.persistTemp();
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
        `<span class="member-name">${m}</span>` +
        `<button class="remove-btn" type="button">×</button>`;
      li.querySelector(".remove-btn").onclick = () => this.removeMember(m);
      this.$memberList.appendChild(li);
    });
  }

  /* ---------- 作成 / 更新 ---------- */
  async handleSubmit(e) {
    e.preventDefault();
    if (!this.validate()) return;

    const payload = {
      groupName: this.$groupName.value.trim(),
      members: [...this.members],
    };

    /* === 編集モード === */
    if (this.isEditMode) {
      /* サーバ更新（失敗しても続行） */
      try {
        await fetch(`/api/groups/${this.groupData.groupId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, groupId: this.groupData.groupId }),
        });
      } catch (_) {}

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
      location.href = `page3.html?${qp.toString()}`;
      return;
    }

    /* === 新規モード === */
    let groupId;
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("API Error");
      groupId = (await res.json()).groupId;
    } catch (_) {
      groupId = this.generateId(); // オフライン
    }

    const full = { ...payload, groupId };
    sessionStorage.setItem("groupData", JSON.stringify(full));
    sessionStorage.setItem("currentGroupId", groupId);

    const qp = new URLSearchParams({
      groupId,
      groupName: payload.groupName,
      members: JSON.stringify(this.members),
    });
    location.href = `page3.html?${qp.toString()}`;
  }

  /* ---------- バリデーション ---------- */
  validate() {
    if (!this.$groupName.value.trim())
      return alert("グループ名を入力してください"), false;
    if (this.members.length === 0)
      return alert("メンバーを 1 人以上追加してください"), false;
    if (this.members.length > 10)
      return alert("メンバーは 10 名までです"), false;
    return true;
  }

  /* ---------- Utils ---------- */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

/* ---------- 起動 ---------- */
document.addEventListener("DOMContentLoaded", () => new GroupManager());

// /**
//  * グループ作成ページのJavaScript
//  * メンバー管理とバリデーション機能を提供
//  * フロントエンドのみで動作するよう修正
//  */

// class GroupManager {
//   constructor() {
//     this.members = [];
//     this.init();
//   }

//   /**
//    * 初期化処理
//    */
//   init() {
//     this.bindElements();
//     this.attachEventListeners();
//     this.loadSavedData(); // 保存されたデータを読み込み
//   }

//   /**
//    * DOM要素を取得
//    */
//   bindElements() {
//     this.memberInput = document.getElementById("memberName");
//     this.addButton = document.getElementById("addMember");
//     this.memberList = document.getElementById("memberList");
//     this.groupNameInput = document.getElementById("groupName");
//     this.createGroupBtn = document.getElementById("createGroupBtn");
//   }

//   /**
//    * イベントリスナーを設定
//    */
//   attachEventListeners() {
//     // メンバー追加ボタン
//     this.addButton.addEventListener("click", () => this.addMember());

//     // Enterキーでメンバー追加
//     this.memberInput.addEventListener("keypress", (e) => {
//       if (e.key === "Enter") {
//         e.preventDefault();
//         this.addMember();
//       }
//     });

//     // グループ作成ボタン
//     this.createGroupBtn.addEventListener("click", (e) =>
//       this.handleCreateGroup(e)
//     );

//     // リアルタイムでデータを保存（入力中も保存）
//     this.groupNameInput.addEventListener("input", () => this.saveToSession());
//   }

//   /**
//    * 保存されたデータを読み込み
//    */
//   loadSavedData() {
//     try {
//       const savedGroupData = sessionStorage.getItem("groupData");
//       if (savedGroupData) {
//         const data = JSON.parse(savedGroupData);

//         // グループ名を復元
//         if (data.groupName && this.groupNameInput) {
//           this.groupNameInput.value = data.groupName;
//         }

//         // メンバーリストを復元
//         if (data.members && Array.isArray(data.members)) {
//           this.members = [...data.members];
//           this.updateMemberList();
//         }
//       }
//     } catch (error) {
//       console.error("保存データの読み込みエラー:", error);
//     }
//   }

//   /**
//    * セッションストレージにデータを保存
//    */
//   saveToSession() {
//     try {
//       const groupData = {
//         groupName: this.groupNameInput ? this.groupNameInput.value.trim() : "",
//         members: [...this.members],
//         lastUpdated: new Date().toISOString(),
//       };

//       sessionStorage.setItem("groupData", JSON.stringify(groupData));
//     } catch (error) {
//       console.error("セッションデータの保存エラー:", error);
//     }
//   }

//   /**
//    * メンバー追加処理
//    */
//   addMember() {
//     const memberName = this.memberInput.value.trim();

//     if (!this.validateMemberName(memberName)) {
//       return;
//     }

//     if (this.isDuplicateMember(memberName)) {
//       alert("同じ名前のメンバーは追加できません");
//       return;
//     }

//     this.members.push(memberName);
//     this.updateMemberList();
//     this.clearMemberInput();
//     this.saveToSession(); // メンバー追加時にセッションに保存
//   }

//   /**
//    * メンバー名のバリデーション
//    * @param {string} memberName
//    * @returns {boolean}
//    */
//   validateMemberName(memberName) {
//     if (memberName === "") {
//       alert("メンバー名を入力してください");
//       return false;
//     }

//     if (memberName.length > 20) {
//       alert("メンバー名は20文字以内で入力してください");
//       return false;
//     }

//     return true;
//   }

//   /**
//    * 重複メンバーのチェック
//    * @param {string} memberName
//    * @returns {boolean}
//    */
//   isDuplicateMember(memberName) {
//     return this.members.includes(memberName);
//   }

//   /**
//    * メンバー削除処理
//    * @param {string} memberName
//    */
//   removeMember(memberName) {
//     const index = this.members.indexOf(memberName);
//     if (index > -1) {
//       this.members.splice(index, 1);
//       this.updateMemberList();
//       this.saveToSession(); // メンバー削除時にセッションに保存
//     }
//   }

//   /**
//    * メンバーリスト表示更新
//    */
//   updateMemberList() {
//     this.memberList.innerHTML = "";

//     this.members.forEach((member) => {
//       const li = this.createMemberListItem(member);
//       this.memberList.appendChild(li);
//     });
//   }

//   /**
//    * メンバーリスト項目を作成
//    * @param {string} member
//    * @returns {HTMLElement}
//    */
//   createMemberListItem(member) {
//     const li = document.createElement("li");
//     li.className = "member-tag";

//     const memberSpan = document.createElement("span");
//     memberSpan.className = "member-name";
//     memberSpan.textContent = member;

//     const removeBtn = document.createElement("button");
//     removeBtn.type = "button";
//     removeBtn.className = "remove-btn";
//     removeBtn.textContent = "×";
//     removeBtn.title = "削除";
//     removeBtn.addEventListener("click", () => this.removeMember(member));

//     li.appendChild(memberSpan);
//     li.appendChild(removeBtn);

//     return li;
//   }

//   /**
//    * メンバー入力フィールドをクリア
//    */
//   clearMemberInput() {
//     this.memberInput.value = "";
//     this.memberInput.focus();
//   }

//   /**
//    * グループ作成ボタンのクリック処理
//    * @param {Event} e
//    */
//   handleCreateGroup(e) {
//     e.preventDefault();

//     if (!this.validateGroupCreation()) {
//       return;
//     }

//     // データを保存（フロントエンドのみ）
//     const groupData = this.saveGroupData();

//     if (groupData) {
//       // URLパラメータを作成してpage3に遷移
//       this.redirectToPage3(groupData);
//     }
//   }

//   /**
//    * page3にデータを渡して遷移
//    * @param {Object} groupData
//    */
//   redirectToPage3(groupData) {
//     try {
//       // メンバーデータをオブジェクト配列に変換
//       const membersArray = this.members.map((name) => ({ name: name }));

//       // URLパラメータを作成
//       const params = new URLSearchParams({
//         groupName: groupData.groupName,
//         members: JSON.stringify(membersArray),
//         groupId: groupData.id,
//       });

//       // デバッグ用ログ
//       console.log("Redirecting to page3 with params:", {
//         groupName: groupData.groupName,
//         members: membersArray,
//         groupId: groupData.id,
//       });

//       // page3に遷移
//       window.location.href = `page3.html?${params.toString()}`;
//     } catch (error) {
//       console.error("ページ遷移エラー:", error);
//       alert("ページの遷移に失敗しました。");
//     }
//   }

//   /**
//    * グループ作成時のバリデーション
//    * @returns {boolean}
//    */
//   validateGroupCreation() {
//     const groupName = this.groupNameInput.value.trim();

//     if (groupName === "") {
//       alert("グループ名を入力してください。");
//       this.groupNameInput.focus();
//       return false;
//     }

//     if (this.members.length === 0) {
//       alert("メンバーを1人以上追加してください");
//       this.memberInput.focus();
//       return false;
//     }

//     if (this.members.length > 10) {
//       alert("メンバーは10人以下で登録してください");
//       return false;
//     }

//     return true;
//   }

//   /**
//    * グループデータを保存
//    * フロントエンドのみで動作するよう修正
//    * @returns {Object|null} 保存されたグループデータ
//    */
//   saveGroupData() {
//     const groupData = {
//       groupName: this.groupNameInput.value.trim(),
//       members: [...this.members],
//       createdAt: new Date().toISOString(),
//       id: this.generateId(), // 一意のIDを生成
//     };

//     try {
//       // セッションストレージに保存（ページ間での引き継ぎ用）
//       sessionStorage.setItem("groupData", JSON.stringify(groupData));
//       sessionStorage.setItem("currentGroupId", groupData.id);

//       // ローカルストレージにも保存（永続化用）
//       const existingGroups = this.getExistingGroups();
//       existingGroups.push(groupData);
//       localStorage.setItem("savedGroups", JSON.stringify(existingGroups));

//       // 開発用：コンソールに出力
//       console.log("グループデータ保存:", groupData);
//       console.log("保存されたメンバー:", this.members);

//       return groupData;
//     } catch (error) {
//       console.error("データ保存エラー:", error);
//       alert("データの保存に失敗しました。ブラウザの設定を確認してください。");
//       return null;
//     }
//   }

//   /**
//    * 既存のグループデータを取得
//    * @returns {Array}
//    */
//   getExistingGroups() {
//     try {
//       const savedGroups = localStorage.getItem("savedGroups");
//       return savedGroups ? JSON.parse(savedGroups) : [];
//     } catch (error) {
//       console.error("既存グループデータの取得エラー:", error);
//       return [];
//     }
//   }

//   /**
//    * 一意のIDを生成
//    * @returns {string}
//    */
//   generateId() {
//     return Date.now().toString(36) + Math.random().toString(36).substr(2);
//   }

//   /**
//    * デバッグ用：現在のデータを表示
//    */
//   debugShowData() {
//     console.log("現在のメンバー:", this.members);
//     console.log("グループ名:", this.groupNameInput.value);

//     const sessionData = sessionStorage.getItem("groupData");
//     if (sessionData) {
//       console.log("セッションデータ:", JSON.parse(sessionData));
//     }

//     const localData = localStorage.getItem("savedGroups");
//     if (localData) {
//       console.log("保存されたグループ:", JSON.parse(localData));
//     }
//   }
// }

// // DOM読み込み完了後に初期化
// document.addEventListener("DOMContentLoaded", () => {
//   const groupManager = new GroupManager();

//   // グローバルアクセス用
//   window.groupManager = groupManager;
// });

// // ページ離脱時にもデータを保存
// window.addEventListener("beforeunload", () => {
//   if (window.groupManager) {
//     window.groupManager.saveToSession();
//   }
// });

// // デバッグ用のグローバル関数
// window.showGroupData = () => {
//   const sessionData = sessionStorage.getItem("groupData");
//   const localData = localStorage.getItem("savedGroups");

//   console.log("=== グループデータ確認 ===");
//   if (sessionData) {
//     console.log("セッションデータ:", JSON.parse(sessionData));
//   } else {
//     console.log("セッションデータ: なし");
//   }

//   if (localData) {
//     console.log("保存されたグループ:", JSON.parse(localData));
//   } else {
//     console.log("保存されたグループ: なし");
//   }

//   // URLパラメータもチェック
//   console.log("現在のURL:", window.location.href);
//   console.log(
//     "URLパラメータ:",
//     Object.fromEntries(new URLSearchParams(window.location.search))
//   );
// };
