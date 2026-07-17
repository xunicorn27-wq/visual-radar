import type { IntelItem } from "./intelItem";
import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  normalizeVisualRadarAnalysis,
  type RawVisualRadarAnalysis,
  type VisualRadarAnalysis,
} from "./visualRadarAnalysis";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

type FetchLike = (
  url: string,
  init: RequestInit
) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

interface OpenAiVisualRadarProviderOptions {
  apiKey: string;
  fetch?: FetchLike;
  model?: string;
}

export type OpenAiVisualRadarProvider = (
  items: IntelItem[],
  options?: { analyzedAt?: string }
) => Promise<VisualRadarAnalysis[]>;

export function getConfiguredOpenAiVisualRadarProvider(): OpenAiVisualRadarProvider | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  return createOpenAiVisualRadarProvider({
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
  });
}

export function createOpenAiVisualRadarProvider(
  options: OpenAiVisualRadarProviderOptions
): OpenAiVisualRadarProvider {
  return async (items, runOptions = {}) => {
    if (items.length === 0) return [];

    const fetchImpl = options.fetch || (globalThis.fetch as FetchLike);
    if (!fetchImpl) throw new Error("OpenAI provider requires fetch support.");

    const model = options.model || DEFAULT_OPENAI_MODEL;
    const analyzedAt = runOptions.analyzedAt || new Date().toISOString();
    const response = await fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: JSON.stringify({
              items: items.map(toPromptItem),
              output_contract: {
                results:
                  "数组，每项包含 itemId、中文标题 chineseTitle、可独立阅读的中文编辑稿 chineseSummary、primaryTopic、trendKeywords、selectionRationale 和六项 scoreBreakdown。chineseSummary 必须为 180至260个中文字符，覆盖事件背景、核心内容以及对摄影、造型或视觉工作的具体启发；selectionRationale 为 50至90个中文字符的编辑观察。",
              },
              promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
            }),
          },
        ],
        model,
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `OpenAI visual analysis failed (${response.status}): ${readProviderErrorCode(detail)}`
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI visual analysis returned no content.");

    const itemById = new Map(items.map((item) => [item.id, item]));
    return parseProviderResults(content).flatMap((result) => {
      const item =
        typeof result.itemId === "string" ? itemById.get(result.itemId) : undefined;
      if (!item) return [];

      return [
        normalizeVisualRadarAnalysis(result, {
          analyzedAt,
          contentHash: item.contentHash,
          itemId: item.id,
          model,
        }),
      ];
    });
  };
}

function readProviderErrorCode(detail: string) {
  try {
    const payload = JSON.parse(detail) as { error?: { code?: unknown } };
    return typeof payload.error?.code === "string"
      ? payload.error.code
      : "request_failed";
  } catch {
    return "request_failed";
  }
}

function buildSystemPrompt() {
  return [
    "你是一名独立视觉文化杂志编辑。",
    "只依据提供的标题、摘要、来源、主题、发布时间和证据链接进行判断。",
    "所有标题、摘要、入选理由和趋势词必须使用简体中文。",
    "chineseSummary 不是导流短摘要，而是可独立阅读的中文编辑稿，长度为 180至260个中文字符。",
    "中文编辑稿必须依次说明事件背景、核心信息，以及它对摄影、造型、视觉文化或创作方法的具体启发。",
    "selectionRationale 应写成 50至90个中文字符的编辑观察，补充为什么值得团队关注，不要重复摘要。",
    "不要补充输入中不存在的人物、数字、观点或事件。",
    "评分维度上限：visualInspiration 30，novelty 20，professionalRelevance 20，informationSpecificity 15，sourceQuality 10，timeliness 5。",
    "primaryTopic 只能是 creator、exhibition、fashion_culture、magazine、outfit、photography、styling、tool。",
    "只返回符合 output_contract 的 JSON 对象。",
  ].join("\n");
}

function toPromptItem(item: IntelItem) {
  return {
    contentHash: item.contentHash,
    evidenceUrl: item.provenance.evidenceUrl,
    itemId: item.id,
    keywords: item.keywords || [],
    language: item.lang,
    market: item.market,
    postedAt: item.postedAt,
    sourceAccount: item.sourceAccount,
    sourceUrl: item.sourceUrl,
    summary: item.text,
    title: item.title,
  };
}

function parseProviderResults(content: string) {
  const parsed = JSON.parse(extractJsonObject(content)) as {
    results?: Array<RawVisualRadarAnalysis & { itemId?: unknown }>;
  };
  return Array.isArray(parsed.results) ? parsed.results : [];
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed;
}
