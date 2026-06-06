// より堅牢なエラーハンドリング
document.addEventListener("DOMContentLoaded", () => {
  try {
    const startButton = document.querySelector(".start-button");
    if (!startButton) {
      console.warn("start-buttonが見つかりません");
      return;
    }

    startButton.addEventListener("click", (e) => {
      e.preventDefault();

      try {
        // セッションを初期化
        sessionStorage.removeItem("groupData");
        sessionStorage.removeItem("currentGroupId");

        // 遷移
        window.location.href = "page2.html";
      } catch (error) {
        console.error("遷移エラー:", error);
        alert("ページの遷移に失敗しました。再度お試しください。");
      }
    });
  } catch (error) {
    console.error("page1.js初期化エラー:", error);
  }

  // 最近見たグループ履歴の表示（URL控え忘れ対策）
  try {
    renderRecentGroups();
  } catch (error) {
    console.error("履歴表示エラー:", error);
  }
});

// localStorageの履歴を読み込んでトップページに表示する
function renderRecentGroups() {
  if (!window.MochiyoruHistory) return;

  const section = document.getElementById("recentGroups");
  const list = document.getElementById("recentGroupsList");
  if (!section || !list) return;

  const history = window.MochiyoruHistory.getHistory();
  if (!history || history.length === 0) {
    return; // 履歴なし → 非表示のまま（初回ユーザーの邪魔をしない）
  }

  list.innerHTML = "";

  // 直近5件まで表示
  history.slice(0, 5).forEach((group) => {
    const li = document.createElement("li");
    li.className = "recent-group-item";

    // グループへ移動するリンク
    const link = document.createElement("a");
    link.className = "recent-group-link";
    link.href = window.MochiyoruHistory.buildGroupUrl(group.groupId);

    const name = document.createElement("span");
    name.className = "recent-group-name";
    name.textContent = group.groupName || "名称未設定のグループ";

    const arrow = document.createElement("span");
    arrow.className = "recent-group-arrow";

    link.appendChild(name);
    link.appendChild(arrow);

    // 履歴から削除するボタン
    const del = document.createElement("button");
    del.type = "button";
    del.className = "recent-group-remove";
    del.setAttribute("aria-label", "履歴から削除");
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.MochiyoruHistory.remove(group.groupId);
      li.remove();
      // 全部消えたらセクションごと隠す
      if (list.children.length === 0) {
        section.hidden = true;
      }
    });

    li.appendChild(link);
    li.appendChild(del);
    list.appendChild(li);
  });

  section.hidden = false;
}
