import { GoogleGenerativeAI } from '@google/generative-ai';
import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchPageText(url) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ userAgent: UA, locale: 'pt-BR' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body.innerText);
    return text.replace(/\s+/g, ' ').trim().slice(0, 8000);
  } catch (e) {
    console.error('fetchPageText error:', e.message);
    return '';
  } finally {
    await browser.close();
  }
}

function getModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

function getSearchModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });
}

export async function searchJobLinks(site, keyword, urlPattern) {
  const prompt = `Busque no Google: site:${site} "${keyword}" vaga emprego remoto 2025 2026

Liste até 15 vagas individuais encontradas. Retorne APENAS JSON válido:
{"jobs": [{"url": "URL completa da vaga", "title": "título", "company": "empresa"}]}

Só inclua URLs que contenham "${urlPattern}" — ignore páginas de busca, categorias ou empresas.
Se não encontrar nenhuma, retorne: {"jobs": []}`;

  try {
    const result = await getSearchModel().generateContent(prompt);
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
    console.log('[searchJobLinks raw]', text.slice(0, 500));
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] || text);
    const jobs = (data.jobs || [])
      .filter(j => j.url && j.url.includes(urlPattern))
      .map(j => ({ url: j.url, title: j.title || 'Vaga', company: j.company || 'N/A' }));
    console.log('[searchJobLinks]', site, keyword, '->', jobs.length, 'vagas');
    return jobs;
  } catch (e) {
    console.error('searchJobLinks error:', e.message);
    return [];
  }
}

export async function evaluateJob(url, profile) {
  const profileText = `
Profissão: ${profile.profession} | Nível: ${profile.level} | Modalidade: ${profile.modality} | Preferência de país: ${profile.country_preference || 'brazil'}
Localização: ${profile.location}
Resumo: ${profile.summary}
Hard Skills: ${profile.hard_skills}
Soft Skills: ${profile.soft_skills}
Idiomas: ${profile.languages}
Histórico: ${profile.work_history}
Salário pretendido: R$${profile.salary_min} - R$${profile.salary_max}
Tipos de empresa preferidos: ${profile.company_types}
Setores de interesse: ${profile.sectors_interest}
Setores a evitar: ${profile.sectors_avoid}
O que não quer: ${profile.dealbreakers}
  `.trim();

  const prompt = `
Você é um assistente de busca de empregos. Acesse a URL da vaga abaixo e avalie a compatibilidade com o perfil do candidato.

URL da vaga: ${url}

Perfil do candidato:
${profileText}

Use APENAS as informações presentes no conteúdo da vaga. NÃO invente nada.
Se um campo não estiver no conteúdo, use null. Nunca adivinhe ou complete com dados que não estão lá.

Retorne APENAS um JSON válido com esta estrutura:
{
  "title": "título exato da vaga ou null",
  "company": "nome exato da empresa ou null",
  "location": "cidade/estado exatos ou null",
  "country": "brazil",
  "modality": "remoto|presencial|hibrido ou null",
  "level": "junior|pleno|senior ou null",
  "description": "texto da descrição copiado do conteúdo, sem inventar",
  "score": 4.2,
  "score_reason": "explicação em 2-3 frases baseada no conteúdo real"
}

O campo "country" deve ser "brazil" se a vaga é para trabalhar no Brasil ou remoto para empresa brasileira.
Para qualquer outro país coloque o nome do país em inglês minúsculo (ex: "usa", "portugal", "argentina").

O score vai de 0 a 5:
- 5.0: match perfeito
- 4.0+: muito boa
- 3.0+: vale considerar
- 2.0+: pouco alinhada
- abaixo de 2: não recomendada

REGRAS DE NÍVEL (importante):
- Se o candidato é JÚNIOR e a vaga é pleno/sênior: score máximo 2.5
- Se o candidato é PLENO e a vaga é sênior: score máximo 3.0
- Se o candidato é PLENO e a vaga é júnior: score máximo 3.5
- Se o candidato é SÊNIOR e a vaga é júnior/pleno: score máximo 3.0
- Nível compatível não penaliza o score

REGRA DE PAÍS (importante):
- Se o candidato quer só Brasil (country_preference = brazil) e a vaga exige trabalhar fora do Brasil: score máximo 1.5
- Se o candidato aceita exterior (country_preference = any): país não penaliza o score
  `;

  const pageText = await fetchPageText(url);
  if (!pageText) throw new Error('Não foi possível carregar a página da vaga');

  const fullPrompt = prompt.replace(`URL da vaga: ${url}`, `Conteúdo da vaga (extraído de ${url}):\n${pageText}`);
  const result = await getModel().generateContent(fullPrompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(text);
}

export async function adaptCurriculumForJob(job, curriculum, customPrompt = null) {
  const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } };

  const competencias = parse(curriculum.competencies);
  const experiencias = parse(curriculum.work_history);
  const formacao = parse(curriculum.education);

  const curriculumText = `
Título: ${curriculum.title}
Subtítulo atual: ${curriculum.subtitle}
Resumo atual: ${curriculum.summary}
Competências: ${Array.isArray(competencias) ? competencias.join(', ') : competencias}
Experiências: ${JSON.stringify(experiencias, null, 2)}
Formação: ${JSON.stringify(formacao, null, 2)}
  `.trim();

  const prompt = `Você é um especialista em recrutamento e UX/UI Design. Vou te fornecer o currículo base de um candidato e a descrição de uma vaga. Sua tarefa é adaptar o currículo para maximizar o match com essa vaga, tanto para sistemas ATS quanto para recrutadores humanos.

Retorne APENAS um JSON válido, sem texto adicional, com esta estrutura:
{
  "subtitulo": "título do cargo adaptado à vaga",
  "resumo": "parágrafo de resumo profissional reescrito para a vaga",
  "competencias": ["lista de competências reordenada e ajustada"],
  "observacoes": "explique em 2-3 linhas o que foi alterado e por quê"
}

REGRAS DO RESUMO:
- Escreva sempre de forma impessoal, sem sujeito. Nunca use primeira pessoa ("Possuo", "Minha", "Busco") nem terceira pessoa ("O profissional", "Ele"). Comece diretamente com o cargo ou uma descrição, como: "UX/UI Designer com mais de 10 anos..."
- Adapte a linguagem e a ênfase do resumo base para espelhar o contexto da vaga, sem reescrever do zero
- É proibido afirmar experiência em segmentos, metodologias ou tecnologias que não estejam no currículo base. Se a vaga pede algo que não existe no currículo, ignore — não compense com afirmações genéricas
- Mencione o segmento da empresa quando relevante, usando "aderência ao contexto de [segmento]" se não houver experiência direta, nunca "sólida experiência em [segmento]"
- Nunca altere números e métricas. Se o base diz "7 produtos", mantenha "7 produtos"

REGRAS DAS COMPETÊNCIAS:
- Máximo de 14 itens
- Agrupe ferramentas relacionadas em um único item (ex: "Figma, FigJam, Framer" em vez de um item por ferramenta)
- Nunca duplique ferramentas: se já aparece dentro de uma suite (ex: Adobe Creative Suite), não liste separadamente
- Priorize os termos que o ATS provavelmente vai buscar, baseado nos requisitos da vaga
- Quando a vaga usar terminologia específica de metodologia (ex: triplo diamante, dual track, shape up), use exatamente esses termos, nunca substitua por equivalentes
- Inclua "OKRs" nas competências quando a vaga mencionar acompanhamento de métricas, metas ou objetivos de negócio

REGRAS GERAIS:
- Nunca invente experiências, projetos ou habilidades que não existam no currículo original
- Apenas reorganize, reescreva e adapte o que já existe
- O subtítulo deve usar o título exato da vaga ou o equivalente mais próximo

CURRÍCULO BASE:
${curriculumText}

VAGA:
Título: ${job.title}
Empresa: ${job.company}
Descrição: ${job.description || '(sem descrição disponível)'}${customPrompt ? `

INSTRUÇÕES ESPECÍFICAS PARA ESTA VERSÃO (têm prioridade sobre qualquer decisão anterior, mas nunca contradizem as regras obrigatórias acima):
${customPrompt}` : ''}`;

  const result = await getModel().generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch?.[0] || text);
}

export async function injectAdaptationsIntoHTML(templateHtml, adaptations) {
  const competenciasFormatadas = Array.isArray(adaptations.competencias)
    ? adaptations.competencias.join('\n- ')
    : adaptations.competencias;

  const prompt = `Você recebeu o HTML completo de um currículo profissional e novos valores adaptados para uma vaga específica.

Sua tarefa: localizar e substituir no HTML os conteúdos das seguintes seções pelos novos valores. Mantenha EXATAMENTE o mesmo layout, estilos CSS, estrutura HTML, classes, IDs e todo o restante do conteúdo inalterado — especialmente experiências, formação e dados de contato.

NOVOS VALORES A INJETAR:
- Subtítulo / cargo: ${adaptations.subtitulo}
- Resumo profissional: ${adaptations.resumo}
- Competências (lista completa, na ordem abaixo):
- ${competenciasFormatadas}

Retorne APENAS o HTML completo modificado, sem markdown, sem bloco de código, sem explicações.

HTML DO TEMPLATE:
${templateHtml}`;

  const result = await getModel().generateContent(prompt);
  return result.response.text().replace(/^```html\n?|\n?```$/g, '').trim();
}
