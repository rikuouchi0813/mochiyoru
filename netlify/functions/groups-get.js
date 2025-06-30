// netlify/functions/groups-get.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  console.log("=== Groups GET Function Called ===");
  console.log("Method:", event.httpMethod);
  console.log("Path:", event.path);
  console.log("Query:", event.queryStringParameters);

  // CORS設定
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  // プリフライトリクエスト処理
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // groupIdを複数の方法で取得を試行
  let groupId = null;

  // 方法1: クエリパラメータから
  if (event.queryStringParameters && event.queryStringParameters.groupId) {
    groupId = event.queryStringParameters.groupId;
    console.log("groupId from query:", groupId);
  }

  // 方法2: パスから抽出
  if (!groupId && event.path) {
    const pathMatch = event.path.match(/\/api\/groups\/([^\/\?]+)/);
    if (pathMatch) {
      groupId = pathMatch[1];
      console.log("groupId from path regex:", groupId);
    }
  }

  // 方法3: パスセグメントから（従来の方法）
  if (!groupId && event.path) {
    const pathSegments = event.path.split("/");
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment && lastSegment !== "groups-get" && lastSegment !== "groups") {
      groupId = lastSegment;
      console.log("groupId from segments:", groupId);
    }
  }

  console.log("Final groupId:", groupId);

  if (!groupId || groupId === "groups-get") {
    console.error("No valid groupId provided");
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Group ID is required" }),
    };
  }

  try {
    console.log("Querying Supabase for groupId:", groupId);
    
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("group_id", groupId)
      .single();

    if (error) {
      console.error("Supabase select error:", error);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Group not found" }),
      };
    }

    console.log("Supabase data found:", data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        groupId: data.group_id,
        groupName: data.group_name,
        members: data.members,
        createdAt: data.created_at,
      }),
    };
  } catch (err) {
    console.error("GET group error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
