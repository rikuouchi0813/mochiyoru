// netlify/functions/items.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  console.log("=== Items API Function Called ===");
  console.log("Method:", event.httpMethod);
  console.log("Path:", event.path);
  console.log("Query:", event.queryStringParameters);
  console.log("Body:", event.body);

  // CORS設定
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };

  // プリフライトリクエスト処理
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // groupIdを取得（複数の方法で試行）
  let groupId = null;

  // 方法1: クエリパラメータから
  if (event.queryStringParameters && event.queryStringParameters.groupId) {
    groupId = event.queryStringParameters.groupId;
  }

  // 方法2: パスから抽出
  if (!groupId && event.path) {
    const pathMatch = event.path.match(/\/api\/groups\/([^\/]+)\/items/);
    if (pathMatch) {
      groupId = pathMatch[1];
    }
  }

  // 方法3: referrerヘッダーから（フォールバック）
  if (!groupId && event.headers && event.headers.referer) {
    const refererMatch = event.headers.referer.match(/groupId=([^&]+)/);
    if (refererMatch) {
      groupId = refererMatch[1];
    }
  }

  console.log("Extracted groupId:", groupId);

  if (!groupId) {
    console.error("No groupId provided");
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "no groupId" }),
    };
  }

  // 取得 -----------------------------------------------------
  if (event.httpMethod === "GET") {
    try {
      console.log("GET request for groupId:", groupId);

      const { data, error } = await supabase
        .from("items")
        .select("item_name, quantity, assignee")
        .eq("group_id", groupId);

      if (error) {
        console.error("Supabase GET error:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message }),
        };
      }

      console.log("Supabase data:", data);

      // フロントエンドが期待する形式に変換
      const items = data.map((d) => ({
        item_name: d.item_name,  // ✅ item_name として返す
        quantity: d.quantity,
        assignee: d.assignee,
      }));

      console.log("Returning items:", items);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(items),
      };
    } catch (err) {
      console.error("GET items error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  }

  // 追加／更新（upsert）--------------------------------------
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || '{}');
      
      // ✅ item_name という名前で受け取る（フロントエンドと一致）
      const item_name = body.item_name || body.name;
      const quantity = body.quantity || null;
      const assignee = body.assignee || "";
      const group_id_from_body = body.group_id;

      console.log("POST request with item:", { item_name, quantity, assignee, group_id_from_body });

      // group_idの最終決定（ボディ > クエリパラメータ）
      const finalGroupId = group_id_from_body || groupId;

      if (!item_name) {
        console.error("item_name is missing");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "item_name required" }),
        };
      }

      if (!finalGroupId) {
        console.error("group_id is missing");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "group_id required" }),
        };
      }

      const { error } = await supabase.from("items").upsert(
        [
          {
            group_id: finalGroupId,
            item_name,
            quantity,
            assignee,
          },
        ],
        { onConflict: ["group_id", "item_name"] }
      );

      if (error) {
        console.error("Supabase POST error:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message }),
        };
      }

      console.log("Item saved successfully");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: "saved",
          item_name: item_name
        }),
      };
    } catch (err) {
      console.error("POST items error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error: " + err.message }),
      };
    }
  }

  // 削除 -----------------------------------------------------
  if (event.httpMethod === "DELETE") {
    try {
      const body = JSON.parse(event.body || '{}');
      
      // ✅ item_name という名前で受け取る（フロントエンドと一致）
      const item_name = body.item_name || body.name;
      const group_id_from_body = body.group_id;

      console.log("DELETE request for item:", { item_name, groupId: groupId, group_id_from_body });

      // group_idの最終決定（ボディ > クエリパラメータ）
      const finalGroupId = group_id_from_body || groupId;

      if (!item_name) {
        console.error("item_name is missing");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "item_name required" }),
        };
      }

      if (!finalGroupId) {
        console.error("group_id is missing");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "group_id required" }),
        };
      }

      const { error } = await supabase
        .from("items")
        .delete()
        .eq("group_id", finalGroupId)
        .eq("item_name", item_name);

      if (error) {
        console.error("Supabase DELETE error:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message }),
        };
      }

      console.log("Item deleted successfully");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: "deleted",
          item_name: item_name
        }),
      };
    } catch (err) {
      console.error("DELETE items error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error: " + err.message }),
      };
    }
  }

  // それ以外
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method Not Allowed" }),
  };
};
