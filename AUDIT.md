# Audit du dépôt (2026-10-20)

## Constat

| Élément | Ce que fait le dépôt | Réalité de l'API AIWorkPay (Aiworkpay-v2) |
| --- | --- | --- |
| URL de base | `DEFAULT_BASE_URL = https://api.aiworkpay.com` (`src/tool.ts`) | le domaine de production est `aiworkpay.fr` ; `.com` n'est pas celui du service |
| Routes | `POST /tasks`, `/tasks/{id}/fund`, `/assign`, `/complete`, `/validate`, `GET /workers…`, balance | aucune de ces routes n'existe : les routes sont `/api/missions`, `/api/missions/{id}/approve`, `/request-changes`, `/cancel`, `/api/account`, `/api/transactions`, `/api/webhook` |
| Paiement | `EscrowManager` : registre de séquestre **en mémoire**, moyen de paiement par défaut « wallet » | le paiement passe par Stripe Checkout (un humain paie) ; il n'y a pas de portefeuille ; un registre en mémoire est perdu au redémarrage et ne retient aucun argent |
| Assignation | l'agent assigne un travailleur (`/assign`) | les Payworkers acceptent eux-mêmes une mission publiée ; un agent n'assigne personne |
| Statuts | `pending … paid` | `PAYMENT_PENDING, PUBLISHED, ASSIGNED, IN_PROGRESS, DELIVERED, COMPLETED, CANCELED` |
| Tests | aucun | |
| `ai-plugin.json` | format de plugin ChatGPT retiré par OpenAI | |
| README / licence | README absent ; licence MIT déclarée dans `package.json` seulement | |

## Conclusion

Le plugin ne peut pas fonctionner contre AIWorkPay. Il n'est pas un point d'entrée supporté. Le corriger reviendrait à
réécrire un client des routes `/api/missions`, ce que font déjà le SDK Python v2 et le serveur MCP, tous deux testés de bout
en bout. **Recommandation : le déprécier** (cette PR) et, si un paquet npm est souhaité, créer un client TypeScript mince à
partir de l'OpenAPI du backend plutôt que de réparer celui-ci.

## Compatibilité OpenAI réellement vérifiée

OpenAI Agents SDK 0.24.0 → serveur MCP AIWorkPay en Streamable HTTP avec clé Bearer : 13 outils listés, `get_account`
appelé avec succès, sur une instance de test locale (le serveur MCP hébergé n'est pas encore ouvert au public). ChatGPT (applications) n'est **pas**
compatible en l'état : il exige OAuth.

## Décisions laissées au propriétaire

Archiver le dépôt, ou le supprimer ; ajouter un fichier LICENSE si conservé.
