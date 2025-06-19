export async function GET() {
  return new Response(
    JSON.stringify({
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  )
}
