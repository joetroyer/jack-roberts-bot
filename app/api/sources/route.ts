import {
  getChannelsWithStats,
  addChannel,
  updateChannel,
  deleteChannel,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const channels = getChannelsWithStats();
    return Response.json({ channels });
  } catch (error) {
    console.error("Failed to fetch sources:", error);
    return Response.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, handle, channel_id, personality_prompt } = body;

    if (!name || !handle) {
      return Response.json(
        { error: "name and handle are required" },
        { status: 400 }
      );
    }

    // Use handle as channel_id if not provided
    const resolvedChannelId = channel_id || handle;

    const channel = addChannel(name, resolvedChannelId, handle, personality_prompt);
    return Response.json({ channel }, { status: 201 });
  } catch (error) {
    console.error("Failed to add source:", error);
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "A channel with this ID already exists"
        : "Failed to add source";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, personality_prompt, active, priority } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const channel = updateChannel(id, { personality_prompt, active, priority });
    if (!channel) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    return Response.json({ channel });
  } catch (error) {
    console.error("Failed to update source:", error);
    return Response.json(
      { error: "Failed to update source" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    deleteChannel(Number(id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete source:", error);
    return Response.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}
