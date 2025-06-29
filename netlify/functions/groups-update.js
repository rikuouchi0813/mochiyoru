// netlify/functions/groups-update.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const handler = async (event, context) => {
  console.log("=== Groups Update Function Called ===");
  console.log("Method:", event.httpMethod);
  console.log("Path:", event.path);
  console.log("Body:", event.body);

  // CORS設定
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // プリフライトリクエスト処理
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
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

  console.log("Group update for:", groupId);

  if (!groupId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Group ID is required" }),
    };
  }

  try {
    const { groupName, members } = JSON.parse(event.body);

    if (!groupName || !Array.isArray(members)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid request data" }),
      };
    }

    const { error } = await supabase
      .from("groups")
      .update({
        group_name: groupName,
        members: members,
      })
      .eq("group_id", groupId);

    if (error) {
      console.error("Supabase update error:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to update group" }),
      };
    }

    console.log("Group updated successfully:", { groupId, groupName, members });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Group updated successfully",
        groupId: groupId,
        groupName: groupName,
        members: members,
      }),
    };
  } catch (err) {
    console.error("Update group error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
