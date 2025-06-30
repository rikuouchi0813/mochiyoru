// netlify/functions/groups-create.js
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  console.log("=== Groups Create Function Called ===");
  console.log("Method:", event.httpMethod);
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

  try {
    const { groupName, members } = JSON.parse(event.body);
    console.log("Parsed data:", { groupName, members });

    if (!groupName || !Array.isArray(members)) {
      console.error("Invalid payload:", { groupName, members });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid payload" }),
      };
    }

    const groupId = uuidv4();
    console.log("Generated groupId:", groupId);

    // Supabaseのgroupsテーブルに保存
    console.log("Inserting to Supabase...");
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
        body: JSON.stringify({ error: "Failed to create group", details: error.message }),
      };
    }

    console.log("Supabase insert success:", data);

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
      body: JSON.stringify({ error: "Failed to save group", details: err.message }),
    };
  }
};
