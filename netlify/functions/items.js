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

      const items = data.map((d) => ({
        name: d.item_name,
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
      const {
        name: item_name,
        quantity = null,
        assignee = "",
      } = JSON.parse(event.body);

      console.log("POST request with item:", { item_name, quantity, assignee });

      if (!item_name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "item name required" }),
        };
      }

      const { error } = await supabase.from("items").upsert(
        [
          {
            group_id: groupId,
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
        body: JSON.stringify({ message: "saved" }),
      };
    } catch (err) {
      console.error("POST items error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  }

  // 削除 -----------------------------------------------------
  if (event.httpMethod === "DELETE") {
    try {
      const { name: item_name } = JSON.parse(event.body);

      console.log("DELETE request for item:", { item_name, groupId });

      if (!item_name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "item name required" }),
        };
      }

      const { error } = await supabase
        .from("items")
        .delete()
        .eq("group_id", groupId)
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
        body: JSON.stringify({ message: "deleted" }),
      };
    } catch (err) {
      console.error("DELETE items error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error" }),
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
