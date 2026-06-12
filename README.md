# Aspis — Android

Companion Android do **Aspis** (macOS): um curador de YouTube a serviço dos seus
objetivos de vida. Em vez de assistir vídeos inteiros, a IA analisa cada vídeo,
dá um **score 0–100 de alinhamento com os seus pilares**, neutraliza o título
sensacionalista e produz uma síntese (resumo, pontos-chave, fatos memorizáveis
e citações com timestamp). Ler em 1 minuto em vez de assistir 30.

Ἀσπίς — "escudo". O logo é o escudo com a Medusa.

## Funcionalidades

1. **Compartilhar → Aspis** (caso de uso central): no app do YouTube ou no
   navegador, toque Compartilhar → Aspis. O app extrai o vídeo, analisa
   (a IA *assiste* o vídeo via Gemini `fileUri` → legendas públicas → só
   metadados) e mostra a síntese, com ações: Salvar nota (Drive), Copiar,
   Abrir no YouTube, Perguntar (Q&A) e Descartar.
2. **Feed de inscrições ranqueado**: login Google (`youtube.readonly`) →
   inscrições → uploads playlists → vídeos novos do período → análise IA →
   lista ranqueada com estrelas, pills de pilar e avatar do canal. Filtros:
   pilar, estrelas mínimas (régua de gradiente), período Dia/Semana/Mês,
   mostrar/ocultar lidos. Pipeline de baixa quota idêntico ao desktop
   (**nunca** `search.list`).
3. **Notas no Google Drive** (`drive.file`): "Salvar nota" grava
   `Drive:/Aspis/{Título neutro} ({video_id}).md` no formato **exato** do
   `obsidian.py` do desktop (frontmatter, Resumo, Pontos-chave, Citações,
   link `[[Pilar - MOC]]`). Salvar de novo **atualiza** em vez de duplicar.
4. **Configurações**: chave Gemini do usuário (SecureStore/Keystore), modelo
   selecionável (default `gemini-3.5-flash`, o mesmo do desktop), pilares
   editáveis (nome, descrição, quero/não quero, peso 1–5), regras extras da
   IA, estrelas mínimas e período default.

## Sincronização com o Aspis desktop (sem mudar o desktop)

Os dois apps escrevem o **mesmo formato de nota** na **mesma pasta**:

1. Instale o [Google Drive for Desktop](https://www.google.com/drive/download/)
   no Mac e ative o espelhamento ("Mirror files").
2. No Aspis desktop (`~/.aspis/config.yaml`), aponte o vault para a pasta
   espelhada do Drive, por exemplo:
   ```yaml
   obsidian:
     vault_path: "~/Google Drive/My Drive"   # a pasta Aspis/ fica dentro dela
   ```
   (ou aponte o vault do Obsidian para essa pasta). O desktop grava em
   `{vault}/Aspis/…`; o Android grava em `Drive:/Aspis/…` — a mesma pasta.
3. Pronto: nota salva no celular aparece no vault do Mac e vice-versa.

> Nota: com o escopo mínimo `drive.file`, o app só enxerga arquivos que ele
> mesmo criou. Se já existir uma pasta `Aspis` criada manualmente no Drive, o
> app criará a dele própria — deixe o app criar a pasta na primeira nota e use
> essa.

## Stack

- Expo SDK 54 + React Native 0.81 + TypeScript (dark mode only)
- SQLite local (espelha as colunas da tabela `videos` do desktop)
- `expo-secure-store` para a chave Gemini (Android Keystore)
- `expo-share-intent` (ACTION_SEND `text/plain`)
- `@react-native-google-signin/google-signin` (escopos `youtube.readonly` + `drive.file`)
- Identidade visual do CoMentor: paleta `#1B1F3B`/dourado `#F4C553`,
  Nunito (display) + Inter (corpo)
- Análise: API Gemini REST com a chave do usuário — **sem backend**

## Google Cloud (projeto "Aspis", `clipeo-498021`)

Já feito:
- Tela de consentimento OAuth publicada (Em produção), YouTube Data API v3 e
  Google Drive API habilitadas.

Falta (uma vez, no Console — não dá para criar via gcloud):
1. [console.cloud.google.com/auth/clients](https://console.cloud.google.com/auth/clients?project=clipeo-498021)
   → **Create client** → Application type: **Android**.
2. Package name: `com.claudiogonzaga.aspis`
3. SHA-1: `63:33:6D:EF:59:66:76:11:AE:7E:5E:B8:91:87:0E:1D:2B:69:51:FB`
   (do keystore local em `credentials/android.keystore`; para reimprimir:
   `keytool -list -v -keystore credentials/android.keystore -alias aspis`)
4. Salvar. Não é preciso baixar nada — no Android o cliente é casado
   automaticamente por package + SHA-1, sem segredo embarcado no app.

Sem esse passo o login Google falha com `DEVELOPER_ERROR` (o share + análise
com chave Gemini funcionam mesmo assim).

## Desenvolvimento

```bash
npm install
npx expo start          # com um development build instalado
npm run typecheck
```

## Build (EAS) e distribuição

O keystore é **local** (`credentials.json` + `credentials/android.keystore`,
fora do git). **Faça backup dos dois** — perder o keystore = não poder
atualizar o app instalado.

```bash
eas build -p android --profile production   # gera APK
./scripts/release.sh 1.0.0 ./builds/aspis-1.0.0.apk "Notas da release"
```

### Instalar no aparelho

1. Baixe o `.apk` da release no GitHub pelo celular.
2. Toque no arquivo baixado e aceite "instalar app desconhecido" para o
   navegador/Files quando o Android pedir.
3. Abra o Aspis → Configurações → cole a chave Gemini → conecte a conta
   Google. Teste: YouTube → Compartilhar → Aspis.
