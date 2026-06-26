// Configurações: conta Google + Drive, chave Gemini (SecureStore), modelo,
// voz da leitura (Gemini TTS), pilares (CRUD), regras extras da IA e defaults
// de exibição.
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { PeriodSegment } from '../components/PeriodSegment';
import { ScreenContainer } from '../components/ScreenContainer';
import { StarsRuler } from '../components/StarsRuler';
import { MODEL_PRESETS } from '../constants/defaults';
import { GEMINI_VOICES } from '../services/geminiTTS';
import {
  checkForUpdate,
  getCurrentVersion,
  type UpdateInfo,
} from '../services/updateChecker';
import { useReadAloud } from '../hooks/useReadAloud';
import { useAppStore } from '../store/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

const VOICE_SAMPLE =
  'Esta é a voz que vai ler os resumos dos seus vídeos em voz alta.';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.secTitle}>{title}</Text>
      {sub ? <Text style={styles.secSub}>{sub}</Text> : null}
      {children}
    </Card>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const {
    user,
    geminiKey,
    model,
    pillars,
    rules,
    minStars,
    period,
    ttsVoice,
    noteLang,
    setGeminiKey,
    setModel,
    setRules,
    setMinStars,
    setPeriod,
    setTtsVoice,
    setNoteLang,
    googleSignIn,
    googleSignOut,
  } = useAppStore();

  const [keyDraft, setKeyDraft] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [modelDraft, setModelDraft] = useState(model);
  const [rulesDraft, setRulesDraft] = useState(rules);
  const [rulesSaved, setRulesSaved] = useState(false);
  const sample = useReadAloud();

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [upToDate, setUpToDate] = useState(false);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpToDate(false);
    try {
      const info = await checkForUpdate(true);
      setUpdateInfo(info);
      setUpToDate(!info.available);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const downloadUpdate = () => {
    const url = updateInfo?.downloadUrl ?? updateInfo?.releaseUrl;
    if (url) Linking.openURL(url);
  };

  const maskedKey = geminiKey
    ? `••••••••${geminiKey.slice(-4)}`
    : 'nenhuma chave configurada';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topbar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.back}>‹ Voltar</Text>
          </Pressable>
          <Text style={styles.title}>Configurações</Text>
          <View style={{ width: 60 }} />
        </View>

        <Section
          title="Conta Google"
          sub="Inscrições do YouTube (somente leitura) e notas no Drive."
        >
          {user ? (
            <View>
              <View style={styles.userRow}>
                {user.photo ? (
                  <Image source={{ uri: user.photo }} style={styles.avatar} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
              </View>
              <Text style={styles.driveStatus}>
                ✓ Notas salvas em Drive › Aspis (sincronize essa pasta com o vault do desktop).
              </Text>
              <Button
                label="Sair da conta"
                variant="secondary"
                onPress={googleSignOut}
                style={{ marginTop: spacing.lg }}
              />
            </View>
          ) : (
            <Button label="Conectar conta Google" onPress={() => googleSignIn()} />
          )}
        </Section>

        <Section
          title="Chave Gemini"
          sub="A análise roda no aparelho com a SUA chave (fica no Keystore do Android, nunca em texto plano)."
        >
          <Text style={styles.masked}>{maskedKey}</Text>
          <TextInput
            style={styles.input}
            value={keyDraft}
            onChangeText={(t) => {
              setKeyDraft(t);
              setKeySaved(false);
            }}
            placeholder="Cole a chave aqui (AIza…)"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <View style={styles.rowGap}>
            <Button
              label={keySaved ? '✓ Salva' : 'Salvar chave'}
              fullWidth={false}
              onPress={async () => {
                await setGeminiKey(keyDraft);
                setKeyDraft('');
                setKeySaved(true);
              }}
              disabled={!keyDraft.trim()}
            />
            <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
              <Text style={styles.link}>obter uma chave →</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="Modelo" sub="O mesmo cérebro do desktop. Edite se quiser outro modelo Gemini.">
          <View style={styles.chips}>
            {MODEL_PRESETS.map((m) => (
              <Chip
                key={m}
                label={m}
                active={modelDraft === m}
                onPress={() => {
                  setModelDraft(m);
                  setModel(m);
                }}
              />
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: spacing.md }]}
            value={modelDraft}
            onChangeText={setModelDraft}
            onEndEditing={() => modelDraft.trim() && setModel(modelDraft.trim())}
            placeholder="nome exato do modelo"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Section>

        <Section
          title="Voz da leitura"
          sub="Voz do Gemini que lê os resumos em voz alta. Toque para escolher e ouvir uma amostra."
        >
          <View style={styles.chips}>
            {GEMINI_VOICES.map((v) => (
              <Chip
                key={v.name}
                label={`${v.label} · ${v.gender === 'female' ? '♀' : '♂'}`}
                active={ttsVoice === v.name}
                onPress={() => setTtsVoice(v.name)}
              />
            ))}
          </View>
          <Text style={styles.voiceDesc}>
            {GEMINI_VOICES.find((v) => v.name === ttsVoice)?.description ?? ''}
          </Text>
          <Pressable
            onPress={() => sample.toggle(VOICE_SAMPLE, ttsVoice, geminiKey)}
            style={({ pressed }) => [styles.sampleBtn, pressed && { opacity: 0.7 }]}
          >
            {sample.status === 'loading' ? (
              <ActivityIndicator size="small" color={colors.accent.gold} />
            ) : (
              <Text style={styles.sampleLabel}>
                {sample.status === 'playing' ? '■ Parar amostra' : '▶ Ouvir amostra'}
              </Text>
            )}
          </Pressable>
          {sample.error && <Text style={styles.voiceErr}>{sample.error}</Text>}
        </Section>

        <Section
          title="Idioma das notas"
          sub="Em que idioma a IA escreve resumo, pontos-chave, evidências e citações."
        >
          <View style={styles.chips}>
            <Chip
              label="Português (pt-BR)"
              active={noteLang === 'pt-BR'}
              onPress={() => setNoteLang('pt-BR')}
            />
            <Chip
              label="Idioma original do vídeo"
              active={noteLang === 'original'}
              onPress={() => setNoteLang('original')}
            />
          </View>
          <Text style={styles.voiceDesc}>
            {noteLang === 'pt-BR'
              ? 'Vídeos em outro idioma são traduzidos para o português.'
              : 'Cada nota fica no idioma original do vídeo (igual ao desktop).'}
          </Text>
        </Section>

        <Section
          title="Pilares"
          sub="Os seus objetivos de vida — a IA classifica e pontua cada vídeo por eles."
        >
          {pillars.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => navigation.navigate('PillarEdit', { pillarId: p.id })}
              style={({ pressed }) => [styles.pillarRow, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.pillarName}>{p.nome}</Text>
                <Text style={styles.pillarDesc} numberOfLines={1}>
                  {p.descricao}
                </Text>
              </View>
              <Text style={styles.pillarPeso}>peso {p.peso}</Text>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}
          <Button
            label="+ Adicionar pilar"
            variant="secondary"
            onPress={() => navigation.navigate('PillarEdit', {})}
            style={{ marginTop: spacing.lg }}
          />
        </Section>

        <Section
          title="Critérios extras da IA"
          sub="Texto livre injetado no prompt (cada linha vira uma regra)."
        >
          <TextInput
            style={[styles.input, styles.multiline]}
            value={rulesDraft}
            onChangeText={(t) => {
              setRulesDraft(t);
              setRulesSaved(false);
            }}
            multiline
            placeholderTextColor={colors.text.tertiary}
          />
          <Button
            label={rulesSaved ? '✓ Salvas' : 'Salvar regras'}
            fullWidth={false}
            onPress={async () => {
              await setRules(rulesDraft);
              setRulesSaved(true);
            }}
            style={{ marginTop: spacing.md }}
          />
        </Section>

        <Section title="Exibição" sub="Estrelas mínimas para um vídeo aparecer e período padrão.">
          <StarsRuler value={minStars} onChange={setMinStars} />
          <View style={{ marginTop: spacing.lg, alignItems: 'flex-start' }}>
            <PeriodSegment value={period} onChange={setPeriod} />
          </View>
        </Section>

        <Section title="Atualizações" sub="O app é distribuído por APK no GitHub.">
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Versão instalada</Text>
            <Text style={styles.versionValue}>v{getCurrentVersion()}</Text>
          </View>

          {updateInfo?.available && updateInfo.latestVersion ? (
            <View style={styles.updateBox}>
              <Text style={styles.updateTitle}>
                Nova versão disponível: v{updateInfo.latestVersion}
              </Text>
              {updateInfo.notes ? (
                <Text style={styles.updateNotes} numberOfLines={6}>
                  {updateInfo.notes}
                </Text>
              ) : null}
              <Button
                label={updateInfo.downloadUrl ? 'Baixar APK' : 'Abrir release no GitHub'}
                onPress={downloadUpdate}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : (
            <Button
              label={checkingUpdate ? 'Verificando…' : 'Verificar atualizações'}
              variant="secondary"
              disabled={checkingUpdate}
              onPress={handleCheckUpdate}
              style={{ marginTop: spacing.md }}
            />
          )}
          {upToDate && !updateInfo?.available && (
            <Text style={styles.upToDate}>✓ Você está na versão mais recente.</Text>
          )}
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  back: { ...typography.body, color: colors.accent.gold, width: 60 },
  title: { ...typography.subtitle, color: colors.text.primary },
  section: { gap: 2 },
  secTitle: { ...typography.subtitle, fontSize: 16, color: colors.text.primary },
  secSub: { ...typography.small, color: colors.text.secondary, marginBottom: spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  userName: { ...typography.bodyMedium, color: colors.text.primary },
  userEmail: { ...typography.small, color: colors.text.secondary },
  driveStatus: { ...typography.small, color: colors.accent.success, marginTop: spacing.md },
  masked: { ...typography.small, color: colors.text.secondary, marginBottom: spacing.sm },
  input: {
    ...typography.small,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  multiline: { minHeight: 116, textAlignVertical: 'top' },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  link: { ...typography.small, color: colors.accent.gold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  voiceDesc: { ...typography.small, color: colors.text.secondary, marginTop: spacing.sm },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  versionLabel: { ...typography.small, color: colors.text.secondary },
  versionValue: { ...typography.bodyMedium, color: colors.text.primary },
  updateBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.gold,
    backgroundColor: colors.bg.surface,
  },
  updateTitle: { ...typography.bodyMedium, color: colors.text.primary },
  updateNotes: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  upToDate: { ...typography.small, color: colors.accent.success, marginTop: spacing.md },
  sampleBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: 7,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent.gold,
    minWidth: 140,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleLabel: { ...typography.small, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
  voiceErr: { ...typography.small, color: colors.accent.danger, marginTop: spacing.sm },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pillarName: { ...typography.bodyMedium, fontSize: 15, color: colors.text.primary },
  pillarDesc: { ...typography.small, color: colors.text.secondary },
  pillarPeso: { ...typography.label, color: colors.text.tertiary },
  chev: { fontSize: 20, color: colors.text.tertiary },
});
