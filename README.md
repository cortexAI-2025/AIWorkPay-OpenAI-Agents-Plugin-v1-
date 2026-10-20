# AIWorkPay OpenAI Agents Plugin (v1) — ⚠️ obsolète, non compatible avec l'API AIWorkPay actuelle

> **Ne l'utilisez pas pour commander de vraies missions.** Ce dépôt a été écrit pour une API (`/tasks`, séquestre « wallet »)
> qui n'existe pas dans AIWorkPay. Voir [AUDIT.md](AUDIT.md). Ce n'est pas une application ChatGPT officielle.
>
> Pour brancher un agent OpenAI à AIWorkPay :
> - **OpenAI Agents SDK** (vérifié, v0.24.0) : `MCPServerStreamableHttp` vers le serveur MCP AIWorkPay avec l'en-tête
>   `Authorization: Bearer awp_…` ;
> - **Python** : le SDK `aiworkpay` (v2) ;
> - **REST** : l'API des agents (`/api/missions`, …).

Le code d'origine est conservé tel quel (rien n'a été supprimé) à titre d'historique.
