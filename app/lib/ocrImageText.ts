const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export async function ocrImageText(file: File): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY missing.");
    error.name = "EXTRACTION_NOT_CONFIGURED";
    throw error;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  const base64 = bytes.toString("base64");
  const imageUrl = `data:${mimeType};base64,${base64}`;
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Extract all text exactly as seen. Preserve line breaks. No interpretation.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all readable text from this image. Preserve line breaks.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Image OCR request failed.");
  }

  const json = (await response.json()) as OpenAIChatResponse;
  return (json.choices?.[0]?.message?.content ?? "").trim();
}
