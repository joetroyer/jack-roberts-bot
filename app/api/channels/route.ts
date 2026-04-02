import { getChannels } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const channels = getChannels();
    return Response.json({ channels });
  } catch (error) {
    console.error("Failed to fetch channels:", error);
    return Response.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}
