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
});
