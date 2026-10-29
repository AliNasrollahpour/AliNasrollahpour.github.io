// سیستم‌پرامپت‌ها مستقیماً از AGENTS.md خوانده می‌شوند تا یک منبع بماند.
// اگر تیم نسخهٔ اصلیِ AGENTS.md را جایگزین کند، کافی است همین فایلِ md عوض شود.
import agentsMd from './AGENTS.md?raw';
import type { AgentName } from './game-data';

export interface AgentPersona {
  name: AgentName;
  heading: string;
  /** متنِ توضیحیِ شخصیت (خلاصه، ضعف، ترس…) برای پنلِ حالت راهنما. */
  profile: string;
  /** بلوکِ «SYSTEM PROMPT» عیناً. */
  systemPrompt: string;
}

export interface ParsedAgents {
  context: string;
  sharedRules: string;
  personas: Record<AgentName, AgentPersona>;
}

const NAMES: AgentName[] = ['Maggie', 'Evy', 'Devan', 'Echo'];

export function parseAgentsMd(md: string): ParsedAgents {
  const chunks = md.replace(/\r\n/g, '\n').split(/\n-{3,}\n/);
  let context = '';
  let sharedRules = '';
  const personas = {} as Record<AgentName, AgentPersona>;

  for (const chunk of chunks) {
    const headingMatch = chunk.match(/^##\s+(.+)$/m);
    if (!headingMatch) continue;
    const heading = headingMatch[1].trim();
    const body = chunk.slice(chunk.indexOf(headingMatch[0]) + headingMatch[0].length).trim();

    if (heading.includes('قوانین مشترک')) {
      sharedRules = body;
      continue;
    }
    if (heading.includes('زمینه')) {
      context = body;
      continue;
    }
    const name = NAMES.find((n) => heading.includes(n));
    if (!name) continue;

    const promptStart = body.search(/^>\s*###\s*SYSTEM PROMPT/m);
    const profile = (promptStart >= 0 ? body.slice(0, promptStart) : body).trim();
    const systemPrompt = promptStart >= 0
      ? body
          .slice(promptStart)
          .split('\n')
          .slice(1) // سطرِ عنوانِ «### SYSTEM PROMPT — X»
          .map((l) => l.replace(/^>\s?/, ''))
          .join('\n')
          .trim()
      : '';
    personas[name] = { name, heading, profile, systemPrompt };
  }
  return { context, sharedRules, personas };
}

export const agentsDoc = parseAgentsMd(agentsMd);
