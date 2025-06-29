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
    // 1. URL パラメータ
    const params = new URLSearchParams(window.location.search);
    const urlGroupId = params.get("groupId");
    const urlGroupName = params.get("groupName");
    const urlMembers = params.get("members"); // JSON 文字列

    // 2. sessionStorage
    const saved = sessionStorage.getItem("groupData");
    if (saved) {
      this.groupData = JSON.parse(saved);
    }

    // 3. URL 側を優先してマージ
    if (urlGroupId) this.groupData.groupId = urlGroupId;
    if (urlGroupName)
      this.groupData.groupName = decodeURIComponent(urlGroupName);
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

    // 4. groupId が無ければサーバーで新規作成
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

    // 5. 最終データを保存
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

// 6/22時点のコード↓

/* ※ 注意
 *  - ブラウザを file:// で開くと fetch は CORS で失敗します。必ず http://localhost:3000/page4.html?... で開いてください。
 */

// /**
//  * 持ち物追加・分担管理ページのJavaScript
//  * Page2から引き継いだメンバー情報を使用し、持ち物の追加と分担を管理する
//  */

// class ItemAssignmentManager {
//   constructor() {
//     this.items = [];
//     this.members = [];
//     this.assignments = [];
//     this.newlyAddedItems = new Set(); // 新しく追加されたアイテムを追跡
//     this.init();
//   }

//   /**
//    * 初期化処理
//    */
//   init() {
//     this.bindElements();
//     this.loadMembersFromPage2();
//     this.setupEventListeners();
//     this.renderItems();
//   }

//   /**
//    * DOM要素を取得
//    */
//   bindElements() {
//     this.itemsList = document.getElementById("itemsList");
//     this.noItemsMessage = document.getElementById("noItemsMessage");
//     this.itemInput = document.getElementById("itemInput");
//     this.addButton = document.getElementById("addButton");
//   }

//   /**
//    * Page2からメンバー情報を読み込み
//    */
//   loadMembersFromPage2() {
//     try {
//       const savedGroupData = sessionStorage.getItem("groupData");
//       if (savedGroupData) {
//         const data = JSON.parse(savedGroupData);

//         if (
//           data.members &&
//           Array.isArray(data.members) &&
//           data.members.length > 0
//         ) {
//           this.members = [...data.members];
//           console.log("Page2からメンバーを読み込みました:", this.members);
//         } else {
//           console.warn("Page2からのメンバーデータが見つかりません");
//           this.members = [];
//         }
//       } else {
//         console.warn("Page2からのセッションデータが見つかりません");
//         this.members = [];
//       }
//     } catch (error) {
//       console.error("Page2からのデータ読み込みエラー:", error);
//       this.members = [];
//     }
//   }

//   /**
//    * イベントリスナーの設定
//    */
//   setupEventListeners() {
//     // 持ち物追加ボタン
//     this.addButton.addEventListener("click", () => this.handleAddItem());

//     // 持ち物入力フィールドでのEnterキー
//     this.itemInput.addEventListener("keydown", (e) => {
//       if (e.key === "Enter") {
//         this.handleAddItem();
//       }
//     });
//   }

//   /**
//    * 持ち物追加処理
//    */
//   handleAddItem() {
//     const itemName = this.itemInput.value.trim();

//     if (!itemName) {
//       return;
//     }

//     // アイテムを追加
//     this.items.push(itemName);
//     this.assignments.push({
//       name: itemName,
//       assignee: "",
//       quantity: "",
//     });

//     // 新しく追加されたアイテムとしてマークする
//     this.newlyAddedItems.add(itemName);

//     // 入力フィールドをクリア
//     this.itemInput.value = "";

//     // リストを再描画
//     this.renderItems();
//     this.saveAssignmentData();
//   }

//   /**
//    * アイテムリストのレンダリング
//    */
//   renderItems() {
//     // アイテムがない場合
//     if (this.items.length === 0) {
//       this.showNoItemsMessage();
//       return;
//     }

//     this.hideNoItemsMessage();

//     // 初回の場合、既存のnoItemsMessage以外をクリア
//     const existingHeader = this.itemsList.querySelector(
//       ".speech-bubbles-header"
//     );
//     if (!existingHeader) {
//       // noItemsMessage以外の要素を削除
//       const children = Array.from(this.itemsList.children);
//       children.forEach((child) => {
//         if (child.id !== "noItemsMessage") {
//           child.remove();
//         }
//       });

//       // 吹き出しヘッダーを作成
//       const headerDiv = this.createSpeechBubblesHeader();
//       this.itemsList.appendChild(headerDiv);
//     }

//     // 新しく追加されたアイテムのみ処理
//     this.assignments.forEach((assignment, index) => {
//       if (this.newlyAddedItems.has(assignment.name)) {
//         // 既存の同じアイテムがあれば削除（念のため）
//         const existingItem = this.itemsList.querySelector(
//           `[data-item-name="${assignment.name}"]`
//         );
//         if (existingItem) {
//           existingItem.remove();
//         }

//         // 新しいアイテム行を作成
//         const itemRow = this.createItemRow(assignment, index);
//         itemRow.dataset.itemName = assignment.name; // データ属性を追加
//         this.itemsList.appendChild(itemRow);

//         // 新しいアイテムにアニメーションを適用
//         this.applyAnimationToNewItem(itemRow);

//         // 処理済みとしてマークから削除
//         this.newlyAddedItems.delete(assignment.name);
//       }
//     });
//   }

//   /**
//    * 新しいアイテムにのみアニメーションを適用
//    */
//   applyAnimationToNewItem(itemRow) {
//     // 初期状態を設定（非表示状態）
//     itemRow.style.opacity = "0";
//     itemRow.style.transform = "translateY(20px)";
//     itemRow.style.transition = "none"; // 初期設定時はトランジションを無効化

//     // フェードインアニメーションを実行
//     requestAnimationFrame(() => {
//       itemRow.style.transition = "all 0.5s ease-out";
//       itemRow.style.opacity = "1";
//       itemRow.style.transform = "translateY(0)";
//     });
//   }

//   /**
//    * 吹き出しヘッダーの作成
//    */
//   createSpeechBubblesHeader() {
//     const headerDiv = document.createElement("div");
//     headerDiv.className = "speech-bubbles-header";

//     const whatBubble = document.createElement("div");
//     whatBubble.className = "speech-bubble";
//     whatBubble.textContent = "何を？";

//     const whoBubble = document.createElement("div");
//     whoBubble.className = "speech-bubble";
//     whoBubble.textContent = "誰が？";

//     const howMuchBubble = document.createElement("div");
//     howMuchBubble.className = "speech-bubble";
//     howMuchBubble.textContent = "どのくらい？";

//     headerDiv.appendChild(whatBubble);
//     headerDiv.appendChild(whoBubble);
//     headerDiv.appendChild(howMuchBubble);

//     return headerDiv;
//   }

//   /**
//    * アイテム行の作成
//    */
//   createItemRow(assignment, index) {
//     const itemRow = document.createElement("div");
//     itemRow.className = "item-row";

//     const itemContent = document.createElement("div");
//     itemContent.className = "item-content";

//     // 持ち物名
//     const itemName = document.createElement("div");
//     itemName.className = "item-name";
//     itemName.textContent = assignment.name;

//     // 担当者選択
//     const assigneeSelect = this.createAssigneeSelect(index);
//     // 数量選択
//     const quantitySelect = this.createQuantitySelect(index);

//     itemContent.appendChild(itemName);
//     itemContent.appendChild(assigneeSelect);
//     itemContent.appendChild(quantitySelect);

//     // 削除ボタンを作成
//     const deleteButton = this.createDeleteButton(assignment.name, index);

//     itemRow.appendChild(itemContent);
//     itemRow.appendChild(deleteButton);

//     return itemRow;
//   }

//   /**
//    * 削除ボタンの作成
//    */
//   createDeleteButton(itemName, index) {
//     const deleteButton = document.createElement("button");
//     deleteButton.className = "delete-btn";
//     deleteButton.innerHTML = "×";
//     deleteButton.title = `${itemName}を削除`;
//     deleteButton.setAttribute("aria-label", `${itemName}を削除`);

//     // イベントリスナー
//     deleteButton.addEventListener("click", () =>
//       this.handleDeleteItem(itemName, index)
//     );

//     return deleteButton;
//   }

//   /**
//    * アイテム削除処理
//    */
//   handleDeleteItem(itemName, index) {
//     // 確認ダイアログを表示
//     this.showConfirmDialog(`「${itemName}」を削除しますか？`, () => {
//       // 削除実行
//       this.deleteItem(itemName, index);
//     });
//   }

//   /**
//    * アイテム削除の実行
//    */
//   deleteItem(itemName, index) {
//     try {
//       // 配列から削除
//       this.items = this.items.filter((item) => item !== itemName);
//       this.assignments = this.assignments.filter(
//         (assignment) => assignment.name !== itemName
//       );

//       // 新規追加アイテムのセットからも削除
//       this.newlyAddedItems.delete(itemName);

//       // データを保存
//       this.saveAssignmentData();

//       // 削除後にアイテムがなくなった場合の処理
//       if (this.items.length === 0) {
//         // noItemsMessage以外の要素を削除
//         const children = Array.from(this.itemsList.children);
//         children.forEach((child) => {
//           if (child.id !== "noItemsMessage") {
//             child.remove();
//           }
//         });
//         this.showNoItemsMessage();
//       } else {
//         // アイテムがまだある場合は、全体を再描画
//         this.renderAllItems();
//       }
//     } catch (error) {
//       console.error("アイテム削除エラー:", error);
//       this.showAlert("削除中にエラーが発生しました。");
//     }
//   }

//   /**
//    * 全アイテムを再描画
//    */
//   renderAllItems() {
//     // noItemsMessage以外の要素を削除
//     const children = Array.from(this.itemsList.children);
//     children.forEach((child) => {
//       if (child.id !== "noItemsMessage") {
//         child.remove();
//       }
//     });

//     if (this.items.length === 0) {
//       this.showNoItemsMessage();
//       return;
//     }

//     this.hideNoItemsMessage();

//     // 吹き出しヘッダーを作成
//     const headerDiv = this.createSpeechBubblesHeader();
//     this.itemsList.appendChild(headerDiv);

//     // 全アイテムを再作成
//     this.assignments.forEach((assignment, index) => {
//       const itemRow = this.createItemRow(assignment, index);
//       itemRow.dataset.itemName = assignment.name;
//       this.itemsList.appendChild(itemRow);
//     });
//   }

//   /**
//    * 確認ダイアログの表示
//    */
//   showConfirmDialog(message, onConfirm) {
//     // 既存のダイアログがあれば削除
//     const existingDialog = document.querySelector(".confirm-dialog");
//     if (existingDialog) {
//       existingDialog.remove();
//     }

//     // オーバーレイを作成
//     const overlay = document.createElement("div");
//     overlay.className = "confirm-dialog-overlay";
//     overlay.style.cssText = `
//       position: fixed;
//       top: 0;
//       left: 0;
//       width: 100%;
//       height: 100%;
//       background-color: rgba(0, 0, 0, 0.5);
//       z-index: 1000;
//       display: flex;
//       align-items: center;
//       justify-content: center;
//       opacity: 0;
//       transition: opacity 0.3s ease;
//     `;

//     // ダイアログを作成
//     const dialog = document.createElement("div");
//     dialog.className = "confirm-dialog";
//     dialog.style.cssText = `
//       background: white;
//       padding: 25px;
//       border-radius: 12px;
//       box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
//       max-width: 300px;
//       width: 90%;
//       text-align: center;
//       font-family: "M PLUS 1p", sans-serif;
//       transform: scale(0.8);
//       transition: transform 0.3s ease;
//     `;

//     // メッセージを作成
//     const messageElement = document.createElement("p");
//     messageElement.textContent = message;
//     messageElement.style.cssText = `
//       margin: 0 0 20px 0;
//       font-size: 14px;
//       color: #333;
//       line-height: 1.5;
//     `;

//     // ボタンコンテナを作成
//     const buttonContainer = document.createElement("div");
//     buttonContainer.style.cssText = `
//       display: flex;
//       gap: 10px;
//       justify-content: center;
//     `;

//     // キャンセルボタン
//     const cancelButton = document.createElement("button");
//     cancelButton.textContent = "キャンセル";
//     cancelButton.style.cssText = `
//       padding: 10px 20px;
//       border: 2px solid #ccc;
//       border-radius: 6px;
//       background: white;
//       color: #666;
//       font-size: 13px;
//       cursor: pointer;
//       transition: all 0.3s ease;
//       font-family: "M PLUS 1p", sans-serif;
//     `;

//     // 削除ボタン
//     const confirmButton = document.createElement("button");
//     confirmButton.textContent = "削除";
//     confirmButton.style.cssText = `
//       padding: 10px 20px;
//       border: none;
//       border-radius: 6px;
//       background: #ff6b6b;
//       color: white;
//       font-size: 13px;
//       cursor: pointer;
//       transition: all 0.3s ease;
//       font-family: "M PLUS 1p", sans-serif;
//     `;

//     // ホバー効果
//     cancelButton.addEventListener("mouseenter", () => {
//       cancelButton.style.borderColor = "#999";
//       cancelButton.style.color = "#333";
//     });

//     cancelButton.addEventListener("mouseleave", () => {
//       cancelButton.style.borderColor = "#ccc";
//       cancelButton.style.color = "#666";
//     });

//     confirmButton.addEventListener("mouseenter", () => {
//       confirmButton.style.backgroundColor = "#ff5252";
//     });

//     confirmButton.addEventListener("mouseleave", () => {
//       confirmButton.style.backgroundColor = "#ff6b6b";
//     });

//     // イベントリスナー
//     cancelButton.addEventListener("click", () => {
//       this.hideConfirmDialog(overlay);
//     });

//     confirmButton.addEventListener("click", () => {
//       onConfirm();
//       this.hideConfirmDialog(overlay);
//     });

//     // オーバーレイクリックで閉じる
//     overlay.addEventListener("click", (e) => {
//       if (e.target === overlay) {
//         this.hideConfirmDialog(overlay);
//       }
//     });

//     // ESCキーで閉じる
//     const escHandler = (e) => {
//       if (e.key === "Escape") {
//         this.hideConfirmDialog(overlay);
//         document.removeEventListener("keydown", escHandler);
//       }
//     };
//     document.addEventListener("keydown", escHandler);

//     // 要素を組み立て
//     buttonContainer.appendChild(cancelButton);
//     buttonContainer.appendChild(confirmButton);
//     dialog.appendChild(messageElement);
//     dialog.appendChild(buttonContainer);
//     overlay.appendChild(dialog);

//     // ページに追加
//     document.body.appendChild(overlay);

//     // アニメーション開始
//     requestAnimationFrame(() => {
//       overlay.style.opacity = "1";
//       dialog.style.transform = "scale(1)";
//     });
//   }

//   /**
//    * 確認ダイアログの非表示
//    */
//   hideConfirmDialog(overlay) {
//     const dialog = overlay.querySelector(".confirm-dialog");

//     overlay.style.opacity = "0";
//     dialog.style.transform = "scale(0.8)";

//     setTimeout(() => {
//       if (overlay.parentNode) {
//         overlay.remove();
//       }
//     }, 300);
//   }

//   /**
//    * 担当者選択セレクトボックスの作成
//    */
//   createAssigneeSelect(index) {
//     const select = document.createElement("select");
//     select.className = "item-select";
//     select.dataset.index = index;
//     select.dataset.type = "assignee";

//     // デフォルトオプション
//     const defaultOption = document.createElement("option");
//     defaultOption.value = "";
//     defaultOption.textContent = "選択してください";
//     select.appendChild(defaultOption);

//     // 「全員」オプションを追加
//     const allMembersOption = document.createElement("option");
//     allMembersOption.value = "全員";
//     allMembersOption.textContent = "全員";
//     allMembersOption.style.fontWeight = "bold";
//     allMembersOption.style.color = "#1dd1a1";
//     select.appendChild(allMembersOption);

//     // Page2から取得したメンバーオプション
//     this.members.forEach((member) => {
//       const option = document.createElement("option");
//       option.value = member;
//       option.textContent = member;
//       select.appendChild(option);
//     });

//     // 現在の値を設定
//     select.value = this.assignments[index].assignee;

//     // イベントリスナー
//     select.addEventListener("change", (e) => this.handleSelectChange(e));

//     return select;
//   }

//   /**
//    * 数量選択セレクトボックスの作成
//    */
//   createQuantitySelect(index) {
//     const select = document.createElement("select");
//     select.className = "item-select";
//     select.dataset.index = index;
//     select.dataset.type = "quantity";

//     // デフォルトオプション
//     const defaultOption = document.createElement("option");
//     defaultOption.value = "";
//     defaultOption.textContent = "選択してください";
//     select.appendChild(defaultOption);

//     // 1から10までの数値オプションを作成
//     for (let i = 1; i <= 10; i++) {
//       const option = document.createElement("option");
//       option.value = i.toString();
//       option.textContent = i.toString();
//       select.appendChild(option);
//     }

//     // 現在の値を設定
//     select.value = this.assignments[index].quantity;

//     // イベントリスナー
//     select.addEventListener("change", (e) => this.handleSelectChange(e));

//     return select;
//   }

//   /**
//    * セレクトボックスの変更処理
//    */
//   handleSelectChange(event) {
//     const select = event.target;
//     const index = parseInt(select.dataset.index);
//     const type = select.dataset.type;
//     const value = select.value;

//     if (type === "assignee") {
//       this.assignments[index].assignee = value;
//     } else if (type === "quantity") {
//       this.assignments[index].quantity = value;
//     }

//     // 選択時のアニメーション
//     select.style.borderColor = "#1dd1a1";
//     setTimeout(() => {
//       select.style.borderColor = "#e0e0e0";
//     }, 1000);

//     this.saveAssignmentData();
//   }

//   /**
//    * 分担データをセッションに保存
//    */
//   saveAssignmentData() {
//     try {
//       const assignmentData = {
//         assignments: [...this.assignments],
//         members: [...this.members],
//         items: [...this.items],
//         lastUpdated: new Date().toISOString(),
//       };

//       sessionStorage.setItem("assignmentData", JSON.stringify(assignmentData));
//     } catch (error) {
//       console.error("分担データの保存エラー:", error);
//     }
//   }

//   /**
//    * エラーメッセージの表示（動的にメッセージボックスを作成）
//    */
//   showAlert(message) {
//     // 既存のアラートがあれば削除
//     const existingAlert = document.querySelector(".alert-message");
//     if (existingAlert) {
//       existingAlert.remove();
//     }

//     // アラートメッセージ要素を作成
//     const alertDiv = document.createElement("div");
//     alertDiv.className = "alert-message";
//     alertDiv.textContent = message;

//     // スタイルを直接設定
//     alertDiv.style.cssText = `
//       position: fixed;
//       top: 20px;
//       left: 50%;
//       transform: translateX(-50%);
//       background-color: #ff6b6b;
//       color: white;
//       padding: 12px 20px;
//       border-radius: 8px;
//       font-family: "M PLUS 1p", sans-serif;
//       font-size: 14px;
//       font-weight: 500;
//       box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
//       z-index: 1000;
//       opacity: 0;
//       transition: opacity 0.3s ease;
//       max-width: 90%;
//       text-align: center;
//     `;

//     // ページに追加
//     document.body.appendChild(alertDiv);

//     // フェードイン効果
//     setTimeout(() => {
//       alertDiv.style.opacity = "1";
//     }, 10);

//     // 3秒後に自動的に削除
//     setTimeout(() => {
//       alertDiv.style.opacity = "0";
//       setTimeout(() => {
//         if (alertDiv.parentNode) {
//           alertDiv.remove();
//         }
//       }, 300);
//     }, 3000);
//   }

//   /**
//    * 「持ち物なし」メッセージの表示
//    */
//   showNoItemsMessage() {
//     if (this.noItemsMessage) {
//       this.noItemsMessage.style.display = "block";
//     }
//   }

//   /**
//    * 「持ち物なし」メッセージの非表示
//    */
//   hideNoItemsMessage() {
//     if (this.noItemsMessage) {
//       this.noItemsMessage.style.display = "none";
//     }
//   }
// }

// // ページ読み込み完了時にアプリケーションを初期化
// document.addEventListener("DOMContentLoaded", () => {
//   new ItemAssignmentManager();
// });
