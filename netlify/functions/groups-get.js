// netlify/functions/groups-get.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const handler = async (event, context) => {
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

  // URLからgroupIdを取得
  const path = event.path;
  const pathSegments = path.split("/");
  const groupId = pathSegments[pathSegments.length - 1];

  console.log("Group GET for:", groupId);

  if (!groupId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Group ID is required" }),
    };
  }

  try {
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
