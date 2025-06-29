// netlify/functions/groups-create.js
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const handler = async (event, context) => {
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

  try {
    const { groupName, members } = JSON.parse(event.body);

    if (!groupName || !Array.isArray(members)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid payload" }),
      };
    }

    const groupId = uuidv4();

    // Supabaseのgroupsテーブルに保存
    const { data, error } = await supabase
      .from("groups")
      .insert([
        {
          group_id: groupId,
          group_name: groupName,
          members: members,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to create group" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ groupId }),
    };
  } catch (err) {
    console.error("Failed to save group:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to save group" }),
    };
  }
};
