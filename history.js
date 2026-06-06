// history.js
// グループの利用履歴を localStorage に保存・取得する共通モジュール。
// URLを控え忘れても、トップページから過去に作成・閲覧したグループに戻れるようにする。
// 会員登録は不要で、記録はこのブラウザ内にのみ保存される。

(function (global) {
  "use strict";

  const STORAGE_KEY = "mochiyoru_group_history";
  const MAX_HISTORY = 10; // 保存する最大件数

  // 履歴一覧を取得（新しい順）
  function getHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      // 念のため最終アクセス日時の新しい順にソート
      return list.sort((a, b) => (b.lastAccess || 0) - (a.lastAccess || 0));
    } catch (err) {
      return [];
    }
  }

  // 履歴にグループを追加 or 更新（同じ groupId は重複させず最新化）
  function addOrUpdate(group) {
    if (!group || !group.groupId) return;

    try {
      let list = getHistory();

      // 既存の同じグループを除外
      list = list.filter((g) => g.groupId !== group.groupId);

      // 先頭に追加
      list.unshift({
        groupId: group.groupId,
        groupName: group.groupName || "名称未設定のグループ",
        lastAccess: Date.now(),
      });

      // 最大件数で切り詰め
      if (list.length > MAX_HISTORY) {
        list = list.slice(0, MAX_HISTORY);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      // localStorage が使えない環境（プライベートモード等）は黙って無視
    }
  }

  // 指定グループを履歴から削除
  function remove(groupId) {
    try {
      let list = getHistory().filter((g) => g.groupId !== groupId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      // 無視
    }
  }

  // グループURLを生成
  function buildGroupUrl(groupId) {
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}/group/${groupId}`;
  }

  global.MochiyoruHistory = {
    getHistory,
    addOrUpdate,
    remove,
    buildGroupUrl,
  };
})(window);
