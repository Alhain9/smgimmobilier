// Boucle agent — moteur Groq, API compatible OpenAI (function calling).
// L'IA orchestre lecture / analyse / document / écriture.
// Sécurité : un outil d'ÉCRITURE n'est jamais exécuté tant que l'utilisateur n'a pas confirmé.
const { TOOLS, WRITE_TOOLS, executeTool, resumeAction } = require('./tools');

const SYSTEM = `Tu es l'assistant interne de SMG IMMOBILIER, une société de gestion locative au Cameroun.
- Réponds en français, de façon concise (chat mobile). Les montants sont en FCFA.
- N'invente JAMAIS de données : toute information vient d'un appel d'outil réel. Si une donnée n'est pas disponible, dis-le.
- Utilise les outils pour répondre, analyser, rédiger ou agir. Si une information manque (ex: le mois), demande-la.
- Pour toute ACTION d'écriture (enregistrer un paiement, déclarer un incident, changer un statut, envoyer une relance) : décris d'abord clairement ce que tu vas faire et demande la confirmation de l'utilisateur AVANT d'appeler l'outil. N'exécute jamais une écriture sans confirmation explicite.
- Pour rédiger un document (quittance, relance, rapport), récupère les vraies données via 'rediger_document' puis rédige un texte clair et professionnel.`;

const KEY = () => process.env.GROQ_API_KEY;
const BASE_URL = () => (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
const MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_TURNS = 5;

// Convertit les définitions d'outils (format Anthropic) au format function-calling OpenAI/Groq
function openAiTools() {
  return TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

// Appel à l'API Groq (compatible OpenAI : POST /chat/completions)
async function callGroq(messages) {
  if (!KEY()) {
    throw Object.assign(new Error('Assistant IA non configuré : clé GROQ_API_KEY manquante.'), { status: 503 });
  }
  const res = await fetch(`${BASE_URL()}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
    body: JSON.stringify({
      model: MODEL(), messages, tools: openAiTools(), tool_choice: 'auto', temperature: 0.3, max_tokens: 1024,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json && json.error;
    const msg = (e && (e.message || e)) || `Erreur Groq (${res.status})`;
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: 502 });
  }
  return json;
}

// historique : [{ role:'user'|'assistant', content:'texte' }] (texte seul, pour le suivi de conversation)
async function chat(message, ctx, historique = []) {
  const messages = [
    { role: 'system', content: SYSTEM },
    ...historique.map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '') })),
    { role: 'user', content: message },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const data = await callGroq(messages);
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    const toolCalls = msg.tool_calls || [];

    if (toolCalls.length) {
      const parse = (tc) => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return {}; } };

      // Action d'écriture non confirmée → on stoppe et on demande confirmation (on N'exécute PAS).
      const write = toolCalls.find((tc) => WRITE_TOOLS.has(tc.function.name));
      if (write && !ctx.confirmer) {
        const input = parse(write);
        const resume = resumeAction(write.function.name, input);
        const texte = String(msg.content || '').trim();
        return {
          reponse: texte || `${resume}\n\nConfirmez-vous cette action ?`,
          action_en_attente: { tool: write.function.name, input, resume },
        };
      }

      // Exécute chaque appel d'outil et renvoie les résultats (rôle 'tool')
      messages.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let result;
        try { result = await executeTool(tc.function.name, parse(tc), ctx); }
        catch (e) { result = { erreur: e.message || "Erreur lors de l'appel de l'outil" }; }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }

    // Réponse finale
    const texte = String(msg.content || '').trim();
    return { reponse: texte || "Je n'ai pas pu produire de réponse." };
  }

  return { reponse: "Désolé, la demande nécessite trop d'étapes. Pouvez-vous la reformuler plus simplement ?" };
}

module.exports = { chat };
